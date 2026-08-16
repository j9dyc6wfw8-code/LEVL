-- ============================================================================
-- LEVL BUILD 28 — ROW LEVEL SECURITY FOR SOCIAL
--
-- Run AFTER 2802_check_ins.sql. Idempotent.
--
-- THE RULES, IN PLAIN ENGLISH
--   • You can always see your own Check Ins, including deleted ones.
--   • Somebody else can see yours only when ALL of these hold:
--       – it isn't deleted
--       – neither of you has blocked the other
--       – it's PUBLIC and you allow public discovery, OR you're accepted friends
--   • Only you can edit or delete your Check In, your comment, your reaction.
--   • Reaction and comment counts are written by triggers, never by a client.
--   • Photo objects inherit the post's visibility, so flipping a post from
--     public to friends-only immediately revokes the images too.
--
-- The five scenarios from the brief are asserted at the bottom of this file as
-- runnable checks you can execute in the SQL editor.
-- ============================================================================

alter table public.check_ins          enable row level security;
alter table public.check_in_reactions enable row level security;
alter table public.check_in_comments  enable row level security;

-- ---------------------------------------------------------------------------
-- 0. Ownership guard on photo paths
--
--    Storage paths start with the owner's user id. Without this a user could
--    point their own row at somebody else's object path and re-publish another
--    person's photograph under their name.
-- ---------------------------------------------------------------------------

create or replace function public.levl_check_in_guard_paths()
returns trigger
language plpgsql
as $$
declare
  v_prefix text := new.user_id::text || '/';
begin
  if new.front_photo_path is null or new.rear_photo_path is null
     or position(v_prefix in new.front_photo_path) <> 1
     or position(v_prefix in new.rear_photo_path)  <> 1 then
    raise exception 'Check In photos must live under your own storage folder.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists levl_check_in_guard_paths_trg on public.check_ins;
create trigger levl_check_in_guard_paths_trg
before insert or update of front_photo_path, rear_photo_path, user_id on public.check_ins
for each row execute function public.levl_check_in_guard_paths();

-- ---------------------------------------------------------------------------
-- 1. Visibility predicate — one function, used by every policy below and by
--    the storage policies in 2804, so there is exactly ONE definition of
--    "may this person see this Check In".
-- ---------------------------------------------------------------------------

create or replace function public.levl_can_view_check_in(p_check_in uuid, p_viewer uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.check_ins ci
    left join public.check_in_preferences pr on pr.user_id = ci.user_id
    where ci.id = p_check_in
      and (
        ci.user_id = p_viewer
        or (
          ci.deleted_at is null
          and not public.levl_is_blocked(ci.user_id, p_viewer)
          and (
            public.levl_are_friends(ci.user_id, p_viewer)
            or (ci.visibility = 'public' and coalesce(pr.public_discovery, true))
          )
        )
      )
  );
$$;

revoke all on function public.levl_can_view_check_in(uuid, uuid) from public;
grant execute on function public.levl_can_view_check_in(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. check_ins
-- ---------------------------------------------------------------------------

drop policy if exists "read own check_ins" on public.check_ins;
create policy "read own check_ins" on public.check_ins
  for select to authenticated
  using (auth.uid() = user_id);

-- Friends' Check Ins. Written inline (rather than calling the helper) so the
-- planner can still use check_ins_feed_idx when paginating.
drop policy if exists "read friends check_ins" on public.check_ins;
create policy "read friends check_ins" on public.check_ins
  for select to authenticated
  using (
    deleted_at is null
    and user_id <> auth.uid()
    and public.levl_are_friends(user_id, auth.uid())
    and not public.levl_is_blocked(user_id, auth.uid())
  );

-- Public Check Ins, subject to the poster's discovery switch.
drop policy if exists "read public check_ins" on public.check_ins;
create policy "read public check_ins" on public.check_ins
  for select to authenticated
  using (
    deleted_at is null
    and visibility = 'public'
    and user_id <> auth.uid()
    and not public.levl_is_blocked(user_id, auth.uid())
    and coalesce(
      (select pr.public_discovery from public.check_in_preferences pr where pr.user_id = check_ins.user_id),
      true
    )
  );

drop policy if exists "create own check_ins" on public.check_ins;
create policy "create own check_ins" on public.check_ins
  for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "update own check_ins" on public.check_ins;
create policy "update own check_ins" on public.check_ins
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "delete own check_ins" on public.check_ins;
create policy "delete own check_ins" on public.check_ins
  for delete to authenticated
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 3. Reactions
--
--    You may react only to a Check In you are allowed to SEE — which is what
--    stops a blocked user from interacting with content they can't read.
-- ---------------------------------------------------------------------------

drop policy if exists "read visible reactions" on public.check_in_reactions;
create policy "read visible reactions" on public.check_in_reactions
  for select to authenticated
  using (public.levl_can_view_check_in(check_in_id, auth.uid()));

drop policy if exists "create own reaction" on public.check_in_reactions;
create policy "create own reaction" on public.check_in_reactions
  for insert to authenticated
  with check (
    auth.uid() = user_id
    and public.levl_can_view_check_in(check_in_id, auth.uid())
  );

drop policy if exists "update own reaction" on public.check_in_reactions;
create policy "update own reaction" on public.check_in_reactions
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id and public.levl_can_view_check_in(check_in_id, auth.uid()));

