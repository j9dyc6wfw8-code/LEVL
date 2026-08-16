-- ============================================================================
-- ASCEND — friend_requests RLS: ensure the RECEIVER can read incoming requests.
-- If a receiver can't SELECT the row, the request never appears to accept —
-- which is the most likely cause of "notification arrived but can't accept".
-- Idempotent: safe to run more than once.
-- ============================================================================

alter table public.friend_requests enable row level security;

drop policy if exists "read own friend_requests" on public.friend_requests;
create policy "read own friend_requests"
  on public.friend_requests for select to authenticated
  using (auth.uid() = sender or auth.uid() = receiver);

drop policy if exists "send friend_request" on public.friend_requests;
create policy "send friend_request"
  on public.friend_requests for insert to authenticated
  with check (auth.uid() = sender);

-- Either side may update status (sender cancels; receiver accepts/declines).
drop policy if exists "update own friend_requests" on public.friend_requests;
create policy "update own friend_requests"
  on public.friend_requests for update to authenticated
  using (auth.uid() = sender or auth.uid() = receiver);
