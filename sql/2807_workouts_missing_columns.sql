-- ============================================================================
-- LEVL BUILD 29 — WORKOUTS: THE COLUMNS THAT WERE NEVER ADDED
--
-- Run AFTER 2806_social_hardening.sql. Idempotent. Purely additive.
--
-- SYMPTOM
--   "column w.kind does not exist" on every social screen, and "Add workout"
--   silently refusing to turn a Check In into a Verified Session.
--
-- CAUSE
--   `public.workouts` predates sql/workouts.sql on this project and never
--   gained kind / unit / rpe / distance. Two things broke:
--
--   1. levl_check_in_apply_workout() in 2802 reads w.kind to split lifts from
--      cardio. Missing column -> the trigger raised on every Check In read.
--
--   2. Worse and invisible: workoutService.pushWorkouts sends `kind`, that
--      upsert failed, and the code fell back to a legacy row shape that also
--      STRIPS session_id. So no workout ever got the id that Check In
--      verification matches on — which is why attaching always failed.
--
-- Nothing here deletes or rewrites a value. The backfill only fills NULLs.
-- ============================================================================

alter table public.workouts add column if not exists kind     text;
alter table public.workouts add column if not exists unit     text;
alter table public.workouts add column if not exists rpe      numeric;
alter table public.workouts add column if not exists distance numeric default 0;

-- Classify existing history so the trigger's lift/cardio split is right for
-- rows logged before this: duration but no load was cardio.
update public.workouts
set kind = case
  when coalesce(duration, 0) > 0 and coalesce(weight, 0) = 0 and coalesce(reps, 0) = 0 then 'cardio'
  else 'lift'
end
where kind is null;

-- The owner-scoped dedupe key the app's upsert infers ON CONFLICT from.
create unique index if not exists workouts_user_client_id_key
  on public.workouts (user_id, client_id);

create index if not exists workouts_user_session_idx
  on public.workouts (user_id, session_id)
  where session_id is not null;

-- ---------------------------------------------------------------------------
-- VERIFY — all five should be present, and no row should be missing kind.
-- ---------------------------------------------------------------------------
-- select
--   (select count(*) from information_schema.columns
--      where table_schema='public' and table_name='workouts'
--        and column_name in ('kind','unit','rpe','distance','session_id')) as cols,
--   (select count(*) from public.workouts where kind is null) as missing_kind;
