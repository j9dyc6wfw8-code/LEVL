-- ============================================================================
-- 2815 — P1 HARDENING: duels, comments, invites, function grants
--
-- Run AFTER 2814_moderation.sql. Idempotent. Non-destructive.
--
-- Four findings, none of them exploitable for cross-user data the way 2813's
-- were, but each one lets a user do something the product says they cannot:
--
--   13. `duels` UPDATE was `using (player_one or player_two)` with no column
--       restriction and no WITH CHECK. A participant could simply
--       `update duels set winner = <self>, player_one_score = 999999`. The
--       enforce_friend_duel_integrity trigger validates the players and the
--       time window — it has never looked at scores or the winner. And
--       claim_friend_duel_rewards() pays `reward` to `winner`, so the forgery
--       was directly convertible into coins.
--
--       The irony is that the CLIENT already does this honestly:
--       duelService.workoutXpTotals sums xp_earned from `workouts` inside the
--       duel window, and resolveEndedDuels re-reads that evidence before
--       settling. The logic was right; nothing enforced it. This file moves
--       exactly that logic server-side and takes UPDATE away.
--
--   15. The `update own comment` policy granted UPDATE to the Check In's OWNER
--       as well as the comment's author, with a matching WITH CHECK and no
--       column restriction. The intent (stated in 2803) was to let the host
--       HIDE a comment. Nothing stopped them rewriting its `body` — putting
--       words in another person's mouth, under that person's name.
--
--   16. `duel_invites` SELECT was `using (true)`: any signed-in user could list
--       every invite code in the table. UPDATE was `using (status = 'open' or
--       creator)`, so they could also alter or consume somebody else's invite.
--
--   17. Supabase's own linter flags levl_recompute_profile_stats(uuid) as
--       callable by `anon`. It cannot forge a value — it recomputes from that
--       user's own workouts — but it is an unauthenticated, unbounded
--       write-amplification handle: call it in a loop over every user id.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 13a. The one definition of a duel score
--
--     XP earned inside the duel's own window, from the workouts table. This is
--     duelService.workoutXpTotals, moved to where it can be trusted.
-- ---------------------------------------------------------------------------

create or replace function public.levl_duel_xp(p_user uuid, p_from timestamptz, p_to timestamptz)
returns int
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(sum(greatest(0, coalesce(w.xp_earned, 0))), 0)::int
  from public.workouts w
  where w.user_id = p_user
    and w.date >= p_from
    and w.date <= p_to;
$$;

revoke all on function public.levl_duel_xp(uuid, timestamptz, timestamptz) from public, anon, authenticated;


-- ---------------------------------------------------------------------------
-- 13b. Answer a challenge
--
--     Only the challenged player, only while pending. The clock starts on
--     ACCEPT, preserving the original duration — same rule the client used.
-- ---------------------------------------------------------------------------

create or replace function public.levl_duel_respond(p_duel bigint, p_accept boolean)
returns setof public.duels
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  me       uuid := auth.uid();
  d        public.duels%rowtype;
  secs     numeric;
  v_start  timestamptz := now();
begin
  if me is null then
    raise exception 'Sign in first.' using errcode = 'P0001';
  end if;

  select * into d from public.duels
   where id = p_duel and player_two = me and status = 'pending'
   for update;
  if not found then
    raise exception 'This challenge is no longer available.' using errcode = 'P0001';
  end if;

  if not p_accept then
    update public.duels set status = 'declined' where id = p_duel returning * into d;
    return next d;
    return;
  end if;

  if exists (
    select 1 from public.duels x
     where x.status = 'active' and x.id <> p_duel
       and (x.player_one in (d.player_one, d.player_two)
         or x.player_two in (d.player_one, d.player_two))
  ) then
    raise exception 'Finish the current duel first.' using errcode = 'P0001';
  end if;

  -- Preserve the challenge's intended length, clamped to 1..30 days.
  secs := extract(epoch from (d.end_date - d.start_date));
  if secs is null or secs <= 0 then secs := 7 * 86400; end if;
  secs := least(greatest(secs, 86400), 30 * 86400);

  update public.duels
     set status           = 'active',
         start_date       = v_start,
         end_date         = v_start + make_interval(secs => secs),
         player_one_score = 0,
         player_two_score = 0,
         winner           = null
   where id = p_duel
  returning * into d;

  begin
    insert into public.notifications (user_id, kind, payload, read)
    values (d.player_one, 'duel_challenge',
            jsonb_build_object('from', me, 'duel_id', d.id, 'started', true), false);
  exception when others then null;
  end;

  return next d;
end;
$$;

revoke all on function public.levl_duel_respond(bigint, boolean) from public, anon;
grant execute on function public.levl_duel_respond(bigint, boolean) to authenticated;


-- ---------------------------------------------------------------------------
-- 13c. Refresh live scores
--
--     Recomputes BOTH players from the workout log, not just the caller's.
--     The client could only ever write its own column, which is why an
--     opponent's score sat stale until they happened to open the app. Doing
--     both here is free and removes that whole class of "the score is wrong".
-- ---------------------------------------------------------------------------

