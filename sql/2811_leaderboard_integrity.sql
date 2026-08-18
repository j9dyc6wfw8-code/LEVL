-- ============================================================================
-- 2811 — leaderboard integrity (STRUCT-01 / STRUCT-06)
-- APPLIED TO PRODUCTION 2026-08-18 as migrations:
--   server_side_leaderboard_integrity
--   align_derived_stats_with_client_definitions
--
-- THE PROBLEM
-- profiles carried every column the leaderboard sorts by, and the client wrote
-- all of them from its own local save. With a backup-code importer that accepted
-- any pasted payload, a max-rank account took about a minute and nothing
-- server-side would notice.
--
-- WHAT THIS FIXES, AND WHAT IT HONESTLY DOES NOT
-- weekly_xp, best_e1rm, best_lift_name and consistency are pure functions of the
-- workouts table, so they are DERIVED server-side and the client no longer holds
-- UPDATE on them.
--
-- xp and level are NOT fully derivable without porting the scoring engine into
-- SQL — social XP, first-session bonuses and pack rewards never reach workouts.
-- They stay client-written but are CLAMPED to the engine's own daily cap, which
-- does not make them provable but does stop the zero-to-Champion write.
--
-- The definitions below deliberately mirror the client's, because deriving a
-- number server-side is only an improvement if it still means the same thing.
--   weekly_xp   rolling 7 days (not the calendar week)
--   best_e1rm   Epley, normalised to KG so kg and lb users share one scale
--   consistency PERCENT of the last 28 days with any activity
-- ============================================================================

-- ---- plausibility guard on workout rows -----------------------------------
create or replace function public.levl_validate_workout()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.reps is not null and (new.reps < 0 or new.reps > 50) then
    raise exception 'workout rejected: reps % outside 0-50', new.reps using errcode = 'P0001';
  end if;
  if new.weight is not null and new.weight > (case when new.unit = 'lb' then 900 else 400 end) then
    raise exception 'workout rejected: weight % % above the plausible ceiling', new.weight, coalesce(new.unit,'kg') using errcode = 'P0001';
  end if;
  if new.duration is not null and new.duration > 360 then
    raise exception 'workout rejected: % minutes exceeds the daily cardio ceiling', new.duration using errcode = 'P0001';
  end if;
  if new.xp_earned is not null and (new.xp_earned < 0 or new.xp_earned > 4000) then
    raise exception 'workout rejected: xp_earned % outside 0-4000', new.xp_earned using errcode = 'P0001';
  end if;
  if new.date is not null and new.date > now() + interval '1 day' then
    raise exception 'workout rejected: dated in the future' using errcode = 'P0001';
  end if;
  return new;
end; $$;

drop trigger if exists levl_validate_workout_trg on public.workouts;
create trigger levl_validate_workout_trg
  before insert or update on public.workouts
  for each row execute function public.levl_validate_workout();

-- ---- derive the ranking columns from real workouts ------------------------
create or replace function public.levl_recompute_profile_stats(p_user uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_week_xp bigint; v_best numeric; v_best_name text; v_days int;
begin
  if p_user is null then return; end if;

  select coalesce(sum(w.xp_earned), 0) into v_week_xp
    from public.workouts w
   where w.user_id = p_user and w.date >= now() - interval '7 days';

  select round(max(
           (case when coalesce(w.reps,0) <= 1 then 1.0 else 1 + w.reps/30.0 end)
           * (w.weight * case when w.unit = 'lb' then 0.45359237 else 1 end)
         )::numeric, 1) into v_best
    from public.workouts w
   where w.user_id = p_user and coalesce(w.weight,0) > 0 and coalesce(w.kind,'lift') = 'lift';

  select w.exercise into v_best_name
    from public.workouts w
   where w.user_id = p_user and coalesce(w.weight,0) > 0 and coalesce(w.kind,'lift') = 'lift'
   order by (case when coalesce(w.reps,0) <= 1 then 1.0 else 1 + w.reps/30.0 end)
            * (w.weight * case when w.unit = 'lb' then 0.45359237 else 1 end) desc
   limit 1;

  select count(distinct (w.date at time zone 'UTC')::date) into v_days
    from public.workouts w
   where w.user_id = p_user and w.date >= now() - interval '28 days';

  update public.profiles
     set weekly_xp = coalesce(v_week_xp,0),
         best_e1rm = coalesce(v_best,0),
         best_lift_name = v_best_name,
         consistency = round((coalesce(v_days,0) / 28.0) * 100)
   where id = p_user;
end; $$;

create or replace function public.levl_workouts_touch_profile()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.levl_recompute_profile_stats(coalesce(new.user_id, old.user_id));
  return coalesce(new, old);
end; $$;

drop trigger if exists levl_workouts_touch_profile_trg on public.workouts;
create trigger levl_workouts_touch_profile_trg
  after insert or update or delete on public.workouts
  for each row execute function public.levl_workouts_touch_profile();

-- ---- clamp xp growth to the engine's own daily cap ------------------------
create or replace function public.levl_clamp_profile_progress()
returns trigger language plpgsql set search_path = '' as $$
declare elapsed_days numeric; allowance numeric;
begin
  if new.xp is null or old.xp is null or new.xp <= old.xp then return new; end if;
  elapsed_days := greatest(extract(epoch from (now() - coalesce(old.updated_at, now() - interval '1 day'))) / 86400.0, 0);
  allowance := (elapsed_days + 1) * 4000;   -- one day of headroom for offline catch-up
  if (new.xp - old.xp) > allowance then
    raise exception 'profile rejected: xp rose by % in % day(s), above the % cap',
      (new.xp - old.xp), round(elapsed_days,2), round(allowance) using errcode = 'P0001';
  end if;
  return new;
end; $$;

drop trigger if exists levl_clamp_profile_progress_trg on public.profiles;
create trigger levl_clamp_profile_progress_trg
  before update on public.profiles
  for each row execute function public.levl_clamp_profile_progress();

-- ---- take the derived columns away from the client ------------------------
revoke update on public.profiles from authenticated;
grant update (
  username, display_name, avatar, character,
  level, xp, coins, rank, league, streak, longest_streak,
  updated_at, last_active, username_set,
  terms_accepted_at, terms_version
) on public.profiles to authenticated;
