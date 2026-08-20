# LEVL — World-Class Pass: Master Checklist

Every instruction from the brief, tracked. Updated as work lands.

**Branch:** `world-class-polish` (off `main` @ `f15a2732`)
**Started:** 19 August 2026

**Legend**
`[x]` done · `[~]` partly done · `[ ]` not started · `[—]` deliberately not doing (reason given)
`🔒` = must not regress · `👁` = needs your eyes on a device · `📊` = needs real users/data

---

## STAGE 1 — Protect the known-good state

- [x] **1.1** Inspect current Git state
- [x] **1.2** Confirm current branch — was `main`
- [x] **1.3** Confirm uncommitted changes — none, tree clean
- [x] **1.4** Record current test status — 48 / 216 / 191, 0 hook findings
- [x] **1.5** Run existing tests — all pass
- [x] **1.6** Run Expo Doctor — 17/18 (known committed-`ios/` warning)
- [x] **1.7** Record dependency state — 25 runtime, 4 dev
- [x] **1.8** Identify build/runtime configuration — Expo SDK 54, RN 0.81.5, React 19.1, iPhone-only
- [x] **1.9** Review previous audit documents
- [x] **1.10** Understand which fixes were deliberate
- [x] **1.11** Create safe branch — `world-class-polish`
- [x] **1.12** No production DB changes for cosmetic work — none made
- [x] **1.13** No destructive DB operations — none
- [x] **1.14** No secrets exposed — swept before the repo went public
- [x] **1.15** No major SDK upgrades — SDK 54 held deliberately

## STAGE 2 — Study LEVL as a product

- [~] **2.1** Map TRAIN → COMPETE → SOCIAL → HUNTER → FORGE — mapped in the prior audit
- [~] **2.2** Understand all systems — covered by the prior audit; re-verifying per screen as I touch it
- [ ] **2.3** Identify LEVL's current product personality, in writing
- [x] **2.4** Do not turn LEVL generic — standing constraint

## STAGE 3 — Design philosophy

- [x] **3.1** Design philosophy — [LEVL-DESIGN-SYSTEM.md](LEVL-DESIGN-SYSTEM.md)
- [x] **3.2** What to avoid — documented (no hex in screens, no raw rgba, no invented spacing, no overshoot on routine actions)
- [ ] **3.3** Ensure one-design-team coherence

## STAGE 4 — Design system

- [x] **4.0** Measure current drift — **366** literal `fontSize`, **180** hex outside theme, **54** raw `rgba()`
- [x] **4.1** Colour roles — documented; 54 raw `rgba()` to fold in per-screen
- [x] **4.2** Typography — **done.** Two scales became one: `TYPE` deleted, every screen on `T`. 366 literals down to ~30 deliberate off-scale sizes
- [x] **4.3** Numeric type — `T.numeric` exists; rule set that every numeric display must carry it
- [x] **4.4** Spacing — already good (7 steps)
- [x] **4.5** Radius — already good (5 steps); intent per role documented
- [x] **4.6** Shadow — already good (3 roles, platform-aware)
- [ ] **4.7** Button states (primary/secondary/destructive/ghost/disabled/loading)
- [ ] **4.8** Card usage rules
- [ ] **4.9** Icon family audit

## STAGE 5 — Pixel-level UI review

- [ ] **5.1** Hierarchy per screen 👁
- [ ] **5.2** Spacing per screen 👁
- [ ] **5.3** Alignment 👁
- [x] **5.4** Typography 👁 — verified per screen on an iPhone 17 Pro against before/after screenshots
- [ ] **5.5** Contrast 👁 — still outstanding; the one accessibility axis not yet measured
- [ ] **5.6** Primary action obvious 👁
- [ ] **5.7** Clutter removal 👁
- [ ] **5.8** Cross-screen consistency 👁
- [ ] **5.9** One-handed reachability 👁

## STAGE 6–8 — TRAIN, set entry, Verified Sessions

