# LEVL Build 29 — what to test

Ordered by **how likely it is to be broken**, not by feature. If you only have
twenty minutes, do Tier 1.

Each test says what to do, what *should* happen, and what it means if it
doesn't — so you can tell me something useful rather than "it didn't work".

---

## Before you start

**1. Run the five SQL files.** From `~/levl-build-29/sql/`, in order:
`2801` → `2802` → `2803` → `2804` → `2805`.

Without these the app installs and runs fine, and then Check In fails the moment
you post. That's the single most likely way a working build looks broken.

**2. Make a second account** if you can — a friend's phone, or a second Apple ID
in TestFlight. Half of Social cannot be tested alone.

**3. Know what's already been checked.** I ran these on a simulator, so don't
spend time re-testing unless something looks obviously wrong:

> five-tab navigation · Train logging · effort scale · PR detection · session
> grouping · Live Activity start/render/timer/deep-link/end · Compete segments ·
> Hunter tab · SF Symbols · `levl://` routing

---

# TIER 1 — never executed anywhere

These four are the real unknowns. **Do these first.**

### 1.1 Dual camera capture ⚠️ highest risk

The simulator has no cameras, so this code path has **never run**, on any
machine, ever.

1. Social tab → **CHECK IN**
2. Allow camera access when asked
3. You should see the rear camera filling the screen, with a small selfie
   panel floating top-right
4. Tap the shutter

| Should happen | Meaning |
|---|---|
| Both photos appear on the preview screen | Working |
| Caption says **"Both cameras captured together"** | True simultaneous capture (your iPhone supports it) |
| Caption says **"Rear then selfie"** | Sequential fallback — correct on older phones, **wrong on a recent iPhone** — tell me |
| Black screen, or a crash | The native module failed — tell me |
| Only one photo | Capture partially failed — tell me which one is missing |

Then tap the small photo — the two should **swap** with a slight bounce and a
light haptic.

### 1.2 Posting offline

The upload is a resumable state machine that has never run against a real
network failure.

1. Turn on **Airplane Mode**
2. Do a Check In and post it
3. It should say it's **saved and waiting** — not an error, not a lost photo
4. Turn Airplane Mode off
5. Background the app, then reopen it

| Should happen | Meaning |
|---|---|
| It posts by itself, **exactly once** | Working |
| Two Check Ins appear | Duplicate bug — tell me immediately |
| It never posts | Retry is broken — tell me |
| The photo is lost | Worst case — tell me immediately |

### 1.3 XP cannot be farmed

This is the integrity claim behind the whole social feature.

1. Post a Check In → note the XP you gain (should be **+30**)
2. Delete it (··· → Delete)
3. Post another one

| Should happen | Meaning |
|---|---|
| Second post gives **+0 XP** | Working as designed |
| Second post gives +30 again | The ledger isn't working — tell me immediately |

Also: react to and comment on someone's post. Your XP should **not move at all**.

### 1.4 Workout → Verified Session

The core loop: train, then share what you trained.

1. Log a few sets
2. Tap **Finish** on the green bar
3. A sheet should offer **"Share today's session"** (or "Add this session" if
   you already checked in)
4. Post it

| Should happen |
|---|
| The card reads **VERIFIED SESSION ✓** |
| It shows real numbers — sets, volume, your actual exercise names |
| You gain the **+60** verified bonus on top of the +30 |

Then the reverse order, which is the case the feature was designed around:

1. Check In **first**, before training
2. Then log a workout and tap Finish
3. It should ask **"Add this session to your Check In?"**
4. Say yes → the existing post becomes Verified **without taking another photo**

---

# TIER 2 — needs a second account

Nothing here can be tested alone.

### 2.1 Friends-only visibility

1. Account A posts a Check In set to **Friends**
2. Account B, **not** yet a friend → should see **nothing**
3. Become friends → B should now see it

