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

- [ ] **3.1** Write the LEVL design philosophy
- [ ] **3.2** Define what to avoid (random gradients, glow, clutter…)
- [ ] **3.3** Ensure one-design-team coherence

## STAGE 4 — Design system

- [x] **4.0** Measure current drift — **366** literal `fontSize`, **180** hex outside theme, **54** raw `rgba()`
- [ ] **4.1** Colour roles
- [ ] **4.2** Typography hierarchy
- [ ] **4.3** Numeric/stat type treatment
- [ ] **4.4** Spacing scale
- [ ] **4.5** Radius scale
- [ ] **4.6** Shadow/elevation
- [ ] **4.7** Button states (primary/secondary/destructive/ghost/disabled/loading)
- [ ] **4.8** Card usage rules
- [ ] **4.9** Icon family audit

## STAGE 5 — Pixel-level UI review

- [ ] **5.1** Hierarchy per screen 👁
- [ ] **5.2** Spacing per screen 👁
- [ ] **5.3** Alignment 👁
- [ ] **5.4** Typography 👁
- [ ] **5.5** Contrast 👁
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

- [ ] **15.1** Define motion principles (instant / transition / reward)
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

- [ ] **22.1** Error experience audit
- [ ] **23.1** Empty states answer what/why/now
- [ ] **24.1** Haptic design pass
- [—] **25.1** Sound — not adding any; no value case for a gym app
- [ ] **26.1** One-handed reachability
- [ ] **27.1** Keyboard quality per form
- [ ] **28.1** Accessibility: VoiceOver, roles, Dynamic Type, contrast, targets, reduced motion
- [ ] **29.1** iPhone screen matrix 👁
- [ ] **30.1** Photo pipeline quality
- [ ] **31.1** Information density / progressive disclosure
- [ ] **32.1** Remove weak UI
- [ ] **33.1** Copywriting pass + canonical terminology list

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
- [ ] **51.1** Concurrency / double-tap / duplicate actions
- [ ] **52.1** Optimistic UI where safe
- [ ] **53.1** Data fetching / refetch / cache
- [x] **54.1** List performance audit — done, see 16.2
- [ ] **55.1** Image pipeline
- [ ] **56.1** Memory and lifecycle cleanup
- [ ] **57.1** Crash resistance / defensive data
- [ ] **58.1** Error boundaries

## STAGE 59–61 — Observability, analytics, budgets

- [ ] **59.1** Reassess Sentry / OTA — classify safe-now vs after-launch
- [ ] **60.1** Analytics quality
- [ ] **61.1** Performance budgets (measure baseline first) 👁

## STAGE 62–67 — Adversarial and environmental testing

- [ ] **62.1** Test like a bad user
- [ ] **63.1** Visual edge cases (long names, huge numbers, 100 comments)
- [ ] **64.1** Large Dynamic Type 👁
- [ ] **65.1** Reduced Motion
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
- [ ] **82.1** Before/after evidence where possible; else mark NOT VISUALLY VERIFIED
- [x] **83.1** Keep the best things 🔒
- [x] **84.1** Run tests after each phase — green after every commit
- [ ] **85.1** Regression-test all prior security fixes 🔒
- [ ] **86.1** Build quality gate (install, tests, doctor, no secrets)
- [ ] **87.1** Dead code pass
- [x] **88.1** Comment *why*, not *what*
- [x] **89.1** Boring code over clever code

## STAGE 90–93 — Documents to produce

- [ ] **90.1** `LEVL-WORLD-CLASS-PASS.md`
- [ ] **91.1** `LEVL-DESIGN-SYSTEM.md`
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
| 3–5. Design philosophy & UI review | ⬜ not started |
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

**Commits so far**
- `d3ab85d9` fix: exercise browser hid 67 and 87 exercises
- `(next)` ux: remove taps from every weight and reps entry
