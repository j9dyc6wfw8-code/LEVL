-- ============================================================================
-- 2812 — remote kill switch (STRUCT-05) and telemetry (STRUCT-02)
-- APPLIED TO PRODUCTION 2026-08-18 as migration: app_config_and_telemetry
--
-- Both use Supabase rather than a new SDK on purpose. Sentry or Amplitude each
-- add a native module, and a native module means a new binary and a new review —
-- for an app days from submission that already carries the backend it needs.
-- This is not as good as Sentry: no symbolication, no breadcrumbs, no alerting.
-- It is available today, costs no rebuild, and turns "launching blind" into
-- "launching with eyes". Swap it once there is a reason to cut a build.
-- ============================================================================

create table if not exists public.app_config (
  id                  int primary key default 1,
  social_enabled      boolean not null default true,
  duels_enabled       boolean not null default true,
  packs_enabled       boolean not null default true,
  check_ins_enabled   boolean not null default true,
  leaderboard_enabled boolean not null default true,
  notice_text         text,
  notice_level        text check (notice_level in ('info','warn','critical')),
  min_build           int not null default 0,
  updated_at          timestamptz not null default now(),
  constraint app_config_single_row check (id = 1)
);
insert into public.app_config (id) values (1) on conflict (id) do nothing;

alter table public.app_config enable row level security;
drop policy if exists app_config_readable on public.app_config;
create policy app_config_readable on public.app_config for select using (true);
revoke insert, update, delete on public.app_config from anon, authenticated;

comment on table public.app_config is
  'Single-row runtime configuration read at launch. Flip a flag to disable a
   subsystem without shipping a build. Edited in the dashboard only. Every flag
   defaults to ON and the client keeps them ON if the read fails — a kill switch
   that fails closed is a worse outage than the one it prevents.';

create table if not exists public.telemetry_events (
  id          bigserial primary key,
  user_id     uuid references auth.users(id) on delete set null,
  session_id  text,
  kind        text not null,
  name        text not null,
  props       jsonb not null default '{}'::jsonb,
  app_version text,
  build       text,
  platform    text,
  created_at  timestamptz not null default now()
);
create index if not exists telemetry_events_kind_time_idx on public.telemetry_events (kind, created_at desc);
create index if not exists telemetry_events_name_time_idx on public.telemetry_events (name, created_at desc);

alter table public.telemetry_events enable row level security;
drop policy if exists telemetry_insert_own on public.telemetry_events;
create policy telemetry_insert_own on public.telemetry_events
  for insert with check (user_id is null or user_id = auth.uid());

-- Insert-only. No select policy at all, so a leaked anon key cannot mine it.
revoke select, update, delete on public.telemetry_events from anon, authenticated;
grant insert on public.telemetry_events to anon, authenticated;
grant usage, select on sequence public.telemetry_events_id_seq to anon, authenticated;
