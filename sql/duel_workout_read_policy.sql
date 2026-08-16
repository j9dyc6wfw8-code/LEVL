-- ============================================================================
-- ASCEND — let duel partners read each other's workouts (fixes the friend-duel
-- breakdown showing "No sessions logged" for an opponent you're not friends
-- with yet, e.g. joined via invite link, while their score still climbs).
--
-- This ADDS a policy; it does not touch or replace whatever read rule you
-- already have on `workouts` (e.g. "read own" / "read friends'"). Postgres
-- RLS policies are OR'd together, so this only opens one more legitimate case:
-- you may read someone's workout rows only while an active duel exists and
-- only when each row falls inside that duel's start/end window. No active duel,
-- no access; activity outside the duel stays private from non-friends.
--
-- Run once in Supabase → SQL Editor. Idempotent — safe to run more than once.
-- ============================================================================

alter table public.workouts enable row level security;

drop policy if exists "read duel partner workouts" on public.workouts;
create policy "read duel partner workouts"
  on public.workouts for select to authenticated
  using (
    exists (
      select 1 from public.duels d
      where d.status = 'active'
        and workouts.date >= d.start_date
        and workouts.date <= d.end_date
        and (
          (d.player_one = auth.uid() and d.player_two = workouts.user_id)
          or
          (d.player_two = auth.uid() and d.player_one = workouts.user_id)
        )
    )
  );
