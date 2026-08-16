-- ASCEND — realtime duel workout feed migration
--
-- Run this entire file once in Supabase SQL Editor. It is idempotent and keeps
-- private save blobs private. Duel partners can read only the public workout
-- rows needed inside an active head-to-head window.

create table if not exists public.workouts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  date       timestamptz not null default now(),
  exercise   text not null default '',
  kind       text,
  sets       int default 1,
  reps       int default 0,
  weight     numeric default 0,
  unit       text,
  rpe        numeric,
  duration   int default 0,
  distance   numeric default 0,
  xp_earned  int default 0,
  is_pr      boolean default false,
  client_id  text,
  created_at timestamptz not null default now()
);

alter table public.workouts add column if not exists kind text;
alter table public.workouts add column if not exists sets int default 1;
alter table public.workouts add column if not exists reps int default 0;
alter table public.workouts add column if not exists weight numeric default 0;
alter table public.workouts add column if not exists unit text;
alter table public.workouts add column if not exists rpe numeric;
alter table public.workouts add column if not exists duration int default 0;
alter table public.workouts add column if not exists distance numeric default 0;
alter table public.workouts add column if not exists xp_earned int default 0;
alter table public.workouts add column if not exists is_pr boolean default false;
alter table public.workouts add column if not exists client_id text;

-- Fix the legacy partial/global key. Supabase upsert now uses the owner-scoped
-- pair, which Postgres can infer directly and which cannot collide across users.
alter table public.workouts drop constraint if exists workouts_client_id_key;
drop index if exists public.workouts_client_id_key;
create unique index if not exists workouts_user_client_id_key
  on public.workouts (user_id, client_id);

create index if not exists workouts_user_date_idx
  on public.workouts (user_id, date desc);

alter table public.workouts enable row level security;

drop policy if exists "insert own workouts" on public.workouts;
create policy "insert own workouts"
  on public.workouts for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "update own workouts" on public.workouts;
create policy "update own workouts"
  on public.workouts for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "read own workouts" on public.workouts;
create policy "read own workouts"
  on public.workouts for select to authenticated
  using (auth.uid() = user_id);

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

-- Supabase Realtime Postgres Changes requires publication membership. The
-- SELECT policies above continue to decide which rows each subscriber sees.
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
