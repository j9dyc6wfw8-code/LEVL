# LEVL → TestFlight: uploading build 28

Three parts. Part 1 takes two minutes and you can do it from your phone. Part 2
needs your Mac. Part 3 is App Store Connect.

---

## PART 1 — Supabase (do this first, before the build)

### The one new SQL file

Supabase → SQL Editor → New query → paste the **whole** file → Run.
"Success. No rows returned" is the correct result.

```
sql/profile_character_column.sql
```

**Why it matters:** the app has written a `profiles.character` column on every
sync since Phase 6, but no migration ever created it. If it's missing in your
project, Postgres rejects the *entire* profile upsert — so level, rank, streak,
best lift and consistency have never been updating on anyone's public row. The
leaderboards and friend profiles would be showing whatever was last written
successfully.

It's idempotent. If the column already exists, nothing changes and you've ruled
it out as a cause. Verification queries are at the bottom of the file.

### While you're in there — confirm these are still set

| Where | What |
|---|---|
| Database → Replication | `profiles`, `friend_requests`, `friends`, `duels`, `notifications`, `workouts` all enabled |
| Authentication → URL Configuration → Redirect URLs | `levl://reset` present |
| Authentication → Providers → Email | "Confirm email" **off** |

If you ran the other eight SQL files in a previous round, you don't need them
again.

---

## PART 2 — the build

**Build number is now 28.** I bumped it from 23, because 27 is already on
TestFlight and Apple rejects a build number it has seen before. Don't lower it.

**Don't change the bundle ID.** It stays `com.matteo.ascend` even though the app
is LEVL. It's tied to your App Store Connect listing — changing it creates a
different app.

**No new native dependencies this round.** Same five native packages as your last
successful build, so the toolchain is already correct.

### Route A — EAS (simpler, uses one of your 15 monthly iOS builds)

```bash
cd ~/Downloads/levl-build          # no spaces in the path
npm install
eas build --platform ios --profile production
eas submit --platform ios --latest
```

Your `eas.json` has `appVersionSource: "remote"` with `autoIncrement: true` on
the production profile, which means **EAS assigns the build number from its own
server and ignores app.json.** So on this route the 28 I set doesn't apply — EAS
will pick the next number after whatever it last used. That's fine; just don't be
surprised if TestFlight shows a different number.

### Route B — local Xcode (no EAS build quota, avoids the credential bug you hit before)

```bash
cd ~/Downloads/levl-build          # rename the folder if it has a space in it
npm install
npx expo prebuild --platform ios --clean
open ios/*.xcworkspace
```

In Xcode:
1. Blue project icon → **LEVL** target → **Signing & Capabilities**
2. Tick **Automatically manage signing**, Team = Matteo Shidrawi (`N6GRS6QFGG`)
3. Device selector at the top → **Any iOS Device (arm64)** — Archive is greyed out otherwise
4. **Product → Archive** (10–20 min)
5. Organizer opens → **Distribute App** → **App Store Connect** → **Upload**

This route *does* read `app.json`, so build 28 is what gets uploaded.

---

## PART 3 — App Store Connect

App Store Connect → LEVL → TestFlight. The build sits on "Processing" for
5–15 minutes.

1. Build appears → add it to your **internal** group (you and Seb). Internal
   testing needs no review — install it and check it yourself first.
2. Add it to the **external** group. Since your first build already cleared Beta
   App Review, subsequent builds usually go live in minutes rather than a day —
   but Apple can re-review at any time, especially if you change what the app
   does.
3. **What to Test** — write one or two lines. For this build:
   > New: cleaner headers, a robotic hunter redesign, friend profiles now show
   > gear and stats. Fixed: tapping between tabs no longer lands you mid-page.
4. The external public link stays the same once the group exists — no need to
   resend it.

---

## First-launch check on device (this build specifically)

1. **Watch the Metro/Xcode console on launch.** Sync failures are now loud. A
   `[LEVL sync]` warning naming a missing column means Part 1 didn't take. Silence
   means the profile row is saving.
2. **Scroll test** — scroll to the bottom of the You tab, tap the coin pill. The
   Forge should open **at the top**. That was broken in nine places before.
3. **Friends → tap a friend** — their gear and six stats should show. Their
   numbers only appear after *they* open this build; before that you'll see the
   fallback line, which is expected.
4. **Forge** — equip the Void Scythe and Storm Glaive. Blade tips should be fully
   drawn, not cut off at the right edge.

---

## Things that will trip you up

- **Spaces in the folder path** break CocoaPods. Your working copy is
  `~/Downloads/ascend-react-native 5` — that trailing space-5 will fail a local
  prebuild. Copy it to `~/Downloads/levl-build` first.
- **Open `.xcworkspace`, never `.xcodeproj`.** The project file alone doesn't
  include your dependencies.
- **Don't run `npm audit fix --force`.** It bumps packages that break Expo native
  builds. The moderate warnings are dev tooling, not shipped code.
- **No OTA path.** `expo-updates` isn't installed, so every change — including a
  one-line copy fix — needs a full rebuild and a new TestFlight upload. Worth
  batching changes.
- **Builds expire after 90 days.**

---

## What's in build 28

- Top bar rebuilt around the LEVL mark; one consistent heading on every tab
- Hunter redesigned as a futuristic android; body-part highlighting made obvious
- Friend profiles show a small portrait, their gear by rarity, and their six stats
- Both duel screens show the two builds side by side
- Train tab decluttered — three duplicated explanations removed
- **Bug fix:** nine navigation entry points didn't reset scroll position
- **Bug fix:** profile row now publishes on launch, not only after you change something
- **Bug fix:** the ladder refreshed never; now re-pulls on foreground and on open
- **Bug fix:** scythe and glaive blade tips were being clipped off the figure
- Sync failures now surface a readable console warning instead of failing silently
