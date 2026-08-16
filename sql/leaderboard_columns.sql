-- ============================================================================
-- LEVL — profile columns powering the two global leaderboards.
--
--   Strength board    -> best_e1rm (kg), best_lift_name
--   Consistency board -> consistency (% of last 28 days trained), longest_streak
--
-- best_e1rm is stored in KILOGRAMS regardless of the player's display unit, so
-- kg and lb users are ranked on the same scale.
--
-- Run once in Supabase → SQL Editor. Idempotent and non-destructive.
-- ============================================================================

alter table public.profiles add column if not exists best_e1rm      numeric  default 0;
alter table public.profiles add column if not exists best_lift_name text;
alter table public.profiles add column if not exists consistency    int      default 0;
alter table public.profiles add column if not exists longest_streak int      default 0;

-- Sort indexes: leaderboards order by these columns on every load.
create index if not exists profiles_best_e1rm_idx   on public.profiles (best_e1rm   desc nulls last);
create index if not exists profiles_consistency_idx on public.profiles (consistency desc nulls last);
create index if not exists profiles_streak_idx      on public.profiles (streak      desc nulls last);
create index if not exists profiles_weekly_xp_idx   on public.profiles (weekly_xp   desc nulls last);
create index if not exists profiles_xp_idx          on public.profiles (xp          desc nulls last);

-- Leaderboards are public within the app: any signed-in player can read the
-- display-safe profile columns. Safe to re-run.
alter table public.profiles enable row level security;

drop policy if exists "read all profiles" on public.profiles;
create policy "read all profiles"
  on public.profiles for select to authenticated
  using (true);
