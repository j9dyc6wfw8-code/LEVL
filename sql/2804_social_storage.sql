-- ============================================================================
-- LEVL BUILD 28 — CHECK IN PHOTO STORAGE
--
-- Run AFTER 2803_social_rls.sql. Idempotent.
--
-- The bucket is PRIVATE. There is no permanent public URL for a Check In photo,
-- ever — the app fetches short-lived signed URLs, and Supabase only issues one
-- if the caller passes the SELECT policy below. That policy defers to
-- levl_can_view_check_in(), the same predicate the rows use, so a post flipped
-- from public to friends-only loses its images in the same instant it loses its
-- row. Hiding photos on the client only would have left the URLs working.
--
-- Object layout:   {user_id}/{yyyy-mm-dd}/{uuid}/front.jpg
--                  {user_id}/{yyyy-mm-dd}/{uuid}/rear.jpg
-- The first folder is the owner's user id, which is what every policy keys on.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. The bucket
--
--    5 MB ceiling is generous for a compressed 1440px JPEG (~400-700 KB) while
--    still refusing anything pathological.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('check-ins', 'check-ins', false, 5242880, array['image/jpeg', 'image/webp'])
on conflict (id) do update
  set public             = false,
      file_size_limit    = 5242880,
      allowed_mime_types = array['image/jpeg', 'image/webp'];

-- ---------------------------------------------------------------------------
-- 2. Policies on storage.objects
-- ---------------------------------------------------------------------------

drop policy if exists "check-ins upload own" on storage.objects;
create policy "check-ins upload own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'check-ins'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "check-ins update own" on storage.objects;
create policy "check-ins update own" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'check-ins'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'check-ins'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "check-ins delete own" on storage.objects;
create policy "check-ins delete own" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'check-ins'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Read: the owner always; anyone else only through a Check In they may view.
-- An object with no Check In pointing at it (an upload that was never posted,
-- or one whose post was deleted) is readable by its owner alone.
drop policy if exists "check-ins read visible" on storage.objects;
create policy "check-ins read visible" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'check-ins'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (
        select 1
        from public.check_ins ci
        left join public.check_in_preferences pr on pr.user_id = ci.user_id
        where (ci.front_photo_path = storage.objects.name or ci.rear_photo_path = storage.objects.name)
          and ci.deleted_at is null
          and not public.levl_is_blocked(ci.user_id, auth.uid())
          and (
            public.levl_are_friends(ci.user_id, auth.uid())
            or (ci.visibility = 'public' and coalesce(pr.public_discovery, true))
          )
      )
    )
  );

-- ---------------------------------------------------------------------------
-- 3. Cleanup helper
--
--    Called by the app after it has removed the objects through the storage
--    API, to clear the retry queue that 2802 fills on delete.
-- ---------------------------------------------------------------------------

create or replace function public.levl_drain_storage_cleanup(p_ids bigint[])
returns int
language sql
security definer
set search_path = public, pg_temp
as $$
  with gone as (
    delete from public.storage_cleanup_queue q
    where q.id = any(coalesce(p_ids, array[]::bigint[]))
      and q.user_id = auth.uid()
    returning 1
  )
  select coalesce(count(*), 0)::int from gone;
$$;

revoke all on function public.levl_drain_storage_cleanup(bigint[]) from public;
grant execute on function public.levl_drain_storage_cleanup(bigint[]) to authenticated;

alter table public.storage_cleanup_queue enable row level security;

drop policy if exists "read own cleanup queue" on public.storage_cleanup_queue;
create policy "read own cleanup queue" on public.storage_cleanup_queue
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "delete own cleanup queue" on public.storage_cleanup_queue;
create policy "delete own cleanup queue" on public.storage_cleanup_queue
  for delete to authenticated using (auth.uid() = user_id);
