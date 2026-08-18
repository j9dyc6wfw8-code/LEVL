-- ============================================================================
-- 2814 — CONTENT MODERATION (App Store Guideline 1.2)
--
-- Run AFTER 2813_close_legacy_holes.sql. Idempotent. Non-destructive.
--
-- WHY THIS FILE EXISTS
-- Guideline 1.2 asks for FOUR things from an app with user-generated content.
-- LEVL already had three of them and they are good:
--
--   ✅ report objectionable content   content_reports + the UI in SocialTab
--   ✅ block abusive users            levl_block_user(), symmetric
--   ✅ published contact              SUPPORT_EMAIL, shown in-app and in both policies
--   ❌ A METHOD FOR FILTERING         nothing at all
--
-- The fourth is the one Apple names first, and LEVL is an app whose central
-- social object is a photograph of a person's body. sanitiseComment() strips
-- control characters and trims length; levl_normalize_username() restricts the
-- character set. Neither of those is a filter — they would happily pass the
-- most abusive sentence you can construct.
--
-- This file adds two mechanisms:
--
--   1. A TERM BLOCKLIST applied to every free-text field a user can publish:
--      comments, captions, alt text, usernames and display names. It lives in a
--      table rather than in the app so the list can be extended in the
--      dashboard without shipping a build — which matters, because you will
--      learn what needs blocking after launch, not before.
--
--   2. AUTO-HIDE ON THRESHOLD. Three distinct reporters on one Check In
--      soft-deletes it immediately, pending your review. This is the mechanical
--      half of "act on reports within 24 hours" — it means the content is gone
--      within minutes even while you are asleep, and your review then decides
--      whether to restore it or remove the account.
--
-- WHAT THIS DELIBERATELY DOES NOT DO
-- It does not moderate the photographs. A term list cannot read an image. That
-- needs an image-classification call on upload and is tracked separately as a
-- P1 — the combination here is what Guideline 1.2 asks for literally, and it is
-- what can ship today.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 1. The list
--
--    Seeded with ~120 English terms across four categories: sexual/pornographic
--    (the one Apple names explicitly in 1.2), child safety, slurs, and
--    self-harm encouragement. That is enough to ship.
--
--    IT IS STILL ENGLISH-ONLY. If LEVL gets traction outside the UK, load a
--    maintained multi-language list on top — the usual choice is LDNOOBW ("List
--    of Dirty, Naughty, Obscene and Otherwise Bad Words"), public domain,
--    ~28 languages:
--      https://github.com/LDNOOBW/List-of-Dirty-Naughty-Obscene-and-Otherwise-Bad-Words
--    Paste it in as one insert; the primary key makes re-running harmless.
--
--    Tune it from the report queue rather than from imagination: the terms that
--    actually matter are the ones your users report, and you will not know them
--    until people are posting.
-- ---------------------------------------------------------------------------

create table if not exists public.blocked_terms (
  term       text primary key,
  severity   text not null default 'block' check (severity in ('block', 'review')),
  added_at   timestamptz not null default now()
);

comment on table public.blocked_terms is
  'Word blocklist applied to every user-publishable text field. RLS is enabled with NO policy on purpose: only the service role reads or edits it, and levl_contains_blocked() is SECURITY DEFINER so the filter still works. Edit in the dashboard — no app release required.';

alter table public.blocked_terms enable row level security;
-- No policy at all, deliberately. "RLS on, no policy" means no row is visible
-- to anon or authenticated — exactly right for a moderation word list, since
-- publishing it would be publishing the evasion guide. levl_contains_blocked()
-- is SECURITY DEFINER, so the filter still sees the table.
-- Supabase's linter reports this as INFO 0008; it is intended, not an oversight.
revoke all on public.blocked_terms from anon, authenticated;

-- Matching is on whole words after normalisation (see section 2), so short
-- entries are safe: 'rape' does not fire on "grapes", 'cum' does not fire on
-- "accumulate". Add and remove freely in the dashboard — it takes effect on the
-- next post, with no app release.
--
-- A handful of these will occasionally block an innocent sentence. That is the
-- intended direction of error: an over-blocked caption is one annoyed user who
-- rewords it, an under-blocked one is a Guideline 1.2 problem. If a term proves
-- noisy in practice, delete that row.
insert into public.blocked_terms (term) values
  -- sexual / pornographic — the category Apple names explicitly in 1.2
  ('porn'), ('porno'), ('pornography'), ('xxx'), ('nsfw'), ('nude'), ('nudes'),
  ('nudity'), ('naked'), ('sex'), ('sexy'), ('sexting'), ('sexcam'), ('camgirl'),
  ('camwhore'), ('onlyfans'), ('escort'), ('hooker'), ('prostitute'), ('brothel'),
  ('blowjob'), ('handjob'), ('rimjob'), ('cumshot'), ('creampie'), ('deepthroat'),
  ('gangbang'), ('bukkake'), ('hentai'), ('milf'), ('dildo'), ('vibrator'),
  ('buttplug'), ('anal'), ('anus'), ('vagina'), ('pussy'), ('cunt'), ('clit'),
  ('penis'), ('dick'), ('cock'), ('boobs'), ('tits'), ('titties'), ('nipples'),
  ('asshole'), ('arsehole'), ('butthole'), ('jerkoff'), ('masturbate'), ('fap'),
  ('orgasm'), ('ejaculate'), ('semen'), ('cum'), ('horny'), ('slut'), ('whore'),
  ('thot'), ('nympho'), ('incest'), ('bestiality'), ('zoophilia'),
  -- child safety — zero tolerance, and the fastest route to removal from sale
  ('pedo'), ('pedophile'), ('paedophile'), ('loli'), ('shota'), ('jailbait'),
  ('underage'), ('childporn'), ('child porn'), ('cp link'),
  -- sexual violence
  ('rape'), ('raping'), ('rapist'), ('molest'), ('molester'),
  -- slurs
  ('nigger'), ('nigga'), ('chink'), ('gook'), ('spic'), ('wetback'), ('kike'),
  ('paki'), ('raghead'), ('towelhead'), ('coon'), ('jigaboo'), ('beaner'),
  ('wop'), ('dago'), ('gyppo'), ('faggot'), ('fag'), ('dyke'), ('tranny'),
  ('shemale'), ('ladyboy'), ('retard'), ('retarded'), ('spastic'),
  ('mongoloid'), ('cripple'), ('midget'),
  -- self-harm encouragement and threats
  ('kill yourself'), ('killyourself'), ('kys'), ('neck yourself'),
  ('hang yourself'), ('slit your wrists'), ('drink bleach'),
  ('i will kill you'), ('doxx'), ('swatting')
on conflict (term) do nothing;


-- ---------------------------------------------------------------------------
-- 2. The check
--
--    NAIVE SUBSTRING MATCHING IS WRONG HERE, and it is worth saying why because
--    it is the obvious first implementation:
--
--        position('rape' in 'grapes')      > 0   ← "I ate grapes" is blocked
--        position('cum'  in 'accumulate')  > 0   ← "accumulate volume" is blocked
--        position('anal' in 'analysis')    > 0
--
--    A fitness app whose comment box rejects "grapes" is worse than one with no
--    filter, because the failure is invisible to the person who wrote it and
--    looks like a bug. So matching is on WORD BOUNDARIES (\m ... \M).
--
--    That alone would make the filter trivially avoidable, so the text is
--    normalised first: leetspeak folded (p0rn, f4g, $ex), then everything that
--    is not a letter or a space removed, so f.u.c.k and f-u-c-k collapse to the
--    word itself. Spaces survive, so separate words stay separate.
--
--    This is not, and cannot be, exhaustive. It is a filter, not a guarantee —
--    the report queue and the three-reporter auto-hide in section 5 are what
--    catch everything a word list never will.
-- ---------------------------------------------------------------------------

create or replace function public.levl_normalise_for_match(p text)
returns text
language sql
immutable
set search_path = ''
as $$
  -- 0->o 1->i 3->e 4->a 5->s 7->t 8->b @->a $->s !->i, then drop punctuation
  -- and collapse runs of whitespace.
  select btrim(regexp_replace(
           regexp_replace(
             translate(lower(coalesce(p, '')), '0134578@$!', 'oieastbasi'),
             '[^a-z ]', '', 'g'),
           ' +', ' ', 'g'));
$$;

create or replace function public.levl_contains_blocked(p text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.blocked_terms b,
         lateral (select public.levl_normalise_for_match(p) as t) n
    where b.severity = 'block'
      and n.t ~ ('\m' || regexp_replace(b.term, '([.^$*+?()\[\]{}|\\])', '\\\1', 'g') || '\M')
  );
$$;

revoke all on function public.levl_normalise_for_match(text) from public, anon, authenticated;
revoke all on function public.levl_contains_blocked(text)    from public, anon, authenticated;


-- ---------------------------------------------------------------------------
-- 3. Apply it to everything a user can publish
-- ---------------------------------------------------------------------------

-- Comments -------------------------------------------------------------------
create or replace function public.levl_guard_comment_text()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if public.levl_contains_blocked(new.body) then
    raise exception 'That comment breaks the LEVL community rules.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists levl_guard_comment_text_trg on public.check_in_comments;
create trigger levl_guard_comment_text_trg
  before insert or update of body on public.check_in_comments
  for each row execute function public.levl_guard_comment_text();

-- Check In captions and alt text ---------------------------------------------
create or replace function public.levl_guard_check_in_text()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if public.levl_contains_blocked(new.caption) or public.levl_contains_blocked(new.alt_text) then
    raise exception 'That caption breaks the LEVL community rules.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists levl_guard_check_in_text_trg on public.check_ins;
create trigger levl_guard_check_in_text_trg
  before insert or update of caption, alt_text on public.check_ins
  for each row execute function public.levl_guard_check_in_text();

-- Display names --------------------------------------------------------------
-- Usernames go through levl_set_username() (guarded in section 4), but
-- display_name is written straight from the profile upsert.
create or replace function public.levl_guard_profile_text()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if public.levl_contains_blocked(new.display_name) then
    raise exception 'That display name breaks the LEVL community rules.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists levl_guard_profile_text_trg on public.profiles;
create trigger levl_guard_profile_text_trg
  before insert or update of display_name on public.profiles
  for each row execute function public.levl_guard_profile_text();


-- ---------------------------------------------------------------------------
-- 4. Usernames
--
--    Re-declared with the blocklist check added. Everything else is byte for
--    byte what 2801 created — the normalisation, the length floor, the
--    taken-handle check and the error strings are unchanged.
-- ---------------------------------------------------------------------------

create or replace function public.levl_set_username(p_username text)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid  uuid := auth.uid();
  v_name text := public.levl_normalize_username(p_username);
begin
  if v_uid is null then
    raise exception 'Sign in first.' using errcode = 'P0001';
  end if;
  if v_name is null or char_length(v_name) < 3 then
    raise exception 'Usernames need at least 3 letters, numbers or underscores.' using errcode = 'P0001';
  end if;
  if public.levl_contains_blocked(v_name) then
    raise exception 'That username is not available.' using errcode = 'P0001';
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

revoke all on function public.levl_set_username(text) from public, anon;
grant execute on function public.levl_set_username(text) to authenticated;


-- ---------------------------------------------------------------------------
-- 5. Auto-hide on threshold
--
--    content_reports already has a unique index on (reporter, target_type,
--    target_id), so "three reports" genuinely means three different people —
--    one person cannot hide someone's post by reporting it repeatedly.
--
--    The hide is a SOFT delete. The row and the photographs survive for your
--    review, and every read path in 2803 already filters on `deleted_at is
--    null`, so the post and its photos disappear from every feed and every
--    signed URL the instant this fires.
-- ---------------------------------------------------------------------------

create or replace function public.levl_autohide_reported()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_reports int;
begin
  if new.target_type = 'check_in' then
    select count(distinct reporter) into v_reports
      from public.content_reports
     where target_type = 'check_in' and target_id = new.target_id;

    if v_reports >= 3 then
      update public.check_ins
         set deleted_at = coalesce(deleted_at, now())
       where id = new.target_id;
    end if;

  elsif new.target_type = 'comment' then
    select count(distinct reporter) into v_reports
      from public.content_reports
     where target_type = 'comment' and target_id = new.target_id;

    if v_reports >= 3 then
      update public.check_in_comments
         set deleted_at = coalesce(deleted_at, now())
       where id = new.target_id;
    end if;
  end if;

  return null;
exception when others then
  return null;   -- hiding must never make the report itself fail
end;
$$;

drop trigger if exists levl_autohide_reported_trg on public.content_reports;
create trigger levl_autohide_reported_trg
  after insert on public.content_reports
  for each row execute function public.levl_autohide_reported();


-- ---------------------------------------------------------------------------
-- 6. Your daily moderation queue
--
--    Guideline 1.2 obliges you to act within 24 hours. Bookmark this query and
--    run it once a day. It is the whole job.
-- ---------------------------------------------------------------------------

create or replace view public.moderation_queue as
  select
    r.target_type,
    r.target_id,
    count(distinct r.reporter)                as reporters,
    array_agg(distinct r.reason)              as reasons,
    min(r.created_at)                         as first_reported,
    max(r.created_at)                         as last_reported,
    r2.target_user                            as author,
    case
      when r.target_type = 'check_in'
        then (select ci.deleted_at is not null from public.check_ins ci where ci.id = r.target_id)
      when r.target_type = 'comment'
        then (select cc.deleted_at is not null from public.check_in_comments cc where cc.id = r.target_id)
      else null
    end                                       as already_hidden
  from public.content_reports r
  left join lateral (
    select target_user from public.content_reports x
     where x.target_type = r.target_type and x.target_id = r.target_id
       and x.target_user is not null limit 1
  ) r2 on true
  where r.status = 'open'
  group by r.target_type, r.target_id, r2.target_user
  order by count(distinct r.reporter) desc, min(r.created_at) asc;

comment on view public.moderation_queue is
  'Open reports, grouped by the content reported. Run daily — Guideline 1.2
   requires acting within 24 hours. `already_hidden` means the 3-reporter
   threshold fired and the content is out of every feed already.';

revoke all on public.moderation_queue from anon, authenticated;


-- ============================================================================
-- VERIFY
-- ============================================================================
--
-- 1. The filter refuses a blocked comment. Expect an exception.
--
--    begin;
--      select set_config('role','authenticated',true);
--      select set_config('request.jwt.claims','{"sub":"<USER>","role":"authenticated"}',true);
--      insert into public.check_in_comments (check_in_id, user_id, body)
--      values ('<A CHECK IN YOU CAN SEE>', '<USER>', 'buy nudes here');
--      -- expect: That comment breaks the LEVL community rules.
--    rollback;
--
-- 2. A normal comment still works.
--
--    ...same, with body 'huge session mate' — expect success.
--
-- 3. Three distinct reporters hide a post.
--
--    select target_id, reporters, already_hidden from public.moderation_queue;
--
-- 4. Your daily job:
--
--    select * from public.moderation_queue;
--    -- then, to action one:
--    --   update public.check_ins set deleted_at = now() where id = '<id>';
--    --   update public.content_reports set status='actioned' where target_id='<id>';
--    -- and to clear a false alarm:
--    --   update public.check_ins set deleted_at = null where id = '<id>';
--    --   update public.content_reports set status='dismissed' where target_id='<id>';


-- ---------------------------------------------------------------------------
-- 7. Applied-to-production addendum (migration: revoke_trigger_function_execute)
--
--    PostgREST exposes anything executable in `public`, so the trigger
--    functions above appeared at /rest/v1/rpc/<name> as soon as they existed.
--    levl_autohide_reported is SECURITY DEFINER, which is why Supabase's linter
--    singled it out. Same treatment 2806 gave the 2802 trigger functions.
-- ---------------------------------------------------------------------------

revoke execute on function public.levl_autohide_reported()   from public, anon, authenticated;
revoke execute on function public.levl_guard_comment_text()  from public, anon, authenticated;
revoke execute on function public.levl_guard_check_in_text() from public, anon, authenticated;
revoke execute on function public.levl_guard_profile_text()  from public, anon, authenticated;
