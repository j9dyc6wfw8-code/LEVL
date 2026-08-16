-- ============================================================================
-- ASCEND — bug_reports table + Row Level Security
-- Run once in Supabase → SQL Editor (or add to your migrations).
-- ============================================================================

create table if not exists public.bug_reports (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users(id) on delete set null,
  email        text,
  message      text not null,
  category     text default 'general',
  app_version  text,
  build_number text,
  platform     text,
  os_version   text,
  status       text default 'new',   -- flip to 'triaged' / 'fixed' as you work
  created_at   timestamptz not null default now()
);

alter table public.bug_reports enable row level security;

-- Signed-in users may insert their OWN report only.
create policy "insert own bug report"
  on public.bug_reports for insert to authenticated
  with check (auth.uid() = user_id);

-- Not-signed-in users (the "I can't even log in" case) may file an anonymous
-- report. Drop this policy if you want zero anonymous writes — those reports
-- will then arrive via the email fallback instead.
create policy "insert anon bug report"
  on public.bug_reports for insert to anon
  with check (user_id is null);

-- Users may read back only their own reports (harmless; enables a future
-- "my reports" screen). Nobody can read anyone else's.
create policy "read own bug report"
  on public.bug_reports for select to authenticated
  using (auth.uid() = user_id);

-- No UPDATE / DELETE policies => users can't edit or remove reports.
-- You manage everything from the Supabase dashboard (service role bypasses RLS).

create index if not exists bug_reports_created_idx
  on public.bug_reports (created_at desc);