create or replace function public.levl_duel_sync_scores()
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  me  uuid := auth.uid();
  d   public.duels%rowtype;
  s1  int;
  s2  int;
  n   int := 0;
begin
  if me is null then return 0; end if;

  for d in
    select * from public.duels
     where status = 'active' and (player_one = me or player_two = me)
  loop
    s1 := public.levl_duel_xp(d.player_one, d.start_date, d.end_date);
    s2 := public.levl_duel_xp(d.player_two, d.start_date, d.end_date);
    if s1 is distinct from d.player_one_score or s2 is distinct from d.player_two_score then
      update public.duels
         set player_one_score = s1, player_two_score = s2
       where id = d.id and status = 'active';
      n := n + 1;
    end if;
  end loop;

  return n;
end;
$$;

revoke all on function public.levl_duel_sync_scores() from public, anon;
grant execute on function public.levl_duel_sync_scores() to authenticated;


-- ---------------------------------------------------------------------------
-- 13d. Settle finished duels
--
--     Recomputes from the evidence rows at settlement time rather than trusting
--     the cached score columns — a final workout can sync in the same moment
--     the screen opens. Ties leave winner null, which is what the UI expects.
--     Idempotent: `and status = 'active'` means a second caller settles nothing.
-- ---------------------------------------------------------------------------

create or replace function public.levl_duel_resolve()
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  me     uuid := auth.uid();
  d      public.duels%rowtype;
  s1     int;
  s2     int;
  w      uuid;
  n      int := 0;
  r1     text;
  r2     text;
begin
  if me is null then return 0; end if;

  for d in
    select * from public.duels
     where status = 'active'
       and (player_one = me or player_two = me)
       and end_date is not null
       and end_date <= now()
     for update
  loop
    s1 := public.levl_duel_xp(d.player_one, d.start_date, d.end_date);
    s2 := public.levl_duel_xp(d.player_two, d.start_date, d.end_date);
    w  := case when s1 > s2 then d.player_one
               when s2 > s1 then d.player_two
               else null end;

    update public.duels
       set player_one_score = s1, player_two_score = s2,
           status = 'complete', winner = w
     where id = d.id and status = 'active';

    if found then
      n := n + 1;
      r1 := case when w is null then 'draw' when w = d.player_one then 'win' else 'loss' end;
      r2 := case when w is null then 'draw' when w = d.player_two then 'win' else 'loss' end;
      begin
        insert into public.notifications (user_id, kind, payload, read) values
          (d.player_one, 'duel_result', jsonb_build_object('duel_id', d.id, 'result', r1), false),
          (d.player_two, 'duel_result', jsonb_build_object('duel_id', d.id, 'result', r2), false);
      exception when others then null;
      end;
    end if;
  end loop;

  return n;
end;
$$;

revoke all on function public.levl_duel_resolve() from public, anon;
grant execute on function public.levl_duel_resolve() to authenticated;


-- ---------------------------------------------------------------------------
-- 13e. Forfeit
-- ---------------------------------------------------------------------------

create or replace function public.levl_duel_quit(p_duel bigint)
returns setof public.duels
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  me  uuid := auth.uid();
  d   public.duels%rowtype;
  opp uuid;
begin
  if me is null then
    raise exception 'Sign in first.' using errcode = 'P0001';
  end if;

  select * into d from public.duels
   where id = p_duel and status = 'active' and (player_one = me or player_two = me)
   for update;
  if not found then
    raise exception 'This duel is no longer active.' using errcode = 'P0001';
  end if;

  opp := case when d.player_one = me then d.player_two else d.player_one end;

  update public.duels set status = 'complete', winner = opp
   where id = p_duel and status = 'active'
  returning * into d;

  begin
    insert into public.notifications (user_id, kind, payload, read)
    values (opp, 'duel_result',
            jsonb_build_object('result', 'win', 'reason', 'forfeit', 'from', me, 'duel_id', d.id), false);
  exception when others then null;
  end;

  return next d;
end;
$$;

revoke all on function public.levl_duel_quit(bigint) from public, anon;
grant execute on function public.levl_duel_quit(bigint) to authenticated;


-- ---------------------------------------------------------------------------
-- 13f. Take UPDATE away from the client
--
--     Every legitimate transition now has an RPC above. Creating a challenge is
--     still a plain INSERT (its policy is unchanged and correct), and reading
--     your own duels is unchanged.
-- ---------------------------------------------------------------------------

revoke update on public.duels from anon, authenticated;
drop policy if exists "update own duels" on public.duels;

-- `reward` is chosen by the client at INSERT (duelService.challenge passes it),
-- so clamp it rather than trusting it. The engine's richest tier pays 600
-- coins; 1000 leaves headroom without leaving a hole. A separate trigger so
-- enforce_friend_duel_integrity stays exactly as it is.
create or replace function public.levl_clamp_duel_reward()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.reward := least(greatest(coalesce(new.reward, 500), 0), 1000);
  return new;
