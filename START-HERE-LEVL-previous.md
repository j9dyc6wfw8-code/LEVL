# LEVL — Rebrand + Typography Build · START HERE

## What this build is
The audited ASCEND codebase, rebranded to **LEVL** with a full typography
refinement. All previous bug fixes included. Re-verified after changes:
full-codebase parse + reference audit clean, all 15 engine test groups pass.

## Typography — what changed and why
- Every font weight shifted one step lighter app-wide (900→800, 800→700).
  The hierarchy is identical; the "bulky" heavy-black feel is gone. 800 at
  display size still lands with authority — this is the Apple-style premium
  look: big and light, not big and thick.
- Reading text now breathes: line-height added to headings (21), body (20),
  and captions (17) — the single cheapest "flowy" upgrade there is.
- Captions dropped to regular weight; labels/badges softened to semibold with
  slightly wider tracking, so small text reads as refined, not shouty.
- SF Pro (iOS system) + Menlo numerals kept — no custom font, no build risk.

## Rebrand — what changed
- Display name, splash wordmark (+ new tagline "EARN EVERY LEVEL"), auth
  screens, error screens, notifications, bug-report subject, duel share
  message, and all docs now say **LEVL**.
- In-world "Ascendant" flavor renamed to **Apex** (rank label, crown, title,
  relic, forge tier, forge-power band). Item IDs unchanged — old saves load
  perfectly and keep everything they own.
- Deep links now use **levl://** — and old **ascend://** reset + duel links
  still work, so nothing breaks for existing installs.
- Intro slide now reads "Lift. Level up." — the name IS the loop.

## Deliberately NOT changed (do not "fix" these)
- `bundleIdentifier` stays `com.matteo.ascend` — it's invisible to users and
  changing it would orphan your existing App Store Connect app (6790293556).
- `slug: "ascend"` stays — it links to your EAS project + credentials.
- AsyncStorage keys keep legacy `ascend-` prefixes — renaming them would
  wipe every existing save on every device.
- Backup codes: new exports say `levl`, old `ascend` backups still import.

---

# BETA LAUNCH — your steps (I've done everything doable from here)

## STEP 0 — Supabase (5 min, one-time)
Dashboard (project `pndocotsoadxoklqwzys`) → **Authentication → URL
Configuration → Redirect URLs** → ADD `levl://reset` (keep `ascend://reset`
listed too). Without this, password-reset emails won't open the new build.

## STEP 1 — Install this build
Unzip, replace your working copy, then inside the folder: `npm install`

## STEP 2 — Rename the app in App Store Connect (5 min)
appstoreconnect.apple.com → My Apps → your app → **App Information** →
Name: `LEVL` (if taken, fallback: `LEVL: RPG Workout Tracker` — names must
be unique per storefront). Subtitle: `Lift. Level up. Rank up.`
Same app record, same app ID — nothing else changes.

## STEP 3 — Archive & upload (Xcode route)
```
npx expo prebuild --platform ios --clean
open ios/LEVL.xcworkspace
```
(The workspace name follows the new display name after a clean prebuild.)
Xcode: device = **Any iOS Device (arm64)** → check Signing team → Product →
**Archive** → Distribute App → App Store Connect → Upload.
If the build number collides later, bump `"buildNumber"` in app.json.

## STEP 4 — TestFlight external group
App Store Connect → TestFlight → wait for processing (10–30 min, email
arrives) → **External Testing → + →** group `Friends Beta` → add the build.

## STEP 5 — Beta review form (paste-ready)
**Beta App Description:**
> LEVL is a gamified fitness tracker. Log real lifts and cardio to earn XP,
> level up a 2D hunter, and climb a ranked ladder from Bronze to
> Grandmaster. Duel friends in 7-day head-to-heads. 125-exercise library,
> 1RM calculator, streaks, and cosmetic crafting. Every level is earned —
> cosmetics never affect rank or stats.

**Demo account:** create a fresh account in the app, paste its email +
password into the review notes, and add:
> After sign-in, complete profile setup, then log a lift from the Train tab.
> "Load demo save" on the Hunter tab fills the app with sample data.

Submit for Beta Review (usually < 24 h).

## STEP 6 — Invite testers
Easiest: enable the **public link** in the Friends Beta group, cap ~50,
text it to your friends. They install TestFlight, tap, done.

## Watch after launch
- Tester bug reports → Supabase `bug_reports` table (+ email fallback).
- Production crashes render on-screen as "LEVL hit an error" — ask for
  screenshots.
