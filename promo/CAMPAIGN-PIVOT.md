# LEVL — "The Unexpected Pivot" campaign plan

15 short-form videos. The ad is the punchline, never the premise.
**For approval before build.**

---

## 1. Inspection findings

### Corrections to the brief — three features don't exist

| You listed | Reality in the codebase | What I use instead |
|---|---|---|
| **Achievements** | No achievement system anywhere in `src/`. | **Titles** (`TITLES`: Iron Novice → Initiate → Adept → Disciplined → Veteran → Elite Lifter → Master → Apex Lifter → S-Rank Hunter) and **cosmetics**. Both real. |
| **Verified gym activity** | Nothing verifies a gym visit. Apple Health is read for *context only* and `app.json` explicitly states it "never changes your XP, stats or rank". | **Check In** (dual-camera photo) as social proof, not verification. Never say "verified". |
| **Front/rear progress comparisons** | The dual camera shoots rear + front *simultaneously* — your training and your face in one capture. It is not a before/after body comparison over time. | The simultaneity itself, which is a far better visual hook anyway. |

### The strongest visually demonstrable assets I found

Ranked by how well they animate:

1. **Live Activity / Dynamic Island** (`LevlWorkoutAttributes.swift`) — carries `exercise`, `setNumber`/`totalSets`, a locally-counting `restEndsAt`, `lastWeight`/`lastReps`, `nextWeight`/`nextReps`, `xpEarned`. This is a real, shipping, *system-level* surface. Enormous pivot potential.
2. **The Forge anvil** (`ShopTab.js`) — `STRIKE THE ANVIL`, success/fail rolls, a **temper** counter that builds pity on failure, grades `Base → Honed → Tempered → Radiant → Apex → Mythforged`, materials `EMBER / STEEL / RELIC`. A genuine risk mechanic with sparks and metal.
3. **Hunter** (`HunterStage.js` + `Hunter.js`) — a 2D SVG character with **individually addressable body parts**: chest, lats (L/R), delts (L/R), traps, abs, forearms (L/R), upper arms (L/R), thighs (L/R), calves (L/R). Each tappable, each driven by stat levels. Plus live **auras** (ring, galaxy, flames, inferno, frost).
4. **Two leaderboards** (`LiveLeaderboard.js`) — *Strongest* ("Heaviest lift on the platform") and *Most consistent* ("Days trained in the last 28"). Global / Friends.
5. **Home-screen widget** (`LevlTodayWidget.swift`) — `TODAY`, `Push`, `Bench Press`, `NEXT`, `Checked in`, `Gold II`, `Iron Veteran`.
6. **Rank ladder** — `TIERS` Bronze/Silver/Gold/Platinum/Diamond/Champion/Grandmaster on Fitness Rating, with real thresholds (0/600/1200/1800/2400/3000/3600).
7. **Duels** — `DUEL_TIERS` rookie/contender/elite/champion, `DUEL_DURATIONS` 1/3/7 days with deliberately sub-linear rewards.
8. **Packs** — `PACK_XP_STEP = 1200`, rarities common → rare → epic → legendary → mythic.
9. **Six stats** — STR/PWR/END/VIT/MOB/DIS, each with its own colour.
10. **Integrity rails** — `DAILY_XP_CAP = 4000`, packs pay coins not XP, cosmetics can never touch rank. This is LEVL's actual moat and nobody else advertises it.

### What genuinely differentiates LEVL

Not "tracks your workouts". It is:

> **A ranked competitive ladder with an economy that cannot be bought into.**

Every other gamified fitness app sells progress. LEVL's code goes out of its way to prevent it. That's the campaign's spine and the payoff of at least three videos.

---

## 2. Longlist → shortlist

32 concepts brainstormed. Scored 1–5 on the eight criteria you set. Cut anything that scored under 28/40, duplicated a world, or needed a feature that doesn't exist.

**Cut, and why:**

- *Elevator, Slot machine, Google Maps, CCTV, RPG boss, Airport board, Weather, Football transfer* — your examples. Used as calibration, not built.
- *Tamagotchi neglect* — implies stat decay. LEVL has no decay. Would be a lie.
- *Police lineup / wanted poster* — joke lands on shaming. Wrong for a training app.
- *Karaoke bouncing ball* — the rep-counter link is weak and the audio can't carry silently.
- *Escape room, Roulette, Vending machine* — all redundant against the Anvil or Unboxing.
- *Horror found-footage 5:45am alarm* — funny, but the pivot is a cut, not a transformation.
- *Sleep tracking* — Health data is context-only; would overstate the integration.
- *Barcode self-checkout* — "unexpected item" gag is good but the LEVL connection is arbitrary.
- *Museum audio guide, Loading-screen tips, Chess ELO, Delivery tracker, Recipe reel, Subway busker, Heart monitor, Flight safety card* — all scored 24–27. Held in reserve.

