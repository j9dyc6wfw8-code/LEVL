-- ============================================================================
-- LEVL BUILD 29 — SOCIAL HARDENING
--
-- Run AFTER 2805_social_xp.sql. Idempotent. Non-destructive.
--
-- WHY THIS FILE EXISTS
-- Supabase's own database linter caught two real mistakes in 2801-2805. Both
-- are fixed here rather than by editing those files, so a project that has
-- already run them only needs this one.
--
-- ---------------------------------------------------------------------------
-- MISTAKE 1 — `revoke ... from public` does not revoke from `anon`
--
-- 2801-2805 each did:
--     revoke all on function public.levl_x() from public;
--     grant execute on function public.levl_x() to authenticated;
--
-- That looks right and is wrong. Supabase ships
--     ALTER DEFAULT PRIVILEGES IN SCHEMA public
--       GRANT EXECUTE ON FUNCTIONS TO anon, authenticated;
-- so every new function is granted to those two roles DIRECTLY. Revoking the
-- PUBLIC grant leaves the direct `anon` grant untouched, and `anon` is the role
-- an unauthenticated request runs as.
--
-- Net effect: every helper was callable, without signing in, at
-- /rest/v1/rpc/<name>. Most are harmless to anon because they check auth.uid()
-- and bail — but three genuinely leaked information to anyone with a user id:
--
--     levl_are_friends(a, b)        -> are these two people friends?
--     levl_is_blocked(a, b)         -> has one blocked the other?
--     levl_check_in_streak(user)    -> how consistent is this person?
--
-- SECURITY DEFINER means those answered regardless of RLS. Fixed below.
--
-- ---------------------------------------------------------------------------
-- MISTAKE 2 — three functions had no fixed search_path
--
-- levl_normalize_username, levl_social_xp_amount and levl_check_in_guard_paths
-- were created without `set search_path`. A function without one resolves
-- unqualified names against whatever search_path the caller has, which is the
-- standard privilege-escalation route for SECURITY DEFINER code.
--
-- levl_check_in_guard_paths is the one that matters: it is the trigger that
-- stops somebody pointing their Check In row at another user's photograph.
-- A security guard should not itself be manipulable.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Pin search_path on the three that were missing it
-- ---------------------------------------------------------------------------

alter function public.levl_normalize_username(text)   set search_path = public, pg_temp;
alter function public.levl_social_xp_amount(text)     set search_path = public, pg_temp;
alter function public.levl_check_in_guard_paths()     set search_path = public, pg_temp;

-- ---------------------------------------------------------------------------
-- 2. Take EXECUTE away from `anon` AND from PUBLIC
--
--    Both are needed. Postgres grants EXECUTE to PUBLIC by default and anon
--    inherits that, so revoking the role grant alone leaves it callable.
--
--    Nothing in LEVL's social layer is usable signed-out: every policy is
--    `to authenticated`, and every RPC begins by checking auth.uid(). So anon
--    needs none of these.
-- ---------------------------------------------------------------------------

revoke execute on function public.levl_are_friends(uuid, uuid) from public, anon;
revoke execute on function public.levl_is_blocked(uuid, uuid) from public, anon;
revoke execute on function public.levl_can_view_check_in(uuid, uuid) from public, anon;
revoke execute on function public.levl_check_in_streak(uuid, date) from public, anon;
revoke execute on function public.levl_block_user(uuid) from public, anon;
revoke execute on function public.levl_set_username(text) from public, anon;
revoke execute on function public.levl_normalize_username(text) from public, anon;
revoke execute on function public.levl_social_xp_amount(text) from public, anon;
revoke execute on function public.levl_award_check_in_xp(date, boolean) from public, anon;
revoke execute on function public.levl_check_in_stats(uuid) from public, anon;
revoke execute on function public.levl_check_in_month(uuid, date) from public, anon;
revoke execute on function public.levl_check_in_feed(text, int, timestamptz, uuid) from public, anon;
revoke execute on function public.levl_drain_storage_cleanup(bigint[]) from public, anon;

-- ---------------------------------------------------------------------------
-- 3. Trigger functions should not be reachable as RPCs at all
--
--    Calling one directly errors ("trigger functions can only be called as
--    triggers"), so the practical risk is low — but an internal SECURITY
--    DEFINER function has no business being an API endpoint, and PostgREST
--    exposes anything executable in `public`.
-- ---------------------------------------------------------------------------

revoke execute on function public.levl_check_in_apply_workout()   from public, anon, authenticated;
revoke execute on function public.levl_check_in_guard_paths()     from public, anon, authenticated;
revoke execute on function public.levl_notify_social()            from public, anon, authenticated;
revoke execute on function public.levl_queue_check_in_cleanup()   from public, anon, authenticated;
revoke execute on function public.levl_sync_comment_count()       from public, anon, authenticated;
revoke execute on function public.levl_sync_reaction_count()      from public, anon, authenticated;

-- Triggers keep working: Postgres invokes a trigger function as the table
-- owner, which is not affected by these role grants.

-- Internal helpers — used only from inside other functions, never by the app.
revoke execute on function public.levl_normalize_username(text) from public, authenticated;
revoke execute on function public.levl_social_xp_amount(text)   from public, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Same treatment for the pre-existing duel functions
--
--    Not introduced by Build 28/29, but flagged by the same lint and safe to
--    tighten: each already checks auth.uid() and refuses anonymous callers, so
--    removing anon's EXECUTE changes no working behaviour.
-- ---------------------------------------------------------------------------

do $$
begin
  if to_regprocedure('public.claim_duel_invite(text, uuid)') is not null then
    execute 'revoke execute on function public.claim_duel_invite(text, uuid) from public, anon';
  end if;
  if to_regprocedure('public.claim_friend_duel_rewards(uuid)') is not null then
    execute 'revoke execute on function public.claim_friend_duel_rewards(uuid) from public, anon';
  end if;
  -- Trigger functions: no role needs them.
  if to_regprocedure('public.enforce_friend_duel_integrity()') is not null then
    execute 'revoke execute on function public.enforce_friend_duel_integrity() from public, anon, authenticated';
  end if;
  if to_regprocedure('public.handle_new_user()') is not null then
    execute 'revoke execute on function public.handle_new_user() from public, anon, authenticated';
  end if;
  if to_regprocedure('public.rls_auto_enable()') is not null then
    execute 'revoke execute on function public.rls_auto_enable() from public, anon, authenticated';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- VERIFY — every row should show anon_can_exec = false.
-- ---------------------------------------------------------------------------
-- select p.proname,
--        has_function_privilege('anon', p.oid, 'EXECUTE')          as anon_can_exec,
--        has_function_privilege('authenticated', p.oid, 'EXECUTE') as auth_can_exec,
--        coalesce(array_to_string(p.proconfig, ','), '(none)')     as search_path
-- from pg_proc p join pg_namespace n on n.oid = p.pronamespace
-- where n.nspname = 'public' and p.proname like 'levl%'
-- order by p.proname;
