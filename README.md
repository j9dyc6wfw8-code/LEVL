# ASCEND — React Native (Expo)

Your gamified lift & cardio tracker, converted from the web prototype into a real
iPhone app. Everything from the web version is preserved: the RPG stats, ranked
ladder, 1RM science, weekly quests, leaderboard, 1v1 duels, the Forge shop and the
Forge Pass battle pass, accounts, and cross-device backup codes.

## Current release

This version keeps the original six-tab structure, simplifies its main flows,
rebuilds notifications and Forge Power, clarifies Workout Days, adds a replayable
Settings guide, and hardens live friend Duels.

Before deploying, run these files in Supabase SQL Editor in order:

1. `sql/realtime_duel_workouts.sql`
2. `sql/duel_invites.sql`
3. `sql/duel_integrity_patch.sql`

See `START-HERE-MANUAL-STEPS.md` for the release checklist and
`REALTIME-DUELS-SETUP.md` for the two-device test.

---

## Part 1 — See it on your iPhone in ~10 minutes (no Mac needed)

You don't need to be a coder to do this.

1. **Install Node.js** (the free engine that runs the tools)
   Go to <https://nodejs.org> and install the "LTS" version. Accept all defaults.

2. **Open a terminal** in this folder
   - Mac: right-click the folder → "New Terminal at Folder".
   - Windows: open the folder, type `cmd` in the address bar, press Enter.

3. **Install the app's building blocks** — type this and press Enter:
   ```
   npm install
   ```
   Then install the two native modules used by the animations:
   ```
   npx expo install expo-linear-gradient expo-haptics
   ```
   Wait for these to finish (a few minutes the first time).

4. **Start it**:
   ```
   npx expo start
   ```
   A black-and-white square (a QR code) appears.

5. **On your iPhone**, install the free **"Expo Go"** app from the App Store.
   Open the iPhone Camera, point it at the QR code, tap the yellow banner.
   ASCEND loads on your phone. Your phone and computer must be on the **same Wi-Fi**.

That's it — tap around, log a lift, open the Forge, start a duel. Load the demo
save from the Hunter tab (Settings → "Load 4-week demo save") to see it fully populated.

---

## Part 2 — What's in here (the map)

```
App.js                     the root — sign-in, saving, navigation, all game handlers
app.json                   app name, icon, iOS bundle id (change before publishing)
package.json               the exact library versions
assets/                    put icon.png (1024×1024) and splash.png here before store
src/
  theme.js                 colors, fonts, shared styles
  engine/engine.js         ALL game logic (XP, ranks, 1RM, duels, pass, anti-cheat)
  services/platform.js     saving (AsyncStorage), password hashing, share, clipboard
  components/
    ui.js                  design system atoms: buttons, cards, animated charts,
                           count-up numbers, progress bars, toasts, overlays
    NotificationCenter.js  vector activity inbox with live/read state
    AppGuide.js             replayable map of tabs and switches
    Hunter.js              the animated vector hunter + mini emblems + customizer
    TabIcon.js             custom vector tab icons (no emoji)
  screens/
    AuthScreens.js         sign-in / create account / physical profile / transfer
    ProfileTab.js          Hunter: rank, stat sheet, quests, PRs, settings
    TrainTab.js            Log Lift / Cardio / Calculator / Workout Days
    DuelTab.js             bot duels + realtime friend-duel head-to-head
    FriendDuelDetail.js    live exercise, load, reps, XP and PR evidence
    ProgressTab.js         projections, weekly volume, history
    RanksTab.js            global leaderboard
    ShopTab.js             Forge Power, gear upgrades, shop + Forge Pass
    PacksTab.js            reward packs + the pack-opening reveal animation
```

assets/ contains the finished branding: icon.png (1024x1024), splash.png,
adaptive-icon.png, favicon.png — all referenced from app.json.

The **engine is the single source of truth** — the tested scoring logic remains
shared with the web build. The screens only draw it. This is deliberate: it makes future
changes (and the backend swap) safe.

---

## Part 3 — Putting it on the Apple App Store

1. **Branding is done** — `assets/` already has icon.png, splash.png,
   adaptive-icon.png and favicon.png, wired into app.json.
2. **Change the bundle id** in `app.json` from `com.yourname.ascend` to your own
   (e.g. `com.matteo.ascend`).
3. **Get an Apple Developer account** — $99/year at <https://developer.apple.com>.
4. **Build in the cloud (no Mac required)** using Expo's build service, EAS:
   ```
   npm install -g eas-cli
   eas build --platform ios
   ```
   Follow the prompts. It compiles your app on Expo's servers and gives you a file
   Apple accepts.
5. **Send to your phone / testers first** with TestFlight:
   ```
   eas submit --platform ios
   ```
   Then invite friends in App Store Connect → TestFlight. This is the real "share
   with friends" path — they install the actual app on their iPhones.
6. **Submit for review** in App Store Connect. Apple usually replies in 1–3 days.

---

## Part 4 — What was changed in the conversion, and why (honest notes)

- **Web → native UI.** Every `<div>`/`<span>`/CSS from the web build was rebuilt with
  React Native's `View`/`Text` and `StyleSheet`. Same look, native performance.
- **Storage.** `localStorage` → `AsyncStorage`, with a separate save per account and a
  clean fallback so it never crashes if storage is unavailable.
- **Charts.** The web charts (Recharts) were replaced with hand-built `react-native-svg`
  charts using the same math — the radar, the projection line, the volume bars.
- **The 3D avatar → an animated 2D vector hunter.** The web build used three.js for a 3D
  figure. Native 3D (expo-three/expo-gl) is version-sensitive and hard to verify without
  a device, so to keep the app rock-solid it ships as a **detailed animated vector
  hunter** that preserves every feature: stat-glow body regions, tap-to-inspect each
  stat, all equipped cosmetics (helmets, back gear, weapons, auras), rank-based armor
  styles, and full color customization. **Upgrade path to true 3D:** add `expo-gl` +
  `expo-three`, then replace `HunterFigure` in `src/components/Hunter.js` with a GL
  canvas — everything feeding it (stat levels, equipped items, rank style) already
  arrives as clean props, so nothing else has to change.
- **What's identical:** all XP formulas, the 1RM math, the rank ladder and Fitness
  Rating, streaks, weekly quests, the 140-bot leaderboard, the 7-day duel engine with
  strength matching, the Forge shop, the 20-tier Forge Pass, the anti-cheat caps, and
  the account + backup-code system. This logic was carried over verbatim and re-tested.

## Part 5 — Built for what's next

The code is structured so future additions drop in cleanly:
- **Cloud sync / accounts (Supabase):** replace the four functions in
  `src/services/platform.js` (`stGet/stSet/stDel` + `sha256Hex`) and the auth calls in
  `App.js`. Nothing else needs to change — the rest of the app never talks to storage
  directly.
- **Realtime multiplayer duels:** active friend duels already show both players'
  synced exercises and exact in-window XP, with secure Supabase row policies.
- **Subscriptions / AI coaching:** the Forge Pass and shop already model premium
  unlocks and a cosmetic economy to build on.
