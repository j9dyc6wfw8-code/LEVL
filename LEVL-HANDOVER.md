# LEVL — Handover

Everything a new session needs. Written 19 August 2026.

**Branch:** `world-class-polish` — 23 commits ahead of `main`, **not pushed**
**Tests:** 55 engine / 224 render / 191 interactive — all green
**expo-doctor:** 17/18 (the one failure is expected — see below)

---

## 1. What happened before this branch

A full pre-launch audit found and fixed seven P0 security/data defects. **These
are applied to production Supabase and must never regress.** Details in
[LEVL-PRE-LAUNCH-AUDIT.md](LEVL-PRE-LAUNCH-AUDIT.md).

| Was broken | Now |
|---|---|
| Any signed-in account could read **every** user's workouts (610 rows from 20 strangers, reproduced) | 0 rows from non-friends |
| Anyone could forge a friendship, gaining access to private Check In photos | RLS violation |
| Anyone — **without an account** — could write notifications, which fire push | permission denied |
| Either duel player could declare themselves the winner and collect | permission denied |
| One 450 kg leg press silently killed a user's cloud sync for ever | ceiling raised to 720 kg, uploads chunked |
| Push had **never** delivered a single notification (wrong URL, 405 every time) | first HTTP 200 confirmed |
| No content filtering at all (App Store Guideline 1.2) | 122-term filter + auto-hide on 3 reports |

Six migrations are live: `close_legacy_holes`, `content_moderation`,
`p1_hardening_duels_comments_invites`, `fix_push_webhook_endpoint`,
`revoke_trigger_function_execute`, plus the earlier ones.

---

## 2. What this branch did (the world-class pass)

### Fixed

- **Exercise browser hid 67 and 87 exercises** behind silent `.slice()` caps —
  under a button reading "Browse all 127 exercises". Removed.
- **Set entry**: `selectTextOnFocus` + ref forwarding on `NumField`. The field
  pre-fills with your last value; tapping it used to put the caret *after* "80",
  so entering 85 meant backspacing first.
- **Plate breakdown while logging** — "BAR 25 · 15 per side". Barbell lifts only.
- **Double-tapping Accept** on a friend request showed an error for an action
  that had succeeded. Guarded per request id.
- **Apple sign-in surfaced Apple's raw developer string** to users. Mapped to
  human copy.
- **`T.micro` added** — the type scale had no step below 11pt, which is *why*
  screens fell back to literals. `T.label` was the only option at that size and
  it uppercases, so migrating to it would have rewritten copy.
- **TrainTab typography: 151 literals → 6.** Verified pixel-identical on device.
- **The typography migration is finished.** Every screen is on `T`, and `TYPE`
  is deleted from `theme.js`. See §5.

### Written

- [LEVL-RESEARCH.md](LEVL-RESEARCH.md) — competitor gap matrix, love/hate tables
- [LEVL-DESIGN-SYSTEM.md](LEVL-DESIGN-SYSTEM.md) — the spec, with the migration method
- [LEVL-WORLD-CLASS-CHECKLIST.md](LEVL-WORLD-CLASS-CHECKLIST.md) — all 100 brief items tracked

---

## 3. Key research finding that should steer decisions

**Logging friction is the strongest single predictor of whether someone still
uses a fitness app at day 30.** The category keeps ~3% at day 30; the drop is
steepest for manual-entry apps.

I then measured LEVL against Strong's "two taps" benchmark expecting it to lose.
**It doesn't.** `log()` deliberately preserves weight and reps, so logging
another set at the same load is **one tap**. Do not "optimise" this away.

---

## 4. Things I got wrong — don't repeat them

I claimed six features were missing that already existed. Grep before asserting
absence.

| I said missing | Reality |
|---|---|
| Plate calculator | Existed in the 1RM workbench (`CalcView`) |
| Social feed public default | Shipped in `3f944b4f` |
| Rank breakdown UI | Shipped in `StandingPanel` |
| Notification category settings | All four switches exist in Settings |
| Signed-URL TTL too long | Already 3600s, correct |
| Dumbbell weight guidance | "Enter the weight of ONE dumbbell" already there |

Also: I diagnosed the auth screen's guest text as *clipped* and shipped padding.
It is **below the fold**, not clipped — padding lengthens the scroll and fixes
nothing. Reverted. The real fix is tightening the layout above it.

---

## 5. Typography — done, and what the method was

**Complete.** `T` is the only type scale; `TYPE` is deleted from `theme.js`.
Eleven commits, one screen each, each verified on an iPhone 17 Pro against
before screenshots.

