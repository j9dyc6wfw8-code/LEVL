-- ============================================================================
-- 2810 — recorded terms acceptance (App Store Guideline 1.2)
-- APPLIED TO PRODUCTION 2026-08-18 as migration: record_terms_acceptance
--
-- A social app must have the user's AGREEMENT before they post, and agreement
-- has to be recorded — with a version — so it can be shown to have happened and
-- re-requested if the terms change materially. A link in Settings is not
-- agreement.
-- ============================================================================
alter table public.profiles
  add column if not exists terms_accepted_at timestamptz,
  add column if not exists terms_version     text;

comment on column public.profiles.terms_accepted_at is
  'When this user accepted the Terms of Use and Privacy Policy. Null means they
   have not, and the app must ask before they can post user content.';
comment on column public.profiles.terms_version is
  'Which version they accepted, so a material change can re-prompt only the
   people who accepted an older one.';

create or replace function public.accept_terms(p_version text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'accept_terms: no authenticated user';
  end if;
  if p_version is null or length(trim(p_version)) = 0 then
    raise exception 'accept_terms: a version is required';
  end if;

  update public.profiles
     set terms_accepted_at = now(),
         terms_version     = trim(p_version)
   where id = me;
end;
$$;

comment on function public.accept_terms(text) is
  'Records that the calling user accepted the given terms version. Acts only on auth.uid().';

revoke all on function public.accept_terms(text) from public, anon;
grant execute on function public.accept_terms(text) to authenticated;