---

## 3. The 15

Every one obeys: **no LEVL in the first 3 seconds**, transformation not cut, and a designed loop.

---

### 01 · THE ISLAND
**Feature:** Live Activity / Dynamic Island · Today's Workout, rest timer, XP
**Emotion:** Uncanny recognition
**Why they keep watching:** It appears to be a video *of their own phone* misbehaving.

- **0:00–0:02 HOOK** — Extreme macro on an iPhone's Dynamic Island. Music playing, tiny waveform bouncing. Utterly mundane.
- **0:02–0:05 SETUP** — A timer pill joins it. Island splits. Normal iOS behaviour, beautifully shot.
- **0:05–0:08 PIVOT** — The timer doesn't count *down* to zero — it counts down to **REST OVER**. The island stretches wider than physically possible, swallowing the notch. `SET 3 OF 5 · BENCH PRESS · 100 kg`.
- **0:08–0:12 REVEAL** — Camera pushes *into* the island; it becomes the full LEVL Train screen mid-session.
- **0:12–0:15 PAYOFF** — `+128 XP`. The island shrinks back to a music pill. Loop.

**Pivot mechanic:** OS chrome → app UI. The most native-feeling transition possible.
**Loop:** Ends on the identical music pill it opened on.
**Why selected:** Highest scroll-stop of all 32. It hijacks the viewer's own device metaphor, and it's a *real shipped feature* — the payload fields are in `LevlWorkoutAttributes.swift`. Nobody in fitness is advertising the Dynamic Island.

---

### 02 · THE STEEL HELD
**Feature:** Forge — anvil, temper, `Mythforged`
**Emotion:** Tension → relief
**Why they keep watching:** Blacksmith ASMR is a proven format; the risk roll adds stakes.

- **0:00–0:02 HOOK** — Macro, slow-motion: glowing orange steel on a dark anvil. Hammer descends. Sparks.
- **0:02–0:05 SETUP** — Three strikes, each a heavy metal *crack*. Steel brightens.
- **0:05–0:08 PIVOT** — A fourth strike lands and a **72%** appears burned into the metal. The sparks resolve into UI particles. `STRIKE THE ANVIL`.
- **0:08–0:12 REVEAL** — Roll resolves: `THE STEEL HELD`. Item grade steps `Apex → Mythforged`.
- **0:12–0:14 PAYOFF** — Cosmetic equips onto the Hunter. Cut to black on the hammer's next fall.

**Pivot mechanic:** Physical craft → probability UI. Sparks are the shared visual language.
**Loop:** Hammer raised at the end = hammer raised at the start.
**Why selected:** Best sound design opportunity in the set, and it dramatises a mechanic (`forgeTemper` pity) that most users never even see. Genuinely satisfying at 0.5× speed.

---

### 03 · SCOUTER
**Feature:** Hunter — per-body-part stats
**Emotion:** Nostalgia + power fantasy
**Why they keep watching:** Anime-scouter format is instantly readable and universally memed.

- **0:00–0:02 HOOK** — HUD through a green lens. Crosshair sweeps a street. Numbers spike on random passers-by.
- **0:02–0:05 SETUP** — Lens locks onto a figure. `SCANNING…` Reticle tightens.
- **0:05–0:08 PIVOT** — Instead of one power level, **eleven** readouts bloom across the body — chest, lats, delts, traps, abs, arms, thighs, calves — exactly LEVL's real part map.
- **0:08–0:12 REVEAL** — The lens dissolves; the figure becomes the Hunter character. Six stat bars resolve: STR/PWR/END/VIT/MOB/DIS.
- **0:12–0:15 PAYOFF** — `MOB 55` pulses red. Text: *"Everyone has a weak stat."* Aura ignites.

**Pivot mechanic:** Sci-fi HUD → real component. The body-part map already exists — this is near-1:1.
**Loop:** Lens flare wipes back to the street sweep.
**Why selected:** Most direct visual match between an outside world and a LEVL component I found. And "everyone has a weak stat" is a shareable, self-deprecating hook.

---