| Screen | was | now |
|---|---|---|
| ProgressTab | 46 literals | 4 + 1 ternary, all off-scale hero numerals |
| DuelTab | 34 literals + 1 TYPE | 0 |
| PacksTab | 25 literals | 2 off-scale |
| LoadoutCard | 19 literals | 6, for three different stated reasons |
| ShopTab | 36 TYPE + 3 literals | 1 off-scale |
| FriendsScreen | 52 TYPE + 3 literals | 1 off-scale |
| ui.js, FriendDuelDetail, NotificationCenter, +5 | 45 TYPE | 0 |

### The two things worth carrying forward

**1. The hazard check needs to walk braces, not match a regex.**
The original check was `\{[^{}]*fontSize: [0-9.]+[^{}]*\}`, and it silently
misses any style object containing a nested `{...}` — an Animated
`interpolate({...})`, a ternary returning an object. PacksTab had exactly that,
and it was a real `fontWeight`-before-`fontSize` site in the pack reveal. Walk
backwards from each `fontSize` to its own opening brace, strip nested braces,
then look for an earlier `fontWeight` or `lineHeight`. Re-run over every
migrated file, nothing was clobbered.

**2. `TYPE` and `T` were never aliases.** Only `micro` is a free swap. The full
measured table is in [LEVL-DESIGN-SYSTEM.md](LEVL-DESIGN-SYSTEM.md); the trap is
`TYPE.heading` (16/**600**) → `T.callout` (16/**400**), which silently lightens
every card title unless the 600 is restated after the spread.

### What is left

- **AuthScreens still has 29 raw literals.** Never in scope; only its one
  `TYPE.micro` was cleared so `TYPE` could go. No hazard sites. Obvious next.
- **LoadoutCard's `ARMOUR`/`ENERGY` labels wrap mid-word** in the duel build
  columns. Pre-existing, unchanged by this pass, and the reason two 8/8.5pt
  sites were left below `T.micro`'s 10pt floor rather than raised into it.

---

## 6. Running the app

```bash
npx expo start          # Metro, needed for a Debug build
```

Build for the simulator with the iOS build tool against
`ios/LEVL.xcworkspace`, scheme `LEVL`, Debug. Takes ~2 minutes. All ~1,500
warnings come from third-party pods, none from LEVL.

**Simulator cannot test:** dual-camera Check In, push delivery, Live Activity /
Dynamic Island, HealthKit, or real performance (a Mac flatters frame rates).

**Simulator quirk:** injected swipes do not scroll the nested list inside the
exercise-picker modal sheet.

---

## 7. Constraints that must hold

- **Never regress the security fixes in §1.** Re-verify if RLS or services change.
- No iPad support (deliberately dropped — `TARGETED_DEVICE_FAMILY = 1`)
- **`app.json`'s iOS config is inert** — `ios/` is committed, so EAS ignores it.
  Edit `ios/LEVL/Info.plist` and the Xcode project. This is the known
  expo-doctor failure.
- Do not upgrade Expo SDK 54 → 57 before launch
- Do not add native modules (Sentry, expo-updates) without discussing the build
  implications — both were deliberately deferred

---

## 8. Still outstanding for the human

1. **Push these 23 commits** — they exist only on this laptop
2. **Merge to `main` and build** — `eas build --platform ios --profile production`
3. **App Store Connect** — privacy URL, 12+ rating, App Privacy answers, and a
   **demo account seeded with friends, Check Ins and an active duel**
4. **Fix the commit email** — currently `matteo@Mac.lan`, which GitHub cannot
   link to the account
5. `gh auth login` — gh is installed but not authenticated

---

## 9. Highest-value work left

| # | Work | Why |
|---|---|---|
| 1 | AuthScreens' 29 literals, and the guest option below the fold | Same screen, two jobs |
| 2 | Auth screen layout — guest option below the fold | Real, seen on device |
| 3 | Error and empty-state audit (items 22–23) | Code-verifiable |
| 4 | Reduce Motion support | Not implemented at all |
| 5 | Defensive-data pass (item 57) | Deleted users, partial rows |
| 6 | Duolingo lesson: one action feeding several systems | Answers the "20 systems" problem |
| 7 | Strava lesson: small groups ("Crew") | Group activity earns 95–121% more kudos |

Items 4–7 in [LEVL-WORLD-CLASS-CHECKLIST.md](LEVL-WORLD-CLASS-CHECKLIST.md)
carry `👁` (needs a device) and `📊` (needs real users) markers — respect them.
