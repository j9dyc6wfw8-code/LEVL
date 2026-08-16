-- ============================================================================
-- LEVL BUILD 28 — SOCIAL XP LEDGER
--
-- Run AFTER 2804_social_storage.sql. Idempotent.
--
-- WHY A LEDGER RATHER THAN "ADD XP WHEN A ROW IS INSERTED"
--   The obvious design — award XP on check_in insert — is farmable in five
--   seconds: post, delete, post, delete. The ledger is keyed on
--   (user_id, local_date, award_kind) and is NEVER cleaned up when a Check In
--   is deleted, so the day's reward is spent the first time and cannot be
--   re-earned by reposting. Detaching and re-attaching a workout is covered by
--   the same key.
--
--   The AMOUNTS live here, server-side, in levl_social_xp_amount(). The client
--   asks "award me today's Check In XP" and is TOLD the number; it cannot
--   propose one. A tampered client can still write its own local save (the
--   game is offline-first by design and the whole economy is local), but it
--   cannot make the server agree, and every cloud-visible surface — profile,
--   leaderboard, duel score — is fed from the training log, not from this.
--
-- ------------------------- HOW THE NUMBERS WERE CHOSEN ----------------------
--   Measured against the real engine (src/engine/engine.js), not guessed:
--
--     one working set        setXP(80kg x 8 @RPE8)         ~ 39 XP
--                            setXP(12kg x 12 @RPE8)        ~ 17 XP
--     a typical 14-set session (incl. first-of-day bonus)  ~ 440 XP
--     one level, mid game    xpForLevel(27) - xpForLevel(26) = 1320 XP
--                                                          ~ 3 sessions
--     a won 7-day duel       DUEL_TIERS.contender          = 500 XP
--     one training pack      PACK_XP_STEP                  = 1200 XP
--     daily integrity cap    INTEGRITY.DAILY_XP_CAP        = 4000 XP
--
--   CHECK IN = 30 XP.  About one accessory set. 6.8% of a typical session and
--   0.75% of the daily cap. Visible enough to be worth the ten seconds, far too
--   small to be a strategy.
--
--   VERIFIED SESSION = +60 XP (90 total). Only reachable on a day you actually
--   logged a workout — a workout that already paid its own ~440 XP. So this is
--   a ~20% bonus for sharing training you genuinely did, never a substitute
--   for doing it.
--
--   Photo-only ceiling is 30 XP/day. Someone who never trains and posts every
--   single day for a year earns ~11,000 XP — roughly level 15. Someone who
--   trains four times a week earns that in about six weeks. Training wins by
--   an order of magnitude, which is the whole point.
--
--   STREAK MILESTONES at 7 / 30 / 100 consecutive Check In days pay
--   120 / 350 / 900. Rare, self-rate-limiting (you cannot reach day 7 twice in
--   a week), and each is granted at most once on any given date.
--
--   Reactions and comments are worth ZERO, given and received. Social
--   popularity must never be a progression route.
-- ============================================================================

create table if not exists public.social_xp_awards (
  id         bigserial primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  local_date date not null,
  award_kind text not null check (award_kind in ('check_in', 'verified', 'streak_7', 'streak_30', 'streak_100')),
  xp         int  not null check (xp >= 0),
  created_at timestamptz not null default now(),
  constraint social_xp_awards_once unique (user_id, local_date, award_kind)
);

create index if not exists social_xp_awards_user_idx on public.social_xp_awards (user_id, local_date desc);

alter table public.social_xp_awards enable row level security;

-- Readable by its owner so the app can reconcile after reinstalling. There is
-- deliberately NO insert/update/delete policy: rows are only ever written by
-- the SECURITY DEFINER function below.
drop policy if exists "read own social xp" on public.social_xp_awards;
create policy "read own social xp" on public.social_xp_awards
  for select to authenticated using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- The published rate card. Changing a value here changes the economy in one
-- place, for every client, with no app release.
-- ---------------------------------------------------------------------------
create or replace function public.levl_social_xp_amount(p_kind text)
returns int
language sql
immutable
as $$
  select case p_kind
    when 'check_in'    then 30
    when 'verified'    then 60
    when 'streak_7'    then 120
    when 'streak_30'   then 350
    when 'streak_100'  then 900
    else 0
  end;
$$;

-- ---------------------------------------------------------------------------
-- Consecutive Check In days ending on p_date. Social consistency ONLY — this is
-- deliberately separate from the training streak in the engine. Uploading a
-- photograph must never read as having trained.
--
-- Gaps-and-islands: for a run of consecutive dates, (p_date - d) and the
-- descending row number advance together, so every day in the current run
-- shares one group key. A missing day shifts the key and ends the run.
-- ---------------------------------------------------------------------------
create or replace function public.levl_check_in_streak(p_user uuid, p_date date default null)
returns int
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with days as (
    select distinct ci.local_date as d
    from public.check_ins ci
    where ci.user_id = p_user
      and ci.deleted_at is null
      and ci.local_date <= coalesce(p_date, current_date)
  ),
  ranked as (
    select d, (coalesce(p_date, current_date) - d) - (row_number() over (order by d desc) - 1)::int as grp
    from days
  )
  select coalesce((
    select count(*)::int from ranked
    where grp = (select grp from ranked order by d desc limit 1)
      -- One day of grace: the streak still stands before you have posted today.
      and (select max(d) from days) >= coalesce(p_date, current_date) - 1
  ), 0);
$$;