If B sees it before becoming friends, the database security is wrong. **Tell me
immediately** — that's a privacy bug, not a cosmetic one.

### 2.2 Public visibility

1. A posts set to **Public**
2. B (not a friend) opens the **Discover** tab → should see it

### 2.3 Reactions and comments

- B reacts 🔥 → A's post shows the count
- B taps 💪 instead → the count stays **1** (it swaps, doesn't stack)
- B taps 💪 again → reaction removed
- B comments → appears for A, live, without refreshing
- B long-presses their own comment → can delete it
- A long-presses B's comment → can remove it from their own post

### 2.4 Blocking

1. A blocks B (··· on a post → Block)
2. A should no longer see B's posts — **and B should no longer see A's**
3. B should not be able to react or comment on A's posts
4. Check they're no longer friends

Blocking is meant to work **both ways**. If B can still see A, tell me.

### 2.5 Reporting

- Report a post, and a comment. Both should confirm quietly.
- Check Profile → Privacy → **Blocked people** lists who you blocked, and lets
  you unblock.

*(These four exist because Apple requires them for any app with a public feed.
A reviewer may check.)*

---

# TIER 3 — did I break anything that already worked?

Quick pass. These all worked before Build 29 and should still.

| Area | Check |
|---|---|
| **Train** | Log a lift · log cardio · batch sets ("I did this 3 times") · create a Workout Day · run one · delete an entry and confirm XP is refunded |
| **Compete** | Duels tab loads · start a duel · challenge a friend · Ranks shows your division · Leaderboard loads |
| **Hunter** | Character renders · tap a body region · change appearance · equip a title or border · radar chart correct |
| **Forge** | Buy a cosmetic · equip it · forge an item · open a pack · Forge Pass claim |
| **Profile** (avatar, top right) | Change units kg↔lb and confirm **all weights convert** · edit physical profile · export/import backup code |
| **Account** | Sign out and back in · confirm XP, level, workouts, friends, inventory all survive |

That last one matters most. Build 29 moved a lot of things between screens — but
**nothing should have been lost**.

---

# TIER 4 — the Apple extras

Lower stakes. Nice to confirm, not blocking.

### 4.1 Home Screen widget
Long-press home screen → + → search **LEVL** → add the small and medium widgets.
Should show your level ring, streak, and whether you've checked in.

### 4.2 Quick Actions
Long-press the LEVL icon → **Start Workout**, **Check In**, **Active Duel**.
Each should open the right place.

### 4.3 Apple Health
Hunter tab → **Connect Apple Health** → allow. Should show today's steps,
energy, sleep, resting HR.

Then finish a workout and check the **Fitness app** — the LEVL workout should
appear there.

> Health data must **never** appear on a Check In or affect your XP, stats or
> rank. If you see a health number anywhere social, that's a privacy bug.

### 4.4 Check In reminder
Profile → Check In → set your training window → turn the reminder on and allow
notifications. You should get a prompt at a random time inside that window
(a different time each day — that's deliberate).

### 4.5 Notification deep links
When a notification arrives, tapping it should open the **exact** content — the
comment, the duel, the Check In — never the home screen.

---

# If something fails

Send me:

1. **The number** (e.g. "1.2")
2. **What happened instead**
3. **A screenshot** if there's anything on screen

If the app crashes, LEVL shows a yellow error screen with the actual cause —
screenshot that, it's far more useful than "it crashed".

---

# Known limitations — not bugs

Don't report these:

- **Social needs an account.** Guests can train, but not Check In. Deliberate.
- **Friend reactions don't buzz your phone yet.** They appear live in the bell
  icon inside the app. Push for social events needs a server component that
  isn't built — the daily Check In reminder and rest alerts *do* work.
- **Discover is empty** until other people post publicly.
- **No filters, no photo editing.** Deliberate — authenticity is the point.
- **The Live Activity needs iOS 16.2+.** Older phones just don't show it.
