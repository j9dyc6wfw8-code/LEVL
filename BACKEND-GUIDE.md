# ASCEND — Backend Guide

Everything about how the LEVL backend works, written for a non-coder owner.
Keep this file with the project. Last updated: July 2026.

---

## The big picture

ASCEND is **offline-first**. Your phone's local storage is always the source of
truth — the app reads and writes locally, instantly, even in airplane mode.
Supabase (the cloud backend) is a **mirror** that syncs in the background.

This means: if Supabase is down, misconfigured, or unreachable, the app still
works completely. Nothing social will load, but training, XP, forge — all fine.

```
Your phone (source of truth)  ──debounced push (1.5s)──▶  Supabase (mirror)
        ▲                                                      │
        └────────── pull + conflict-resolve on login ◀─────────┘
```

**Conflict rule:** every save carries a timestamp. On login, local and cloud
are compared — the NEWER one wins, wholesale. Never merged field-by-field
(mixing two saves could create impossible states).

---

## The Supabase project

- Dashboard: supabase.com/dashboard — project `pndocotsoadxoklqwzys`
- The app connects using the **Project URL** + **anon key** in `app.json` →
  `expo.extra`. The anon key is safe to ship — it can only do what Row Level
  Security allows.
- **NEVER put the `service_role` key in the app.** That one bypasses all
  security. It stays in the dashboard only.

## Core database tables