-- ---------------------------------------------------------------------------
-- Award today's Check In XP.
--
--   Returns the XP that was ACTUALLY granted by this call — 0 on every repeat.
--   Requires a real, non-deleted Check In to exist for that date, so the call
--   cannot be made in isolation.
--
--   p_verified is a request, not an assertion: the function reads
--   check_ins.check_in_type, which the 2802 trigger computed from the training
--   log. Asking for the verified bonus without an attached workout gets you
--   nothing.
-- ---------------------------------------------------------------------------
create or replace function public.levl_award_check_in_xp(
  p_local_date date default null,
  p_verified   boolean default false
)
returns table (granted int, total_today int, detail jsonb)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid      uuid := auth.uid();
  v_date     date := coalesce(p_local_date, current_date);
  v_type     text;
  v_granted  int := 0;
  v_amount   int;
  v_detail   jsonb := '[]'::jsonb;
  v_streak   int;
  v_kind     text;
begin
  if v_uid is null then
    raise exception 'Sign in first.' using errcode = 'P0001';
  end if;
  if v_date < current_date - 2 or v_date > current_date + 1 then
    raise exception 'That date is out of range.' using errcode = 'P0001';
  end if;

  select ci.check_in_type into v_type
  from public.check_ins ci
  where ci.user_id = v_uid and ci.local_date = v_date and ci.deleted_at is null;

  if v_type is null then
    return query select 0, 0, '[]'::jsonb;
    return;
  end if;

  -- 1. The daily Check In award.
  v_amount := public.levl_social_xp_amount('check_in');
  insert into public.social_xp_awards (user_id, local_date, award_kind, xp)
  values (v_uid, v_date, 'check_in', v_amount)
  on conflict (user_id, local_date, award_kind) do nothing;
  if found then
    v_granted := v_granted + v_amount;
    v_detail := v_detail || jsonb_build_object('kind', 'check_in', 'xp', v_amount);
  end if;

  -- 2. The verified bonus, only if the server agrees a workout is attached.
  if p_verified and v_type = 'verified' then
    v_amount := public.levl_social_xp_amount('verified');
    insert into public.social_xp_awards (user_id, local_date, award_kind, xp)
    values (v_uid, v_date, 'verified', v_amount)
    on conflict (user_id, local_date, award_kind) do nothing;
    if found then
      v_granted := v_granted + v_amount;
      v_detail := v_detail || jsonb_build_object('kind', 'verified', 'xp', v_amount);
    end if;
  end if;

  -- 3. Streak milestones, measured from the Check In rows themselves.
  v_streak := public.levl_check_in_streak(v_uid, v_date);
  for v_kind in select unnest(array['streak_7', 'streak_30', 'streak_100']) loop
    if (v_kind = 'streak_7'   and v_streak = 7)
    or (v_kind = 'streak_30'  and v_streak = 30)
    or (v_kind = 'streak_100' and v_streak = 100) then
      v_amount := public.levl_social_xp_amount(v_kind);
      insert into public.social_xp_awards (user_id, local_date, award_kind, xp)
      values (v_uid, v_date, v_kind, v_amount)
      on conflict (user_id, local_date, award_kind) do nothing;
      if found then
        v_granted := v_granted + v_amount;
        v_detail := v_detail || jsonb_build_object('kind', v_kind, 'xp', v_amount, 'streak', v_streak);
      end if;
    end if;
  end loop;

  return query
    select v_granted,
           coalesce((select sum(a.xp)::int from public.social_xp_awards a
                     where a.user_id = v_uid and a.local_date = v_date), 0),
           v_detail;
end;
$$;

revoke all on function public.levl_award_check_in_xp(date, boolean) from public;
revoke all on function public.levl_check_in_streak(uuid, date) from public;
grant execute on function public.levl_award_check_in_xp(date, boolean) to authenticated;
grant execute on function public.levl_check_in_streak(uuid, date) to authenticated;

-- ---------------------------------------------------------------------------
-- Profile social stats — one call for the archive header.
-- ---------------------------------------------------------------------------
create or replace function public.levl_check_in_stats(p_user uuid default null)
returns table (check_ins int, verified int, streak int, best_streak int)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  with mine as (
    select ci.local_date, ci.check_in_type
    from public.check_ins ci
    where ci.user_id = coalesce(p_user, auth.uid())
      and ci.deleted_at is null
  ),
  runs as (
    -- Longest run ever: same gaps-and-islands trick, ascending.
    select count(*)::int as len
    from (
      select local_date - (row_number() over (order by local_date))::int as grp
      from (select distinct local_date from mine) d
    ) g
    group by g.grp
  )
  select
    (select count(*)::int from mine),
    (select count(*)::int from mine where check_in_type = 'verified'),
    public.levl_check_in_streak(coalesce(p_user, auth.uid()), current_date),
    coalesce((select max(len) from runs), 0);
$$;

revoke all on function public.levl_check_in_stats(uuid) from public;
grant execute on function public.levl_check_in_stats(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Archive calendar: which days in a month have a Check In, and of which type.
-- ---------------------------------------------------------------------------
create or replace function public.levl_check_in_month(p_user uuid, p_month date)
returns table (local_date date, check_in_id uuid, check_in_type text, front_photo_path text, rear_photo_path text, primary_photo text)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select ci.local_date, ci.id, ci.check_in_type, ci.front_photo_path, ci.rear_photo_path, ci.primary_photo
  from public.check_ins ci
  where ci.user_id = coalesce(p_user, auth.uid())
    and ci.deleted_at is null
    and ci.local_date >= date_trunc('month', p_month)::date
    and ci.local_date <  (date_trunc('month', p_month) + interval '1 month')::date
  order by ci.local_date asc;
$$;

revoke all on function public.levl_check_in_month(uuid, date) from public;
grant execute on function public.levl_check_in_month(uuid, date) to authenticated;