- [x] **6.0** Exercise browser reachability — **fixed**: caps hid 67 and 87 exercises
- [ ] **6.1** Starting a workout
- [ ] **6.2** Today's workout
- [ ] **6.3** Exercise selection + search + recents
- [ ] **6.4** Previous performance surfacing
- [ ] **6.5** Sets / reps / weight / RPE entry
- [ ] **6.6** Add / edit / delete set
- [ ] **6.7** Rest periods
- [ ] **6.8** Finish exercise / finish workout
- [ ] **6.9** XP and PR moments
- [~] **7.1** Keyboard — `selectTextOnFocus` + ref forwarding added to `NumField`; InputAccessoryView 'Next' toolbar still outstanding
- [ ] **7.2** Default values / copy previous set
- [ ] **7.3** Accidental tap protection
- [ ] **7.4** Target: log a set in 2–3 seconds
- [ ] **8.1** Verified Session visual treatment
- [ ] **8.2** Verification prestige without overuse

## STAGE 9–14 — COMPETE, rank, SOCIAL, Check Ins, HUNTER, FORGE

- [ ] **9.1** Rank display, divisions, leaderboard
- [ ] **9.2** Duel invite / active / result
- [ ] **9.3** Stakes and clarity without casino patterns
- [~] **10.1** Rank explained — four components already shipped (`StandingPanel`)
- [~] **10.2** Decay/grace state — shipped in the prior pass
- [ ] **10.3** Next milestone / recent movement
- [ ] **11.1** Feed density and composition
- [ ] **11.2** Post header, identity, photos
- [ ] **11.3** Comments, timestamps, pagination, refresh
- [ ] **11.4** Empty and loading states
- [ ] **12.1** Shareable PR / Verified Session / duel / rank-up cards
- [ ] **13.1** Justify Hunter — tie to "I trained → something changed"
- [ ] **14.1** Make Forge create desire, connect to Hunter

## STAGE 15–21 — Motion, performance, startup, network, offline

- [x] **15.1** Motion principles — already defined in theme.js; documented and endorsed
- [ ] **15.2** Audit easing, duration, springs
- [ ] **16.1** Find JS/UI thread stalls 👁
- [x] **16.2** List virtualization audit — only 1 `FlatList` (SocialTab, well configured); no unbounded lists found
- [ ] **16.3** Re-render audit (measure first)
- [ ] **17.1** Profile before optimising — no blind memoisation
- [ ] **18.1** Measure startup phases 👁
- [ ] **19.1** Perceived performance: skeletons, optimistic, prefetch
- [ ] **20.1** Network strategy per interaction
- [ ] **21.1** Offline-first workout flow verification 👁

## STAGE 22–33 — Errors, empty states, haptics, input, a11y, copy

- [~] **22.1** Errors — Apple sign-in surfaced Apple's raw developer string ("The authorization attempt failed for an unknown reason"). Mapped to human copy naming a way forward. Found in the simulator. Rest of the audit outstanding.
- [~] **23.1** Empty states — audited. Most already answered what/why/now; three did not and now do (ProgressTab ×2, FriendDuelDetail). Not device-verified: the demo save has data in every range and filter
- [~] **24.1** Haptics — 7-verb vocabulary already exists and is documented; per-call-site audit outstanding
- [—] **25.1** Sound — not adding any; no value case for a gym app
- [x] **26.1** Touch targets — audited against the app's own `TOUCH = 44`.
  **15 were under it**, from 42pt down to 32pt; ten of them on TrainTab, the
  most-used screen (the "How to do X" pill and rest-timer presets at 32pt, START
  and EDIT at 40pt). Fixed with vertical `hitSlop`, so the compact visual design
  is unchanged but the tappable area reaches 44pt. Vertical-only is deliberate —
  all 15 sit in horizontal rows, so sideways expansion would overlap neighbours.
  One-handed *reachability* (thumb zones) is a separate question, still open 👁
- [ ] **27.1** Keyboard quality per form
- [~] **28.1** Accessibility — Reduce Motion ✅ (65.1), Dynamic Type ✅ (64.1),
  touch targets ✅ (26.1), VoiceOver roles ✅ (162 of 171 interactive elements).
  **Left:** labels for 12 deliberately-skipped controls (the sheet scrim and
  Hunter's nine invisible body-part hit areas — these need a design decision and
  VoiceOver on a device 👁), plus the colour-contrast audit
