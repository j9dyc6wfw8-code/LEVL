# LEVL — what changed, and the two things you need to do

All 19 items from your list are in. Verified: 45 files parse, 0 undefined
references, 0 missing imports, engine passes `node --check`, 6 tabs intact.

(The previous version of this file is kept as `START-HERE-LEVL-previous.md`.)

---

## MANUAL STEPS — only two

### 1. Run one SQL file
Supabase → SQL Editor → paste **all** of `sql/leaderboard_columns.sql` → Run.

It adds the columns the new leaderboards read (`best_e1rm`, `best_lift_name`,
`consistency`, `longest_streak`) plus sort indexes. Without it the Strength and
Consistency boards come back empty. Idempotent — safe to re-run.

### 2. Rebuild
Everything here is JavaScript, but the project still has no `expo-updates`, so
OTA isn't available — this needs a normal build.

---

## The 19 items

**Exercises**

1. **Incline chest flies** — Incline Dumbbell Fly and Incline Cable Fly added.
   (The old generic "Dumbbell Fly" listed incline as a variant, so that's now
   `flat · decline` to avoid duplicating the new entries.)
2. **Alphabetical order** — the whole 126-exercise library sorts A–Z. Category
   filters unaffected.
5. **Muay Thai / martial arts** — 12 entries: Muay Thai (bag/pads, sparring,
   clinch), Boxing (bag/pads, sparring), Kickboxing, BJJ/Grappling, Wrestling,
   Judo, Karate/Taekwondo, MMA Conditioning, Shadow Boxing. They're duration-
   and-intensity based, so they live in the cardio logger — now split into
   **Cardio · Martial Arts · Mobility & Recovery**.
10. **Per-limb clarification** — selecting an exercise shows a gold callout with
    the exact rule: *"Enter the weight of ONE dumbbell, not the pair"*, or
    *"One limb at a time"* for Bulgarian split squats, single-leg RDLs, one-arm
    rows. Kettlebells get their own wording.

**Logging**

4. **Calculator navigation bug — fixed.** The cause: the log view rendered as
   `{seg === 'lift' && <LogView/>}`, so switching to Calculator *unmounted* it
   and destroyed your selected exercise. Selection, weight, reps and RPE now
   live one level up, so Calculator → back returns you exactly where you were —
   which is the point, since you go there to work out a weight and then log it.
16. **Multiple sets at once** — a Sets stepper (1–10), backdated ~3 minutes
    apart so history and volume windows stay realistic.
    *Anti-spam is intact and tested:* rapid re-logging still blocked, absurd
    loads still rejected, 60-sets-per-day ceiling still applies, and 60 heavy
    sets still cap under the 4,000 daily XP limit. The rest-gap rule is skipped
    only for a declared batch, which is one deliberate action.

**Duels**

11. **No more phantom loss** — quitting a duel you never logged anything in is
    recorded as **skipped** and stays off your record; the button reads "Skip
    this duel". You can't dodge a real loss with it: any logged activity makes
    it a genuine forfeit.
19. **1 / 3 / 7-day duels** — pick the length before choosing an opponent.
    Rewards scale deliberately *sub*-linearly (50 → 60 → 71 XP per day), so a
    full week is always the best value. If short duels paid the same per day
    they'd become the optimal farm and the format would collapse into spam.

**Leaderboards**

3. **Two boards.** *Strength* (heaviest estimated 1RM — stored in kg so kg and
   lb users rank fairly, with the exercise named underneath) and *Consistency*
   (share of the last 28 days trained, current streak, weekly XP). Every row
   explains its own number. Global/Friends scope applies to both.

**Stats**

12. **Muscle balance now measures sets, not tonnage.** You were exactly right —
    comparing a 70 kg bench to a 25 kg triceps extension was never fair, and it
    made arms and shoulders look neglected in a balanced programme. Hard sets
    per muscle group is the unit training volume is actually prescribed in, and
    the only one comparable across muscles. Tested: three sets of bench vs three
    sets of pushdowns read **65%/35%** by tonnage but **50%/50%** by sets.
    Tonnage stays available on a toggle — useful for tracking your own load over
    time — with a line explaining what each does and doesn't tell you.

**Packs**

15. **XP removed; packs now pay coins.** Pack XP was inflating levels far faster
    than training did. Coins buy Forge upgrades and cosmetics, which are
    explicitly non-competitive, so pack luck can never touch rank. Verified: 400
    packs opened, XP unchanged. Legacy saves holding an old XP reward convert it
    to coins rather than breaking.
13. **Packs arrive far more often** — a **Pack Meter** grants one every 1,200 XP
    of training, on top of level-up packs. Daily XP is capped so it can't be
    farmed, and the watermark survives reloads without duplicating.
14. **Pack area developed** — the meter with progress bar, a **Recent Pulls**
    list (previously everything vanished the moment the reveal closed), and
    corrected reveal labels. *Side fix:* materials were being labelled "Profile
    Border" in the reveal.
16. **Item catalogue** — every cosmetic, title and border, owned ones lit and
    unowned locked, with a completion percentage and an "Owned only" filter.

**Screens**

6. **Account creation** — a proper layered brand mark (ring + diamond + glyph,
   matching the splash), a real segmented Sign in / Create account switch
   instead of two loose chips, and copy that changes with the mode.
7. **Notifications drop down** — a banner slides in from the top when something
   arrives, holds ~4.5s, retracts. Tapping it jumps to the relevant screen; ✕
   dismisses. It only fires for genuinely new items, so opening the app never
   replays an old one.
8. **Splash** — 2.5s → 3.5s.
9. **Auras are now real.** They existed as cosmetics but only drew a flat ring
   on the floor. Each now renders a full-body effect on its own animation cycle:
   **ring** (orbiting halo), **galaxy** (counter-rotating dual rings), **flames**
   and **inferno** (rising embers, inferno denser and brighter), **frost**
   (shimmering crystalline shards).
17. **Ranks page cleaned up.** It had a Players/Practice toggle *and* three chips
    inside it — two things to understand before you could read your own rank —
    plus a 100-row wall. Now: one standing card answering "where am I?" (rank,
    tier, FR, and a **progress bar to the next tier**, which was missing
    entirely), then a single three-way control: **Global · Ladder · Rivals**.
    The ladder shows 25 at a time with "Show 25 more" and pins your row if
    you're below the fold.

---

## Two numbers you may want to tune

**Pack coin amounts** are set at roughly 5× what the old XP would have converted
to (a standard common pack pays 25–50 coins). That compensates for removing the
XP without touching levels. All in one place: `coinRange` on each entry in
`PACK_TYPES` in the engine.

**Pack meter cadence** is `PACK_XP_STEP = 1200` — roughly one to two solid
sessions per pack. One number to change if you want it faster.
