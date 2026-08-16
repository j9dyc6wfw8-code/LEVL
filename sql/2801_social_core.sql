-- ============================================================================
-- LEVL BUILD 28 — SOCIAL CORE
--
-- Run FIRST of the 28xx series. Idempotent and non-destructive.
--
-- WHAT THIS FILE DOES
--   1. Relationship helpers (are-friends / is-blocked) used by every RLS policy
--      in 2803. They are SECURITY DEFINER so a policy on `check_ins` can ask
--      "are these two friends?" without needing a SELECT policy on `friends`
--      (which would recurse).
--   2. user_blocks         — symmetric mute: neither side sees the other.
--   3. content_reports     — minimal moderation intake.
--   4. check_in_preferences— per-user Check In window, audience default,
--                            notification categories, push token.
--   5. Public usernames    — makes `profiles.username` a real, unique, public
--                            identity so social posts never lean on email.
--
-- NOTHING HERE DELETES OR REWRITES TRAINING DATA.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Relationship helpers
-- ---------------------------------------------------------------------------

-- Are these two accepted LEVL friends? `friends` stores one ordered edge per
-- pair (user_one < user_two), but older rows may be unordered, so check both.
create or replace function public.levl_are_friends(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select a is not null and b is not null and exists (
    select 1 from public.friends f
    where (f.user_one = a and f.user_two = b)
       or (f.user_one = b and f.user_two = a)
  );
$$;

create table if not exists public.user_blocks (
  blocker    uuid not null references auth.users(id) on delete cascade,
  blocked    uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker, blocked),
  constraint user_blocks_not_self check (blocker <> blocked)
);

create index if not exists user_blocks_blocked_idx on public.user_blocks (blocked);