drop policy if exists "delete own reaction" on public.check_in_reactions;
create policy "delete own reaction" on public.check_in_reactions
  for delete to authenticated
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 4. Comments
--
--    Delete is soft (set deleted_at) so the count trigger can adjust and the
--    row survives for moderation. The post's OWNER may also hide a comment on
--    their own Check In — the minimum host control a UGC feature needs.
-- ---------------------------------------------------------------------------

drop policy if exists "read visible comments" on public.check_in_comments;
create policy "read visible comments" on public.check_in_comments
  for select to authenticated
  using (
    deleted_at is null
    and public.levl_can_view_check_in(check_in_id, auth.uid())
    and not public.levl_is_blocked(user_id, auth.uid())
  );

drop policy if exists "create own comment" on public.check_in_comments;
create policy "create own comment" on public.check_in_comments
  for insert to authenticated
  with check (
    auth.uid() = user_id
    and public.levl_can_view_check_in(check_in_id, auth.uid())
  );

drop policy if exists "update own comment" on public.check_in_comments;
create policy "update own comment" on public.check_in_comments
  for update to authenticated
  using (
    auth.uid() = user_id
    or auth.uid() = (select ci.user_id from public.check_ins ci where ci.id = check_in_id)
  )
  with check (
    auth.uid() = user_id
    or auth.uid() = (select ci.user_id from public.check_ins ci where ci.id = check_in_id)
  );

drop policy if exists "delete own comment" on public.check_in_comments;
create policy "delete own comment" on public.check_in_comments
  for delete to authenticated
  using (
    auth.uid() = user_id
    or auth.uid() = (select ci.user_id from public.check_ins ci where ci.id = check_in_id)
  );

-- ---------------------------------------------------------------------------
-- 5. Feed reader
--
--    ONE round trip per page instead of N queries per card. Returns the poster's
--    display identity, the viewer's own reaction, and the top reaction types —
--    all already filtered by the policies above.
--
--    Cursor pagination on (posted_at, id) so a post arriving mid-scroll cannot
--    shift the page boundary and duplicate or skip a card.
-- ---------------------------------------------------------------------------

