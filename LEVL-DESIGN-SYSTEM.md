# LEVL — Design System

What exists, what is inconsistent, and what new work should follow.

Measured from the repository on 19 August 2026, not asserted.

---

## The honest headline

**LEVL is not missing a design system. It had a good one that three screens
never adopted — and now they all do.**

Spacing, radius, shadow, touch targets, motion springs and haptics are all
defined, documented and sensible in [src/theme.js](src/theme.js). The gap is
typography, and it was a specific, fixable gap: **there were two type scales, a
migration between them was started and abandoned, and the app's most-used screen
used neither.** That is now closed — see §1.

| Token family | State |
|---|---|
| Spacing | ✅ 7 steps, `SPACING` |
| Radius | ✅ 5 steps, `RADIUS` |
| Shadow | ✅ 3 roles, platform-aware |
| Touch target | ✅ `TOUCH = 44` |
| Motion | ✅ 3 springs with a stated rule |
| Haptics | ✅ 7-verb vocabulary |
| Colour | ✅ documented roles, ⚠️ 54 raw `rgba()` outside the theme |
| Typography | ✅ one scale, `T`. `TYPE` deleted; `T.micro` added to close the gap that stalled the migration |

---

## 1. Typography — the actual problem

### Two scales existed. Now there is one.

```js
T     // 13 steps, Apple HIG-aligned:  34 28 22 20 17 17 16 15 13 12 11 11 10
```

`TYPE` — the original 7-step LEVL scale — **has been deleted from `theme.js`.**
It survived because `theme.js` said of it: *"Kept verbatim so every existing
screen renders identically; new work should reach for T above."* Nobody ever
finished the second half of that sentence.

The two agreed at 34, 22 and 12 and diverged everywhere else; `TYPE.body` was
14, a size `T` does not have at all, which is the single clearest reason the
migration stalled twice. The measured step-by-step differences are recorded
below, because they are the record of what actually changed on screen.

### Measured adoption

| Screen | `T.` | `TYPE.` | raw literals |
|---|---:|---:|---:|
| TrainTab | 147 | 0 | 6 |
| ProgressTab | 42 | 0 | 4 + 1 ternary |
| DuelTab | 35 | 0 | **0** |
| PacksTab | 23 | 0 | 2 |
| LoadoutCard | 13 | 0 | 6 |
| ShopTab | 50 | 0 | 1 |
| FriendsScreen | 54 | 0 | 1 |
| CheckInDetail / Camera | 10 | 0 | 1 |
| WorkoutAttachment | 8 | 0 | 1 |
| AuthScreens | 23 | 0 | 7 |

Counted with `grep -o '\.\.\.T\.\w*'` and `grep -c 'fontSize: [0-9]'`, so the
`T.` column includes `T.numeric` pairings and the literal column misses
ProgressTab's one `fontSize: big ? 26 : 22` ternary. Recount the same way.

Every screen is now on `T`.

Every row is off `TYPE`. Apart from AuthScreens, the literals that remain are
deliberate and listed in the migration log below.

**The audit above was incomplete, and that matters.** It listed screens only, so
it missed 45 `TYPE` references living in components and secondary screens —
`FriendDuelDetail` (25), `NotificationCenter` (9), `ui.js` (4), `NoticeBanner`,
`AppGuide`, `Hunter`, `AuthScreens`, `Intro`, and three dead `s.h1/h2/h3`
helpers inside `theme.js` itself with zero call sites app-wide. Deleting `TYPE`
was blocked on those until they were migrated too. If you audit adoption again,
count `src/components/` as well as `src/screens/`.

### 34 distinct sizes are in use

Including `11.5` (37×), `12.5` (22×), `10.5` (12×), `9.5` (11×), `13.5` (9×),
`16.5`, `14.5`, `8.5`, `6.5`. Half-point sizes are the signature of eyeballed
adjustment rather than scale decisions, and they are the single clearest reason
screens look like they were designed independently.

### The decision, and how it ended

**`T` won.** It is Apple-aligned, it is where new work already went, and it has
the steps the app actually needs. `TYPE` is **deleted** — along with the three
dead `s.h1/h2/h3` helpers that were its last consumer in `theme.js`.

### The lineHeight hazard, and what testing it showed

**79% of TrainTab's literals (113 of 143) map to a token that carries a
`lineHeight` the original did not have** — `caption`, `caption2`, `footnote`,
`callout`, `subheadline`, `headline`, `body` all set one. Only `display`,
`title1`, `title2`, `title3`, `label` and `micro` are free of it.

