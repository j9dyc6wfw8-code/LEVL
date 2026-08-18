# LEVL — Pre-Launch Audit

**Date:** 18 August 2026
**Repo state:** `main` @ `b87f37e6`, working tree clean
**App version:** 1.1.0 (build 29) · bundle `com.matteo.ascend` · Expo SDK 54 · RN 0.81.5 · React 19.1
**Backend:** Supabase project `pndocotsoadxoklqwzys` (eu-central-1, Postgres 17.6) — **audited live, not just from SQL files**
**Method:** full repo read, live database interrogation (RLS policies, grants, triggers, webhook logs), test-suite run, `expo-doctor`, `npm audit`, targeted web research.

Confidence labels used throughout: **CONFIRMED** (I reproduced it), **LIKELY**, **POSSIBLE**, **NOT VERIFIED**.

---

## A. EXECUTIVE SUMMARY

### Is LEVL ready?

**No — but it is much closer than the finding count suggests, and the gap is narrow and specific.**

The craft in this codebase is genuinely above average. The test suite is real (34 engine assertions, 216 render checks, 191 interactive-state checks, a rules-of-hooks audit and an undefined-identifier audit — all passing). There are zero `console.log`s, zero TODOs, no committed secrets beyond the anon key (which is safe by design), a real privacy manifest in the native project, an offline-first resumable Check In uploader, server-computed workout snapshots, an XP ledger that genuinely cannot be farmed, and comment/RLS design that shows someone thought about adversaries. Most apps at this stage have none of that.

The problem is that **the newest, best security work sits on top of an older, permissive layer that was never removed**, and three legacy policies quietly cancel out the new ones. I confirmed all three by executing queries as a real user against your live production database.

### Biggest strengths

1. **The verified-session idea is a genuine differentiator.** A Check In cannot claim a workout — the database recomputes the summary from your own `workouts` rows (`levl_check_in_apply_workout`, sql/2802). "14 sets · 8,420 kg · VERIFIED" means something. Strava can't say that about a gym session; Hevy doesn't try.
2. **The XP economy is designed, not guessed.** `sql/2805_social_xp.sql` shows the actual arithmetic behind every number, and the ledger key `(user_id, local_date, award_kind)` makes post-delete-repost farming structurally impossible.
3. **Offline resilience where it matters.** Workout logging is fully local-first; the Check In uploader is a persisted state machine that survives an app kill mid-upload.
4. **Real engineering discipline.** CI runs the suite on every push. Migration files explain *why*, including their own past mistakes (2806 is a written post-mortem of 2801–2805).

### Biggest weaknesses

1. **Three confirmed cross-user data holes.** Any signed-in account can read every user's entire training history; any account can unilaterally make itself your "friend" and then see your friends-only Check In photographs; and *anyone at all* — no account needed — can write notification rows addressed to any user.
2. **Push notifications have never worked, not once.** The webhook posts to a Supabase *dashboard page URL* instead of the function endpoint. Every attempt returned HTTP 405.
3. **A silent, cascading sync failure is armed and waiting.** The server's weight ceiling (400 kg) is stricter than the client's (700 kg for leg press). One heavy leg press permanently breaks that user's entire cloud sync, invisibly.
4. **Your Privacy Policy and Terms are hosted on `claude.ai`.** Those are my artifact URLs, not yours. That is not a durable home for a document Apple requires and GDPR expects you to maintain.
5. **No content filtering.** Guideline 1.2 requires a *filtering* method, not just reporting and blocking. LEVL has reporting and blocking (good) but zero filtering of comments, captions, usernames or photographs — in an app whose core social object is a photograph of a person's body.

### Biggest risks

- **Trust collapse on day one.** If someone works out that another user's full lifting history is readable, that is the story about LEVL, and it is unrecoverable for a fitness app.
- **Rejection.** The most likely rejection reasons, in order: 1.2 (no content filtering), 5.1.1 (privacy policy on a third-party host; placeholder microphone purpose string), 2.4.1/4.0 (iPad claimed but portrait-designed).
- **Silent data divergence.** The sync failure above produces users whose duel scores freeze, leaderboard stats freeze and Check Ins stop verifying — with no error anywhere.

### Biggest opportunities

- **Name the differentiator out loud.** "Verified Session" is your moat and it is currently a small label on a card. It should be the reason someone downloads LEVL.
- **Fix the empty-state problem with the thing you already built.** The public Check In feed exists. A brand-new account with zero friends should land in a populated global feed, not a blank one.
- **The rest timer, previous-session recall and Live Activity are already shipped** — they are competitive with Hevy on the fast-logging axis. That is a stronger position than you may realise.

**Verdict: 🔴 NO-GO today. 🟡 CONDITIONAL GO after roughly a day of work**, almost all of it SQL I can write for you.

---

## B. 🚨 P0 — DO NOT LAUNCH UNTIL FIXED

---

### P0-1 — Every user's entire training history is readable by every other user

**Status: CONFIRMED (reproduced against production).**

**Problem.** `public.workouts` carries five carefully-scoped SELECT policies (own / friends / duel partner) — and one legacy policy that makes all of them irrelevant.

**Evidence.** Live policy on `public.workouts`:

| policy | cmd | roles | using |
|---|---|---|---|
| `workouts readable` | SELECT | `{public}` | `auth.role() = 'authenticated'` |

RLS policies are OR-ed. This one grants every signed-in account SELECT on every row.

I executed, as user `08906651…` (who owns 18 workout rows):

```sql
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"08906651-…","role":"authenticated"}',true);
select count(*) from public.workouts where user_id <> '08906651-…';
```

→ **`610`**. That account can read 610 workout rows belonging to 20 other people. Total table size: 628.

**Where.** Database policy `workouts readable` on `public.workouts`. It is not in any file in `sql/` — it predates `sql/workouts.sql` and survived every later migration. The scoped policies that *were* meant to govern this live in [sql/workouts.sql](sql/workouts.sql).

**What could happen.** Any user who extracts the anon key from the app binary (trivial — it is in `app.json` → the bundle) and signs up can dump every LEVL user's complete lifting history: exercises, loads, dates, bodyweight-derived context. Your Privacy Policy states *"Your training log is private by default."* It is not. That is both a trust catastrophe and a GDPR accuracy problem.

**Exact fix.**

```sql
drop policy if exists "workouts readable" on public.workouts;
```

The three scoped policies already cover every legitimate read path. Then tighten the duel-partner policy, which currently includes `status = 'pending'` — a *pending* (unaccepted) challenge should not open your log:

```sql
drop policy if exists "read duel partner workouts" on public.workouts;
create policy "read duel partner workouts" on public.workouts
  for select to authenticated
  using (exists (
    select 1 from public.duels d
    where d.status = 'active'
      and workouts.date between d.start_date and d.end_date
      and ((d.player_one = auth.uid() and d.player_two = workouts.user_id)
        or (d.player_two = auth.uid() and d.player_one = workouts.user_id))));
```

**How you verify.** Re-run the query above as a user who has no friends and no active duel. Expected result: only their own rows.

---

### P0-2 — Any account can make itself your friend without asking, then read your private Check In photos

**Status: CONFIRMED (reproduced against production).**

**Problem.** The `friends` INSERT policy only checks that *you are one of the two people in the row*. It does not check that the other person agreed.

**Evidence.** Live policy:

```
friends / "create own friendships" / INSERT / {public}
  with check: ((auth.uid() = user_one) OR (auth.uid() = user_two))
```

I inserted, as user A, a friendship edge with an unrelated user B (rolled back afterwards):

```sql
insert into public.friends (user_one, user_two) values ('08906651-…','475b529b-…');
-- → 1 row created, no RLS violation
```

**Where.** `public.friends` RLS. The client path that needs it is [`acceptRequest()` in src/services/supabase/friendService.js:74](src/services/supabase/friendService.js) — it writes the edge from the phone, so the policy was widened to let it.

**What could happen.** Because friendship is the key to friends-only content, a forged edge grants the attacker:
- your friends-only Check In **photographs** (via the `check-ins` storage read policy in sql/2804, which defers to `levl_are_friends`),
- your workouts (already exposed by P0-1, but this survives the P0-1 fix),
- your presence in their friends leaderboard.

Worse, it is *bidirectional* — the edge is symmetric, so the victim now sees a stranger in their friends list with no idea how they got there.

**Exact fix.** Move edge creation into a `SECURITY DEFINER` RPC that verifies consent, and close the direct INSERT.

```sql
create or replace function public.accept_friend_request(p_sender uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); a uuid; b uuid;
begin
  if me is null then raise exception 'Sign in first.' using errcode='P0001'; end if;
  if not exists (select 1 from public.friend_requests r
                 where r.sender = p_sender and r.receiver = me and r.status = 'pending')
  then raise exception 'No pending request from that person.' using errcode='P0001'; end if;
  if public.levl_is_blocked(me, p_sender)
  then raise exception 'That person is blocked.' using errcode='P0001'; end if;

  update public.friend_requests set status='accepted'
   where sender=p_sender and receiver=me;
  a := least(me::text, p_sender::text)::uuid;
  b := greatest(me::text, p_sender::text)::uuid;
  insert into public.friends (user_one, user_two) values (a,b) on conflict do nothing;
end; $$;
revoke all on function public.accept_friend_request(uuid) from public, anon;
grant execute on function public.accept_friend_request(uuid) to authenticated;

drop policy if exists "create own friendships" on public.friends;
-- no INSERT policy at all: the RPC is now the only way in.
```

Then change [friendService.js `acceptRequest()`](src/services/supabase/friendService.js:74) to a single `supabase.rpc('accept_friend_request', { p_sender: senderId })`.

Also close the related hole: `friend_requests` UPDATE currently allows **either** party to set any status, so a *sender* can mark their own request `accepted`.

```sql
drop policy if exists "update own friend_requests" on public.friend_requests;
drop policy if exists "update own requests" on public.friend_requests;
create policy "receiver answers request" on public.friend_requests
  for update to authenticated
  using (auth.uid() = receiver) with check (auth.uid() = receiver);
create policy "sender cancels request" on public.friend_requests
  for delete to authenticated using (auth.uid() = sender);
```

**How you verify.** As user A, attempt the raw insert above → expect `new row violates row-level security policy`. Then send and accept a request through the app end to end and confirm both sides see each other.

---

### P0-3 — Anyone on the internet can send push notifications to any LEVL user

**Status: CONFIRMED (reproduced as both `authenticated` and `anon`).**

**Problem.** `public.notifications` has an INSERT policy of `with check (true)` granted to the `public` role — which includes `anon`, the role your shipped API key runs as. Every insert fires the push trigger.

**Evidence.** Live policy:

```
notifications / "insert notifications for anyone" / INSERT / {public} / with check: true
```

Grants: `anon` holds `INSERT` on `public.notifications`.

As `anon`, with no session at all:

```sql
select set_config('role','anon',true);
insert into public.notifications (user_id, kind, payload, read)
  values ('475b529b-…','duel_challenge','{"anon_spoof":true}'::jsonb,false);
reset role;
select count(*) from public.notifications where payload->>'anon_spoof'='true';  -- → 1
```

**Where.** `public.notifications` RLS + the `levl_push` trigger. The legitimate caller is [`notify()` in src/services/supabase/notificationService.js](src/services/supabase/notificationService.js), used by `friendService.sendRequest` and `duelService.challenge` — those write a notification *for someone else*, which is why the policy was opened all the way.

