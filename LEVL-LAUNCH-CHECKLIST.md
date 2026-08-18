# LEVL — Launch Checklist

Companion to [LEVL-PRE-LAUNCH-AUDIT.md](LEVL-PRE-LAUNCH-AUDIT.md). Work top to bottom — the order matters.

**Status: 🟡 CONDITIONAL GO** · all 7 P0 closed · 12 of 13 P1 closed

The database work is **applied to production and verified by re-running the
original exploits**. What remains is a build, two dashboard toggles, and hosting
for two HTML files.

---

## 🚨 Blockers — must be done before submission

**Applied to production on 18 August 2026** as migrations `close_legacy_holes`,
`content_moderation`, `p1_hardening_duels_comments_invites`,
`fix_push_webhook_endpoint` and `revoke_trigger_function_execute`.

Verified by re-running the original attacks as a real signed-in user and as
`anon`. Evidence in the table below.

| # | What | State | Proof |
|---|---|---|---|
| 1 | Drop `workouts readable` — every account could read every user's training log | ✅ **applied** | as user A, rows visible from non-friends **610 → 0**. The 191 still visible belong to their 2 accepted friends. |
| 2 | Stop unilateral friending — moved into `accept_friend_request()` | ✅ **applied** | insert now `new row violates row-level security policy for table "friends"` |
| 3 | Stop anyone writing `notifications` — moved to `levl_notify()` | ✅ **applied** | as `anon`: `permission denied for table notifications`. `levl_notify` with no real pending request wrote **0 rows**. |
| 4 | Server weight ceiling 400 → 720 kg + chunked uploads | ✅ **applied** | `levl_validate_workout` carries the kg-normalised 720 ceiling |
| 5 | Fix the push webhook URL | ✅ **applied** | trigger repointed at the Edge Function |
| 6 | Turn off **Verify JWT** on the `push` function | ✅ **applied** | redeployed as version 3, `verify_jwt: false` |
| 7 | Rotate the `x-levl-secret` push secret | ☐ **You** — deliberately left; see note below. Low urgency. |
| 8 | Host Privacy Policy + Terms somewhere you control | ✅ **done** — GitHub Pages from `/docs` in the LEVL repo. Both URLs verified loading; [legal.js](src/services/legal.js) updated. Repo is also now backed up off the laptop. |
| 9 | Content filtering — blocklist + auto-hide on 3 reports (Guideline 1.2) | ✅ **applied** | 122 terms live; word-boundary + leetspeak matching verified 13/13 |
| 10 | Terms state the 24-hour commitment | ✅ already stated; now also describes filtering and auto-hide | |
| 11 | iPad — **dropped**, iPhone only | ✅ `app.json`, `TARGETED_DEVICE_FAMILY=1`, `~ipad` orientations removed | |
| 12 | Remove the placeholder `NSMicrophoneUsageDescription` | ✅ removed; plist validates, 3 real usage strings remain | |

### 🎉 Push notifications now work

The webhook had been POSTing to the Supabase **dashboard web page** since the
feature shipped — every attempt returned `405`, and not one push had ever been
delivered. After repointing the trigger and redeploying the function with
`verify_jwt: false`, a test notification produced this project's **first ever
HTTP 200**:

```
{"ok":true,"handled":1,"results":[{"kind":"reward","skipped":"no-token"}]}
```

That test was deliberately addressed to a user with **no** push token, so the
whole chain ran without anyone's phone buzzing. The one hop still unproven is
the last one — Expo → APNs → a real device. That needs the manual test below.

> **Why item 7 is still open.** Rotating the secret means changing it in two
> places at once — the trigger header and the function's `PUSH_HOOK_SECRET`
> env var — and I can only reach one of them. Rotating half would have broken
> push in the same breath as fixing it. It is also low urgency: reading the
> current value requires database access, and anyone with that already has far
> more than the secret protects. Rotate both together in the dashboard when
> convenient.

---

## 🔴 Before public launch