### 04 · LOT 112
**Feature:** PRs and estimated 1RM (Brzycki)
**Emotion:** Prestige, tension
**Why they keep watching:** Auction tension is pure escalation, and nobody expects the lot.

- **0:00–0:02 HOOK** — Dim auction house. Gavel. Paddle numbers. A spotlit plinth, contents unseen.
- **0:02–0:05 SETUP** — Bids climb in whispered increments: `95 · 100 · 105`.
- **0:05–0:08 PIVOT** — Bids pass **112.5** and stop. Reveal on the plinth: a loaded barbell. The bid board relabels itself `ESTIMATED 1RM · BRZYCKI`.
- **0:08–0:12 REVEAL** — Gavel falls. `NEW PERSONAL RECORD`. The lot card becomes LEVL's PR banner.
- **0:12–0:14 PAYOFF** — *"Some things you can't buy."*

**Pivot mechanic:** Currency → kilograms. Same numerals, different unit.
**Loop:** Gavel strike cuts to the opening gavel.
**Why selected:** The "can't buy it" line lands LEVL's integrity moat inside a format entirely about buying things. Best conceptual irony in the campaign.

---

### 05 · THE GRID
**Feature:** Streaks + 28-day consistency (real: *"Days trained in the last 28"*)
**Emotion:** Compulsion, mild guilt
**Why they keep watching:** Daily-puzzle grids are a universally understood shape.

- **0:00–0:02 HOOK** — A familiar grid of coloured squares fills the frame. Reads as a daily word game result.
- **0:02–0:05 SETUP** — Squares flip one by one with a tile *tick*. Green, green, green, grey.
- **0:05–0:08 PIVOT** — Camera pulls back — it's not 5×6, it's **28 days**. A grey square lands on today.
- **0:08–0:12 REVEAL** — Grid becomes LEVL's consistency panel. `86% · LAST 28 DAYS`. Streak counter ignites.
- **0:12–0:14 PAYOFF** — One square left unfilled, pulsing. *"You've got until midnight."*

**Pivot mechanic:** Scale reveal. Nothing morphs — the *meaning* changes.
**Loop:** The pulsing empty square fills, resetting the grid.
**Why selected:** Cheapest to build, highest shareability. The open loop (one empty square) is the strongest CTA in the set without saying "download".

---

### 06 · TALE OF THE TAPE
**Feature:** Duels — 1/3/7 day, `DUEL_TIERS` rewards
**Emotion:** Rivalry
**Why they keep watching:** Boxing weigh-in graphics carry inherent conflict.

- **0:00–0:02 HOOK** — Broadcast weigh-in. Two silhouettes, dramatic rim light. `TALE OF THE TAPE`.
- **0:02–0:05 SETUP** — Stats stack up: REACH, WEIGHT, RECORD. Crowd noise.
- **0:05–0:08 PIVOT** — Rows glitch and relabel: `XP THIS WEEK`, `STREAK`, `FR`. Silhouettes become Hunters.
- **0:08–0:12 REVEAL** — `7-DAY DUEL` slams down. Bars race toward the centre.
- **0:12–0:16 PAYOFF** — `VICTORY · +500 XP · +250 FORGE COINS` (real `DUEL_TIERS.contender` values).

**Pivot mechanic:** Broadcast stat panel → duel scoreboard.
**Loop:** Bell rings; cut to the opening bell.
**Why selected:** Duels are LEVL's most social feature and the hardest to explain in words. A weigh-in explains it in two seconds.

---

### 07 · $BENCH
**Feature:** Progress over time / e1RM history
**Emotion:** Greed, then recognition
**Why they keep watching:** Finance-chart content is enormous, and the punchline is good.

- **0:00–0:02 HOOK** — Candlestick chart ripping upward. Ticker tape. Green everywhere.
- **0:02–0:05 SETUP** — Zoom on the symbol: `$BENCH`. Volume bars. `+41% · 90D`.
- **0:05–0:08 PIVOT** — Y-axis relabels from dollars to **kg**. Candles become weekly sets. A red candle appears — labelled `DELOAD`.
- **0:08–0:12 REVEAL** — Chart becomes LEVL's progression view. `60.0 → 98.5 kg e1RM`.
- **0:12–0:15 PAYOFF** — *"The only chart that pays out."*

**Pivot mechanic:** Axis relabel — the data never moves, only its meaning.
**Loop:** Chart scrolls left back to day one.
**Why selected:** Highest crossover reach (finance audience), and it's the clearest way to show 90 days of progress in three seconds.