- [ ] **29.1** iPhone screen matrix 👁
- [ ] **30.1** Photo pipeline quality
- [ ] **31.1** Information density / progressive disclosure
- [ ] **32.1** Remove weak UI
- [~] **33.1** Canonical terminology list — written; per-string copy pass outstanding

## STAGE 34–36, 74 — Research  ← **IN PROGRESS**

- [x] **34.1** Research Hevy, Strong et al — done; key finding: Hevy's top logging complaint is *no Next button between input fields*. LEVL had the same gap.
- [x] **34.2** Duolingo/BeReal/etc — done; XP as a *shared currency* across streak, league and achievements is why their system feels coherent rather than bolted together.
- [x] **34.3** Independent comparisons — Jefit (library depth as retention floor), Whoop/Oura (daily verdict with no logging), competitive ladders (the right reference class for rank, not fitness apps)
- [x] **35.1** What users hate — done; logging friction is the **single strongest predictor** of 30-day retention. Also: choice paralysis, barbell total-weight entry, manual-entry drop-off.
- [x] **36.1** Gap matrix — built, [LEVL-RESEARCH.md](LEVL-RESEARCH.md) §4
- [x] **74.1** Love/hate tables — [LEVL-RESEARCH.md](LEVL-RESEARCH.md) §2–3

## STAGE 37–45 — Activation, retention, notifications, deep links

- [~] **37.1** Preserve first-set-logged activation — protected 🔒
- [ ] **38.1** First 60 seconds simulation
- [ ] **39.1** First workout teaches LEVL without tutorial popups
- [ ] **40.1** Retention by day (1/3/7/30/90)
- [ ] **41.1** Healthy gamification audit
- [ ] **42.1** Micro-rewards
- [ ] **43.1** Ethical social loops
- [ ] **44.1** Notification wording, timing, dedupe, grouping
- [ ] **45.1** Deep link edge cases (logged out, deleted, expired)

## STAGE 46–58 — Architecture and code quality

- [ ] **46.1** State architecture review
- [ ] **47.1** Component architecture / duplication
- [ ] **48.1** Business logic boundaries
- [ ] **49.1** Type safety strategy (incremental, not a rewrite)
- [~] **50.1** Input validation client + server — server side hardened in the prior pass 🔒
- [~] **51.1** Concurrency — friend accept/decline had **no** in-flight guard; double-tap showed an error for an action that worked. Fixed per-id. Duels and set logging were already guarded. Remaining call sites unaudited.
- [ ] **52.1** Optimistic UI where safe
- [ ] **53.1** Data fetching / refetch / cache
- [x] **54.1** List performance audit — done, see 16.2
- [ ] **55.1** Image pipeline
- [ ] **56.1** Memory and lifecycle cleanup
- [~] **57.1** Crash resistance — FriendsScreen now tolerates a missing `isPending` prop rather than blanking; broader defensive pass outstanding
- [ ] **58.1** Error boundaries

## STAGE 59–61 — Observability, analytics, budgets

- [ ] **59.1** Reassess Sentry / OTA — classify safe-now vs after-launch
- [ ] **60.1** Analytics quality
- [ ] **61.1** Performance budgets (measure baseline first) 👁

## STAGE 62–67 — Adversarial and environmental testing

- [ ] **62.1** Test like a bad user
- [ ] **63.1** Visual edge cases (long names, huge numbers, 100 comments)
- [x] **64.1** Large Dynamic Type 👁 — **fixed.** Was completely broken: at
  `accessibility-extra-extra-extra-large` the auth screen collapsed (wordmark
  reflowed to "LEV"/"L", "Create account" clipped to "accoun", form pushed
  off-screen). Root cause: `FONT_SCALE_CAP` was exported and read by nothing, and
  no `maxFontSizeMultiplier`/`allowFontScaling` existed anywhere.
  **Negative result worth keeping:** `Text.defaultProps.maxFontSizeMultiplier` —
  the standard global fix — was tested on device and had *zero* effect. React 19
  dropped `defaultProps` for function components; RN 0.81's `Text` is one.
  Fixed with `src/components/Text.js`, a capped `Text`/`TextInput` adopted by 43
  files. Text 1.5, inputs 1.25. Wordmarks opt out (`allowFontScaling={false}`);
  the rank name shrinks to fit rather than hyphenating.
  Verified on device at the largest size across Auth, Train and Compete, and
  re-checked at the default size for regressions.
  Reproduce: `xcrun simctl ui booted content_size accessibility-extra-extra-extra-large`