| # | What | Who | Done |
|---|---|---|---|
| 13 | Lock duel `winner`/scores/`reward` server-side — either player could forge a win | ✅ **applied** → [sql/2815](sql/2815_p1_hardening.sql) + [duelService.js](src/services/supabase/duelService.js). Verified: forging a win now returns `permission denied for table duels`. |
| 14 | DELETE policy on `workouts` + client delete path | ✅ **applied** → 2813 + [useGameSave.js](src/hooks/useGameSave.js) |
| 15 | Stop the post owner rewriting other people's comment text | ✅ **applied** → 2815 + [checkInService.js](src/services/supabase/checkInService.js) |
| 16 | Close `duel_invites` — anyone could list and hijack open codes | ✅ **applied** → 2815. Safe because `claimInvite` already went through the `claim_duel_invite` RPC. |
| 17 | Revoke `anon`/`authenticated` EXECUTE on `levl_recompute_profile_stats` | ✅ **applied** → 2815. Supabase's advisor no longer flags it. A 6th migration also revoked the new moderation trigger functions. |
| 18 | Leaked-password protection | ✅ **solved differently** — Supabase gates it behind the Pro plan, so it is now done in-app via the Have I Been Pwned range API ([breachCheck.js](src/services/breachCheck.js)), on signup, reset and change-password. Verified live: `Password1!` rejected at 584,516 breaches, random passwords pass. Password never leaves the device (k-anonymity, 5-char hash prefix). Fails open if HIBP is unreachable. Supabase's advisor will still flag this — ignore it. ☐ You: set the project's **minimum password length to 8** (that part is free). |
| 19 | Raise minimum password length from 6 to 8 | ✅ done — [AuthScreens.js](src/screens/AuthScreens.js), [SetNewPasswordScreen.js](src/screens/SetNewPasswordScreen.js); the Supabase error matcher no longer hunts for the literal digit "6" |
| 20 | Cut the splash | ✅ done — 3500 ms → **1400 ms** ([App.js](App.js)). Not 900: BootScreen's entrance animation runs 700 ms, so 1400 lets the mark land and the quote register. The gate still waits longer if the save is genuinely slow. |
| 21 | Rank floor / decay grace | ✅ done — [engine.js](src/engine/engine.js) `frProtection()`. Full hold for 14 days after your peak, then a linear slide over 14 more. Explained on the card in [StandingPanel.js](src/components/StandingPanel.js), and covered by **14 new engine tests**. |
| 22 | Filter the global leaderboard; adaptive scope | ✅ done — [leaderboardService.js](src/services/supabase/leaderboardService.js) requires `consistency > 0` and activity in 30 days; [useLeaderboard.js](src/hooks/useLeaderboard.js) opens on Friends when you have any, Global otherwise |
| 23 | Surface "Export my data" in Settings | ✅ done — `AccountTransfer` was already imported into Settings and never rendered. Now rendered under HELP & DATA, and relabelled so one component reads correctly in both places. |
| 24 | Expo patch bumps | ✅ done — `expo` 54.0.37, `expo-constants` 18.0.14, `expo-file-system` 19.0.24. **expo-doctor now 17/18**, the one remaining being item 25 by design. SDK 57 deliberately not attempted. |
| 25 | Note that `app.json` iOS config is inert | ✅ done — `_READ_THIS_FIRST` block at the top of [app.json](app.json). Verified Expo still parses and reads the config correctly. |
| 26 | Run the "stalled sync" query in the audit (§R3) to find users whose cloud history has stopped | ☐ **You** (SQL editor) — worth doing a week after launch too |

---

## 🎯 Activation fixes — highest return per hour

| # | What | Who | Done |
|---|---|---|---|
| 27 | Move the 6-field physical profile form to **after** the first logged set | ✅ done — the hard gate in [App.js](App.js) is gone. A skippable sheet appears 1.6 s after the first set lands, so the XP reward is seen first. Nothing but that gate depended on `profileComplete`. |
| 28 | ~~Default the Social feed to public scope~~ — **already shipped** in `3f944b4f`. [App.js:251](App.js) opens on Friends, then moves a friendless user to Discover once, automatically. Better than the blanket default I proposed. The audit was wrong to list this. | — | ☑ |
| 29 | Make "Verified Session" the headline — in-app copy, App Store description, screenshot 1 | ☐ **Mostly you.** The App Store description and screenshots are the high-value half and only you can write/shoot them. Say the word and I'll do the in-app copy pass. |
| 30 | ~~Show the four components behind the rank number~~ — **already shipped**. [StandingPanel.js](src/components/StandingPanel.js) renders Consistency / Trend / PRs / Balance with weights and hints, live at [CompeteTab.js:132](src/screens/CompeteTab.js). Second audit error. | — | ☑ |
| 31 | Add a duel invite link that opens a real "X challenged you" preview | ☐ **Blocked on item 8.** A link preview needs a web page to link *to*, and there is nowhere to host one yet. Do the GitHub Pages step and this unblocks. |

---

## 📱 App Store Connect

