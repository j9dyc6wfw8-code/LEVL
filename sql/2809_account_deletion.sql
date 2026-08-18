-- ============================================================================
-- 2809 — account deletion (App Store Review Guideline 5.1.1(v))
--
-- APPLIED TO PRODUCTION 2026-08-18 as two migrations:
--   delete_own_account
--   fix_storage_cleanup_queue_survives_account_deletion
-- This file is the record of what is live.
--
-- WHAT THE SCHEMA ALREADY DID RIGHT
-- Every table holding user data already had ON DELETE CASCADE from auth.users,
-- and check_in_comments/check_in_reactions cascade from the check-in as well.
-- bug_reports.user_id, content_reports.target_user and duel_invites.claimed_by
-- are ON DELETE SET NULL, which is correct — those rows belong to somebody else
-- and survive, anonymised. So deleting the auth user does almost all the work.
--
-- THE TWO DEFECTS THAT MADE DELETION IMPOSSIBLE
-- Found by running a deletion end to end against a synthetic account rather than
-- assuming it worked:
--
--   1. levl_queue_check_in_cleanup() fires ON DELETE of check_ins and inserts a
--      row carrying old.user_id. Under a cascade that runs AFTER auth.users is
--      already gone, so the insert violated its foreign key and aborted the whole
--      transaction. Any user who had ever posted a Check In could not be deleted
--      at all — which is precisely the rejection this feature exists to avoid.
--
--   2. storage_cleanup_queue.user_id was NOT NULL and ON DELETE CASCADE, so even
--      once (1) was fixed, deleting the account would delete the queue rows that
--      exist to remove that account's photos from the bucket. The objects would
--      be stranded with nothing left pointing at them.
-- ============================================================================

-- (2) the queue must outlive the account it came from; the PATH is the point.
alter table public.storage_cleanup_queue alter column user_id drop not null;
alter table public.storage_cleanup_queue drop constraint storage_cleanup_queue_user_id_fkey;
alter table public.storage_cleanup_queue
  add constraint storage_cleanup_queue_user_id_fkey
  foreign key (user_id) references auth.users (id) on delete set null;

comment on column public.storage_cleanup_queue.user_id is
  'Who owned the object. Nullable and SET NULL on purpose: the queue entry must '
  'outlive the account so the object can still be removed from the bucket.';

-- (1) delete check-ins while the account still exists, so the cleanup trigger
--     fires against a live foreign key and queues the photos itself.
create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'delete_own_account: no authenticated user';
  end if;

  delete from public.check_ins  where user_id = me;   -- trigger queues the photos
  delete from public.bug_reports where user_id = me;  -- the user's own words
  delete from auth.users        where id = me;        -- everything else cascades
end;
$$;

comment on function public.delete_own_account() is
  'Deletes the calling user''s account and data. Removes check-ins first so photo '
  'cleanup is queued while the account still exists, then deletes the auth user '
  'so every remaining table cascades. Acts only on auth.uid().';

-- No parameter, so it can only ever delete the caller. anon cannot call it.
revoke all on function public.delete_own_account() from public, anon;
grant execute on function public.delete_own_account() to authenticated;