**What could happen.** Once P0-4 is fixed and push works, anyone with the anon key (extractable from the IPA in minutes) can:
- push arbitrary text to every LEVL user in a loop — harassment, phishing (*"Tap to verify your account"*), or simply enough noise that every user disables notifications permanently;
- fabricate friend requests and duel challenges in the in-app inbox;
- exhaust your Expo push quota.

There is no rate limit anywhere on this path.

**Exact fix.** Notifications should never be client-writable. Route each one through a `SECURITY DEFINER` function that decides, from `auth.uid()`, whether the caller is allowed to notify that person about that thing.

```sql
create or replace function public.levl_notify(p_user uuid, p_kind text, p_payload jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid();
begin
  if me is null or p_user is null or p_user = me then return; end if;
  if p_kind not in ('friend_request','duel_challenge') then
    raise exception 'Unsupported notification kind.' using errcode='P0001';
  end if;
  if public.levl_is_blocked(p_user, me) then return; end if;

  -- the caller must actually have done the thing they are notifying about
  if p_kind = 'friend_request' and not exists (
       select 1 from public.friend_requests r
        where r.sender = me and r.receiver = p_user and r.status='pending')
  then return; end if;
  if p_kind = 'duel_challenge' and not exists (
       select 1 from public.duels d
        where d.status in ('pending','active')
          and ((d.player_one=me and d.player_two=p_user) or (d.player_two=me and d.player_one=p_user)))
  then return; end if;

  -- cheap flood guard: at most 20 notifications per sender per hour
  if (select count(*) from public.notifications n
       where n.created_at > now() - interval '1 hour'
         and n.payload->>'from' = me::text) >= 20
  then return; end if;

  insert into public.notifications (user_id, kind, payload, read)
  values (p_user, p_kind, coalesce(p_payload,'{}'::jsonb) || jsonb_build_object('from', me), false);
end; $$;
revoke all on function public.levl_notify(uuid,text,jsonb) from public, anon;
grant execute on function public.levl_notify(uuid,text,jsonb) to authenticated;

drop policy if exists "insert notifications for anyone" on public.notifications;
revoke insert on public.notifications from anon, authenticated;
```

(The existing DB triggers `levl_notify_social` and `claim_duel_invite` insert as the table owner and are unaffected.)

Then point [`notify()`](src/services/supabase/notificationService.js) at `supabase.rpc('levl_notify', …)`.

**How you verify.** Repeat the `anon` insert above → expect `permission denied for table notifications`. Then send a friend request through the app and confirm the row still appears in the recipient's inbox.

---

### P0-4 — Push notifications have never been delivered. Not once.

**Status: CONFIRMED (from `net._http_response`).**

**Problem.** The Database Webhook that turns a `notifications` row into a push is pointed at the wrong URL — a Supabase *dashboard web page*, not your Edge Function.

**Evidence.** The live trigger definition:

```
CREATE TRIGGER levl_push AFTER INSERT ON public.notifications FOR EACH ROW
EXECUTE FUNCTION supabase_functions.http_request(
  'https://supabase.com/dashboard/project/pndocotsoadxoklqwzys/functions',   ← the dashboard page
  'POST', '{"Content-type":"application/json","x-levl-secret":"eb…b2"}', '{}', '5000')
```

The correct endpoint is `https://pndocotsoadxoklqwzys.supabase.co/functions/v1/push`.

Every delivery attempt ever made:

```
id | status_code | created
 3 |     405     | 2026-08-18 11:34:54
 5 |     405     | 2026-08-18 12:33:02
 6 |     405     | 2026-08-18 12:33:02
```

**405 Method Not Allowed** — the dashboard website rejecting a POST. Three attempts, three failures, zero pushes.

**There is a second defect stacked behind it.** The `push` Edge Function is deployed with `verify_jwt: true`, and the webhook sends no `Authorization` header. Fixing only the URL will convert every 405 into a 401.

**Third:** only **1 of 7** `check_in_preferences` rows holds an `expo_push_token`. Token registration happens in [useCheckInPreferences.js:123](src/hooks/useCheckInPreferences.js) and only after notification permission is granted — so even with the pipeline fixed, six of seven testers would receive nothing.

**Where.** Trigger `levl_push` on `public.notifications`; Edge Function `push` (`verify_jwt`); [supabase/functions/push/index.ts](supabase/functions/push/index.ts) (the function code itself is well written and is not the problem).

**What could happen.** Every retention mechanism that depends on someone else's action — friend requests, comments, duel challenges, duel results — is silently dead. Your in-app inbox works over Realtime, so the app *looks* fine while it is open; the failure only shows up as "nobody ever comes back".

**Exact fix.** Three steps, all in the Supabase dashboard:

1. **Database → Webhooks →** edit `levl_push`, set the URL to `https://pndocotsoadxoklqwzys.supabase.co/functions/v1/push`.
2. **Edge Functions → push → Details →** turn **Verify JWT** off (the function already authenticates via `x-levl-secret`), *or* add an `Authorization: Bearer <service_role key>` header to the webhook. Turning verify_jwt off is simpler and the shared secret is the real gate.
3. **Rotate `x-levl-secret`.** It is currently stored in plaintext inside the trigger definition, readable by anything that can read `pg_trigger`. Generate a new value, update both the webhook header and the function's `PUSH_HOOK_SECRET` env var.

⚠️ **Do P0-3 before this.** Fixing push while `notifications` is world-writable arms the spam cannon.

**How you verify.** After fixing, insert a test notification for yourself from the SQL editor, then:

```sql
select id, status_code, left(content,200) from net._http_response order by created desc limit 3;
```

Expect `200` and a body containing `"sent":true`. Then confirm the push actually lands on a physical device with the app fully closed.

---

### P0-5 — One heavy leg press permanently and silently breaks a user's entire cloud sync

**Status: CONFIRMED (by reading both validators; not yet reproduced end to end).**

**Problem.** The server's plausibility trigger is *stricter* than the client's, so the app happily accepts lifts the database will reject — and the rejection takes down the whole batch, forever, silently.

**Evidence.**

Client ceilings — [src/engine/engine.js:277](src/engine/engine.js):
```js
const LIFT_CAPS_KG = { 'Leg Press': 700, 'Rack Pull': 520, 'Hip Thrust': 500, 'Deadlift': 460, … };
```

Server ceiling — [sql/2811_leaderboard_integrity.sql](sql/2811_leaderboard_integrity.sql), live as trigger `levl_validate_workout_trg`:
```sql
if new.weight > (case when new.unit = 'lb' then 900 else 400 end) then
  raise exception 'workout rejected: weight % % above the plausible ceiling', …
```

A 450 kg leg press is accepted by the app and rejected by the database.

The failure then cascades, because of three things that are individually reasonable:
1. [`pushWorkouts()`](src/services/supabase/workoutService.js:47) upserts **all rows in one statement** — one bad row aborts the whole batch.
2. [`recentWorkoutEntries()`](src/hooks/useGameSave.js:47) re-sends **the last 500 entries of the past 30 days** on every sync. The poisoned row is included every single time.
3. [`syncPublicWorkoutActivity(...).catch(() => {})`](src/hooks/useGameSave.js:159) swallows the error. Nothing is shown, nothing is logged.

**What could happen.** For any user who logs one heavy leg press, hip thrust or rack pull:
- no workout ever reaches the cloud again, for 30 days minimum and in practice indefinitely;
- their duel score freezes (duel scores are computed from `public.workouts`);
- their `weekly_xp`, `best_e1rm` and `consistency` freeze (derived server-side from `workouts` by `levl_recompute_profile_stats`);
- Check In verification stops working (the trigger matches on `session_id` in `workouts`);
- reinstalling the app loses everything not in the last local save.

And they will never see an error. This is the single most damaging reliability defect in the app.

**Exact fix — do both halves.**

*Server side*, make the ceiling match the client's per-exercise reality rather than a flat 400:

```sql
create or replace function public.levl_validate_workout()
returns trigger language plpgsql set search_path = '' as $$
declare w_kg numeric;
begin
  if new.reps is not null and (new.reps < 0 or new.reps > 50) then
    raise exception 'workout rejected: reps % outside 0-50', new.reps using errcode='P0001'; end if;
  w_kg := coalesce(new.weight,0) * (case when new.unit='lb' then 0.45359237 else 1 end);
  -- 720 kg clears the heaviest client ceiling (Leg Press 700) with headroom.
  if w_kg > 720 then
    raise exception 'workout rejected: % kg above the plausible ceiling', round(w_kg) using errcode='P0001'; end if;
  if new.duration is not null and new.duration > 360 then
    raise exception 'workout rejected: % minutes exceeds the daily cardio ceiling', new.duration using errcode='P0001'; end if;
  if new.xp_earned is not null and (new.xp_earned < 0 or new.xp_earned > 4000) then
    raise exception 'workout rejected: xp_earned % outside 0-4000', new.xp_earned using errcode='P0001'; end if;
  if new.date is not null and new.date > now() + interval '1 day' then
    raise exception 'workout rejected: dated in the future' using errcode='P0001'; end if;
  return new;
end; $$;
```

*Client side*, stop one bad row from poisoning the batch. In `pushWorkouts`, on a `P0001` rejection, fall back to chunked upserts (say 50 rows) so only the offending chunk fails, and surface the failure through `warnOnce` + `telemetry.captureError` so it is visible rather than silent.

**How you verify.** Log a 450 kg leg press on a test account, then check `select count(*) from public.workouts where user_id = '<you>'` grows. Before the fix it will not.

---

### P0-6 — No method for filtering objectionable content (App Store Guideline 1.2)

**Status: CONFIRMED (by absence).**

**Problem.** Apple's Guideline 1.2 requires apps with user-generated content to implement, at minimum: *a method for filtering objectionable material*, a mechanism to report it, the ability to block abusive users, and published contact info — and to act on reports within 24 hours.

LEVL has **three of the four**:

| 1.2 requirement | LEVL today |
|---|---|
| Filter objectionable content | ❌ **nothing** |
| Report mechanism | ✅ [SocialTab.js:69 `runReport`](src/screens/SocialTab.js) → `content_reports` |
| Block abusive users | ✅ `levl_block_user()`, symmetric, tears down the friendship |
| Published contact info | ✅ `SUPPORT_EMAIL` in [src/services/legal.js](src/services/legal.js) |
| Act within 24h | ⚠️ process, not code — see below |

**Evidence.** [`sanitiseComment()` in checkInService.js:514](src/services/supabase/checkInService.js) strips control characters and trims length. That is it. `levl_normalize_username` restricts the character set but permits any word. There is no check on captions, alt text, display names, or — most importantly — on the **photographs**, which are the primary content object in a Check In.

**What could happen.** This is the single most likely rejection reason for LEVL. A reviewer creating an account, posting a Check In and finding no filtering in an app built around photos of people's bodies is a straightforward 1.2 rejection. It is also a genuine safety issue independent of Apple: nothing stops a user uploading explicit imagery to a feed other users can see.

**Exact fix (minimum viable, shippable in an afternoon).**

1. **A word blocklist applied to every free-text field** — comments, captions, alt text, `display_name`, `username`. Put it in Postgres so it applies to all clients and can be updated without a build:

```sql
create table if not exists public.blocked_terms (term text primary key);
create or replace function public.levl_contains_blocked(p text)
returns boolean language sql stable set search_path='' as $$
  select exists (select 1 from public.blocked_terms b
                 where position(b.term in lower(coalesce(p,''))) > 0);
$$;
```
Add a `before insert or update` trigger on `check_in_comments` and `check_ins` that raises on a hit, and a check inside `levl_set_username`. Seed `blocked_terms` from any public profanity/slur list.

2. **Make the report queue actionable.** A report currently lands in `content_reports` and nothing happens. Add a `deleted_at`-setting admin path (service role, dashboard) and — critically — **auto-hide on threshold**: three distinct reporters on one Check In soft-deletes it pending review. That is the mechanical part of "act within 24 hours".

3. **State the policy.** Add an "Objectionable content is not tolerated; reported content is reviewed within 24 hours and offending accounts are removed" clause to your Terms, and show the same line in the Check In composer the first time someone posts.

4. **Recommended but not strictly required:** an image-moderation pass on upload. Cheapest credible option is an Edge Function calling a moderation API on the compressed JPEG before the row is inserted. Flag as P1 rather than P0 only because the blocklist + report-threshold combination is what Apple asks for literally.

**How you verify.** Post a comment containing a seeded blocked term → expect a clear user-facing refusal. Report the same Check In from three accounts → expect it to disappear from the feed.

