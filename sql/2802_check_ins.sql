-- ============================================================================
-- LEVL BUILD 28 — CHECK INS, REACTIONS, COMMENTS
--
-- Run AFTER 2801_social_core.sql. Idempotent and non-destructive.
--
-- THE ONE IMPORTANT IDEA IN THIS FILE
--   A Check In never stores a workout the client typed. It stores a POINTER
--   (workout_session_id) to rows the user already owns in `public.workouts`,
--   and a trigger recomputes the display snapshot from those rows server-side.
--   That is what makes "VERIFIED SESSION · 14 sets · 8,420 kg" mean something:
--   the numbers are derived from the training log, not asserted by the phone.
--
--   The snapshot is cached on the row purely so a PUBLIC viewer — who has no
--   read access to your `workouts` — can still see the session summary. The
--   canonical record remains the workout rows, which are never copied or
--   deleted by anything here.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0. Sessions on the existing workout log
--
--    `workouts` is one row per SET. There was no session concept, so add a
--    nullable client-generated session id. Old rows stay null and keep working
--    exactly as before; the app groups them by day for display.
-- ---------------------------------------------------------------------------

alter table public.workouts add column if not exists session_id text;

create index if not exists workouts_user_session_idx
  on public.workouts (user_id, session_id)
  where session_id is not null;

-- ---------------------------------------------------------------------------
-- 1. check_ins
-- ---------------------------------------------------------------------------

create table if not exists public.check_ins (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,

  -- WHEN --------------------------------------------------------------------
  created_at          timestamptz not null default now(),
  posted_at           timestamptz not null default now(),
  local_date          date not null,          -- the poster's local calendar day
  timezone            text not null default 'UTC',
  window_end_minute   int,                    -- their prompt window at post time
  notified_at         timestamptz,            -- when the daily prompt actually fired
  late_seconds        int not null default 0 check (late_seconds >= 0),

  -- WHO SEES IT -------------------------------------------------------------
  visibility          text not null default 'friends' check (visibility in ('friends', 'public')),

  -- THE PHOTOS --------------------------------------------------------------
  front_photo_path    text not null,
  rear_photo_path     text not null,
  primary_photo       text not null default 'rear' check (primary_photo in ('front', 'rear')),
  alt_text            text check (char_length(alt_text) <= 240),
  caption             text check (char_length(caption) <= 140),

  -- THE TRAINING ------------------------------------------------------------
  workout_session_id  text,
  workout_snapshot    jsonb,                  -- SERVER-COMPUTED. See trigger below.
  check_in_type       text not null default 'check_in' check (check_in_type in ('check_in', 'verified')),

  -- DENORMALISED COUNTS (maintained by trigger, never writable by clients) ---
  reaction_count      int not null default 0,
  comment_count       int not null default 0,

  deleted_at          timestamptz,

  -- One Check In per person per local day. This is the backbone of the whole
  -- anti-farm design: you cannot post five times to earn five rewards.
  constraint check_ins_one_per_day unique (user_id, local_date),
  constraint check_ins_photos_differ check (front_photo_path <> rear_photo_path)
);

-- Feed ordering + pagination. The feed is always "newest first, not deleted",
-- so the index carries that shape exactly.
create index if not exists check_ins_feed_idx
  on public.check_ins (posted_at desc, id desc)
  where deleted_at is null;

create index if not exists check_ins_user_date_idx
  on public.check_ins (user_id, local_date desc);

create index if not exists check_ins_public_feed_idx
  on public.check_ins (posted_at desc, id desc)
  where deleted_at is null and visibility = 'public';

-- ---------------------------------------------------------------------------
-- 2. Reactions — ONE active reaction per person per Check In.
--
--    Changing 🔥 to 💪 replaces your reaction rather than adding a second one,
--    which is what makes the counts un-inflatable by a single account.
-- ---------------------------------------------------------------------------

