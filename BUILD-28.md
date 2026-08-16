# LEVL Build 28 — Check In, five tabs, and a much deeper Apple integration

This document is the reference for everything that changed. If you only read one
section, read **[Manual steps](#manual-steps)** at the bottom — that is the list
of things only you can do.

---

## 1. What changed

### The five destinations

```
TRAIN      COMPETE      SOCIAL      HUNTER      FORGE
```

Stats and You are gone as bottom tabs. **Nothing they contained was deleted** —
it was reorganised by purpose:

| Was | Is now | Why |
|---|---|---|
| **You** → character, rank, stats, titles, PRs | **HUNTER** tab | This is the RPG heart of LEVL. It deserved a destination, not a settings screen with a character at the top. |
| **You** → units, account, transfer, reset, bug report | **Profile sheet**, from the avatar in the header | Preferences are not a destination. iOS users look top-right for them. |
| **Stats** → strength curves, volume, history, calculators | **Train → Progress & analytics** | Analytics belong next to the training they describe, one tap away — not occupying a fifth of the tab bar. |
| **Ranks** (was folded into Compete already) | **COMPETE → Ranks / Leaderboard** | Ranks and the leaderboard were two answers to one question. |
| **Packs** | Inside **FORGE** | It was never a top-level destination. |

The tabs stay **mounted**. Switching to Social and back does not lose a
half-entered set on Train — that property is why navigation is a small resident
tab set plus a modal stack rather than a stack navigator.

### Files

**New**
```
src/navigation/routes.js               every route + the levl:// parser
src/hooks/useRouter.js                 tabs, modals, deep links, quick actions
src/hooks/useGameSave.js               the save + every game handler (moved out of App.js)
src/hooks/useCheckIn.js                today's Check In, posting, attaching
src/hooks/useCheckInFeed.js            paginated realtime feed
src/hooks/useCheckInComments.js        comments for one post
src/hooks/useCheckInPreferences.js     window, audience, notification switches
src/hooks/useHealth.js                 Apple Health, display only
src/engine/session.js                  workout sessions, naming, summaries
src/services/checkInUpload.js          compress → upload → post → award, resumable
src/services/notifications.js          local prompts, taps, deep links, push token
src/services/haptics.js                one vocabulary for touch
src/services/workoutSession.js         active workout state (also the Watch seam)
src/services/supabase/checkInService.js  every social Supabase call
src/screens/SocialTab.js               the feed
src/screens/CheckInCameraScreen.js     capture
src/screens/CheckInDetailScreen.js     one post (notification target)
src/screens/CheckInArchiveScreen.js    calendar archive
src/screens/SocialIntro.js             three cards + set your window
src/screens/HunterTab.js               the character destination
src/screens/CompeteTab.js              Duels · Ranks · Leaderboard
src/screens/SettingsScreen.js          the profile sheet
src/components/social/*                CheckInCard, DualPhoto, ReactionBar,
                                       WorkoutAttachment, CheckInComposer,
                                       CommentSheet, CheckInPrompt, FeedSkeleton,
                                       WorkoutShareSheet
src/components/HunterAvatar.js         the small Hunter used in social contexts
src/components/SFIcon.js               SF Symbols with a vector fallback
src/components/ActiveWorkoutBar.js     live workout strip + the way to end it
```

**Removed**
```
src/screens/ProfileTab.js    split into HunterTab.js + SettingsScreen.js.
                             Every section survives in one of the two.
```

**Substantially changed**
```
App.js         1078 → ~700 lines, and now composition rather than logic
src/theme.js   added the SF Pro type scale (T) and tabular numerals (NUM)
src/engine/engine.js  session ids on new records; the social XP rate card
```

---

## 2. Social — Check In

**The mechanic.** Once a day LEVL prompts you at an unpredictable time inside
the training window you chose. You capture both cameras at once. Friends (or the
wider LEVL community, if you choose) react and comment.

**Two states.**

- **CHECK IN** — the photographs. Counts as your day.
- **VERIFIED SESSION ✓** — a Check In with a LEVL workout attached. The card
  shows the real session: `PUSH · 14 sets · 8,420 kg · Bench Press · Incline DB
  Press · Lateral Raise · +286 workout XP · 2 PRs`.

  "Verified" means *a workout logged in LEVL is attached*. The copy never claims
  LEVL confirmed anyone was at a gym.

**Lateness is stated, never punished.** Miss the prompt and post at 11pm and the
card reads `3h late`. That is all that happens.

**The numbers are not asserted by the phone.** A Check In stores a *pointer* to
a workout session id. A database trigger verifies the session is yours and from
that day, then recomputes sets, volume, XP and PRs from your `workouts` rows
itself. A tampered client that posts a fabricated summary has it overwritten.

**Capture.** On A12 and later (iPhone XS / XR onward) both cameras run in one
`AVCaptureMultiCamSession` and fire milliseconds apart. Older hardware physically
cannot, so LEVL shoots rear then immediately front — about a third of a second —
and the app **says which happened**. Nothing is faked. Where the native module
isn't present (Expo Go, Android) `expo-camera` provides the same two-shot
sequence.

**Offline.** Gyms have terrible signal, so the whole flow is a resumable state
machine persisted to disk:

```
captured → compressed → front uploaded → rear uploaded → posted → XP awarded
```

The photographs are compressed and written to durable storage *before any
network call*. A failed post becomes a pending job that retries on every
foreground. It cannot double-post: the storage path is generated once, the
`check_ins` table has `UNIQUE (user_id, local_date)`, and XP comes from a
server-side ledger.

**Privacy.** Photos are re-encoded before upload, which strips all EXIF. No
location is ever requested or attached. The bucket is private — there is no
permanent public URL for a Check In photo, only short-lived signed URLs that
Supabase issues only if you pass the same visibility rule the rows use. Flip a
post from Public to Friends and the images become unreachable in the same
instant.

---

## 3. XP — and why these numbers

I measured the existing economy in `src/engine/engine.js` before choosing
anything:

| Reference point | Value |
|---|---|
| One working set — `setXP(80kg × 8 @ RPE 8)` | ~39 XP |
| A typical 14-set session incl. first-of-day bonus | ~440 XP |
| One mid-game level — `xpForLevel(27) − xpForLevel(26)` | 1,320 XP |
| A won 7-day duel (Contender) | 500 XP |
| One training pack — `PACK_XP_STEP` | 1,200 XP |
| Daily integrity cap — `INTEGRITY.DAILY_XP_CAP` | 4,000 XP |

**The values:**

| Award | XP | Share of a session |
|---|---|---|
| **Check In** | **30** | 6.8% |
| **Verified Session bonus** | **+60** (90 total) | 20% |
| 7-day Check In streak | 120 | ¼ session |
| 30-day Check In streak | 350 | ¾ session |
| 100-day Check In streak | 900 | 2 sessions |
| Reactions and comments, given or received | **0** | — |

**Why they're balanced.**

- 30 XP is about one accessory set — 0.75% of the daily cap. Enough to notice,
  nowhere near enough to be a strategy.
- The verified bonus is only reachable on a day you logged a real workout, one
  that already paid its own ~440 XP. It rewards sharing training you did; it can
  never substitute for doing it.
- **Photo-only ceiling is 30 XP/day.** Someone who never trains and posts every
  single day for a year earns ~11,000 XP — about level 15. Somebody training four
  times a week reaches that in six weeks. Training wins by an order of magnitude.
- Social popularity is worth exactly nothing.

**Why it can't be farmed.** The ledger `social_xp_awards` is keyed on
`(user_id, local_date, award_kind)` and is never cleaned up when a post is
deleted. Post → delete → repost returns 0. Detaching and re-attaching a workout
returns 0. The amounts live in `levl_social_xp_amount()` server-side; the client
asks and is *told*, it never proposes a number.

The values are defined once in `SOCIAL_XP` (`src/engine/engine.js`) for the UI
preview, and authoritatively in `sql/2805_social_xp.sql`.

---

## 4. Database

### New tables

| Table | Holds |
|---|---|
| `check_ins` | One per user per local day. Photos, audience, lateness, the workout pointer, the server-computed summary, denormalised counts. |
| `check_in_reactions` | One active reaction per person per post (unique constraint). |
| `check_in_comments` | Flat, plain text, soft-deleted. |
| `check_in_preferences` | Window, timezone, default audience, notification switches, push token. |
| `user_blocks` | Symmetric in effect: neither side sees the other. |
| `content_reports` | Moderation intake; one report per person per item. |
| `social_xp_awards` | The idempotency ledger. |
| `storage_cleanup_queue` | Photos to remove if the device was offline at delete time. |

### Changed tables

- `workouts` — added `session_id TEXT` (null on everything logged before Build 28).
- `profiles` — added `username_set`, a **unique index on `username`**, and a
  de-duplication pass. The app no longer overwrites `username` on every sync;
  it is claimed once via `levl_set_username()`. Display names are untouched.

### Relationships

```
                       User
                        │
        ┌───────────────┼───────────────┬──────────────┐
        │               │               │              │
    Check In       Friends          Blocks         Reports
        │
   ┌────┼────────────────┐
   │    │                │
Workout Reactions    Comments
(pointer:
 session_id →
 workouts rows)
```

**Reused, not rebuilt:** `profiles`, `friends`, `friend_requests`,
`notifications` (social activity lands in the existing activity centre),
`workouts`, `duels`.

---

## 5. SQL — run these in this exact order

In the Supabase dashboard → **SQL Editor**, paste and run each file in full:

| # | File | What it does | Risk to existing data |
|---|---|---|---|
| 1 | `sql/2801_social_core.sql` | Relationship helpers, blocks, reports, Check In preferences, **unique usernames** | Rewrites duplicate/invalid `profiles.username` values only. Display names, XP, workouts untouched. |
| 2 | `sql/2802_check_ins.sql` | `check_ins`, reactions, comments, the workout-verification trigger, count triggers, activity notifications | None — new tables, plus one nullable column on `workouts`. |
| 3 | `sql/2803_social_rls.sql` | All Row Level Security for the social tables, and the feed reader | None. |
| 4 | `sql/2804_social_storage.sql` | The private `check-ins` bucket and its policies | None. |
| 5 | `sql/2805_social_xp.sql` | The XP ledger, the rate card, streak and stats functions | None. |

All five are **idempotent** — safe to run again. None of them drop a table, and
none of them touch a workout, an XP total, a level, inventory, coins, titles,
ranks, duels or friends.

> **The one thing to know about #1:** if two accounts currently share a username
> (which was possible — it was generated from the display name), the older
> account keeps it and the other gets a short suffix. Nobody's display name
> changes and nobody loses anything.

### Storage

`sql/2804` creates the bucket for you. You do not need to touch the Storage UI.

- Bucket **`check-ins`** — private, 5 MB limit, JPEG/WebP only.
- Path layout: `{user_id}/{yyyy-mm-dd}/{uuid}/{front|rear}.jpg`
- Policies: upload/update/delete only under your own user id folder; read is the
  owner **or** anyone allowed to see the Check In that references the object.

---

## 6. Security review

The five scenarios from the brief, and where each is enforced. Runnable checks
are at the bottom of `sql/2803_social_rls.sql`.

| Scenario | Result | Enforced by |
|---|---|---|
| **A** Alice posts Friends-only; Bob is a friend, Charlie isn't | Bob reads, Charlie denied | `read friends check_ins` policy → `levl_are_friends()` |
| **B** Alice posts Public | Any signed-in user reads, unless Alice turned off public discovery | `read public check_ins` policy |
| **C** Alice blocks Bob | Bob can't read Alice's posts, can't react, can't comment; the friendship and any pending request are torn down | `levl_is_blocked()` in every policy; `levl_block_user()` |
| **D** Bob tries to delete Alice's post or comment | 0 rows | `delete own check_ins` / `delete own comment` policies |
| **E** Bob calls the XP function repeatedly | First call pays, every later call returns 0 | `social_xp_awards` unique key |

Additional guards:

- Photo paths must begin with the poster's own user id — a trigger rejects
  anything else, so nobody can republish someone else's photograph.
- Reaction and comment counts are written **only** by triggers; a client value
  is discarded.
- Reaction types are a CHECK-constrained enum. Comment bodies are length-checked
  in the database and rendered into `<Text>`, which React Native never
  interprets as markup.
- A workout can only be attached if the server confirms it is yours and from the
  right day, and the public summary is recomputed from your rows regardless of
  what the client sent.

---

## 7. Apple integrations

| Feature | Status | Notes |
|---|---|---|
| **Dual-camera capture** | Native Swift | `AVCaptureMultiCamSession` where supported, measured sequential fallback otherwise. Reports which ran. |
| **Live Activity + Dynamic Island** | Native (ActivityKit + WidgetKit) | One idea per state: resting → countdown, PR → the PR, otherwise → the set. Tapping deep-links to `levl://workout/{sessionId}`. Rest counts down locally via `Text(timerInterval:)`, so a running timer costs zero updates. |
| **Lock Screen** | Native | Roomier layout: exercise, set, last load, rest or elapsed, XP. |
| **Live Activity lifecycle** | Handled | Start adopts an existing activity for the same session and ends stale ones; `endAll()` at launch clears anything a crash left behind; the Active Workout bar gives an explicit end. |
| **HealthKit** | Native | Reads steps, active energy, exercise minutes, resting HR, body mass, body fat, VO₂ max, sleep. Writes completed workouts with a duplicate guard on session id. **Never** feeds XP, stats, rank or duels. Never uploaded. Never on a Check In. |
| **Home screen widget** | Native (WidgetKit) | "LEVL Today" — small and medium. Level ring, streak, next workout, Check In status. Reads an App Group snapshot; no health data, no photos. |
| **Notifications** | Local, implemented | Daily Check In prompt at a re-rolled random minute inside your window, scheduled several days ahead and re-rolled on launch — survives DST and travel. Rest alerts. Granular category switches. |
| **Deep links** | Implemented | Every notification, the Dynamic Island, Quick Actions and the widget produce a `levl://` URL, all parsed in one place. |
| **Home Screen Quick Actions** | Native | Start Workout · Check In · Active Duel, delivered through an `ExpoAppDelegateSubscriber` and parked until JS is ready (so a cold launch works). |
| **SF Symbols** | Implemented | Utility icons only — camera, people, bell, gear, chevrons. LEVL's own artwork (Hunter, muscle figures, rank crests, tab icons) stays custom. |
| **Haptics** | Implemented | One vocabulary: selection / tap / commit / success / warning / error / celebrate. Celebration is rationed to PRs and level-ups. Respects Reduce Motion. |
| **SF Pro typography** | Implemented | 110 hardcoded `Menlo` usages replaced with the system font plus `tabular-nums`. Full iOS-shaped scale in `T`. No font files bundled. |
| **Apple Watch** | Architecture only, as asked | `src/services/workoutSession.js` is the seam — see below. |
| **App Intents / Siri / Spotlight** | **Not implemented** | See "What I did not build". |
| **Control Center** | **Not implemented** | See "What I did not build". |

### Apple Watch — how a companion would consume this

`src/services/workoutSession.js` is a plain observable store with no React and
no platform APIs in its core. A Watch app needs exactly:

- `getState()` — a small JSON-serialisable snapshot: exercise, set, rest,
  elapsed, XP, PR flag
- `subscribe(fn)` — every change, already coalesced
- `start` / `logSet` / `startRest` / `endRest` / `setExercise` / `end` — the
  complete set of transitions

To add it: build a WatchConnectivity bridge that sends the snapshot on every
`subscribe` callback via `updateApplicationContext`, and forwards watch-side
actions back into the same transition functions. **No workout logic has to
move**, because none of it lives in the UI.

---

## 8. Packages

**Added** (all via `npx expo install`, so all SDK 54-matched):

```
expo-camera            expo-image             expo-image-manipulator
expo-notifications     expo-file-system       expo-device
expo-localization      expo-blur              expo-symbols
expo-build-properties  expo-linking
```

**Removed:** none.

## 9. Native code

```
modules/levl-dual-camera/
  ios/DualCameraController.swift      multi-cam + sequential capture
  ios/LevlDualCameraView.swift        the live preview
  ios/LevlDualCameraModule.swift      the JS surface
modules/levl-live-activity/
  ios/LevlLiveActivityModule.swift    ActivityKit + widget snapshot
  ios/LevlWorkoutAttributes.swift     the app↔widget contract (canonical)
  ios/LevlSharedStore.swift           App Group snapshot (canonical)
  ios/LevlShortcutSubscriber.swift    Quick Actions / Siri route parking
modules/levl-health/
  ios/LevlHealthModule.swift          HealthKit read + workout write
targets/levl-widgets/
  LevlWidgetBundle.swift
  LevlWorkoutLiveActivity.swift       Lock Screen + Dynamic Island
  LevlTodayWidget.swift               home screen widget
  Info.plist
plugins/withLevlWidgets.js            adds the extension target to Xcode
```

The two shared Swift files live in `modules/levl-live-activity/ios/` as the
single source of truth and are **copied** into the extension at prebuild, so the
app and the widget can never compile two different versions of the
`ActivityAttributes` contract.

---

## 10. Expo Go

> **Native features now require a development or TestFlight build.**

This is expected, not an error. Expo Go cannot load custom native modules. In
Expo Go the app still runs, and: Check In falls back to `expo-camera`'s
sequential capture, and Live Activities, the widget, HealthKit and Quick Actions
report themselves unavailable rather than failing.

Make a development build once:

```bash
npx expo run:ios
```

or

```bash
eas build --profile development --platform ios
```

`eas.json` did not need changing — the existing `development`, `preview` and
`production` profiles all work.

---

<a name="manual-steps"></a>
## 11. Manual steps — in order

These are the things I cannot do for you. Follow them top to bottom.

### Step 1 — Run the database migrations

Open Supabase → your project → **SQL Editor**. For each file below, open it from
this repo, copy the whole thing, paste, and press Run. **Do them in this order:**

1. `sql/2801_social_core.sql`
2. `sql/2802_check_ins.sql`
3. `sql/2803_social_rls.sql`
4. `sql/2804_social_storage.sql`
5. `sql/2805_social_xp.sql`

None of these can damage your existing data. If one reports an error, stop and
send me the message rather than running the next.

### Step 2 — Check the storage bucket appeared

Supabase → **Storage**. You should see a bucket called **check-ins** marked
Private. If it's there, step 1 worked.

### Step 3 — Turn on the Apple capabilities

Go to <https://developer.apple.com/account> → **Certificates, Identifiers &
Profiles** → **Identifiers** → tap `com.matteo.ascend`. Tick these:

- ☑️ **Sign in with Apple** *(already on)*
- ☑️ **Push Notifications**
- ☑️ **HealthKit**
- ☑️ **App Groups** — then click Configure and add a group called
  `group.com.matteo.ascend`

Then create a **second identifier** for the widget:

- Click **+** → App IDs → App → Description "LEVL Widgets", Bundle ID
  `com.matteo.ascend.LevlWidgets`
- Tick **App Groups**, Configure, and select the same `group.com.matteo.ascend`

Save both.

> Live Activities and Widgets need no capability of their own — they come from
> the widget extension plus the `NSSupportsLiveActivities` key, which is already
> set for you.

### Step 4 — Build the app

```bash
npx expo prebuild --platform ios --clean
```

Then either:

```bash
npx expo run:ios
```

(to run on a device connected to this Mac), or:

```bash
eas build --profile development --platform ios
```

If EAS asks about provisioning, let it manage credentials automatically — it
will pick up the capabilities from Step 3.

### Step 5 — Set up push notifications *(optional, do it when you're ready)*

The daily Check In prompt, and rest alerts, work **right now with no server**.

What needs a backend is the category that is triggered by *someone else's*
phone — a friend reacting, a friend commenting, a duel challenge. Those already
appear live in the in-app activity centre, so nothing is invisible; they just
don't buzz the phone yet.

To add that later you need two things:

1. An **EAS project id**. Run `eas init` in this folder; it writes
   `extra.eas.projectId` into `app.json`. Without it, `getPushToken()` returns
   null and the app carries on.
2. A **Supabase Edge Function** that watches the `notifications` table and posts
   to `https://exp.host/--/api/v2/push/send` using the token stored in
   `check_in_preferences.expo_push_token`, respecting each user's
   `notify_social` / `notify_duels` / `notify_rewards` switches.

The device half is done — permission, token capture, storage, and tap routing.

### Step 6 — App Store Connect, before you submit

Because LEVL now has user-generated photographs, comments, HealthKit and the
camera, review these in App Store Connect → your app → **App Privacy**:

- **Photos or Videos** — collected, linked to identity, used for App
  Functionality. (Check In photographs.)
- **User Content** — comments.
- **Health & Fitness** — declare it, but note LEVL only **reads** Health data for
  on-device display and **writes** workouts. It never transmits Health data
  anywhere. Say so.
- **Identifiers / Contact Info** — email is used for account only and is never
  shown publicly.
- **Diagnostics** — bug reports.

Also confirm the four usage strings, which are already written into `app.json`:
`NSCameraUsageDescription`, `NSHealthShareUsageDescription`,
`NSHealthUpdateUsageDescription`, plus the notification prompt.

**User-generated content requirements** — Apple requires all four for an app
with a social feed. All four are implemented:

- ☑️ Report a Check In and report a comment
- ☑️ Block a user (symmetric, and it removes the friendship)
- ☑️ Delete your own Check In and your own comment
- ☑️ Reports stored for moderation (`content_reports`, triaged in the Supabase
  dashboard)

I have **not** written any privacy-policy or legal text — that has to be yours.
Your policy will need to cover: photographs stored on Supabase, comments,
friend relationships, and that Health data never leaves the device.

---

## 12. What I tested

**Validated by running:**

- Every JS file parses — `node tools/check-syntax.js` → 91 files, 0 failures.
- Every import resolves and every named import genuinely exists —
  `node tools/check-imports.js` → 88 files, 0 problems. *(new tool)*
- The repo's own `tools/find-undefined-refs.js` → 0 undefined references.
- **The whole app bundles** — `npx expo export --platform ios` → 1,025 modules,
  no errors. This is the strongest guarantee that nothing is missing at runtime.
- `npx expo config --type prebuild` parses with all plugins applied.
- `npx expo prebuild --platform ios --clean` succeeds and produces both targets.
- `pod install` integrates all three custom modules — confirmed in
  `Podfile.lock` (`LevlDualCamera`, `LevlHealth`, `LevlLiveActivity`).
- **The widget extension compiles** — `xcodebuild -target LevlWidgets` →
  **BUILD SUCCEEDED**. That covers the Live Activity, the Dynamic Island
  layouts, the Today widget and the shared attributes contract.
- **All three native modules compile** — `xcodebuild -scheme LevlDualCamera` /
  `LevlHealth` / `LevlLiveActivity` → **BUILD SUCCEEDED** for each.
- The generated Xcode project contains exactly one "Embed App Extensions" phase,
  one target dependency, and correct entitlements (App Group, HealthKit,
  aps-environment) with `NSSupportsLiveActivities` set.

### Verified running on an iPhone 17 simulator (iOS 26.5)

The app was built, installed and driven end to end. What was confirmed by
actually using it, not by reading the code:

| Checked | Result |
|---|---|
| Five-tab bar, correct order and icons | ✅ Train · Compete · Social · Hunter · Forge |
| Train — muscle grid, exercise picker, logging, effort scale | ✅ unchanged |
| **Session grouping** (what Check In attaches to) | ✅ named the day's work "Pull" from the exercises, and correctly split a later set into a 2nd session via the 3-hour gap rule |
| PR detection | ✅ 45 kg × 8 → "NEW PERSONAL RECORD, est. 1RM 57 kg (was 43.3)" |
| **Live Activity starts** on first logged set | ✅ green Active Workout bar, then the Lock Screen card |
| **Lock Screen layout** | ✅ `LEVL PULL · Barbell Curl · Set 2 · 45 kg × 8 · Next 45 kg × 8 · WORKOUT 0:30 · +43 XP` |
| Timer counts without app updates | ✅ 0:30 → 1:00 with the app backgrounded |
| **Deep link from the Live Activity** | ✅ tapping it opened Barbell Curl, not the home screen |
| **Live Activity ends on Finish** | ✅ Lock Screen completely clear — no zombie |
| `levl://` URL scheme | ✅ registered; `levl://compete/leaderboard` opened the right tab AND segment |
| Compete — unified Duels/Ranks/Leaderboard | ✅ standing card `#29 of 141 · Champion II · FR 3389`, nested toggle correctly suppressed |
| Hunter — character, radar, appearance | ✅ |
| Social — guest state | ✅ "Join LEVL to Check In with friends" |
| SF Symbols | ✅ real system symbols rendering (people, bell) |
| Train analytics entry point | ✅ TODAY strip + "Progress & analytics" |

That covers the riskiest thing in this build — 255 lines of SwiftUI for the Live
Activity that had been compiled but never seen render — plus the full lifecycle
that would otherwise strand a workout on somebody's Lock Screen.

### Two environment problems worth recording

Neither is a code defect; both cost real time.

1. **A space in the project path breaks the build.** `expo run:ios` fails inside
   `ASCEND/levl 3` because an Expo build script doesn't quote the path — it
   truncates at the space and reports `is a directory: /Users/.../ASCEND/levl`.
   Build from a path with no spaces. **EAS is unaffected**, since it builds at a
   clean path on its own servers.

2. **iCloud Desktop sync + a full disk is destructive.** Installing the 16 GB
   simulator runtime pushed the disk to 99%, and macOS responded by evicting
   58,000 iCloud-backed files to dataless stubs — including the git packfile and
   most of `node_modules`. Git reported a corrupt pack; Expo's own CLI crashed
   with a nonsense error. Nothing was lost (reading a file re-downloads it), but
   re-materialising 26,000 files at iCloud's throttle would have taken ~22 hours;
   `npm ci` rebuilt them in two minutes. **Keep this project off the Desktop, or
   keep several gigabytes free.**

> A note on CocoaPods on this machine: `pod install` aborts unless the shell has
> a UTF-8 locale. If you hit `Unicode Normalization not appropriate for
> ASCII-8BIT`, add `export LANG=en_US.UTF-8` to your `~/.zshrc`. It is a
> CocoaPods/Ruby environment issue, nothing to do with this build.

**Reviewed by reading, not executed:** the RLS policies and triggers. I could
not run them because I have no credentials for your Supabase project. The
scenario checks at the bottom of `sql/2803_social_rls.sql` are written so you
can execute them yourself in the SQL editor.

**Still not tested, because it needs real hardware and a second account:**
simultaneous dual-camera capture (the simulator has no cameras), the HealthKit
permission sheet, push delivery, and a real friend-to-friend feed with
reactions and comments. These compile and the logic is complete, but they need
a TestFlight build on a physical phone.

### A short device checklist, in the order things are most likely to break

1. Log a set → the green Active Workout bar appears; lock the phone and check
   the Lock Screen shows the Live Activity; tap it and confirm you land on that
   exercise. Tap **Finish** and confirm the activity disappears.
2. Force-quit mid-workout, reopen → no zombie activity on the Lock Screen.
3. Check In on an iPhone XS or newer → the composer should say "Both cameras
   captured together". On anything older it should say "Rear then selfie". If
   the wrong one shows, the capability probe is wrong.
4. Turn on Airplane Mode, Check In → it should say it is saved and waiting.
   Turn the network back on, background and foreground the app → it posts once.
5. Post, delete, post again → the second post awards **0 XP**.
6. From a second account: react and comment, and confirm the first account gets
   the activity row. Then block, and confirm both directions go dark.

---

## 13. What I did not build, and why

- **App Intents / Siri / Spotlight / Control Center.** The brief ranks these
  last (§89 #13), and doing them properly means App Intents metadata extraction
  in the right target — which is exactly the kind of change that can break an
  otherwise-working build. Home Screen Quick Actions cover most of the same
  ground and are implemented and tested. The route-parking mechanism they use
  (`LevlShortcutSubscriber` + the shared App Group) is the same one App Intents
  would use, so adding them later is additive.
- **A share card image export.** Sharing a Check In externally would want
  `react-native-view-shot` to rasterise a card. I left it out rather than add a
  native dependency late in a build I could not device-test.
- **AI photo moderation.** Explicitly out of scope (§93). The reporting and
  storage architecture supports adding it later.