Source: [App Review Guidelines §1.2](https://developer.apple.com/app-store/review/guidelines/)

---

### P0-7 — Your Privacy Policy and Terms are hosted on claude.ai

**Status: CONFIRMED.**

**Problem.** [src/services/legal.js](src/services/legal.js):

```js
export const PRIVACY_URL = 'https://claude.ai/code/artifact/cb1a58e5-…';
export const TERMS_URL   = 'https://claude.ai/code/artifact/99ef57a5-…';
```

I fetched the privacy URL. It resolves, it is shared-with-link, and **the content is excellent** — clear, honest, accurate about Apple Health staying on-device, correct about Supabase in the EU. The document is not the problem. The *hosting* is.

**What could happen.**
- App Store Connect requires a Privacy Policy URL that is publicly accessible and remains so. A `claude.ai/code/artifact/<uuid>` link is a share-pinned page on infrastructure you do not own, do not control, and cannot guarantee. If the pin moves, the share is revoked, or the URL scheme changes, your live App Store listing points at nothing.
- The artifact system explicitly notes that viewers stay on a pinned version and **will not see future publishes** — so a policy update may not reach the people the policy governs. Under UK/EU GDPR you must be able to publish an updated notice; you currently cannot reliably.
- A reviewer clicking through to `claude.ai` for a fitness app's privacy policy is, at best, a question they did not need to have.

**Exact fix.** You already have the source files — [docs/privacy.html](docs/privacy.html) and [docs/terms.html](docs/terms.html) are committed and complete. Host them somewhere you own:

- **Fastest free option:** push this repo to GitHub, enable Pages on `/docs`, and the URLs become `https://<you>.github.io/levl/privacy.html`. (Note: **this repo currently has no git remote at all** — `git remote -v` is empty. Nothing is backed up anywhere.)
- **Better:** buy a domain (`levl.app` is listed for sale; anything works) and point it at the same files.

Then update the two constants in `src/services/legal.js`, set the same URL in App Store Connect, and cut a build.

**How you verify.** Open both URLs in a private browser window with no session. They must render fully with no login prompt.

---

## C. 🔴 P1 — FIX BEFORE PUBLIC LAUNCH

---

### P1-1 — Either player can declare themselves the winner of a duel

**Status: CONFIRMED (policy inspection).**

**Problem.** `duels` UPDATE policy:
```
using: ((auth.uid() = player_one) OR (auth.uid() = player_two))    -- no WITH CHECK, no column grants
```
With no column-level restriction, a participant can `update duels set winner = <self>, player_one_score = 999999, reward = 50000 where id = …`. The `enforce_friend_duel_integrity` trigger validates players and the time window — it does **not** validate scores or the winner.

Then `claim_friend_duel_rewards()` pays out `d.reward` to `d.winner`. The forgery is directly monetisable in coins/XP.

**Fix.** Take score/winner/reward away from the client, exactly as 2811 did for `profiles`:

```sql
revoke update on public.duels from authenticated;
grant update (status) on public.duels to authenticated;   -- accept/decline only
```
and compute scores and the winner in a `SECURITY DEFINER` function that sums `workouts.xp_earned` inside the duel window (the logic already exists in [`workoutXpTotals()`](src/services/supabase/duelService.js:26) — port it to SQL). Cap `reward` server-side at the `DUEL_TIERS` values.

**Verify.** As a duel participant, `update public.duels set winner = auth.uid()` → expect permission denied.

---

### P1-2 — Deleting a workout in the app does not delete it from the cloud

**Status: CONFIRMED.**

**Problem.** [`deleteEntry`](src/hooks/useGameSave.js:336) calls `removeEntryPure` — a local-save transform. `pushWorkouts` only ever *upserts*. There is no delete call anywhere in `workoutService.js`, and `public.workouts` has **no DELETE policy**, so the client could not delete even if it tried.

**What could happen.** A user logs 300 kg bench by typo, notices, deletes it. Locally it is gone. In the cloud it lives forever, and since `sql/2811` now derives `best_e1rm`, `weekly_xp` and `consistency` *from that table*, the typo permanently sits at the top of the Strength leaderboard. It also keeps counting toward any duel that overlaps its date. The user sees their own app say one thing and the leaderboard say another — which is precisely the "inconsistent stats" trust failure that makes people delete fitness apps.

**Fix.**
```sql
create policy "delete own workouts" on public.workouts
  for delete to authenticated using (auth.uid() = user_id);
```
and in `deleteEntry`, call `supabase.from('workouts').delete().eq('user_id', uid).eq('client_id', id)`. The `levl_workouts_touch_profile` trigger already fires on DELETE, so derived stats self-correct.

**Verify.** Log a set, sync, delete it, check `select count(*) from workouts where client_id='<id>'` → 0, and confirm `best_e1rm` drops.

---

### P1-3 — A Check In's owner can rewrite other people's comments

**Status: CONFIRMED (policy inspection).**

**Problem.** The `update own comment` policy on `check_in_comments` grants UPDATE to the *post owner* as well as the comment author, with a matching `with check`. The intent (per the comment in sql/2803) was to let the host **hide** a comment by setting `deleted_at`. Nothing restricts it to that column — the owner can rewrite `body`.

**What could happen.** Putting words in another user's mouth, attributed to them, on your feed. A genuinely nasty UGC failure mode.

**Fix.** Split it: author may edit; owner may only soft-delete.
```sql
drop policy if exists "update own comment" on public.check_in_comments;
create policy "author edits own comment" on public.check_in_comments
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
```
and give the host a `SECURITY DEFINER` `levl_hide_comment(uuid)` that only sets `deleted_at` after checking the caller owns the Check In.

---

### P1-4 — Anyone can enumerate and hijack duel invite codes

**Status: CONFIRMED.**

`duel_invites` SELECT is `using (true)` and UPDATE is `using (status='open' OR auth.uid()=creator)`. Any signed-in user can list every invite code that exists and claim one intended for someone else, or flip an open invite's `days`/`reward`/`status`.

**Fix.** Remove the blanket SELECT (the claim path is already the `claim_duel_invite` RPC, which looks up by code as `SECURITY DEFINER` and does not need a client-side read), and drop the client UPDATE entirely:
```sql
drop policy if exists "read duel_invites" on public.duel_invites;
drop policy if exists "update duel_invites" on public.duel_invites;
create policy "read own duel_invites" on public.duel_invites
  for select to authenticated using (auth.uid() = creator or auth.uid() = claimed_by);
```

---

### P1-5 — `levl_recompute_profile_stats` is callable by anyone, unauthenticated

**Status: CONFIRMED (Supabase security advisor + grant inspection).**

Supabase's linter flags it: `public.levl_recompute_profile_stats(p_user uuid)` is a `SECURITY DEFINER` function executable by `anon` at `/rest/v1/rpc/levl_recompute_profile_stats`. It takes an arbitrary user id and performs a full recompute + `UPDATE profiles` for that user.

It cannot forge values (it derives from that user's own workouts), so this is not a data-integrity break — but it is an **unauthenticated write amplification vector**: loop it over every user id and you generate unbounded database load with no account.

**Fix.**
```sql
revoke execute on function public.levl_recompute_profile_stats(uuid) from public, anon, authenticated;
revoke execute on function public.levl_workouts_touch_profile() from public, anon, authenticated;
```
Triggers still work — Postgres invokes them as the table owner.

Also from the same advisor run: **Leaked-password protection is disabled.** Turn it on (Authentication → Policies → "Prevent use of leaked passwords"). Free, one click, and your minimum password length is only 6 characters ([AuthScreens.js:238](src/screens/AuthScreens.js)) — raise that to 8 while you are there.

---

### P1-6 — iPad support is claimed but the app is designed for portrait iPhone

**Status: CONFIRMED (config inspection). LIKELY rejection risk.**

`app.json` sets `"supportsTablet": true`, and the committed `ios/LEVL/Info.plist` contains:
```
UISupportedInterfaceOrientations~ipad = [Portrait, PortraitUpsideDown, LandscapeLeft, LandscapeRight]
UIRequiresFullScreen = false
```

So on iPad the app rotates to landscape and participates in Split View / Slide Over. Every screen in `src/screens/` is laid out for a phone; `Dimensions.get('window')` is read at module scope in [Intro.js:17](src/screens/Intro.js), which means the intro carousel will be measured once at launch and break on any rotation or Split View resize.

Reviewers do test iPad when an app claims it. Guideline 2.4.1 (apps must run on the device they claim) and 4.0 (design).

**Fix — pick one:**
- **Recommended, 2 minutes:** set `"supportsTablet": false` in app.json **and** in the committed Xcode project (`TARGETED_DEVICE_FAMILY = 1`). Ship iPhone-only; add iPad later as a real project.
- Or lock iPad to portrait and set `UIRequiresFullScreen = true`, and actually test every screen at 1024×1366.

⚠️ Because `ios/` is committed (see P1-7), changing `app.json` alone will **not** take effect.

---

### P1-7 — `app.json` changes silently do nothing, because `ios/` is committed

**Status: CONFIRMED (`expo-doctor`).**

```
✖ Check for app config fields that may not be synced in a non-CNG project
  … EAS Build will not sync: orientation, userInterfaceStyle, scheme,
  backgroundColor, icon, splash, ios, android, plugins.
```

The committed `ios/` directory is deliberate and correctly justified in [.easignore](.easignore) — EAS needs the Xcode project to exist to resolve widget signing. The consequence is that **`app.json` is now documentation, not configuration**: `infoPlist`, `buildNumber`, `usesAppleSignIn`, `privacyManifests`, `supportsTablet` and the whole `plugins` array are ignored at build time.

I verified the native project is currently *correct* — `ios/LEVL/Info.plist` has all three usage descriptions, `ios/LEVL/PrivacyInfo.xcprivacy` exists, and 25 pods ship their own manifests. So nothing is broken today. But this is a loaded footgun: the next time you edit `app.json` expecting an effect, you will get none, and you may not notice until a reviewer does.

**Fix.** No code change. Add a prominent note at the top of `app.json` (and your build checklist) stating that iOS config must be edited in `ios/LEVL/Info.plist` and the Xcode project, and that `app.json`'s `ios` block is a mirror kept for reference only. Optionally add a CI check that diffs the two.

---

### P1-8 — Placeholder microphone purpose string for a capability you do not use

**Status: CONFIRMED.**

`ios/LEVL/Info.plist`:
```
NSMicrophoneUsageDescription = "Allow $(PRODUCT_NAME) to access your microphone"
```

That is Expo's default boilerplate. LEVL never records audio (`recordAudioAndroid: false`, no audio APIs anywhere in `src/`). Apple rejects generic purpose strings under 5.1.1, and declaring a permission you do not use invites the question.

**Fix.** Delete the key from `ios/LEVL/Info.plist`. (Also remove `NSMicrophoneUsageDescription` from the pod-generated config if expo-camera re-adds it — set `"recordAudioAndroid": false` is already there; the iOS equivalent is simply not shipping the key.)

---

### P1-9 — 3.5 seconds of forced splash on every single cold start

**Status: CONFIRMED.**

[App.js:95](App.js) `const SPLASH_MS = 3500;` and [App.js:571](App.js) `if (stage === 'boot' || !splashDone) return <BootScreen duration={SPLASH_MS} />;`

Every launch — including the fiftieth launch, including a launch from a notification tap, including a launch mid-workout to log the next set — blocks for 3.5 seconds regardless of how fast the app is actually ready.

For a gym app this is the wrong trade in the most literal sense: the user is standing at a rack with a bar loaded. Hevy's whole reputation is that logging "gets out of your way".

**Fix.** Show the splash animation only on **first launch of a session**, cap it at what the app actually needs, and race it against readiness:
```js
const SPLASH_MS = 900;          // enough to register the brand mark
// and skip entirely when launched from a deep link / notification
```
Keep the full 3.5 s treatment for the very first launch after install if you like the moment — just not for every launch forever.

**Verify.** Time cold start to first interactive frame with a stopwatch. Target under 1.5 s.

---

### P1-10 — Rank can collapse from Grandmaster to Bronze without the user doing anything wrong

**Status: CONFIRMED (engine reading).** Design issue, not a bug.

`computeDerived` in [engine.js:651](src/engine/engine.js) computes Fitness Rating from a **28-day rolling window only**:
```
fr = 4200 × (0.35·consistency + 0.25·trend + 0.25·prScore + 0.15·balance)
```
- `consistency` = trained days in 28, capped at 16
- `trend` = last-14-days volume vs previous 14
- `prScore` = PRs in 28 days ÷ 6
- `balance` = evenness across the six stats

Two consequences that will generate support email:

1. **Two weeks off (illness, holiday, deload) drops every term toward zero.** A Grandmaster becomes Bronze. Nothing in the UI explains this, and "the app took my rank away while I had flu" reads as broken, not as design.
2. **The system structurally punishes advanced lifters.** `prScore` needs 6 PRs in 28 days for full marks. A beginner PRs every session; someone with five years of training PRs maybe monthly. Your most committed users are mathematically capped below your newest ones. That inverts the incentive a competitive ladder is supposed to create.

**Fix (design, cheap).**
- Add a **rank floor / decay grace**: FR decays toward the tier floor over ~2 weeks of inactivity rather than dropping instantly, and never falls more than one tier below the user's peak. This is standard practice in competitive ladders precisely because instant decay feels punitive.
- Rebalance `prScore` to reward *any* progression (volume or e1RM trend), not PR *count*, or scale the denominator by training age.
- Whatever you choose, **show the four components in the UI**. Right now `frParts` is computed and returned but the user never sees why their number moved. Explaining the number is most of the fix.

---

### P1-11 — The global leaderboard is a list of 21 accounts, several of them inactive

**Status: CONFIRMED.**

[`globalTop()`](src/services/supabase/leaderboardService.js) does `select … from profiles order by <metric> desc limit 100` with **no activity filter and no minimum-data floor**. Today the database holds 21 profiles. A new user opening COMPETE sees a near-empty ladder including accounts that have never logged anything.

Also note: `xp` and `level` remain client-written (2811 deliberately only clamps growth to 4000/day rather than deriving them). So the XP and Level boards are still spoofable — slowly, but spoofable. `best_e1rm` and `consistency` are now genuinely server-derived and trustworthy.

**Fix.**
- Filter the board: `where consistency > 0 and updated_at > now() - interval '30 days'`.
- **Default the leaderboard to Friends, not Global,** until you have real density. A 6-person friends board is motivating; a 21-person global board is embarrassing.
- Mark the XP/Level boards as "unverified" or drop them, and lead with **Strength (best e1RM)** and **Consistency**, which are the two you can actually stand behind. The code already defaults to `best_e1rm` — good instinct, keep it.

---

### P1-12 — Guest mode creates an account-shaped trap

**Status: LIKELY (code reading; needs device confirmation).**

Guests get a full local save keyed to `SAVE_PREFIX + ':guest'`. [App.js:257–286](App.js) shows a one-time prompt warning that guest history lives only on the phone (good — that was `STRUCT-03` work). But:
- Deleting the app deletes everything with no recovery.
- There is no in-app "export my data" surface, despite the Privacy Policy stating *"the backup code exports it in full"* — that is a backup-code feature the user must know to find.

**Fix.** After a guest logs their **third** session, prompt once to create an account, framed as "keep your history" rather than "sign up". And put the backup-code export somewhere findable in Settings under a plain label like "Export my data".

---

### P1-13 — Dependency drift

**Status: CONFIRMED (`expo-doctor`, `npm audit`).**

| item | severity | recommendation |
|---|---|---|
| `expo` 54.0.36 → 54.0.37, `expo-constants` 18.0.13 → .14, `expo-file-system` 19.0.23 → .24 | patch | **Recommended.** `npx expo install --check`. Patch-only, same SDK, low risk. |
| `@expo/cli` / `@expo/config-plugins` high+moderate advisories (via `xcode` package) | high (dev only) | **Optional / not now.** These are build-time tooling, not shipped in the IPA. The fix is `expo@57` — a two-major-version SDK jump, which is a **Risky** change days before submission. Defer to a post-launch cycle. |
| SDK 54 → 57 | — | **Risky.** Do not do this before launch. |

---

## D. 🟠 P2 — HIGH-VALUE IMPROVEMENTS

**P2-1 — `anon` holds table-level INSERT/UPDATE/DELETE on almost every table.** RLS blocks it today (every policy tests `auth.uid()`, which is null for anon), so this is defence-in-depth, not an open door. But one future policy written with `using (true)` becomes an instant breach. Run `revoke all on all tables in schema public from anon;` then grant back only what anon genuinely needs (`select` on `app_config`, `insert` on `telemetry_events` and `bug_reports`).

**P2-2 — `telemetry_events` and `bug_reports` accept unlimited anonymous inserts.** No rate limit, no size cap on `props`. Someone could inflate your database with junk rows for free. Add a per-session insert cap in a `before insert` trigger, or move telemetry behind an Edge Function.

**P2-3 — No crash monitoring worth the name.** [src/services/telemetry.js](src/services/telemetry.js) is honest about this in its own header: no symbolication, no breadcrumbs, no alerting. It captures six events and caught errors to Supabase. That is a real improvement over nothing, and the reasoning for avoiding a native module before submission is sound. **Post-launch, add Sentry** (`@sentry/react-native` with the Expo config plugin) in the first build after approval. Until then, you will not know about a crash unless a user emails you — and note that `expo-updates` is **not installed**, so you have no OTA path to fix one quickly either.

**P2-4 — No OTA updates configured.** `expo-updates` is absent from `package.json` and there is no `updates` block in `app.json`. Every fix, including a one-line crash fix, requires a full App Store review cycle. Adding `expo-updates` before launch means a JS-only bug can be fixed in minutes rather than days. Requires a new build to take effect, so it must go in *this* build or wait for the next one. **Strongly consider adding it now.**

**P2-5 — Realtime subscription count is unbounded per user.** [realtimeService.subscribe()](src/services/supabase/realtimeService.js) opens one channel per call, and hooks call it per screen. At 1,000 concurrent users with 4–5 channels each you approach Supabase's free/pro concurrent-connection limits. Consolidate to one channel per user filtered on `user_id`, or accept it until ~1k DAU and monitor.

**P2-6 — `friendsFeed` and the feed reader are fine; the leaderboard is the scaling risk.** `levl_check_in_feed` uses proper keyset pagination on `(posted_at, id)` with a supporting partial index — genuinely well done. `globalTop` sorts all profiles on every open; the indexes exist so this is fine to ~100k rows. **Needed around 10k+ users:** materialise the leaderboard into a table refreshed every few minutes.

**P2-7 — `saves` blob has no size guard.** The full game save is upserted as `jsonb` on a 1.5 s debounce. `recentWorkoutEntries` caps workouts at 500, but `lifts`/`cardio` in the blob are unbounded — a two-year user's save could reach several MB, pushed repeatedly. Add a server-side size check and prune history older than N months from the synced blob (keep it locally).

**P2-8 — Accessibility is better than most, but incomplete.** `TOUCH = 44` is defined and used on buttons; `FriendsScreen` controls have proper `accessibilityLabel`s naming who they act on (commit 44562cbf); the delete-account flow has labels and `accessibilityState`. Gaps: no `accessibilityRole` on many custom `Pressable`s; rarity and rank are communicated **by colour alone** in `ItemGlyph`/`TierCrest`; no `AccessibilityInfo.isReduceMotionEnabled()` check anywhere despite heavy `Animated` use; charts in `ProgressTab` have no text alternative. **Launch-critical:** none. **Important:** reduce-motion, and a non-colour cue for rarity. **Later:** the rest.

**P2-9 — Notification strategy is well judged; two gaps.** The local set is genuinely thoughtful — the streak guard fires on the *one* day the streak can still be saved rather than nagging nightly, and the Check In prompt is randomised inside the user's own window so it does not become wallpaper. Missing: (a) a **per-category settings screen** — the `notify_social` / `notify_duels` / `notify_rewards` / `notify_training` columns exist and the Edge Function respects them, but I found no UI exposing all four; (b) no notification for **"your friend just PR'd"**, which is the single highest-value social pull in Strava's playbook.

**P2-10 — Check In photo privacy has one sharp edge.** The `check-ins` bucket is private and read policies defer to `levl_can_view_check_in` — excellent. But signed URLs, once issued, remain valid for their TTL even after a post flips from public to friends-only. Check the TTL in `signPhotoUrls` ([checkInService.js:127](src/services/supabase/checkInService.js)) and keep it short (≤1 hour) so revocation is fast.

---

## E. 🟢 P3 — POST-LAUNCH ROADMAP

- **Supersets and drop sets.** Missing; expected by intermediate lifters. Hevy and Strong both have them.
- **Plate calculator on the log screen.** There is a warm-up/percentage calculator; a plate breakdown next to the weight field is a 30-minute feature people mention in reviews constantly.
- **Workout templates from history.** "Workout Day" exists as a builder; "repeat last Tuesday" does not.
- **Apple Watch companion.** The single biggest logging-speed differentiator available to a gym app. Large project.
- **Weekly recap card.** A shareable image of the week — volume, PRs, sessions, rank movement. This is BeReal/Spotify-Wrapped mechanics and it is the cheapest organic-growth surface you have.
- **Season resets with a visible archive.** `seasonLabel()` exists in the engine but nothing resets or archives. Seasons give lapsed users a reason to return on a schedule.
- **Android.** `app.json` has the config; nothing has been tested.

---

## F. APP STORE APPROVAL CHECK

| Requirement | Status | Note |
|---|---|---|
| 1.2 — Filter objectionable content | ❌ | **P0-6.** Nothing filters text or images. |
| 1.2 — Report mechanism | ✅ | `content_reports` + UI in SocialTab and CommentSheet |
| 1.2 — Block abusive users | ✅ | `levl_block_user`, symmetric, plus an unblock list in Settings |
| 1.2 — Published contact | ✅ | `SUPPORT_EMAIL` shown in-app and in both policies |
| 1.2 — Act on reports in 24h | ⚠️ | No mechanism and no stated policy. Add auto-hide-on-threshold. |
| 2.1 — App completeness | ✅ | No placeholders, no dead screens found |
| 2.3 — Accurate metadata | ⚠️ | **NOT VERIFIED** — App Store Connect listing not inspected |
| 2.4.1 — Runs on claimed devices | ❌ | **P1-6.** iPad claimed, portrait-iPhone designed |
| 2.5.1 — Public APIs only | ✅ | Standard Expo/RN; three custom native modules, all standard AVFoundation/HealthKit/ActivityKit |
| 4.0 — Design / HIG | ⚠️ | Strong on iPhone. iPad unverified. |
| 5.1.1 — Purpose strings | ❌ | **P1-8.** Placeholder `NSMicrophoneUsageDescription` for an unused capability |
| 5.1.1 — Camera / Health strings | ✅ | Specific, honest, and the Health one explicitly says it never affects XP |
| 5.1.1(v) — Account deletion in app | ✅ | Settings → Delete account → type DELETE → `delete_own_account()`. Traced end to end; see §G. |
| 5.1.1 — Privacy policy reachable | ❌ | **P0-7.** Hosted on claude.ai |
| 5.1.2 — Data minimisation | ✅ | No advertising, no third-party analytics, no tracking |
| 5.1.3 — Health data handling | ✅ | HealthKit read-only, on-device, never uploaded — matches the policy text exactly |
| 4.8 / Sign in with Apple | ✅ | Apple Sign In is implemented ([appleAuth.js](src/services/appleAuth.js)) alongside email. Required because you offer a third-party-equivalent login; you have it. |
| 5.1.1 — Account required for free features | ✅ | Guest mode exists; training works signed-out |
| App Privacy answers in ASC | ⚠️ | **NOT VERIFIED.** See §G for the exact list you must declare. |
| Encryption declaration | ✅ | `ITSAppUsesNonExemptEncryption = false` |
| Privacy manifest | ✅ | `ios/LEVL/PrivacyInfo.xcprivacy` present; 25 pod manifests |
| Age rating | ⚠️ | **NOT VERIFIED.** UGC + user photos generally means **12+** minimum. Your policy says not for under-13s. |
| Demo account for review | ⚠️ | **You must provide one.** A reviewer with an empty social feed may not be able to evaluate the app. Create a seeded account with friends, Check Ins and an active duel, and put the credentials in App Review notes. |

---

## G. SECURITY REPORT

### Every table, and who can do what (live, verified)

| Table | RLS | SELECT | INSERT | UPDATE | DELETE | Verdict |
|---|---|---|---|---|---|---|
| `profiles` | ✅ | any authenticated (all columns) | own | own, **column-restricted** ✅ | none | ⚠️ leaks `last_active`, `streak`, `best_e1rm` to all — acceptable for a leaderboard app; contains **no email** ✅ |
| `workouts` | ✅ | **ANY authenticated (all rows)** 🔴 | own | own | **none** 🔴 | **P0-1**, **P1-2** |
| `saves` | ✅ | own | own | own | none | ✅ correct |
| `friends` | ✅ | own edges | **unilateral** 🔴 | — | own edges | **P0-2** |
| `friend_requests` | ✅ | own | own as sender | **either party, any field** 🟠 | none | **P0-2 (b)** |
| `notifications` | ✅ | own | **anyone → anyone** 🔴 | own | none | **P0-3** |
| `check_ins` | ✅ | own / friends / public+discovery | own | own | own | ✅ excellent |
| `check_in_reactions` | ✅ | visible posts only | own + visible | own | own | ✅ excellent |
| `check_in_comments` | ✅ | visible + not blocked | own + visible | **owner can rewrite** 🟠 | own or post owner | **P1-3** |
| `check_in_preferences` | ✅ | own | own | own | none | ✅ |
| `user_blocks` | ✅ | own | own | — | own | ✅ |
| `content_reports` | ✅ | own | own | — | — | ✅ |
| `social_xp_awards` | ✅ | own | **none** (RPC only) | none | none | ✅ exemplary |
| `duels` | ✅ | participants | as player_one | **any field** 🔴 | none | **P1-1** |
| `duel_invites` | ✅ | **all rows** 🟠 | own | **any open row** 🟠 | none | **P1-4** |
| `storage_cleanup_queue` | ✅ | own | trigger only | — | own | ✅ |
| `telemetry_events` | ✅ | **none** ✅ | anon+auth, unbounded 🟠 | none | none | **P2-2** |
| `bug_reports` | ✅ | own | anon (null uid) + own | none | none | ✅ / **P2-2** |
| `app_config` | ✅ | everyone (intended) | none | none | none | ✅ |
| `storage.objects` (`check-ins`) | ✅ | owner, or via a viewable Check In | own folder | own folder | own folder | ✅ excellent — bucket is private, paths guarded by trigger |

### Can a malicious client inflate its own progression?

| Value | Client-writable? | Server authority | Verdict |
|---|---|---|---|
| `xp`, `level` | yes | clamped to 4000/day by `levl_clamp_profile_progress_trg` | 🟠 **slowly forgeable** — ~4000 XP/day of fake progress is possible. Honest, documented in 2811. |
| `best_e1rm` | **no** | derived from `workouts` | ✅ but see P0-5 |
| `weekly_xp`, `consistency` | **no** | derived from `workouts` | ✅ |
| `streak`, `longest_streak` | yes | none | 🟠 forgeable |
| `coins` | yes | none | 🟠 forgeable (cosmetic only) |
| Check In XP | **no** | `levl_award_check_in_xp` ledger | ✅ **exemplary** — cannot be farmed at all |
| Duel winner/score | **yes** | none | 🔴 **P1-1** |
| Workout rows | yes, but validated | `levl_validate_workout` | ✅ (with P0-5 fixed) |
| Check In workout snapshot | **no** | recomputed by trigger | ✅ **exemplary** |

### Secrets

- ✅ **No `.env` files, ever committed or present.** No service-role key in the repo. `BACKEND-GUIDE.md` and `PUSH-SETUP.md` both explicitly warn against it.
- ✅ The Supabase **anon key in `app.json` is correct and safe** — it is designed to ship in clients and does only what RLS allows. (Which is exactly why the RLS findings above matter so much.)
- 🔴 **The push webhook secret is stored in plaintext in a trigger definition** and appeared in my `pg_trigger` query. Redacted here as `eb…b2`. **Rotate it** as part of P0-4.
- ⚠️ `EXPO_ACCESS_TOKEN` is optional in the push function. **Enable Enhanced Security for push in expo.dev and set it** — otherwise anyone who obtains a user's Expo push token can send pushes to that device directly, bypassing your backend entirely.

### Anti-cheat: essential now vs later

**Essential now:** P1-1 (duel winner), P0-5 (validation parity so honest users are not blocked), P1-2 (deleted workouts must actually be deleted).

**Later, when LEVL scales:** port the XP engine to SQL so `profiles.xp` is derived rather than clamped; add device-attestation (App Attest) if a real cheating economy emerges. Do **not** do these now — they would cost weeks and the clamp is adequate at your scale.

---

## H. PERFORMANCE REPORT

| Area | Finding | Severity |
|---|---|---|
| Cold start | **3.5 s hard-coded splash** on every launch ([App.js:95](App.js)) | 🔴 P1-9 |
| Tab architecture | All five tabs stay **mounted** (deliberate — preserves a half-entered set). Costs memory and initial render time but is the right call for a gym app. | ✅ good trade |
| Feed pagination | `levl_check_in_feed` uses keyset pagination on `(posted_at, id)` with a matching partial index. **This is textbook correct.** | ✅ |
| Feed round trips | One RPC per page returns poster identity, your reaction and top reaction types — no N+1. | ✅ excellent |
| Image sizes | 1440 px long edge, quality 0.82, ~400–700 KB. Well chosen for gym wifi. | ✅ |
| Repo assets | `icon.png` 321 KB, `splash.png` 394 KB, `adaptive-icon.png` 308 KB — all larger than needed, though they ship once. | 🟢 minor |
| Sync debounce | 1.5 s debounce on persist; account-change guard drops stale pushes. | ✅ correct |
| Leaderboard | Sorts all profiles on every open, no filter, refreshes on foreground. Fine to ~100k. | 🟠 P2-6 |
| Realtime | One channel per subscribe() call, unbounded per user. | 🟠 P2-5 |
| Save blob | Unbounded `lifts`/`cardio` arrays pushed as jsonb on every debounce. | 🟠 P2-7 |
| Indexes | Genuinely well covered: `workouts(user_id,date)`, `workouts(user_id,session_id)`, `check_ins` feed indexes (incl. a public-only partial), all five leaderboard sort columns, `check_in_comments(check_in_id, created_at)`. | ✅ |
| Re-renders | `useMemo`/`useCallback` used consistently; the hooks audit passes with 0 findings across 89 files. | ✅ |

**Biggest single win available:** the splash. 3.5 s → 0.9 s makes the app feel like a different product for zero risk.

---

## I. UX REPORT

**The 3-second test, screen by screen.** Would an 18–25-year-old gym user know what to do?

| Screen | Verdict |
|---|---|
| **Intro** | ✅ **Very good.** Four slides, one idea each, skippable, benefit-first ("Your gym, ranked."). The file's own header cites the ~20–28% read-rate research. This is better than most funded apps. |
| **Auth** | ✅ Clean. Apple Sign In present. Guest path visible. |
| **TRAIN** | ✅ **Strongest screen.** Muscle-region tiles with anatomical glyphs, previous-session recall ("Last time, 6 days ago: …"), rest timer, effort expressed as *"Could have done about 2 more reps"* instead of "RPE 8" — that translation is a genuinely excellent piece of product thinking. |
| **COMPETE** | ⚠️ Three concepts (duels, ranks, leaderboard) behind one tab, all of them near-empty for a new user. The FR number is unexplained. |
| **SOCIAL** | ⚠️ Depends entirely on having friends. `EmptyFeed` exists with actions, which is right — but a global public feed as the default landing scope would be better. |
| **HUNTER / Player** | ⚠️ Six stats (STR/PWR/END/VIT/MOB/DIS), rank, titles, decorations, PRs. Dense. A newcomer will not know which number matters. |
| **FORGE** | ⚠️ Packs, cosmetics, forge levels, temper, materials, a season pass. This is the most mechanically complex part of the app and the least connected to training. |

**Terminology load.** In one session a new user meets: XP, Level, Rank, Tier, Division, Fitness Rating, Six Stats, Title, Decoration, Streak, Check In, Verified Session, Duel, Pack, Forge Level, Temper, Material, Season Pass, Coins, Hunter. **That is twenty systems.** Every one is individually defensible; collectively they are a wall. This is the app's biggest UX risk and it is not a bug — it is an editing problem.

**Recommendation — do not remove them, sequence them.** Lock FORGE and the six stats behind level 5. Lock duels behind having one friend. Let a new user meet TRAIN, XP, Level and Streak in week one and nothing else. The systems then arrive as rewards rather than as homework. (See §N.)

**Design consistency** is strong: [src/theme.js](src/theme.js) defines real tokens (`C`, `SPACING`, `TYPE`, `RADIUS`, `SHADOW`, `TOUCH = 44`), the palette philosophy is written down (60/30/10, charcoal not black, depth-as-brightness), and the gold-vs-legendary conflict was consciously resolved. Reusable `Card`/`Chip`/`Sheet`/`GoldBtn`/`Segmented` primitives live in `components/ui.js` and are used consistently. This is a designed app, not an assembled one.

---

## J. RETENTION REPORT

**Benchmarks for calibration.** Health & fitness apps average roughly **26–35% Day-1** retention and fall to **~3–4% by Day 30**; leaders reach ~45% D1 and 8–25% D30. Fitness apps suffer specifically from *delayed value* — unlike a news or banking app, the payoff arrives weeks later. Sources: [Business of Apps](https://www.businessofapps.com/data/health-fitness-app-benchmarks/), [UXCam](https://uxcam.com/blog/mobile-app-retention-benchmarks/).

**This is exactly the problem LEVL is designed to solve** — XP and rank manufacture immediate feedback for a delayed-payoff activity. The thesis is sound. Execution is where it is thin.

### First 10 minutes, simulated

| Time | What happens | Why they continue | Why they leave | Reward |
|---|---|---|---|---|
| **0–30 s** | 3.5 s splash → 4 intro slides | "Your gym, ranked" is a clear promise | The splash is dead time; a 3.5 s wait is a lot before any value | None yet |
| **30–60 s** | Auth. Apple Sign In, email, or guest | Guest removes all friction | Email signup with no context is the classic drop point | None |
| **1–3 min** | Physical profile form (bodyweight, height, age, sex, activity, experience) | Fair — it powers plausibility checks | **Six fields before seeing anything.** This is the highest-risk moment in the whole funnel | None |
| **3–5 min** | TRAIN. Pick a region → exercise → weight/reps/effort → **first set logged → XP → possibly a level-up** | ✅ **This is the moment.** The XP number, the ring filling, the level-up overlay — this is where LEVL becomes obviously different | If they cannot find the exercise, or if the effort scale confuses them | **~39 XP, a filling ring, maybe Level 2** |
| **5–10 min** | Explores. COMPETE is empty. SOCIAL is empty. FORGE has a pack from level-up. HUNTER shows six stats at level 1. | The Forge pack is a real reward and it lands well | **Three of five tabs are empty.** The app looks abandoned rather than new | A cosmetic pull |

**The "I understand why LEVL is different" moment happens at ~4 minutes**, at the first logged set. **That is too late by about three minutes**, and it is gated behind a six-field form.

**Fix:** move the physical profile *after* the first logged set. Let someone log one set within 60 seconds of opening the app, see XP land, and *then* ask for bodyweight ("so we can sanity-check your lifts"). Same data, dramatically better funnel.

### Day-by-day

| Period | What brings them back | Strength |
|---|---|---|
| **Day 0** | First set → XP → level-up → pack | ✅ **Strong.** Well built. |
| **Day 1** | Streak (1 day), the Forge pack they did not open | 🟠 Medium. Push is dead (P0-4), so nothing reaches them. |
| **Day 3** | Streak at risk — the guard notification fires on the deadline day | ✅ **Excellent design**, ❌ **currently undeliverable** (P0-4) |
| **Day 7** | 7-day Check In streak (120 XP), weekly quests reset, first rank placement (needs 5 training days) | ✅ Good, if they have friends |
| **Day 14** | Duels, friends' Check Ins, PR notifications | 🔴 **Weak.** Duels need a friend; PR notifications do not exist. |
| **Day 30** | Rank movement, Forge progression, season | 🟠 Medium. Rank decay (P1-10) may actively push them out here. |
| **Day 90** | Long-term strength curves in ProgressTab, level 20–30, cosmetics | 🟠 The strongest genuine hook is the *training history itself* — and it is buried one tap from TRAIN rather than celebrated. |

**The honest summary:** LEVL's Day 0 is strong, its Day 3 mechanism is well designed but literally cannot fire, and its Day 14+ depends entirely on a social graph that a new user has no path to build. **Fixing push (P0-4) and the empty-state problem are worth more than every other retention idea combined.**

### Progression modelling

Using the real engine (`setXP`, `xpForLevel(L) = 150·(L−1)^1.6`, cap 4000/day):

| | **User A** — beginner, 2×/wk, ~8 sets | **User B** — normal, 4×/wk, ~14 sets | **User C** — advanced, 6×/wk, ~20 sets |
|---|---|---|---|
| Session XP | ~250 (PRs frequent → ×1.5 bonuses) | ~440 | ~700 |
| **Day 1** | L1→L3. Feels fast and generous. | L1→L4 | L1→L5 |
| **Day 7** | ~2,000 XP · **L6** · 1 pack | ~3,500 XP · **L9** · 2 packs | ~5,600 XP · **L11** · 4 packs |
| **Day 30** | ~8,500 XP · **L13** | ~15,000 XP · **L18** | ~24,000 XP · **L23** |
| **Day 90** | ~26,000 XP · **L23** | ~46,000 XP · **L30** | ~73,000 XP · **L38** |
| **6 months** | ~52,000 · **L34** | ~92,000 · **L45** | ~146,000 · **L57** |
| **1 year** | ~104,000 · **L49** | ~184,000 · **L64** | ~292,000 · **L80** |

**Assessment.** The curve is **well tuned** — the `^1.6` exponent gives fast early levels and a long tail without the "dead zone" that kills most XP systems. Titles at 1/5/10/15/20/30/40/50/75 land at sensible intervals. A pack every 1,200 XP means a reward roughly every 2–3 sessions, which is the right cadence.

**Three problems:**
1. **The 4000/day cap is never reached by anyone.** User C's biggest day is ~700 XP. The cap is doing anti-cheat work, not economy work — fine, but it means there is no "big session" ceiling to push against.
2. **Titles stop at level 75.** User C reaches L80 in a year. The last title, "S-Rank Hunter", arrives and then nothing ever again. Add tiers at 100/125/150.
3. **Rank (FR) and Level are completely decoupled**, and only Level grows monotonically. A user can be Level 45 and Bronze simultaneously (P1-10). Nothing in the UI reconciles these two numbers, and users will read it as broken.

---

## K. COMPETITOR RESEARCH

| Product | What they do well | LEVL today | Opportunity |
|---|---|---|---|
| **Hevy** | Fast logging, previous-set recall, templates, an in-app social feed. Reddit consensus: the community feel is liked; some users resent the community section being pushed, and dislike that logging can require a connection. ([Setgraph roundup](https://setgraph.app/ai-blog/best-workout-tracker-app-reddit)) | Logging speed is **competitive** — previous-session recall and rest timer both shipped. Social is **more ambitious** (photos, verification). | **LEVL's offline-first logging is a real advantage over Hevy.** Say so. "Works when the gym wifi doesn't." |
| **Strong** | The speed benchmark. Praised for getting out of the way; criticised for thin programming features. | Competitive on speed once P1-9 (splash) is fixed. | Do not out-feature Strong; out-*meaning* it. Strong has no reason to open the app on a rest day. LEVL does. |
| **Strava** | The definitive social-fitness network. Kudos, segments, clubs, and the strongest network effect in fitness. Weak for gym lifting specifically. | LEVL's Check In is a credible gym-native analogue of a Strava post. | **The gap Strava leaves open is exactly LEVL's shape**: gym training is not a route, so Strava cannot verify it. LEVL can. |
| **Fitbod** | Algorithmic workout generation; solves "what do I do today". | LEVL has "Workout Day" (a builder) but does not *recommend*. | Not before launch. A simple "you haven't trained legs in 9 days" nudge is 90% of the value for 5% of the work. |
| **Duolingo** | The reference implementation of streak psychology: streak freezes, a visible streak everywhere, and notifications that fire when the streak is genuinely at risk. | ✅ **LEVL already does the hard part** — `scheduleStreakGuard` fires on the *deadline day only*. Better restraint than Duolingo. | Add a **streak freeze** (one per month, earned). It converts the streak from a source of anxiety into a source of loyalty. |
| **BeReal** | A randomised daily window creates a shared, time-boxed ritual; dual camera makes the post feel unfakeable. | ✅ **LEVL already has both** — randomised prompt inside a user-chosen window, and a genuine dual-camera native module. | This is a stronger borrowed mechanic than you may realise. **Lean into it in the App Store screenshots.** |
| **Habitica** | Full RPG framing for habits: gear, levels, parties. Proves the framing works — and shows its failure mode, which is systems outgrowing the habit. | LEVL is at genuine risk of Habitica's failure mode (§I: twenty systems). | Gate systems by level. See §N. |
| **Discord** | Small-group belonging beats large-network reach. | LEVL has friends and duels but no *group*. | **P3:** a "Crew" of 3–8 people with a shared weekly volume goal would likely out-retain everything else in this table. |

**Distinguishing my claims:** the Hevy/Strong sentiment above is *informed interpretation* of community roundups, not first-party data. The retention benchmarks are *verified fact* from published industry reports. The Duolingo/BeReal mechanic descriptions are *verified fact*; the recommendations built on them are *my recommendation*.

---

## L. LEVL'S COMPETITIVE ADVANTAGE

> **Why would someone use LEVL instead of Hevy + Strava + Instagram?**

**Three real answers, ranked by strength:**

### 1. Verified Sessions — genuinely strong, currently hidden

Nobody else can do this. A Check In cannot lie about the workout behind it because the database recomputes the summary from the poster's own training rows. Strava can verify a run because GPS exists; **nothing verifies a gym session — except a log the app itself owns.** This is the moat.

**Current state: hidden.** It appears as a small label on a feed card. It should be the first sentence of your App Store description, the first screenshot, and the thing the intro promises.

### 2. Progression as identity, not just a chart — underdeveloped

Hevy shows you a graph. LEVL gives you a rank, a title, six stats and a character. For an 18–25-year-old who grew up on game progression, "I'm a Diamond II Hunter, Elite Lifter" is an identity in a way "my bench is up 8%" is not.

**Current state: underdeveloped**, because the rank is unexplained (P1-10) and can collapse, which breaks the identity it is meant to create. Fix the decay and explain the four components, and this becomes a top-tier differentiator.

### 3. Offline-first logging — genuinely strong, unclaimed

Logging works with no signal at all. Hevy users complain about exactly this. It costs you nothing to say it.

### Where LEVL is *not* yet strong enough

- **The social graph has no acquisition path.** There is no contact matching, no invite link with a preview, no "find people at your gym". Duels have an invite-code system — **that is your viral loop and it is buried.** A duel invite link that opens a beautiful "Matteo challenged you to a 7-day duel" page is the single most natural reason a LEVL user brings someone in. Ethical, non-spammy, and mostly built already.
- **The Forge does not connect to training.** Cosmetics are a reward *for* XP, but nothing about them reflects *what you trained*. A pair of gauntlets you earned for a 200 kg deadlift would mean something; a random pack pull does not.

---

## M. MISSING FEATURES

### Expected / basic (users will notice these are absent)

| | Status |
|---|---|
| Supersets / drop sets | ❌ missing |
| Plate calculator | ❌ missing (percentage/warm-up calculator exists) |
| Repeat a previous workout in one tap | ❌ missing (Workout Day builder exists) |
| Workout notes | ❌ missing |
| Body-weight tracking over time | ❌ single static value only |
| Exercise search by name | ✅ present |
| Edit / delete a logged set | ✅ present (but see P1-2 — delete is local-only) |
| kg/lb switching | ✅ present, and it correctly rewrites stored weights |
| Rest timer | ✅ present |
| Previous-session recall | ✅ present |
| Workout history | ✅ present |
| Data export | ⚠️ backup code exists but is not surfaced as "export" |

### Differentiating (these are the reason LEVL exists)

| | Status |
|---|---|
| Verified Sessions | ✅ built, ❌ not marketed |
| Dual-camera Check In | ✅ built (native module) |
| Randomised daily prompt window | ✅ built |
| Duels | ✅ built, 🔴 result forgeable (P1-1) |
| Rank / division ladder | ✅ built, 🟠 decay problem (P1-10) |
| Six-stat character | ✅ built |
| Forge / cosmetics | ✅ built, 🟠 disconnected from training |
| Live Activity on Lock Screen | ✅ built |
| Home Screen widget | ✅ built |
| Crew / small groups | ❌ missing — the highest-value missing differentiator |
| PR notifications to friends | ❌ missing — highest-value missing social hook |

---

## N. REMOVE / SIMPLIFY

**Be ruthless here. LEVL's biggest risk is not a missing feature — it is twenty systems arriving at once.**

1. **Gate FORGE behind Level 5.** Packs, cosmetics, forge levels, temper, materials and a season pass is more mechanical surface than the training loop it is meant to reward. A new user does not need it in week one.
2. **Gate the six stats behind Level 3.** Show one number (XP/Level) first. STR/PWR/END/VIT/MOB/DIS is a great system that reads as noise on day one.
3. **Merge or hide the XP and Level leaderboards.** They are the two you cannot verify (§G). Lead with Strength and Consistency, which you can.
4. **Drop "Fitness Rating" as a visible number, or explain it.** Right now it is a four-digit score with no explanation that can halve while the user is on holiday. Either show its four components or show only the tier name.
5. **Cut the splash to under a second** (P1-9).
6. **Reconsider `PacksTab` as a separate screen.** It is 788 lines behind a modal inside FORGE. If it stays, it should not be a second navigation layer.
7. **Retire `START-HERE-*.md`, `BUILD-28.md`, `TESTING-BUILD-29.md`, `TESTFLIGHT-BUILD-29.md`** from the repo root — seven build-specific docs in the root make the project hard to navigate and some are now contradicted by the code. Move them to `docs/history/`.

---

## O. HIGH-LEVERAGE OPPORTUNITIES — TOP 10

| # | Opportunity | Current state | User benefit | Difficulty | Impact |
|---|---|---|---|---|---|
| **1** | **Fix push, then say what it's for** | Never delivered a single notification (P0-4) | Every social and streak mechanic starts working | **Low** (3 dashboard clicks) | **Enormous** |
| **2** | **Log a set in the first 60 seconds** — move the 6-field profile form to *after* the first set | Profile gate sits before any value | The "aha" moment moves from ~4 min to ~1 min | **Low** | **Very high** |
| **3** | ~~Land new users in the public Check In feed~~ — **CORRECTION: already shipped.** [App.js:251](App.js) opens on Friends and moves a friendless user to Discover once, automatically (commit `3f944b4f`). That is better than the blanket default I proposed. This row was an audit error. | — | — | — | — |
| **4** | **Make the duel invite link the growth loop** | Invite codes exist, buried in Compete | One user brings in one friend, ethically | **Medium** | **Very high** |
| **5** | **Splash 3.5 s → 0.9 s** | Fixed 3.5 s every launch | The app feels twice as fast | **Very low** | **High** |
| **6** | **"Your friend just PR'd" notification** | Doesn't exist | The single strongest social pull in fitness | **Medium** | **High** |
| **7** | **Put "Verified Session" front and centre** | A small card label | The one thing no competitor can copy | **Low** (copy + screenshots) | **High** |
| **8** | **Streak freeze, one per month** | Streak dies silently | Converts streak anxiety into loyalty | **Low** | **Medium-high** |
| **9** | **Explain the rank number** — show consistency / trend / PRs / balance | `frParts` is computed and never shown | Removes the top "this app is broken" complaint | **Low** — the data already exists | **Medium-high** |
| **10** | **Weekly recap card, shareable** | Doesn't exist | Free organic reach, and a real Sunday-evening ritual | **Medium** | **Medium-high** |

Note how many of these are **Low** difficulty. Items 1, 2, 3, 5, 7, 8 and 9 are together maybe two days of work and they move activation, retention and differentiation more than any new feature would.

---

## P. SCORING TABLE

| Area | Score | What is stopping it reaching 9–10 |
|---|---|---|
| Core functionality | **7**/10 | Everything advertised exists and works. Held back by P0-5 (silent sync failure) and P1-2 (deletes don't propagate). |
| Reliability | **5**/10 | The offline architecture is excellent, but one heavy lift silently kills a user's sync forever, and push has never worked. Both are invisible failures, which is the worst kind. |
| Security | **3**/10 | The *new* security work is 9/10. Three legacy policies undo it: full training-log exposure, unilateral friending, world-writable notifications. All confirmed against production. |
| UI quality | **8**/10 | Real design tokens, a written palette philosophy, bespoke vector iconography, consistent primitives. Loses points only for density. |
| UX clarity | **6**/10 | TRAIN and the intro are excellent. Twenty simultaneous systems, an unexplained four-digit rank, and three empty tabs on day one hold it back. |
| Workout logging | **7**/10 | Fast, offline, previous-session recall, rest timer, and the best effort scale I have seen in a lifting app. Missing supersets, plate calculator, notes, one-tap repeat. |
| Social | **6**/10 | The Check In concept and its verification are genuinely novel and well built. No acquisition path, no filtering, comments editable by the host. |
| Gamification | **7**/10 | The XP curve is properly tuned and the ledger is farm-proof. Loses points for the title ceiling at L75 and for Forge being disconnected from training. |
| Competitive systems | **4**/10 | Duel results are client-forgeable, the rank model punishes advanced lifters and collapses after a layoff, the global board has 21 people in it. |
| Performance | **6**/10 | Good indexes, keyset pagination, sensible debounce. The 3.5 s splash on every launch is the dominant cost. |
| Accessibility | **6**/10 | 44 pt targets, real labels on the delete flow and Friends screen, semantic states. No reduce-motion handling, rarity conveyed by colour alone, charts have no text alternative. |
| Privacy | **4**/10 | The written policy is genuinely excellent and accurate about HealthKit. But it says training logs are private and they are not (P0-1), and it is hosted on a domain you don't own (P0-7). |
| App Store readiness | **4**/10 | Account deletion, Sign in with Apple, privacy manifest and purpose strings are all handled well. Blocked by no content filtering, the policy URL, iPad, and the placeholder mic string. |
| New-user activation | **5**/10 | Strong intro; the "aha" moment is real and well built — but it sits behind a splash, a signup and a six-field form, and then three of five tabs are empty. |
| Retention potential | **6**/10 | The mechanisms are designed thoughtfully — the deadline-day streak guard is better than Duolingo's. Undermined entirely by push not working and by the absent social graph. |
| Differentiation | **6**/10 | Verified Sessions is a real moat. It is currently a label rather than a promise, and the rank identity it should reinforce is unstable. |
| **Overall launch readiness** | **4**/10 | **Three confirmed cross-user data holes and one silent data-loss path. The fixes are small and specific — mostly SQL — but they are not optional.** |

---

## Q. EXACT PRE-LAUNCH ACTION PLAN

Ordered by dependency and importance. **"Claude Code"** = I can do it in this repo. **"You"** = requires a dashboard, Apple, or a decision only you can make.

### Step 1 — Close the three data holes *(Claude Code writes the SQL, you run it)*
Fix P0-1, P0-2 and P0-3 in one migration file. In plain English: stop strangers reading your users' workouts, stop strangers adding themselves as friends, and stop anyone sending notifications to anyone.
→ **I write `sql/2813_close_legacy_holes.sql` plus the two client changes; you paste it into the Supabase SQL editor.**

### Step 2 — Fix the workout weight ceiling *(Claude Code + you)*
Right now a 450 kg leg press silently breaks that user's cloud sync forever. Raise the server ceiling to 720 kg and make the app upload in small chunks so one bad row can't take the rest down.
→ **I write it; you run the SQL.**

### Step 3 — Turn push on *(You — 5 minutes in the Supabase dashboard)*
1. Database → Webhooks → `levl_push` → change the URL to `https://pndocotsoadxoklqwzys.supabase.co/functions/v1/push`
2. Edge Functions → `push` → Details → turn **Verify JWT** off
3. Generate a new random secret, put it in the webhook's `x-levl-secret` header **and** in the function's `PUSH_HOOK_SECRET` env var
4. Test: insert a notification for yourself, then check the webhook log shows `200`
→ **Must come after Step 1.** Fixing push before Step 1 arms a spam cannon.

### Step 4 — Move the legal pages off claude.ai *(You + Claude Code)*
Your privacy policy and terms currently live on my servers. Push this repo to GitHub (it has **no remote at all** right now — nothing is backed up), turn on GitHub Pages for the `/docs` folder, and the pages get real URLs.
→ **You create the GitHub repo and enable Pages; I update the two URLs in the code.**

### Step 5 — Add content filtering *(Claude Code + you)*
Apple requires a way to filter objectionable content, not just report it. I'll add a word blocklist in the database (so you can update it without a new app build) and make three reports auto-hide a post.
→ **I write it; you run the SQL and paste in a word list.**

### Step 6 — Decide on iPad *(You — one decision)*
Either drop iPad support (recommended — two minutes, no risk) or commit to testing every screen on an iPad. Right now you're claiming support you haven't built.
→ **Tell me which; I make the change.**

### Step 7 — Small fixes *(Claude Code)*
Remove the placeholder microphone permission; cut the splash from 3.5 s to 0.9 s; lock duel scores and winners server-side; add the missing workout-delete path; turn on leaked-password protection.
→ **I do all of it except the Supabase toggle, which is one click for you.**

### Step 8 — The activation fixes *(Claude Code)*
Move the six-field profile form to *after* the first logged set. Default the Social feed to the public scope so a new account sees a living app. These two changes probably matter more for launch success than everything above.

### Step 9 — Rebuild and test *(You)*
`eas build --platform ios --profile production`, then work through the manual test plan in §R on a real iPhone.

### Step 10 — Prepare App Store Connect *(You)*
- Privacy Policy URL (the new one from Step 4)
- App Privacy answers: **Email**, **User Content (photos)**, **Health & Fitness**, **Identifiers (push token)**, **Usage Data**, **Diagnostics** — all "linked to user", none used for tracking
- Age rating: **12+** minimum for UGC
- **A demo account with friends, Check Ins and an active duel**, with credentials in the review notes — otherwise a reviewer sees three empty tabs

---

## R. MANUAL IPHONE TEST PLAN

Do these on a real iPhone from TestFlight. Tick each one. If something doesn't match, write down exactly what you saw.

### Account
1. Delete LEVL from your phone. Reinstall from TestFlight.
2. Open it. Watch the splash and the intro. **The splash should be under 1 second** after the fix.
3. Tap "Continue as guest". Log one set. Force-close the app (swipe up). Reopen. **Your set should still be there.**
4. Delete and reinstall again. Create a real account with an email.
5. Force-close. Reopen. **You should still be logged in — no login screen.**
6. Log out. Log back in. **Your workouts should come back.**
7. Tap "Forgot password". Check your email. Follow it all the way to setting a new password. Log in with the new one.
8. Sign out. Sign in with Apple instead. **Check you don't end up with a second empty account.**

### Workout
9. Log a normal set: 60 kg × 8, effort "Hard". **Check you see XP appear.**
10. Try to log 0 reps. Try 999 reps. Try a negative weight. **Each should give you a clear, friendly message — never a crash and never a silent failure.**
11. Log a **450 kg leg press**. Then close and reopen the app. In Supabase, check the row arrived in `workouts`. **This is the P0-5 test — before the fix it will silently vanish.**
12. Tap "log set" twice very fast. **You should get one set, not two.**
13. Log a set, then delete it. Check the leaderboard **Strength** number goes back down.
14. Start a workout, put the phone in your pocket for 5 minutes, come back. **The rest timer and session should still be right.**
15. Turn on **Airplane Mode**. Log three sets. **Everything should work.** Turn wifi back on, wait a minute, and check the sets reached Supabase.
16. Change your phone's timezone in Settings. Reopen LEVL. **Check the streak and today's session still look right.**

### Check In
17. Tap Check In. Allow camera. Take a Check In. **Both photos should capture.**
18. Do it again with Airplane Mode on. Force-close the app mid-upload. Reopen with wifi on. **The Check In should finish uploading by itself.**
19. Try to post a second Check In on the same day. **It should tell you you've already checked in today.**
20. Log a workout, then Check In, then attach the workout. **It should say VERIFIED and show your real set count and volume.**
21. Delete a Check In. **The photos should disappear from the feed immediately.**

### Friends & Social (needs a second phone — see below)
22. Send a friend request from phone A to phone B.
23. Accept on phone B. **Both phones should now show each other as friends.**
24. Post a friends-only Check In on A. **B should see it. Nobody else should.**
25. Comment on it from B. **A should get a push notification** (after Step 3).
26. Block B from A. **B should immediately be unable to see A's posts, and A should vanish from B's friends list.**
27. Unblock from Settings → Blocked accounts.
28. Report a Check In. **You should get a "Thanks" confirmation.**

### Compete
29. Challenge B to a 7-day duel from A. **B should get a notification.**
30. Accept on B. Log a set on each phone. **Both scores should update within a minute or two.**
31. Try to start a second duel while one is active. **It should refuse.**
32. Open the leaderboard. Switch between Strength / Consistency / Friends. **No blank screens, no spinners that never stop.**

### Hunter & Forge
33. Open a pack. **Check the animation completes and the item appears in your inventory.**
34. Equip a cosmetic. Check it shows on your character and on your profile as seen from phone B.

### Notifications
35. Settings → turn the Check In reminder on. **Allow notifications when asked.**
36. Fully close LEVL (swipe up). Have B comment on your post. **A push should arrive on the lock screen within seconds.**
37. Tap it. **It should open directly to that comment — not the home tab.**
38. Check the red badge number on the app icon matches your unread count.

### Settings & deletion
39. Change kg → lb. **Every weight in your history should convert, not just the label.**
40. Open Privacy Policy and Terms from Settings. **Both must load fully.**
41. **On a throwaway account:** Settings → Delete account → type DELETE. Then try to log back in with that email. **It must fail.** Check in Supabase that the profile, workouts and Check In photos are gone.

### Poor connection
42. Turn wifi off and mobile data to one bar (or use Network Link Conditioner). Open every tab. **Nothing should hang on a spinner forever.**

---

## R2. TWO-ACCOUNT TEST PLAN

Use two phones, or one phone plus the iOS Simulator. **Account A = you. Account B = a throwaway.**

| # | On A | On B | Expected |
|---|---|---|---|
| 1 | Search for B's username | — | B appears |
| 2 | Send request | — | B gets a push and an inbox entry |
| 3 | — | Accept | Both show each other as friends |
| 4 | — | Send a request to A again | Refused or no-op |
| 5 | Post a **friends-only** Check In | View feed | B sees it |
| 6 | Switch it to **public** | — | Still visible |
| 7 | Switch back to friends-only | Reload | Still visible (B is a friend) |
| 8 | — | Comment | A gets a push |
| 9 | Delete B's comment as post owner | Reload | Gone for both |
| 10 | Block B | Reload feed | A's posts vanish for B; B cannot react or comment |
| 11 | Unblock B | Reload | Visible again |
| 12 | Challenge B to a duel | Accept | Both see an active duel |
| 13 | Log 5 sets | Log 2 sets | A leads; both phones agree within a minute |
| 14 | — | Delete their account mid-duel | **A's duel screen must not crash.** Watch this one closely. |
| 15 | Open Friends leaderboard | — | B is gone or shown as a deleted user, not a blank row |

**The critical one is #14.** Deleting an account mid-duel is the most likely place for a crash, because `duels.player_two` cascades to null while A's screen is still rendering it. **NOT VERIFIED** — I could not test this without deleting a real account.

---

## R3. EXISTING vs FRESH ACCOUNT

You have TestFlight users with data from earlier builds. Test both paths:

| Check | Why | Risk |
|---|---|---|
| Old save with `goal` field | [`mergeSave`](src/hooks/useGameSave.js:76) deletes it during hydration | ✅ handled |
| Old save with no `sid` on entries | Sessions are derived by 3-hour gap instead | ✅ handled ([engine/session.js](src/engine/session.js)) |
| Workouts logged before Build 28 | `session_id` is null; Check In verification can't attach them | 🟠 expected — a user's older workouts simply can't be verified |
| Workouts with no `kind` | Backfilled by `sql/2807` | ✅ handled |
| Duplicate usernames from before the unique index | De-duplicated by the `do $$` block in `sql/2801` | ✅ handled |
| **Old saves containing a heavy lift above 400 kg** | Will hit the P0-5 trigger on the *next* sync and break it | 🔴 **Test this specifically.** Any existing user with a heavy leg press is already broken. |
| Users who accepted no terms | `needsTermsAcceptance()` returns true; they'll be prompted | ✅ handled |

**Detecting who is already affected.** I ran this against production:

```sql
select count(*) from public.workouts
 where coalesce(weight,0) * (case when unit='lb' then 0.45359237 else 1 end) > 400;
-- → 0
```

**Zero — and that is not reassuring, it is the symptom.** The trigger rejects those rows, so by construction they can never appear in the table. This query can never find an affected user; it can only ever return 0.

The real detection is to look for users whose cloud history has simply *stopped*:

```sql
select p.id, p.username, max(w.date) as last_synced_workout, p.updated_at as last_app_open
  from public.profiles p left join public.workouts w on w.user_id = p.id
 group by p.id, p.username, p.updated_at
having max(w.date) < p.updated_at - interval '7 days' or max(w.date) is null
 order by p.updated_at desc;
```

Any user whose profile is being updated (so the app is open and syncing) but whose newest workout is a week or more old is a candidate. **Run this before launch and again a week after.**

---

## S. GO / NO-GO VERDICT

> ### ⚠️ THIS SECTION IS SUPERSEDED — 18 August 2026, later the same day
>
> The verdict below was written **before** the fixes were applied. Everything in
> it was accurate at the time; most of it is now historical. See
> [LEVL-LAUNCH-CHECKLIST.md](LEVL-LAUNCH-CHECKLIST.md) for current state.
>
> **All four confirmed defects are closed and verified in production:**
>
> | Was | Now |
> |---|---|
> | Any account could read all 610 of other users' workout rows | **0** rows from non-friends |
> | Any account could forge a friendship | `new row violates row-level security policy` |
> | Anyone, without an account, could push-spam every user | `permission denied for table notifications` |
> | One heavy leg press silently killed a user's sync forever | ceiling raised to 720 kg, uploads chunked, rejections surfaced |
> | Push had never delivered a single notification (405, always) | **first HTTP 200 in the project's history** |
> | Either duel player could declare themselves the winner | `permission denied for table duels` |
> | No content filtering at all (Guideline 1.2) | 122-term filter, word-boundary + leetspeak, auto-hide on 3 reports |
>
> **Current verdict: 🟡 CONDITIONAL GO.** Three things remain, none of them code:
> a new TestFlight build, two Supabase dashboard toggles, and a public home for
> the two legal pages.
>
> The original assessment follows, unedited, because the reasoning behind a
> finding is worth more than its status field.

---

# 🔴 NO-GO *(as assessed before the fixes)*

**Not because LEVL is a weak product — it isn't. Because four specific things are confirmed broken, and three of them expose user data.**

The reasoning:

1. **Any signed-in account can read every user's complete training history.** I ran the query. 610 rows belonging to 20 other people, returned to one account. Your own privacy policy says this data is private. Launching in this state is a data breach waiting for someone to notice.

2. **Any account can silently add itself as your friend** and thereby see your friends-only progress photographs. In an app where the social object is a photo of someone's body, this is the finding that would end the product's reputation.

3. **Anyone at all — no account required — can send push notifications to any user.** Dormant only because push doesn't currently work; the moment you fix push, this becomes live.

4. **One heavy leg press permanently and invisibly breaks a user's cloud sync**, freezing their duel scores, leaderboard position and Check In verification with no error shown anywhere.

Plus two near-certain rejection reasons: no content filtering (Guideline 1.2) and a privacy policy hosted on a third party's domain.

**But here is the thing that matters: none of this is deep.**

There is no architectural flaw here, no rewrite required, no month of work. The security holes are three legacy RLS policies that should have been dropped when their replacements were written. The sync bug is one number that disagrees with another number. The push failure is one wrong URL. The legal pages are two files that already exist and need a home.

**This is roughly a day of work, most of it SQL, and then you are at 🟡 CONDITIONAL GO** — conditional on the content filter and the policy URLs, which are another half-day.

The underlying product is stronger than its current state suggests. The verified-session mechanic is a real moat, the XP economy is properly designed, the offline logging is better than the market leader's, and the test discipline is unusual for a solo project. Fix the six things above and you are shipping something genuinely competitive.

**Do not launch this week. Launch next week, properly.**

---

*Findings marked NOT VERIFIED: App Store Connect listing and privacy answers; iPad rendering; physical-device push delivery; account deletion mid-duel; cold-start timing on real hardware. Each is noted inline with how to verify it.*