- [x] **65.1** Reduced Motion — **done.** Correcting the record: it was already honoured in 4 places, not "unimplemented". The real defects were that two copies never subscribed (so toggling mid-session did nothing) and that ten infinite `Animated.loop`s ignored it entirely. One shared `useReduceMotion` hook now; all ten gated. Verified against the real OS setting: **0.000%** of pixels change over 4s with it on, **51.6%** with it off
- [ ] **66.1** Dark gym readability 👁
- [ ] **67.1** Sunlight readability 👁

## STAGE 68–77 — Product judgement

- [ ] **68.1** Identify best screenshot screens
- [x] **69.1** No feature bloat — standing constraint
- [ ] **70.1** Remove where removal beats addition
- [x] **71.1** No random dependencies — none added so far
- [ ] **72.1** Use current official documentation
- [ ] **73.1** Evaluate against current Apple HIG
- [ ] **75.1** Rank top 20 improvements by impact/effort/risk
- [ ] **76.1** Classify every change P0–P3
- [ ] **77.1** Mark anything needing real user data 📊

## STAGE 78–89 — Implementation discipline

- [x] **78.1** Small coherent commits, one concern each — holding
- [x] **79.1** Checkpoint high-risk changes — none attempted
- [x] **80.1** No placebo optimisation
- [x] **81.1** No visual change without stated purpose
- [x] **82.1** Before/after evidence — held throughout. Screens that could not be reached on device (FriendsScreen populated, FriendDuelDetail, two empty states) are marked as such in their commit messages rather than claimed
- [x] **83.1** Keep the best things 🔒
- [x] **84.1** Run tests after each phase — green after every commit
- [ ] **85.1** Regression-test all prior security fixes 🔒
- [ ] **86.1** Build quality gate (install, tests, doctor, no secrets)
- [~] **87.1** Dead code — measured: **19 unused named exports.** Three (`s.h1/h2/h3`) already deleted with `TYPE`. The rest are listed below and not yet removed, because two are findings rather than litter:
  `FONT_SCALE_CAP` is now genuinely in use (see 64.1); `needsTermsAcceptance` remains a real question — legal re-acceptance may simply never run.
  Others: `HunterIdentity`, `TierBadge`, `HeroCard`, `HeroStat`, `SelectRow`, `findSession`, `buildRoute`, `PreviewImage`, `onAuthChange`, `clearSignedUrlCache`, `getCheckIn`, `reactionByKey`, `setPrimaryPhoto`, `LEGACY_DUEL_LINK_PREFIX`, `DUR`, `RARITY_C`, `STAT_C`
- [x] **88.1** Comment *why*, not *what*
- [x] **89.1** Boring code over clever code

## STAGE 90–93 — Documents to produce

- [ ] **90.1** `LEVL-WORLD-CLASS-PASS.md`
- [x] **91.1** `LEVL-DESIGN-SYSTEM.md` — written
- [ ] **92.1** `LEVL-PERFORMANCE.md`
- [ ] **93.1** `LEVL-POLISH-TEST.md`

## STAGE 94–100 — Final assessment

- [ ] **94.1** LEVL vs best-in-class scoring, unflattering
- [ ] **95.1** Answer: what will LEVL be known for?
- [ ] **96.1** "Would I delete this app?" per journey
- [ ] **97.1** "Would I show this to someone?" per screen
- [x] **98.1** No claims of perfection without evidence
- [ ] **99.1** Final 12-part output
- [x] **100.1** Hold the standard throughout

---

## 🔒 Regression guards — verify before every commit

These were closed in the pre-launch audit and must never come back.