| Table | What it holds | Who can read | Who can write |
|---|---|---|---|
| `profiles` | Public player card: username, level, rank, weekly XP, streak, last_active | Any signed-in user | Owner only |
| `saves` | Your FULL game save (private blob) | Owner only | Owner only |
| `workouts` | One row per logged set/cardio activity (feed + duel evidence) | Owner, friends, active duel partner | Owner only |
| `friend_requests` | Pending/accepted/declined requests | Sender + receiver | Sender creates; either updates |
| `friends` | One row per friendship (ordered pair, stored once) | The two friends | The two friends |
| `duels` | Friend duels: players, evidence score, window, winner, reward claim | The two players | Players through guarded app actions |
| `notifications` | In-app notifications | Owner only | Anyone can insert FOR you (a friend's action notifies you) |
| `duel_invites` | One-use friend Duel codes | Signed-in users can look up a code | Creator + atomic claim function |
| `bug_reports` | Tester reports and device metadata | Project owner in Supabase | Signed-in tester |

Every table has **Row Level Security ON** — the database itself enforces these
rules, so even a malicious client can't read private data.

The full schema lives in `ascend-supabase-schema.sql` (already run).

## How each system works

**Auth** — email/password via Supabase. Signup is instant (email confirmation
is off). A local account mirror is kept on-device so the app works offline.
Apple Sign In is coded but needs manual credentials (see manual steps).

**Cloud save** — every local save also schedules a background push, debounced
1.5 seconds so rapid logging doesn't spam the network. On login the cloud copy
is pulled and the newer-timestamp copy wins.

**Account switching safety** — signing out (a) cancels any pending push,
(b) ends the Supabase session, and (c) a guard drops any push that fires for
the wrong account. This prevents one account's data landing on another.

**Friends** — search by username → request → accept. Friendships are stored
once as an ordered pair. All queries use plain two-step lookups (never
PostgREST embedded joins, which fail silently without a direct foreign key —
that caused a real bug once).

**Duels** — challenge a friend → they accept → the 7-day window starts. Score =
XP read from synced workout rows inside that exact window. The active screen
subscribes to both players, so exercise, weight × reps, RPE, XP and PR activity
appear as they sync. A 15–20 second fallback covers socket interruptions. At
the end, ASCEND re-reads both workout feeds before choosing the winner. The
database prevents overlapping active duels and duplicate invite claims. Winner
coins can be claimed only once, even across two devices.

**Leaderboards** — read straight from `profiles`, sorted by weekly XP / total
XP / level / streak. Global or friends scope. No separate table needed.

**Activity feed** — recent `workouts` rows across your friends, joined to
their profiles in the app.

**Notifications** — friend requests, challenge starts and Duel results appear
in the Activity centre. Opening the sheet no longer clears the badge; a user
opens one item or explicitly taps Mark all read. Account changes clear the old
inbox before the new one loads.

**Realtime** — Supabase pushes row changes over a websocket. Friend requests,
friendships, duels, notifications, and public workout rows all update live. Requires the
replication toggle in the dashboard (see manual steps).

**Presence** — the app stamps `last_active` every 60s while open; friends
within 5 minutes show a green Online dot.

## Deploying changes

| Change type | Command | Time |
|---|---|---|
| JS/UI only (most changes) | `npx eas-cli@latest update --branch production --message "..."` | ~1 min, no Apple review |
| New native package / icon / entitlement | `npx testflight` | ~30 min + Apple processing |

Always `npm install` first if `package.json` changed. Work from
`~/Downloads/ascend-react-native 5`.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| "email rate limit exceeded" | Free tier caps auth emails (~3-4/hr) | Wait an hour; keep Confirm-email OFF |
| Friend request saved but not showing | Realtime replication off, or old build | Enable replication; deploy latest |
| Nothing social loads | Not signed in / no network | Check Friends screen error banner |
| Score/workout feed not updating in duel | Realtime migration missing, sync delay, or replication off | Run `sql/realtime_duel_workouts.sql`, verify replication, then retry both accounts |
| Invite says Duel update required | Integrity RPC is missing | Run `sql/duel_integrity_patch.sql` after `sql/duel_invites.sql` |
| Duel remains on “ending” | Final workout evidence could not be read | Verify the active-duel workout policy, reconnect, then refresh |
| "expo package not found" on update | `node_modules` missing | `npm install` first |
| App works but no cloud anything | Keys missing from app.json extra | Re-add URL + anon key |

## What's deliberately NOT built

- **Matchmaking (random opponents)** — waiting until there's a real user base;
  friend duels + bot duels cover the need today.
- **Google sign-in** — Apple covers one-tap login on iOS; Google needs its own
  console setup for marginal benefit.
- **Push notifications (APNs)** — in-app notifications exist; OS-level pushes
  are a later project (needs Apple push certificates).

---

# MANUAL STEPS — the complete list

Everything that requires a human with dashboard access. In priority order.

## Required for current features (do these first)

**1. Turn off email confirmation** *(fixes signup + rate limits)*
   - Supabase → Authentication → Sign In / Providers → Email
   - Toggle **"Confirm email" OFF** → Save

**2. Run the Duel migrations, then verify replication**
   - Supabase → SQL Editor → run all of `sql/realtime_duel_workouts.sql`
   - Run all of `sql/duel_invites.sql`
   - Run all of `sql/duel_integrity_patch.sql`
   - Supabase → Database → Replication → `supabase_realtime`
   - Enable: `profiles`, `friend_requests`, `friends`, `duels`, `notifications`, `workouts`
   - (Alternative if menu differs: Table Editor → each table → Realtime toggle)

**3. Rebuild + install** *(ships all fixes: account-bleed, duel slot, notifications, Apple button)*
   ```
   cd ~/Downloads/ascend-react-native 5
   npm install
   npx testflight
   ```
   This must be a rebuild (not OTA): new package `expo-apple-authentication`
   plus the iOS Sign-In-with-Apple entitlement were added.

## Only when you want Apple Sign In to actually work (optional, fiddly)

**4. Apple Developer console** (developer.apple.com → Certificates, IDs & Profiles)
   - App IDs → `com.matteo.ascend` → enable capability **Sign In with Apple**
   - Create a **Services ID** (e.g. `com.matteo.ascend.signin`)
   - Keys → create a **Sign In with Apple** key → download the `.p8` file,
     note the **Key ID** and your **Team ID**

**5. Supabase** → Authentication → Sign In / Providers → **Apple**
   - Enable, then paste: Services ID, Team ID, Key ID, and the `.p8` contents

Until steps 4–5 are done, the Apple button shows but errors gracefully on tap.
Email login is unaffected.

## Ongoing / when you're ready to launch wider

**6. External TestFlight** (for 20 friends): App Store Connect → your app →
   TestFlight → External Testing → create group, add the public link. Needs
   the one-time Beta App Review + your privacy policy URL.

**7. Re-enable "Confirm email"** before any public launch (it's off for beta
   convenience; on = better account security at scale).