That looked like a reason not to migrate at all. It was worth measuring rather
than assuming, so 11 sites on the Train screen were migrated and compared
against a before screenshot on an iPhone 17 Pro:

**No layout shift.** The tile grid, card boundaries and Power row all landed
identically.

The reason is that these were single-line labels, where the token's lineHeight
sits close enough to the natural line box to be absorbed. **The risk is real for
multi-line paragraphs**, where a changed lineHeight compounds per line. So:

- single-line labels, badges, headings → migrate freely
- multi-line body copy → migrate one block at a time and look at it

### The migration rule

**Do not mass-replace.** A literal `fontSize: 12` is not equivalent to
`T.caption`: the token also carries `fontWeight`, `letterSpacing` and
`lineHeight`. Swapping them changes rendering in ways only a device can confirm.

Migrate **one screen per change**, and look at it on a phone before the next.
Suggested order, worst first:

1. ~~`TrainTab`~~ ✅ **done** — 145 of 151 migrated; 6 off-scale sizes (18, 24, 26, 56) left deliberately
2. ~~`ProgressTab`~~ ✅ **done** — 42 of 46 migrated; 44, 19×3 and a 26/22 ternary left as off-scale hero numerals
3. ~~`DuelTab`~~ ✅ **done** — all 34 migrated, plus the one `TYPE.body` holdout; no off-scale sizes on this screen
4. ~~`PacksTab`~~ ✅ **done** — 23 of 25. ~~`LoadoutCard`~~ ✅ **done** — 13 of 19; see the sub-micro note below
5. ~~`ShopTab`~~ ✅ **done** — mixed scale resolved; see the TYPE→T table below
6. ~~`FriendsScreen`~~ ✅ **done** — 52 TYPE refs and 2 literals
7. ~~Delete `TYPE` from `theme.js`~~ ✅ **done**, after clearing the eight
   files the audit above had missed and three dead style helpers

### Mapping `TYPE` → `T`

The two scales are not aliases. Measured, step by step:

| `TYPE` | value | → `T` | value | what actually changes |
|---|---|---|---|---|
| `micro` | 10 / 600 / +0.4 | `micro` | 10 / 600 / +0.4 | **nothing — byte-identical** |
| `caption` | 12 / 400 / lh 17 | `caption` | 12 / 400 / lh 16 | 1pt tighter line |
| `title` | 22 / 700 / −0.4 | `title2` | 22 / 700 / +0.35 | letter-spacing flips sign |
| `display` | 34 / 700 / −0.8 | `display` | 34 / 700 / +0.37 | letter-spacing flips sign |
| `heading` | 16 / **600** / lh 21 | `callout` | 16 / **400** / lh 21 | **weight drops — restate `fontWeight: '600'`** |
| `body` | **14** / **500** / lh 20 | `footnote` | **13** / **400** / lh 18 | **1pt smaller and lighter** |
| `label` | 10 / 600 / +1.4 | `label` | 11 / 600 / +0.9 | 1pt larger, tighter tracking |

Only `micro` is a free swap. `heading` needs its weight restated or every card
title on the screen quietly lightens; `body` has no exact home in `T` at all,
which is the single biggest reason the two scales were never reconciled.

Mapping when migrating:

| Literal | Use |
|---|---|
| 34 | `T.display` |
| 28 | `T.title1` |
| 22 | `T.title2` |
| 20 | `T.title3` |
| 17 | `T.headline` (semibold) / `T.body` (regular) |
| 16, 16.5 | `T.callout` |
| 15 | `T.subheadline` |
| 13, 13.5, 14, 14.5 | `T.footnote` |
| 12, 12.5 | `T.caption` |
| 11, 11.5 | `T.caption2` |
| 10, 10.5, 9.5, 9 | `T.micro` — **added this pass**. Do NOT use `T.label` here: it uppercases and would rewrite your copy. |
| — | **Do not migrate a `TextInput`'s fontSize.** Every reading-size token carries a `lineHeight`, and on iOS that fights TextInput's own vertical centring — it clips or offsets the caret and text. AuthScreens' three inputs, including both credential fields, keep their literals for this reason. Same for any `Text` clamped with `numberOfLines` around data you cannot afford to truncate. |
| 8, 8.5 | **nothing** — these sit below `T.micro`'s 10pt floor. LoadoutCard's slot and colour labels live here, inside half-width columns where "ARMOUR" already wraps mid-word at 8.5. Raising them to 10 makes that worse, so they stay literal until the layout is fixed. |
| Any number | pair with `T.numeric` for tabular figures |

Numbers are LEVL's core content — weights, reps, XP, ranks, scores. **Every
numeric display should carry `T.numeric`** (`fontVariant: ['tabular-nums']`) so
digits stop jittering as values change.