---

### 08 · THE LINEUP
**Feature:** Today's Workout / Workout Days (saved routines)
**Emotion:** Anticipation
**Why they keep watching:** Festival-poster typography is a beloved, highly designed format.

- **0:00–0:02 HOOK** — Festival poster. Huge headliner type, tiny support acts. Sun-bleached texture.
- **0:02–0:05 SETUP** — Camera drifts down the bill. Names are unreadable-cool, in the way real posters are.
- **0:05–0:08 PIVOT** — Headliners resolve: `CHEST` · `BACK` · `LEGS`. Support acts become exercises. Day tags become `MON / WED / FRI`.
- **0:08–0:12 REVEAL** — Poster peels into LEVL's Workout Day builder. `PUSH · 6 EXERCISES`.
- **0:12–0:14 PAYOFF** — *"Doors open at 6pm."*

**Pivot mechanic:** Typographic resolution — text was always there, focus changes.
**Loop:** Poster flaps in wind and re-flattens to frame one.
**Why selected:** Only concept that makes programme-building look *desirable*. Workout Days are a real feature (saved routines, explicitly not calendar dates) and badly under-sold.

---

### 09 · STATEMENT
**Feature:** XP economy + `DAILY_XP_CAP`
**Emotion:** Dry humour
**Why they keep watching:** Everyone reads a bank statement. It's involuntary.

- **0:00–0:02 HOOK** — Banking app transaction list. Coffee £3.40. Rent £1,150. Uber £8.20.
- **0:02–0:05 SETUP** — Thumb scrolls. Balance ticks down. Familiar dread.
- **0:05–0:08 PIVOT** — A credit appears: `DEADLIFT 140kg × 5 · +312 XP`. Then another. Balance starts going *up*.
- **0:08–0:12 REVEAL** — Statement becomes LEVL's XP ledger. Daily total climbs toward `4,000 XP` and **stops** — the real cap.
- **0:12–0:15 PAYOFF** — `DAILY LIMIT REACHED`. *"Even the currency has integrity."*

**Pivot mechanic:** Ledger → ledger. Same layout, inverted emotion.
**Loop:** Balance resets at midnight; list scrolls to top.
**Why selected:** Turns an *anti-feature* (a cap) into a selling point. The cap is genuinely why LEVL's ladder isn't farmable — worth a whole video.

---

### 10 · IN THE WILD
**Feature:** Social — Check In feed
**Emotion:** Affectionate comedy
**Why they keep watching:** Nature-doc narration over human behaviour is reliably funny.

- **0:00–0:02 HOOK** — Grainy long-lens footage through foliage. Handheld drift.
- **0:02–0:05 SETUP** — Lower-third: `THE NORTH LONDON LIFTER — Solitary. Nocturnal.` Subject circles a squat rack.
- **0:05–0:08 PIVOT** — Subject raises a phone. **Both cameras fire at once.** Shutter. The doc frame becomes the Check In capture.
- **0:08–0:12 REVEAL** — Post lands in the LEVL feed. Reactions and comments arrive.
- **0:12–0:15 PAYOFF** — Narrator: *"He has been seen."* Lower-third: `CHECKED IN`.

**Pivot mechanic:** Observational camera → the subject's own camera. Point of view flips.
**Loop:** Returns to foliage; another subject enters frame.
**Why selected:** The dual-camera capture is LEVL's most unusual technical feature and has no natural ad format — until you frame it as being *observed*. Funniest concept in the set.

---

### 11 · LAST STOP
**Feature:** Ranks — Bronze → Grandmaster on FR
**Emotion:** Journey, aspiration
**Why they keep watching:** Transit maps are hypnotic and instantly legible.

- **0:00–0:02 HOOK** — Metro map, tight on a single coloured line. A train dot moves.
- **0:02–0:05 SETUP** — Stations tick past. Familiar rhythm, familiar chime.
- **0:05–0:08 PIVOT** — Station names resolve: `BRONZE` · `SILVER` · `GOLD` · `PLATINUM`. Line colours become the real tier colours.
- **0:08–0:12 REVEAL** — Dot stops at `GOLD`. Camera lifts to reveal the full line running to `GRANDMASTER`. Progress bar = the track.
- **0:12–0:15 PAYOFF** — `1,480 FR · 320 TO PLATINUM`. Doors chime. *"Mind the gap."*