- [ ] Strangers cannot read each other's workouts
- [ ] No unilateral friendships
- [ ] Clients cannot insert arbitrary notifications
- [ ] Duel winners/rewards not client-forgeable
- [ ] Post owners cannot rewrite others' comments
- [ ] Duel invites stay private
- [ ] Workout deletion propagates to cloud
- [ ] Heavy valid lifts do not poison sync
- [ ] Moderation filter + reporting functional
- [ ] iPad support stays off
- [ ] No unnecessary permissions
- [ ] Password minimum 8 + breach check
- [ ] Onboarding friction stays removed

---

## Progress

| Stage | Status |
|---|---|
| 1. Protect state | ✅ complete |
| 2. Study product | 🔄 partial |
| 3–5. Design philosophy & UI review | 🔄 system documented; per-screen review needs a device |
| 6–8. TRAIN & Verified | 🔄 1 fix landed |
| 9–14. Compete/Social/Hunter/Forge | ⬜ not started |
| 15–21. Motion & performance | 🔄 list audit done |
| 22–33. Errors → copy | ⬜ not started |
| **34–36, 74. Research** | ✅ complete — [LEVL-RESEARCH.md](LEVL-RESEARCH.md) |
| 37–45. Activation & retention | ⬜ not started |
| 46–58. Architecture | 🔄 list audit done |
| 59–61. Observability | ⬜ not started |
| 62–67. Adversarial testing | ⬜ not started |
| 68–77. Product judgement | 🔄 partial |
| 78–89. Discipline | ✅ holding |
| 90–93. Documents | ⬜ not started |
| 94–100. Final assessment | ⬜ not started |

**See [LEVL-HANDOVER.md](LEVL-HANDOVER.md) for the full continuation brief.**

**Commits so far**
- `d3ab85d9` fix: exercise browser hid 67 and 87 exercises
- `1d9cfaae` ux: fewer taps per weight/reps entry
- `13289fd7` docs: competitive and user research
- `dc1c33ce` feat: plate breakdown during logging
- `(next)` ux: remove taps from every weight and reps entry

---

## 📱 SIMULATOR FINDINGS — 19 August 2026

Built and ran LEVL on an iPhone 17 Pro simulator (Xcode 26.6, Debug + Metro).
Build succeeded in 128s; all 1,505 warnings come from third-party pods
(libwebp, libdav1d), none from LEVL's own code.

### Verified working ✅

| Change | Evidence |
|---|---|
| Intro slide 4 "Proof, not claims" | Shield SVG renders correctly, green tint carries to the progress dot |
| Password minimum 8 | Placeholder reads "At least 8 characters" |
| Profile gate removed (item 27) | Guest → straight into Train, no six-field form |
| Plate hint (item 6) | "BAR 25 · 15 per side" at 100 kg — matches the engine test exactly |
| Plate hint correctly absent | Dumbbell Bench Press at 100 kg shows no hint — `usesBarbell` works |

### Found by looking, not readable from source 🔍

1. **Auth screen: guest option sits half-cut below the fold at rest.** The
   content is taller than the viewport on a 6.3" screen, so "Saves to this
   device only" is bisected by the screen edge until you scroll. It IS
   reachable — this is a first-paint appearance problem, not a broken control.
   **Fix needs a layout decision** (tighten the logo block or the 26pt margin
   above the guest button), not more padding. I tried padding first and it was
   the wrong diagnosis; reverted.
2. **Intro slide 4 body wraps to three lines** where the other slides use two.
   The brief asks for one idea, one line. Copy could tighten.
3. **LEVL already warns "Enter the weight of ONE dumbbell, not the pair."**
   That is the barbell/dumbbell confusion Hevy users complain about — another
   feature I would wrongly have called missing.

### Could NOT verify ⚠️

- **Exercise list scroll depth.** Injected swipes do not scroll the nested list
  inside the modal sheet, so I could not walk to exercise #100 on device. The
  uncapping is proven at data level (127 reachable vs 60) and by tests, but not
  visually. **Add to the manual test plan.**
- Keyboard behaviour — the text action types directly without raising the
  keyboard, so keyboard-avoidance is still unverified.

### Still genuinely needs hardware

Dual-camera Check In · push delivery · Live Activity / Dynamic Island ·
HealthKit · real frame rates and cold-start timing (a Mac flatters all three).