| # | What | Done |
|---|---|---|
| 32 | Privacy Policy URL = your new hosted URL (not claude.ai) | ☐ |
| 33 | Support URL / email set | ☐ |
| 34 | App Privacy: Email · User Content (photos) · Health & Fitness · Identifiers (push token) · Usage Data · Diagnostics — all "linked to user", **none** used for tracking | ☐ |
| 35 | Age rating **12+** minimum (user-generated content) | ☐ |
| 36 | Screenshots for every required iPhone size | ☐ |
| 37 | **Demo account** seeded with friends, Check Ins and an active duel — credentials in the review notes | ☐ |
| 38 | Review notes explain the Check In / Verified Session concept | ☐ |
| 39 | Export compliance: already declared (`ITSAppUsesNonExemptEncryption = false`) | ☑ |

---

## 🧪 Before you hit Submit

| # | What | Done |
|---|---|---|
| 40 | `npm test` passes | ☐ |
| 41 | `npx expo-doctor` — only the two known/accepted warnings | ☐ |
| 42 | Fresh TestFlight install, brand-new account, full walkthrough (§R of the audit) | ☐ |
| 43 | Two-account test on two devices (§R2) — especially **deleting an account mid-duel** | ☐ |
| 44 | Airplane-mode workout logging, then confirm it syncs | ☐ |
| 45 | Push received with the app **fully closed**, and the tap opens the right screen | ☐ |
| 46 | Account deletion on a throwaway account, verified gone in Supabase | ☐ |
| 47 | Both legal URLs open in a private browser window with no login | ☐ |
| 48 | Existing TestFlight user updates without losing data | ☐ |

---

## 🚀 First week after approval

- [ ] Add `expo-updates` so a JS bug can be fixed without a review cycle
- [ ] Add Sentry for real crash reporting with symbolication
- [ ] Watch `telemetry_events` daily: `app_open` → `first_set_logged` → `returned_day_2`
- [ ] Watch `content_reports` daily — you have a 24-hour obligation
- [ ] Check `net._http_response` for push failures
- [ ] Ship the "friend just PR'd" notification
- [ ] Ship the streak freeze

---

## 📊 The numbers to watch

**Primary activation event: a user logs their first set.** Everything else is downstream of it.

| KPI | Target | Source |
|---|---|---|
| Signup → first set logged | **> 60%** | `telemetry_events` |
| First set → third set | **> 40%** | `telemetry_events` |
| Day-1 return | **> 30%** ([industry avg 26–35%](https://www.businessofapps.com/data/health-fitness-app-benchmarks/)) | `returned_day_2` |
| Day-7 return | **> 15%** | add an event |
| Day-30 return | **> 8%** (industry avg ~3–4%) | add an event |
| Users with ≥1 friend by day 7 | **> 25%** | `friends` table |
| Crash-free sessions | **> 99.5%** | Sentry, once added |

---

## What is left for you

Everything I could reach is done. These four need you.

### 1. Cut a new TestFlight build  ← do this first
```bash
eas build --platform ios --profile production
```
**The database is now ahead of the shipped app.** Build 29 writes directly to
tables that are locked as of today, so on the *currently installed* TestFlight
build, accepting a friend request and duel accept/quit/score-sync will fail. The
fixed client is already in this repo. Tell your testers, or just build now.
A build was required regardless — `package.json`, the iPad change and the
Info.plist edits all need one.

### 2. Two toggles in the Supabase dashboard
- **Authentication → Policies →** enable leaked-password protection, and set the
  minimum password length to **8** so the server agrees with the app *(item 18)*
- **Edge Functions → push →** rotate `PUSH_HOOK_SECRET` and paste the same value
  into the `levl_push` webhook header *(item 7 — both halves together, or push
  breaks)*

### 3. Give the legal pages a home *(item 8)*
`git push` this repo to GitHub, enable Pages on `/docs`, send me the URL and I
will swap the two constants. **There is still no git remote — nothing here is
backed up anywhere.**

### 4. App Store Connect
The whole section above. The one people forget: **a demo account seeded with
friends, Check Ins and an active duel**, with credentials in the review notes.
A reviewer who sees three empty tabs cannot evaluate the app.

---

## What I still can't verify

- **A push actually arriving on a phone.** I proved the chain end to end up to
  Expo; the last hop (Expo → APNs → your device) needs a physical device on a
  real build.
- **Anything on-device**: cold-start timing, the new profile sheet, rank
  protection rendering, iPad now being refused.
- **App Store Connect** — I have no access.
