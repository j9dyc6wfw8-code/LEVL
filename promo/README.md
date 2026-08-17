# LEVL — Instagram Reels

Ten promo animations for LEVL, all built from the app's own source so the
visuals are the product, not a mood board.

**Every file is 1080 × 1920 (9:16), 60 fps, H.264 High profile, yuv420p,
`+faststart`, with a silent stereo AAC track.** Drop any of them straight into
the Instagram composer — Reels, Stories and TikTok accept this spec unchanged.

| # | File | Angle | Len | Hook |
|---|---|---|---:|---|
| A | `LEVL-reel.mp4` | Product tour | 29.2s | "Lifting without a scoreboard is just moving weight" |
| O | `LEVL-reel-hype.mp4` | Hype / brand | 25.2s | Glitch boot → logo slam |
| C | `LEVL-concept-c-xp.mp4` | XP loop (loops seamlessly) | 12.0s | "What if every set gave you XP?" |
| D | `LEVL-concept-d-streak.mp4` | Streak boss fight | 18.0s | "🔥 6 · One set left" |
| E | `LEVL-concept-e-rival.mp4` | 1v1 duel | 16.0s | "53 XP behind · 2 hours left" |
| I | `LEVL-concept-i-season.mp4` | Season reset FOMO | 15.4s | "Season ends in 00:59" |
| J | `LEVL-concept-j-finish.mp4` | Completion pain point | 17.2s | "POV: you actually finish the programme" |
| K | `LEVL-concept-k-choose.mp4` | Fake-interactive choice | 15.0s | "8pm. You're tired." |
| L | `LEVL-concept-l-story.mp4` | 90-day story | 22.0s | "Day 1" |
| M | `LEVL-concept-m-pack.mp4` | Forge pack pull | 15.0s | "20 XP from a pack" |

## Why ten and not fifteen

The source research listed fifteen concepts, but five of them (B, G, H, N and
most of F) are built on a creator economy this app doesn't have — AI generating
challenges from uploaded posts, creator onboarding, paid communities, web
transaction fees. Producing those would mean advertising features LEVL doesn't
ship. They were dropped rather than faked.

The ten above all rest on mechanics that exist in the codebase today.

---

## Where the visuals come from

Nothing here is invented styling:

| In the reels | Source |
|---|---|
| Charcoal/gold palette, panels, elevation | `src/theme.js` → `C.*` |
| Tab icons (dumbbell, swords, aperture, shield, satchel, pack) | `src/components/TabIcon.js` — path data verbatim |
| Tab names and order | `src/navigation/routes.js` → `TABS` |
| Bronze → Grandmaster ladder + tier colours | `src/engine/engine.js` → `TIERS` |
| STR/PWR/END/VIT/MOB/DIS names + colours | `src/engine/engine.js` → `STAT_META` |
| Duel lengths and rewards (500 XP / 250 coins) | `src/engine/engine.js` → `DUEL_TIERS.contender` |
| Pack meter step (1,200 XP) | `src/engine/engine.js` → `PACK_XP_STEP` |
| Common → Mythic rarities | `src/theme.js` → `RARITY_C` |
| "NEW PERSONAL RECORD", "Where you sit this season" | `TrainTab.js`, `CompeteTab.js` |
| Dual-camera Check In copy | `app.json` → `NSCameraUsageDescription` |
| The gold `L` mark | traced from `assets/icon.png` |
| Type | SF Pro — the same system font the app renders |

The on-screen numbers are real maths, not props:

- **112.5 kg** from 100 kg × 5 is genuine Brzycki (`w × 36 / (37 − r)`), the formula the app uses
- **98.5 kg** in concept L is Brzycki for 87.5 × 5
- **FR 1,480** and **1,420** both sit inside the Gold band (1,200–1,799)
- **1,758 → 1,800** in concept I is the real Gold→Platinum promotion threshold
- **86% consistency** is 24 of 28 days, matching the app's 28-day window

---

## Architecture

`levl-kit.js` holds everything shared: design tokens, real engine data, icon
paths, easing curves, the beat-locked impact system, the phone mockup, the
lifter avatar, shockwaves, sparks, and the common end card. Each concept file is
then only ~200 lines of scene code.

This matters because the research is emphatic that **volume is the strategy** —
roughly 2% of creative variants absorb most of the spend, so finding a winner
means testing many. Adding an eleventh concept is now an afternoon, not a week.

The impact system is the spine of the "edited" feel: one array of beat times
drives camera shake, white strobe, chromatic aberration, glitch tearing, speed
lines and grid acceleration together, so every layer lands on the same frame.

---

## Re-rendering

```bash
cd promo && npm install
```

```bash
npm run render:all
```

Individual cuts: `npm run render:streak`, `render:rival`, `render:pack`,
`render:xp`, `render:season`, `render:finish`, `render:choose`, `render:story`,
`render:product`, `render:hype`.

Frames are captured deterministically — each file exposes `window.renderAt(t)`
which fully describes the frame at time `t` — so renders are reproducible and
never drop or duplicate a frame.

Preview stills without encoding a video:

```bash
SRC=concept-d-streak.html PREVIEW=0.2,5.2,11.9 node render.js
```

Stills land in `preview/<source-name>/`. Use `FPS=30` for smaller files.

---

## Editing

Shared across every concept, in `levl-kit.js`:

- **CTA button + store line** — `makeEndCard()`; `LINK IN BIO` and `iOS · TestFlight` are placeholders
- **Brand colours** — the `C` object

Per concept, near the top of each file:

- **`IMPACTS`** — every beat the whole frame reacts to. Thin this out to calm an edit down.
- **`HEAVY`** — the subset that also gets a white strobe, shockwave and glitch tearing. Keep it small.
- **Duel names** — `mkSide('You','Matteo',…)` in concept E
- **Scene timings** — absolute seconds, so shifting one means shifting those after it

`flashAt()` in the kit decays over 0.10s deliberately. Lengthening it turns the
whole picture milky — a lingering full-frame white destroys a dark palette.

---

## Audio

Every file ships with a **silent** audio track. Some uploaders reject video-only
MP4s, and Reels reach is better when you attach a trending sound in the composer
— in-app audio gets credited and feeds that sound's discovery page, burnt-in
music doesn't.

Cut grids: the product tour runs on 120 BPM, everything else on 150 BPM, so most
gym audio lines up without nudging.

---

## Safe area

Instagram covers roughly the top 140px and bottom 340px of a 1080×1920 Reel with
its own chrome, plus the right rail of buttons. Everything that must be read is
composed inside **y 220–1560**. If you re-lay-out a scene, keep text out of
those bands.

## Flashing

Concepts B(hype), D, E, I, K and M use white strobe frames on heavy hits. Fine
for the large majority of viewers, but if photosensitivity matters for your
audience, either note it in the caption or shrink the `HEAVY` set and re-render.
Concept L is deliberately calm — no glitch tearing, one heavy hit — if you need
a safe option.