create table if not exists public.check_in_reactions (
  id            uuid primary key default gen_random_uuid(),
  check_in_id   uuid not null references public.check_ins(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  reaction_type text not null check (reaction_type in ('fire', 'strong', 'pr', 'respect', 'like')),
  created_at    timestamptz not null default now(),
  constraint check_in_reactions_one_per_user unique (check_in_id, user_id)
);

create index if not exists check_in_reactions_post_idx on public.check_in_reactions (check_in_id);
create index if not exists check_in_reactions_user_idx on public.check_in_reactions (user_id);

-- ---------------------------------------------------------------------------
-- 3. Comments — flat, plain text, soft-deleted.
-- ---------------------------------------------------------------------------

create table if not exists public.check_in_comments (
  id          uuid primary key default gen_random_uuid(),
  check_in_id uuid not null references public.check_ins(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  body        text not null check (char_length(btrim(body)) between 1 and 300),
  created_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

create index if not exists check_in_comments_post_idx
  on public.check_in_comments (check_in_id, created_at asc)
  where deleted_at is null;

-- ---------------------------------------------------------------------------
-- 4. Server-computed workout snapshot + verification
--
--    Runs on INSERT and whenever workout_session_id changes. It:
--      • refuses a session that isn't yours or isn't from that local day
--      • recomputes sets / volume / exercises / XP / PRs from `workouts`
--      • sets check_in_type accordingly
--    A client that posts a fabricated snapshot has it overwritten.
-- ---------------------------------------------------------------------------

create or replace function public.levl_check_in_apply_workout()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_rows      int;
  v_sets      int;
  v_volume    numeric;
  v_xp        int;
  v_prs       int;
  v_exercises text[];
  v_kinds     text[];
  v_cardio    int;
  v_first     timestamptz;
  v_last      timestamptz;
begin
  -- Counts are server-owned. Ignore whatever the client sent.
  if tg_op = 'INSERT' then
    new.reaction_count := 0;
    new.comment_count  := 0;
  else
    new.reaction_count := old.reaction_count;
    new.comment_count  := old.comment_count;
  end if;

  -- local_date must be within a day of the server's idea of now. Real travel
  -- and timezone edges move it by at most one; anything further is someone
  -- trying to mint extra "days".
  if new.local_date < (current_date - 1) or new.local_date > (current_date + 1) then
    raise exception 'That Check In date is not valid.' using errcode = 'P0001';
  end if;

  -- Lateness, derived from the stored window rather than trusted from the app.
  if new.window_end_minute is not null then
    begin
      new.late_seconds := greatest(0, floor(extract(epoch from (
        new.posted_at
        - ((new.local_date::timestamp + make_interval(mins => new.window_end_minute))
            at time zone coalesce(nullif(new.timezone, ''), 'UTC'))
      )))::int);
    exception when others then
      new.late_seconds := 0;   -- unknown timezone string: don't fail the post
    end;
  else
    new.late_seconds := 0;
  end if;
  -- Cap at 24h so a bad clock can't render "8000h late".
  new.late_seconds := least(new.late_seconds, 86400);

  if new.workout_session_id is null then
    new.workout_snapshot := null;
    new.check_in_type := 'check_in';
    return new;
  end if;

  select
    count(*),
    coalesce(sum(case when w.kind = 'cardio' then 0 else coalesce(w.sets, 1) end), 0),
    coalesce(sum(case when w.kind = 'cardio' then 0 else coalesce(w.weight, 0) * coalesce(w.reps, 0) end), 0),
    coalesce(sum(coalesce(w.xp_earned, 0)), 0),
    coalesce(sum(case when w.is_pr then 1 else 0 end), 0),
    coalesce(sum(case when w.kind = 'cardio' then coalesce(w.duration, 0) else 0 end), 0),
    min(w.date), max(w.date)
  into v_rows, v_sets, v_volume, v_xp, v_prs, v_cardio, v_first, v_last
  from public.workouts w
  where w.user_id = new.user_id
    and w.session_id = new.workout_session_id;

  if coalesce(v_rows, 0) = 0 then
    raise exception 'That workout could not be found on your account.' using errcode = 'P0001';
  end if;

  -- The session has to belong to the same local day as the Check In. Compared
  -- in the poster's timezone, not the server's.
  if (v_last at time zone coalesce(nullif(new.timezone, ''), 'UTC'))::date
       not between (new.local_date - 1) and (new.local_date + 1) then
    raise exception 'You can only attach a workout from the same day.' using errcode = 'P0001';
  end if;

  select array_agg(ex order by ord), array_agg(distinct k)
  into v_exercises, v_kinds
  from (
    select w.exercise as ex, min(w.date) as ord, coalesce(w.kind, 'lift') as k
    from public.workouts w
    where w.user_id = new.user_id
      and w.session_id = new.workout_session_id
      and coalesce(w.exercise, '') <> ''
    group by w.exercise, coalesce(w.kind, 'lift')
    order by min(w.date)
    limit 12
  ) t;

  new.workout_snapshot := jsonb_build_object(
    'session_id',   new.workout_session_id,
    'sets',         v_sets,
    'volume_kg',    round(v_volume)::int,
    'xp',           v_xp,
    'prs',          v_prs,
    'cardio_min',   v_cardio,
    'exercises',    to_jsonb(coalesce(v_exercises, array[]::text[])),
    'kinds',        to_jsonb(coalesce(v_kinds, array[]::text[])),
    'started_at',   v_first,
    'ended_at',     v_last,
    'computed_at',  now()
  );
  new.check_in_type := 'verified';
  return new;
end;
$$;

drop trigger if exists levl_check_in_apply_workout_trg on public.check_ins;
create trigger levl_check_in_apply_workout_trg
before insert or update of workout_session_id, posted_at, local_date, timezone, window_end_minute
  on public.check_ins
for each row execute function public.levl_check_in_apply_workout();

-- ---------------------------------------------------------------------------
-- 5. Count maintenance
--
--    Incremental UPDATE ... SET n = n + 1 on the parent row. Postgres takes a
--    row lock for the duration of the statement, so concurrent reactions
--    serialise correctly instead of both reading the same stale value.
-- ---------------------------------------------------------------------------

create or replace function public.levl_sync_reaction_count()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    update public.check_ins set reaction_count = reaction_count + 1 where id = new.check_in_id;
  elsif tg_op = 'DELETE' then
    update public.check_ins set reaction_count = greatest(0, reaction_count - 1) where id = old.check_in_id;
  end if;
  return null;
end;
$$;

drop trigger if exists levl_sync_reaction_count_trg on public.check_in_reactions;
create trigger levl_sync_reaction_count_trg
after insert or delete on public.check_in_reactions
for each row execute function public.levl_sync_reaction_count();

create or replace function public.levl_sync_comment_count()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' and new.deleted_at is null then
    update public.check_ins set comment_count = comment_count + 1 where id = new.check_in_id;
  elsif tg_op = 'DELETE' and old.deleted_at is null then
    update public.check_ins set comment_count = greatest(0, comment_count - 1) where id = old.check_in_id;
  elsif tg_op = 'UPDATE' then
    if old.deleted_at is null and new.deleted_at is not null then
      update public.check_ins set comment_count = greatest(0, comment_count - 1) where id = new.check_in_id;
    elsif old.deleted_at is not null and new.deleted_at is null then
      update public.check_ins set comment_count = comment_count + 1 where id = new.check_in_id;
    end if;
  end if;
  return null;
end;
$$;

drop trigger if exists levl_sync_comment_count_trg on public.check_in_comments;
create trigger levl_sync_comment_count_trg
after insert or update or delete on public.check_in_comments
for each row execute function public.levl_sync_comment_count();

-- ---------------------------------------------------------------------------
-- 6. Social activity notifications
--
--    Reuses the EXISTING `notifications` table so there is one activity centre,
--    not two. A user is never notified about their own action, and never about
--    someone they have blocked.
-- ---------------------------------------------------------------------------

create or replace function public.levl_notify_social()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_owner uuid;
  v_kind  text;
  v_body  text;
begin
  select user_id into v_owner from public.check_ins where id = new.check_in_id;
  if v_owner is null or v_owner = new.user_id then return null; end if;
  if public.levl_is_blocked(v_owner, new.user_id) then return null; end if;

  if tg_table_name = 'check_in_reactions' then
    v_kind := 'check_in_reaction';
    v_body := new.reaction_type;
  else
    v_kind := 'check_in_comment';
    v_body := left(new.body, 80);
  end if;

  begin
    insert into public.notifications (user_id, kind, payload, read)
    values (
      v_owner, v_kind,
      jsonb_build_object('from', new.user_id, 'check_in_id', new.check_in_id, 'body', v_body),
      false
    );
  exception when others then
    null;   -- a notification must never roll back the reaction or comment
  end;
  return null;
end;
$$;

drop trigger if exists levl_notify_reaction_trg on public.check_in_reactions;
create trigger levl_notify_reaction_trg
after insert on public.check_in_reactions
for each row execute function public.levl_notify_social();

drop trigger if exists levl_notify_comment_trg on public.check_in_comments;
create trigger levl_notify_comment_trg
after insert on public.check_in_comments
for each row execute function public.levl_notify_social();

-- ---------------------------------------------------------------------------
-- 7. Storage cleanup queue
--
--    The app deletes its own photo objects when a Check In is removed. If the
--    device is offline at that moment the rows land here instead, and the next
--    launch drains the queue. Nothing is orphaned indefinitely.
-- ---------------------------------------------------------------------------

create table if not exists public.storage_cleanup_queue (
  id          bigserial primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  bucket_id   text not null,
  object_path text not null,
  created_at  timestamptz not null default now()
);

create index if not exists storage_cleanup_user_idx on public.storage_cleanup_queue (user_id);

create or replace function public.levl_queue_check_in_cleanup()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.storage_cleanup_queue (user_id, bucket_id, object_path)
  values (old.user_id, 'check-ins', old.front_photo_path),
         (old.user_id, 'check-ins', old.rear_photo_path);
  return old;
end;
$$;

drop trigger if exists levl_queue_check_in_cleanup_trg on public.check_ins;
create trigger levl_queue_check_in_cleanup_trg
after delete on public.check_ins
for each row execute function public.levl_queue_check_in_cleanup();

-- ---------------------------------------------------------------------------
-- 8. Realtime publication
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['check_ins', 'check_in_reactions', 'check_in_comments'] loop
      if to_regclass('public.' || t) is not null
         and not exists (
           select 1 from pg_publication_tables
           where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
         ) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end $$;