**Pivot mechanic:** Route → ladder. Both are linear progressions with named stops.
**Loop:** Train departs; map scrolls back to the first station.
**Why selected:** Cleanest metaphor for a 7-tier ladder. The tier colours (`#cd7f4a` → `#ff4d6d`) already look like a transit line.

---

### 12 · SEALED
**Feature:** Reward packs · common → mythic
**Emotion:** Anticipation, dopamine
**Why they keep watching:** Unboxing ASMR is one of the highest-retention formats that exists.

- **0:00–0:02 HOOK** — Macro. Fingernail under a foil seal. Perfect crinkle sound.
- **0:02–0:05 SETUP** — Slow peel. Card edge emerges. Shallow depth of field.
- **0:05–0:08 PIVOT** — The card *lights from within*. Rarity glow escapes the packet — blue, then violet, then orange.
- **0:08–0:12 REVEAL** — Card becomes the LEVL pack reveal. Rarity ladder flicks past to `MYTHIC`.
- **0:12–0:15 PAYOFF** — Then, deliberately deflating: `COSMETIC · DOES NOT AFFECT RANK`.

**Pivot mechanic:** Physical object → UI card. Same silhouette throughout.
**Loop:** Card slides back into the packet.
**Why selected:** Uses the dopamine format *and then undercuts it honestly* — which is exactly LEVL's position on loot. That final beat is the whole brand.

---

### 13 · THE SMALL PRINT
**Feature:** Integrity rails — cosmetics never affect rank, daily cap, anti-farm
**Emotion:** Surprise, respect
**Why they keep watching:** Nobody reads T&Cs, so putting them on screen is inherently a joke.

- **0:00–0:02 HOOK** — Dense legalese scrolling fast. 6pt type. Grey on grey.
- **0:02–0:05 SETUP** — Scroll accelerates absurdly. Occasional readable fragment.
- **0:05–0:08 PIVOT** — Scroll slams to a stop. One clause enlarges: **"Nothing purchasable may affect rank, XP, stats or Fitness Rating."**
- **0:08–0:12 REVEAL** — Clause becomes LEVL's Forge screen with the same line printed on it.
- **0:12–0:15 PAYOFF** — *"We put it in writing."* Scroll resumes.

**Pivot mechanic:** Body text → headline. Pure typographic scale.
**Loop:** Scroll never stops; it wraps.
**Why selected:** Zero competitors can run this ad. It's a category attack disguised as a gag, and every claim is verifiable in the engine.

---

### 14 · ANY%
**Feature:** Leaderboards — *Strongest* and *Most consistent*, Global/Friends
**Emotion:** Competitive obsession
**Why they keep watching:** Speedrun overlays signal "this is a serious attempt at something absurd".

- **0:00–0:02 HOOK** — Speedrun HUD. Split timer. Webcam box in the corner (empty). `ATTEMPT #47`.
- **0:02–0:05 SETUP** — Splits tick past, green deltas. `−00:04.2`.
- **0:05–0:08 PIVOT** — Split names resolve: `BRONZE → SILVER`, `SILVER → GOLD`. The run is a **rank climb**. Timer unit changes from seconds to **days**.
- **0:08–0:12 REVEAL** — HUD becomes the LEVL leaderboard. `STRONGEST · GLOBAL`.
- **0:12–0:16 PAYOFF** — `PERSONAL BEST` fires. *"No skips. No glitches. No shortcuts."*

**Pivot mechanic:** Timer semantics change; layout persists.
**Loop:** `ATTEMPT #48` resets the HUD.
**Why selected:** Speaks fluent internet, and "no skips, no glitches, no shortcuts" is the integrity message translated for a gaming audience.

---

### 15 · THE MIRROR
**Feature:** Check In — both cameras at once
**Emotion:** Quiet recognition
**Why they keep watching:** A mirror shot that behaves wrongly is unsettling in a good way.

- **0:00–0:02 HOOK** — Gym mirror. Reflection of a room. Fluorescent hum. Nobody in frame.
- **0:02–0:05 SETUP** — Someone steps in, raises a phone to shoot the mirror. Standard gym selfie.
- **0:05–0:08 PIVOT** — The **reflection lags**, then splits: the mirror shows the room, the phone shows the face. Both fire at once.
- **0:08–0:12 REVEAL** — The two images assemble into one LEVL Check In card — rear frame with the front inset.
- **0:12–0:15 PAYOFF** — *"One photo of your training. One of you."* (real `NSCameraUsageDescription` copy)