create or replace function public.levl_check_in_feed(
  p_scope        text default 'friends',      -- 'friends' | 'public' | 'mine'
  p_limit        int  default 12,
  p_cursor_time  timestamptz default null,
  p_cursor_id    uuid default null
)
returns table (
  id                 uuid,
  user_id            uuid,
  posted_at          timestamptz,
  local_date         date,
  late_seconds       int,
  visibility         text,
  front_photo_path   text,
  rear_photo_path    text,
  primary_photo      text,
  alt_text           text,
  caption            text,
  check_in_type      text,
  workout_snapshot   jsonb,
  reaction_count     int,
  comment_count      int,
  username           text,
  display_name       text,
  avatar             jsonb,
  -- Quoted, because `character` is also a SQL type name (CHARACTER VARYING).
  -- Unquoted here Postgres tries to parse it as the column's TYPE and fails
  -- with "syntax error at or near character". The quotes make it a plain
  -- identifier, and the column is still returned as `character` to the client.
  "character"        jsonb,
  level              int,
  my_reaction        text,
  reaction_types     jsonb
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select
    ci.id, ci.user_id, ci.posted_at, ci.local_date, ci.late_seconds, ci.visibility,
    ci.front_photo_path, ci.rear_photo_path, ci.primary_photo, ci.alt_text, ci.caption,
    ci.check_in_type, ci.workout_snapshot, ci.reaction_count, ci.comment_count,
    p.username, p.display_name,
    to_jsonb(p.avatar), to_jsonb(p."character"), p.level,
    mine.reaction_type,
    coalesce(agg.types, '[]'::jsonb)
  from public.check_ins ci
  join public.profiles p on p.id = ci.user_id
  left join public.check_in_reactions mine
    on mine.check_in_id = ci.id and mine.user_id = auth.uid()
  left join lateral (
    select jsonb_agg(jsonb_build_object('type', t.reaction_type, 'n', t.n) order by t.n desc) as types
    from (
      select r.reaction_type, count(*)::int as n
      from public.check_in_reactions r
      where r.check_in_id = ci.id
      group by r.reaction_type
    ) t
  ) agg on true
  where ci.deleted_at is null
    and case p_scope
      when 'mine'    then ci.user_id = auth.uid()
      when 'public'  then ci.visibility = 'public' and ci.user_id <> auth.uid()
      else public.levl_are_friends(ci.user_id, auth.uid()) or ci.user_id = auth.uid()
    end
    and (
      p_cursor_time is null
      or (ci.posted_at, ci.id) < (p_cursor_time, coalesce(p_cursor_id, '00000000-0000-0000-0000-000000000000'::uuid))
    )
  order by ci.posted_at desc, ci.id desc
  limit greatest(1, least(coalesce(p_limit, 12), 40));
$$;

-- SECURITY INVOKER is deliberate: the function runs as the caller, so every
-- row it returns has already passed the SELECT policies above. It is a
-- convenience layer, never a bypass.
revoke all on function public.levl_check_in_feed(text, int, timestamptz, uuid) from public;
grant execute on function public.levl_check_in_feed(text, int, timestamptz, uuid) to authenticated;

-- ============================================================================
-- SCENARIO CHECKS — paste into the SQL editor to verify the brief's cases.
-- Replace the UUIDs with real accounts. Each SELECT should return the comment.
-- ============================================================================
--
-- A) Friends-only visibility
--    set local role authenticated;
--    set local request.jwt.claims to '{"sub":"<BOB>","role":"authenticated"}';
--    select count(*) = 1 as bob_sees_alices_friends_post
--      from public.check_ins where user_id = '<ALICE>';
--    set local request.jwt.claims to '{"sub":"<CHARLIE>","role":"authenticated"}';
--    select count(*) = 0 as charlie_is_denied
--      from public.check_ins where user_id = '<ALICE>';
--
-- B) Public visibility — as CHARLIE, after Alice sets visibility='public':
--    select count(*) = 1 as charlie_sees_public_post
--      from public.check_ins where user_id = '<ALICE>';
--
-- C) Blocking — as ALICE: select public.levl_block_user('<BOB>');
--    then as BOB:
--    select count(*) = 0 as blocked_cannot_read from public.check_ins where user_id = '<ALICE>';
--    insert into public.check_in_reactions (check_in_id, user_id, reaction_type)
--      values ('<ALICE_POST>', '<BOB>', 'fire');   -- must raise: RLS violation
--
-- D) Cross-user modification — as BOB:
--    delete from public.check_in_comments where user_id = '<ALICE>';  -- 0 rows
--    delete from public.check_ins where user_id = '<ALICE>';          -- 0 rows
--
-- E) XP farming — as BOB, repeatedly:
--    select public.levl_award_check_in_xp(current_date, false);
--    -- first call returns the daily amount, every later call returns 0.
--    -- See 2805_social_xp.sql.