-- Blocking is deliberately SYMMETRIC in effect: if A blocks B, neither one
-- sees or can interact with the other. A one-way block leaks the blocker's
-- content back to the person they blocked, which is the opposite of the point.
create or replace function public.levl_is_blocked(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select a is not null and b is not null and exists (
    select 1 from public.user_blocks ub
    where (ub.blocker = a and ub.blocked = b)
       or (ub.blocker = b and ub.blocked = a)
  );
$$;

revoke all on function public.levl_are_friends(uuid, uuid) from public;
revoke all on function public.levl_is_blocked(uuid, uuid) from public;
grant execute on function public.levl_are_friends(uuid, uuid) to authenticated;
grant execute on function public.levl_is_blocked(uuid, uuid) to authenticated;

-- Blocking someone also tears down the friendship and any pending request, so
-- the block is not quietly undone by a stale edge.
create or replace function public.levl_block_user(p_target uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Sign in first.' using errcode = 'P0001';
  end if;
  if p_target is null or p_target = v_uid then
    raise exception 'You cannot block yourself.' using errcode = 'P0001';
  end if;

  insert into public.user_blocks (blocker, blocked)
  values (v_uid, p_target)
  on conflict (blocker, blocked) do nothing;

  delete from public.friends f
  where (f.user_one = v_uid and f.user_two = p_target)
     or (f.user_one = p_target and f.user_two = v_uid);

  update public.friend_requests
  set status = 'declined'
  where status = 'pending'
    and ((sender = v_uid and receiver = p_target)
      or (sender = p_target and receiver = v_uid));
end;
$$;

revoke all on function public.levl_block_user(uuid) from public;
grant execute on function public.levl_block_user(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Reports — intake only. Moderation happens in the Supabase dashboard with
--    the service role; the app deliberately ships no moderation console.
-- ---------------------------------------------------------------------------

create table if not exists public.content_reports (
  id           uuid primary key default gen_random_uuid(),
  reporter     uuid not null references auth.users(id) on delete cascade,
  target_type  text not null check (target_type in ('check_in', 'comment', 'user')),
  target_id    uuid not null,
  target_user  uuid references auth.users(id) on delete set null,
  reason       text not null check (reason in ('inappropriate', 'harassment', 'spam', 'other')),
  detail       text check (char_length(detail) <= 500),
  status       text not null default 'open' check (status in ('open', 'reviewed', 'actioned', 'dismissed')),
  created_at   timestamptz not null default now()
);

create index if not exists content_reports_status_idx on public.content_reports (status, created_at desc);
create index if not exists content_reports_target_idx on public.content_reports (target_type, target_id);
-- One report per person per piece of content: re-reporting is a no-op rather
-- than a way to inflate a queue.
create unique index if not exists content_reports_unique_idx
  on public.content_reports (reporter, target_type, target_id);

-- ---------------------------------------------------------------------------
-- 3. Check In preferences
--
--    Window minutes are MINUTES FROM LOCAL MIDNIGHT (0..1439). Storing the
--    window this way plus an IANA timezone is what makes the daily prompt
--    survive travel and daylight saving — an absolute UTC time would drift by
--    an hour twice a year and be wrong the moment somebody flies.
-- ---------------------------------------------------------------------------

create table if not exists public.check_in_preferences (
  user_id             uuid primary key references auth.users(id) on delete cascade,
  enabled             boolean not null default true,
  window_start_minute int not null default 1020 check (window_start_minute between 0 and 1439),  -- 17:00
  window_end_minute   int not null default 1200 check (window_end_minute   between 0 and 1439),  -- 20:00
  timezone            text not null default 'UTC',
  default_visibility  text not null default 'friends' check (default_visibility in ('friends', 'public')),
  public_discovery    boolean not null default true,
  notify_check_in     boolean not null default true,
  notify_social       boolean not null default true,
  notify_duels        boolean not null default true,
  notify_rewards      boolean not null default true,
  notify_training     boolean not null default false,
  expo_push_token     text,
  updated_at          timestamptz not null default now(),
  constraint check_in_window_ordered check (window_end_minute > window_start_minute)
);

create index if not exists check_in_preferences_push_idx
  on public.check_in_preferences (enabled, notify_check_in)
  where expo_push_token is not null;

-- ---------------------------------------------------------------------------
-- 4. Public usernames
--
--    `profiles.username` already exists but was generated from the display
--    name on every sync, so two players called "Matteo" both became "matteo"
--    and the handle silently changed whenever somebody renamed themselves.
--    A social feed needs a stable, unique, public handle — and it must never
--    be an email address.
--
--    This block is written to be safe on live data: it de-duplicates first,
--    THEN adds the unique index, so it cannot fail half way and leave the
--    table unconstrained.
-- ---------------------------------------------------------------------------

alter table public.profiles add column if not exists username_set boolean not null default false;

-- Normalise: lowercase, a-z 0-9 underscore, 3..20 chars.
create or replace function public.levl_normalize_username(p text)
returns text
language sql
immutable
as $$
  select nullif(substring(lower(regexp_replace(coalesce(p, ''), '[^A-Za-z0-9_]', '', 'g')) from 1 for 20), '');
$$;

do $$
declare
  r record;
  v_base text;
  v_try  text;
  v_n    int;
begin
  -- Blank / invalid handles first.
  update public.profiles
  set username = 'hunter'
  where public.levl_normalize_username(username) is null;

  update public.profiles
  set username = public.levl_normalize_username(username)
  where username is distinct from public.levl_normalize_username(username);

  -- Then collisions: keep the OLDEST row's handle, suffix the rest. Suffixing
  -- from the user id keeps the result stable if this ever runs twice.
  for r in
    select p.id, p.username
    from public.profiles p
    join (
      select username from public.profiles group by username having count(*) > 1
    ) dupe on dupe.username = p.username
    order by p.username, coalesce(p.updated_at, now()) asc
  loop
    if exists (select 1 from public.profiles x where x.username = r.username and x.id <> r.id
               and coalesce(x.updated_at, now()) <= (select coalesce(updated_at, now()) from public.profiles where id = r.id))
    then
      v_base := substring(r.username from 1 for 14);
      v_n := 0;
      loop
        v_try := v_base || substring(replace(r.id::text, '-', '') from 1 + v_n for 5);
        exit when not exists (select 1 from public.profiles x where x.username = v_try);
        v_n := v_n + 1;
        exit when v_n > 20;
      end loop;
      update public.profiles set username = v_try where id = r.id;
    end if;
  end loop;
end $$;

create unique index if not exists profiles_username_unique_idx on public.profiles (username);
create index if not exists profiles_username_prefix_idx on public.profiles (username text_pattern_ops);

-- Claim / change a handle. Returns the handle actually stored.
create or replace function public.levl_set_username(p_username text)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_name text := public.levl_normalize_username(p_username);
begin
  if v_uid is null then
    raise exception 'Sign in first.' using errcode = 'P0001';
  end if;
  if v_name is null or char_length(v_name) < 3 then
    raise exception 'Usernames need at least 3 letters, numbers or underscores.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.profiles p where p.username = v_name and p.id <> v_uid) then
    raise exception 'That username is taken.' using errcode = 'P0001';
  end if;

  update public.profiles
  set username = v_name, username_set = true, updated_at = now()
  where id = v_uid;

  if not found then
    raise exception 'Finish setting up your profile first.' using errcode = 'P0001';
  end if;
  return v_name;
end;
$$;

revoke all on function public.levl_set_username(text) from public;
grant execute on function public.levl_set_username(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. RLS for the tables created here (check_ins RLS lives in 2803)
-- ---------------------------------------------------------------------------

alter table public.user_blocks           enable row level security;
alter table public.content_reports       enable row level security;
alter table public.check_in_preferences  enable row level security;

drop policy if exists "read own blocks" on public.user_blocks;
create policy "read own blocks" on public.user_blocks
  for select to authenticated using (auth.uid() = blocker);

drop policy if exists "create own blocks" on public.user_blocks;
create policy "create own blocks" on public.user_blocks
  for insert to authenticated with check (auth.uid() = blocker);

drop policy if exists "remove own blocks" on public.user_blocks;
create policy "remove own blocks" on public.user_blocks
  for delete to authenticated using (auth.uid() = blocker);

-- You may file a report and read back your own. Nobody reads anyone else's;
-- triage happens with the service role, which bypasses RLS.
drop policy if exists "file report" on public.content_reports;
create policy "file report" on public.content_reports
  for insert to authenticated with check (auth.uid() = reporter);

drop policy if exists "read own reports" on public.content_reports;
create policy "read own reports" on public.content_reports
  for select to authenticated using (auth.uid() = reporter);

drop policy if exists "read own check_in_preferences" on public.check_in_preferences;
create policy "read own check_in_preferences" on public.check_in_preferences
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "write own check_in_preferences" on public.check_in_preferences;
create policy "write own check_in_preferences" on public.check_in_preferences
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "update own check_in_preferences" on public.check_in_preferences;
create policy "update own check_in_preferences" on public.check_in_preferences
  for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