**Pivot mechanic:** A mirror is *already* two viewpoints. The feature was always the metaphor.
**Loop:** Mirror empties; room returns to the opening frame.
**Why selected:** The single most elegant setup→feature match in the campaign. A mirror literally is a front and rear camera.

---

## 4. Feature coverage check

| Feature | Videos |
|---|---|
| Train / logging | 01, 04 |
| Today's Workout / Workout Days | 01, 08 |
| Compete / leaderboards | 06, 11, 14 |
| Duels (1/3/7 day) | 06 |
| Social / feed | 10 |
| Check-ins / dual camera | 10, 15 |
| Hunter / body areas / stats | 03 |
| Forge / tempering | 02 |
| Rewards / packs / cosmetics | 02, 12 |
| XP | 01, 09 |
| Ranks / FR | 11, 14 |
| Progress over time | 07 |
| Streaks / consistency | 05 |
| Integrity (the moat) | 04, 09, 12, 13, 14 |

All fifteen mandated areas covered. No video repeats another's world, format, or transition type.

---

## 5. Production plan

### Reusable components (extends the existing `levl-kit.js`)

| Component | Status | Used by |
|---|---|---|
| Design tokens, icon paths, `TIERS`/`RARITY`/stat data | **built** | all |
| Impact system (shake, strobe, aberration, glitch, speed lines) | **built** | all |
| Shockwaves, spark bursts, end card, phone mockup, lifter | **built** | most |
| **Morph rig** — cross-fade + shape-tween between two arbitrary DOM trees | new | 01,03,04,06,07,11,12,15 |
| **Camera rig** — dolly/push/pull with perspective + parallax layers | new | 01,02,03,04,10,11 |
| **Flip-board** — mechanical split-flap character animation | new | 08, 11 |
| **Macro-lens rig** — shallow DoF, bokeh, focus-pull simulation | new | 02, 12, 15 |
| **Broadcast pack** — lower-thirds, stat rows, glitch relabel | new | 06, 07, 10, 14 |
| **Scan-line HUD** — reticles, tracking boxes, readouts | new | 03, 14 |

Six new rigs cover all fifteen videos. That's the whole reason to build them as a system.

### LEVL UI elements required

Already recreated and reusable: Train screen (exercise card, weight/reps/RPE, e1RM readout, Log Set, PR banner), tab bar, rank plates, stat radar, duel scoreboard, pack rarity cards, consistency grid, Check In viewfinder, end card.

**Needs building:** Live Activity pill (01), Forge anvil + temper meter (02), Hunter character with addressable body parts (03), XP ledger rows (09), Check In feed card with comments (10), Workout Day builder (08), leaderboard rows (14), progression chart (07).

### Complexity and build order

| Tier | Videos | Est. per video | Notes |
|---|---|---|---|
| **Low** | 05, 09, 13 | ~0.5 day | Typography and layout only. No new rig. |
| **Medium** | 06, 07, 08, 11, 14 | ~1 day | Need flip-board or broadcast pack. |
| **High** | 01, 03, 04, 10, 12, 15 | ~1.5–2 days | Camera rig, morph rig or macro-lens work. |

**Recommended build order:** 05 → 13 → 09 (prove the pivot format cheaply), then 01 → 15 → 03 (the three highest-ceiling concepts), then the rest.

### Output spec

1080×1920, 60fps, H.264 High, yuv420p, `+faststart`, silent AAC. Content inside y 220–1560. Identical to the current pipeline.

### Honest constraints

- **No live-action.** Everything is rendered — "cinematic macro" means simulated DoF and lighting, not a camera. Concepts 02, 10, 12 and 15 lean hardest on this; I'd build **02** first as the test, because if stylised macro doesn't sell, those four need redesigning.
- **Sound is specified, not produced.** I can't author audio here. Each video ships with a cue sheet keyed to frame numbers; you or an editor lay it in. The cut points are already built on a beat grid so this is mechanical.
- **Loops are visual only** — a true seamless loop also needs the audio to wrap, which is a mixing decision.

---

## 6. What I need from you

1. **Approve or cut** any of the fifteen.
2. **CTA and handle** — everything currently says `LINK IN BIO` / `iOS · TestFlight`.
3. **Voiceover?** Concepts 10 and 03 are much stronger with narration. I'd write the script; you'd record or cast it. Without VO, 10 becomes text-led and loses roughly a third of its comedy.
4. **Build order** — confirm the low-tier-first sequence, or name your three priorities.
