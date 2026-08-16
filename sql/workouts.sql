-- ============================================================================
-- ASCEND — `workouts` table: one row per logged set / cardio session.
-- Powers the activity feed AND the friend-duel session breakdown.
--
-- Run once in Supabase → SQL Editor. Idempotent and non-destructive: it creates
-- the table if missing, adds any missing columns if it already exists, and
-- ensures the owner-scoped UNIQUE key that the app's upsert depends on.
-- (Without that constraint every sync fails silently and both players' session
-- lists stay empty.)
-- ============================================================================

create table if not exists public.workouts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  date       timestamptz not null default now(),
  exercise   text not null default '',
  kind       text,
  sets       int  default 1,
  reps       int  default 0,
  weight     numeric default 0,
  unit       text,
  rpe        numeric,
  duration   int  default 0,
  distance   numeric default 0,
  xp_earned  int  default 0,
  is_pr      boolean default false,
  client_id  text,
  created_at timestamptz not null default now()
);

-- If the table already existed from an earlier setup, make sure nothing is missing.
alter table public.workouts add column if not exists client_id  text;
alter table public.workouts add column if not exists kind       text;
alter table public.workouts add column if not exists unit       text;
alter table public.workouts add column if not exists rpe        numeric;
alter table public.workouts add column if not exists distance   numeric default 0;
alter table public.workouts add column if not exists duration   int default 0;
alter table public.workouts add column if not exists xp_earned  int default 0;
alter table public.workouts add column if not exists is_pr      boolean default false;
alter table public.workouts add column if not exists sets       int default 1;

-- Scope the dedupe key to its owner. A partial client_id index cannot be
-- inferred by PostgREST's ON CONFLICT clause and can make every sync fail with
-- "no unique constraint" even though the index appears in the dashboard.
alter table public.workouts drop constraint if exists workouts_client_id_key;
drop index if exists public.workouts_client_id_key;
create unique index if not exists workouts_user_client_id_key
  on public.workouts (user_id, client_id);

create index if not exists workouts_user_date_idx
  on public.workouts (user_id, date desc);

alter table public.workouts enable row level security;

-- Write your own rows only.
drop policy if exists "insert own workouts" on public.workouts;
create policy "insert own workouts"
  on public.workouts for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "update own workouts" on public.workouts;
create policy "update own workouts"
  on public.workouts for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Read your own rows.
drop policy if exists "read own workouts" on public.workouts;
create policy "read own workouts"
  on public.workouts for select to authenticated
  using (auth.uid() = user_id);

-- Read your friends' rows (activity feed + friend profiles).
drop policy if exists "read friends workouts" on public.workouts;
create policy "read friends workouts"
  on public.workouts for select to authenticated
  using (
    exists (
      select 1 from public.friends f
      where (f.user_one = auth.uid() and f.user_two = workouts.user_id)
         or (f.user_two = auth.uid() and f.user_one = workouts.user_id)
    )
  );

-- Read only an active duel partner's rows inside that duel's exact window,
-- even if you aren't friends yet (invite-link duels).
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

-- Postgres Changes only emits events for tables in the Realtime publication.
-- Add workouts once; the guard keeps this safe to rerun.
do $$
begin
  if exists (
    select 1 from pg_publication where pubname = 'supabase_realtime'
  ) and not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'workouts'
  ) then
    execute 'alter publication supabase_realtime add table public.workouts';
  end if;
end $$;
