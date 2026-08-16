-- ============================================================================
-- ASCEND — duel_invites: shareable "open" duel invites (join by link or code).
-- Run once in Supabase → SQL Editor. Idempotent.
-- ============================================================================

create table if not exists public.duel_invites (
  id         uuid primary key default gen_random_uuid(),
  code       text unique not null,
  creator    uuid not null references auth.users(id) on delete cascade,
  days       int  default 7,
  reward     int  default 500,
  status     text default 'open',   -- 'open' | 'claimed'
  claimed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.duel_invites enable row level security;

-- Anyone signed in can look up an invite by code in order to join it.
drop policy if exists "read duel_invites" on public.duel_invites;
create policy "read duel_invites"
  on public.duel_invites for select to authenticated using (true);

-- You can only create invites as yourself.
drop policy if exists "create duel_invites" on public.duel_invites;
create policy "create duel_invites"
  on public.duel_invites for insert to authenticated
  with check (auth.uid() = creator);

-- An open invite can be claimed (marked used); the creator can also update it.
drop policy if exists "update duel_invites" on public.duel_invites;
create policy "update duel_invites"
  on public.duel_invites for update to authenticated
  using (status = 'open' or auth.uid() = creator);

create index if not exists duel_invites_code_idx on public.duel_invites (code);