end;
$$;

drop trigger if exists levl_clamp_duel_reward_trg on public.duels;
create trigger levl_clamp_duel_reward_trg
  before insert or update on public.duels
  for each row execute function public.levl_clamp_duel_reward();


-- ---------------------------------------------------------------------------
-- 15. Comments: the author edits, the host only hides
-- ---------------------------------------------------------------------------

drop policy if exists "update own comment"        on public.check_in_comments;
drop policy if exists "author edits own comment"  on public.check_in_comments;

create policy "author edits own comment"
  on public.check_in_comments for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Hiding is a separate, narrower power: it sets deleted_at and touches nothing
-- else, and it is available to the comment's author OR the Check In's owner —
-- which is the minimum host control a UGC feature needs, and the maximum it
-- should have.
create or replace function public.levl_hide_comment(p_comment uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  me     uuid := auth.uid();
  author uuid;
  owner  uuid;
begin
  if me is null then
    raise exception 'Sign in first.' using errcode = 'P0001';
  end if;

  select c.user_id, ci.user_id into author, owner
    from public.check_in_comments c
    join public.check_ins ci on ci.id = c.check_in_id
   where c.id = p_comment;

  if author is null then
    raise exception 'That comment no longer exists.' using errcode = 'P0001';
  end if;
  if me <> author and me <> owner then
    raise exception 'You cannot remove that comment.' using errcode = 'P0001';
  end if;

  update public.check_in_comments
     set deleted_at = coalesce(deleted_at, now())
   where id = p_comment;
end;
$$;

revoke all on function public.levl_hide_comment(uuid) from public, anon;
grant execute on function public.levl_hide_comment(uuid) to authenticated;


-- ---------------------------------------------------------------------------
-- 16. duel_invites: a code is not a public directory
--
--     Claiming goes through claim_duel_invite(), which is SECURITY DEFINER and
--     looks the code up itself — the client never needed to read the table to
--     join. createInvite() only ever reads its OWN open invite, which the
--     policy below still allows.
-- ---------------------------------------------------------------------------

drop policy if exists "read duel_invites"     on public.duel_invites;
drop policy if exists "update duel_invites"   on public.duel_invites;
drop policy if exists "read own duel_invites" on public.duel_invites;

create policy "read own duel_invites"
  on public.duel_invites for select to authenticated
  using (auth.uid() = creator or auth.uid() = claimed_by);

-- Only claim_duel_invite() consumes an invite, and it runs as the table owner.
revoke update on public.duel_invites from anon, authenticated;


-- ---------------------------------------------------------------------------
-- 17. Internal functions are not API endpoints
--
--     PostgREST exposes anything executable in `public`. Neither of these is
--     ever called by the app; both are reached through triggers, which run as
--     the table owner and are unaffected by role grants.
-- ---------------------------------------------------------------------------

revoke execute on function public.levl_recompute_profile_stats(uuid) from public, anon, authenticated;
revoke execute on function public.levl_workouts_touch_profile()      from public, anon, authenticated;


-- ============================================================================
-- VERIFY
-- ============================================================================
--
-- 1. The client can no longer write a duel. Expect zero rows from both.
--
--    select grantee, privilege_type from information_schema.role_table_grants
--     where table_schema='public' and table_name='duels'
--       and grantee in ('anon','authenticated') and privilege_type='UPDATE';
--    select policyname from pg_policies
--     where schemaname='public' and tablename='duels' and cmd='UPDATE';
--
-- 2. Forging a win is refused. Substitute a duel you are actually in.
--
--    begin;
--      select set_config('role','authenticated',true);
--      select set_config('request.jwt.claims','{"sub":"<YOU>","role":"authenticated"}',true);
--      update public.duels set winner = '<YOU>' where id = <A DUEL YOU ARE IN>;
--      -- expect: permission denied for table duels
--    rollback;
--
-- 3. anon can no longer call the recompute handle. Expect false, false.
--
--    select has_function_privilege('anon','public.levl_recompute_profile_stats(uuid)','EXECUTE'),
--           has_function_privilege('authenticated','public.levl_recompute_profile_stats(uuid)','EXECUTE');
--
-- 4. Invite codes are no longer enumerable. As a user who created none,
--    `select count(*) from public.duel_invites` must return 0.
--
-- 5. Comments: the post owner can hide but not rewrite.
--
--    begin;
--      select set_config('role','authenticated',true);
--      select set_config('request.jwt.claims','{"sub":"<POST OWNER>","role":"authenticated"}',true);
--      update public.check_in_comments set body='I never said this' where id='<SOMEONE ELSE''S COMMENT>';
--      -- expect: 0 rows updated (the policy no longer matches)
--      select public.levl_hide_comment('<SAME COMMENT>');   -- expect: success
--    rollback;


-- Applied with the same addendum migration as 2814.
revoke execute on function public.levl_clamp_duel_reward() from public, anon, authenticated;