---

## 2. Colour

Roles are defined and the philosophy is written down in `theme.js`: 60/30/10,
charcoal not black, depth expressed as brightness, one accent. Gold is the brand
and orange is legendary rarity — a conflict that was consciously resolved.

**Rules for new work**

- Never write a hex literal in a screen. Use `C.*`.
- Never write `rgba(...)` in a screen. Use `alpha(C.x, 0.14)`.
- Rank, rarity and muscle-group colours are **data**, and belong in
  `engine.js` where they already live — not in the theme.
- 54 raw `rgba()` calls remain outside the theme. Fold them into `alpha()` as
  each screen is migrated, not in a separate sweep.

---

## 3. Spacing, radius, elevation

```js
SPACING = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28, xxxl: 40 }
RADIUS  = { sm: 8, md: 12, lg: 16, xl: 20, pill: 999 }
SHADOW  = { card, raised, glow }        // platform-aware
TOUCH   = 44                            // Apple HIG minimum
```

Do not invent intermediate values. If a layout seems to need 14, it needs 12
or 16.

**Radius intent:** `sm` inputs and chips · `md` buttons and rows · `lg` cards ·
`xl` sheets · `pill` badges and toggles. Not everything is a rounded rectangle;
a full-bleed photo has no radius at all.

---

## 4. Motion

Already defined in `theme.js`, and the rule is right:

| Spring | Use | Never use for |
|---|---|---|
| `SNAPPY` | taps, toggles, tab switches | anything that should feel considered |
| `SMOOTH` | sheets, cards, transitions | celebrations |
| `BOUNCY` | level-up, PR, claim, duel win | routine actions |

**Overshoot on a routine action reads as instability, not delight.** That line
is in the theme and should stay.

Durations: instant feedback 50–150 ms · transitions 150–300 ms · reward moments
may run longer when they are genuinely a moment.

**Reduced Motion is not yet respected.** Every non-essential animation should
check `AccessibilityInfo.isReduceMotionEnabled()`. Currently unimplemented —
tracked as an open item.

---

## 5. Haptics

A 7-verb vocabulary already exists in
[src/services/haptics.js](src/services/haptics.js):

| Verb | When |
|---|---|
| `selection` | picking from a list, changing a segment |
| `tap` | light confirmation of a press |
| `commit` | a set logged, something recorded |
| `success` | workout finished, PR |
| `warning` | destructive confirmation |
| `error` | rejected input |
| `celebrate` | level-up, rank-up, rare unlock |

**Rule:** if a haptic fires more than a few times per minute of normal use, it
is the wrong verb. Never buzz on scroll, render or navigation.

---

## 6. Terminology — canonical list

The app should use exactly one word for each thing. Current agreed usage:

| Use | Not | Meaning |
|---|---|---|
| **set** | rep set, entry | one logged effort |
| **session** | workout session | one training session, grouped by 3-hour gap |
| **workout** | — | informal synonym for session in user-facing copy |
| **Workout Day** | template, routine | a saved, reusable plan |
| **Check In** | checkin, check-in | the daily dual-camera post |
| **Verified Session** | verified workout | a Check In with a real session attached |
| **Rank** | tier alone | Bronze…Grandmaster, plus division |
| **Fitness Rating / FR** | score, rating | the 0–4200 number behind rank |
| **Level** | — | XP progression, separate from rank |
| **Duel** | challenge, battle | a head-to-head |
| **Hunter** | character, avatar | the player identity tab |
| **Forge** | shop, store | cosmetics and progression |

**Level is how much you have trained. Rank is how you compare.** That
distinction is already stated in `StandingPanel` and should be used verbatim
wherever both appear.

---

## 7. Copy rules

- Sentence case in body copy; UPPERCASE only in `T.label` section headers
- No exclamation marks outside genuine celebration moments
- State what happened, whether data is safe, and what to do next — in that order
- Never surface a raw backend error to a user
- Numbers before adjectives: *"14 sets · 8,420 kg"*, not *"a big session"*

---

## 8. What this document does not cover

- **Per-screen layout** — needs a device; see the polish test plan
- **Icon family audit** — SFIcon, MuscleIcon, CardioGlyph, ItemGlyph, TierCrest
  and TabIcon coexist and have not been audited for stylistic coherence 👁
- **Dark-gym and sunlight legibility** — measurable only on hardware 👁
- **Dynamic Type at accessibility sizes** — `FONT_SCALE_CAP` exists but per-screen
  behaviour at the largest settings is unverified 👁
