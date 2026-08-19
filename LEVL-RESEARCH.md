# LEVL — Competitive & User Research

Evidence gathered for the world-class pass, August 2026. Every claim is either
sourced or measured from the repository. Where I am reasoning rather than
citing, it says so.

---

## 1. The single most important finding

**Logging friction is the strongest predictor of whether someone is still using
a fitness app at day 30.** Not features, not design, not content.

- Health & fitness apps retain roughly **3%** of users at day 30
- Activation falls from **26% on day 1 to 10% by day 28**
- The drop-off is *steepest* for apps relying on manual logging
- Apps that cut logging time show measurably higher retention at every horizon

Sources: [Business of Apps benchmarks](https://www.businessofapps.com/data/health-fitness-app-benchmarks/),
[Fitness Refined 2026](https://www.openpr.com/news/4602398/fitness-refined-releases-2026-report-on-why-fitness-app-users),
[UXCam](https://uxcam.com/blog/mobile-app-retention-benchmarks/)

**Implication for LEVL:** every tap removed from set entry is worth more than
any visual polish anywhere in the app. This reorders the whole brief — set entry
is the priority, not the design system.

**The benchmark to beat:** Strong is repeatedly described as the gold standard
because *"recording a set takes two taps."*
([roundup](https://www.hevyapp.com/best-workout-tracker-app/))

### ⚠️ Correction — I measured LEVL before assuming it was behind

I drafted this section expecting LEVL to lose on tap count. It does not.
`log()` in [TrainTab.js:233](src/screens/TrainTab.js) resets only the set
multiplier — **weight and reps deliberately persist**. So the most common action
in a session, logging another set at the same load, is **one tap**, and the
button even counts it: *"Log Set · #3 today"*.

That is at or ahead of Strong's two taps for the repeat case. The remaining
friction was only in *changing* a value, which the `selectTextOnFocus` fix this
pass addresses.

**What this changes:** set entry was not the weak point I assumed. The priority
below is reordered again — toward the features that are genuinely absent rather
than the interaction that is already good. Measuring before optimising is the
rule; I nearly broke it.

---

## 2. What users LOVE (across all the leading trackers)

| What | Why it works | LEVL today |
|---|---|---|
| Set-by-set logging: reps, weight, RPE | The core loop; must be frictionless | ✅ has all three, and the RPE scale is translated into plain English (*"Could have done about 2 more reps"*) — better than the competition |
| Previous workout values shown live | Removes recall effort mid-session | ✅ shipped (`lastSession`) |
| Built-in rest timer | Removes a second app | ✅ shipped, plus a Live Activity on the Lock Screen |
| Reusable templates | Start a session in one tap | ✅ "Workout Day" |
| Per-lift progress charts | The payoff for logging | ✅ ProgressTab |
| Plate calculator | Mental arithmetic under fatigue | ❌ **missing** (a warm-up/percentage calculator exists, which is not the same) |
| Marking set types (warm-up, drop, failure) | Warm-ups shouldn't count as working sets | ❌ **missing** |
| Exercise notes | "Left shoulder twinged" | ❌ **missing** |
| Large exercise library | Finding your specific variation | ⚠️ **127** vs Jefit 1,400+, typical 300–800 |
| Apple Watch app | Logging without a phone | ❌ **missing** — Strong's is "among the best in the category" |

Source: [Fitbod roundup](https://fitbod.me/blog/best-workout-tracker-apps-for-2026/),
[JEFIT comparison](https://www.jefit.com/blog/10-best-workout-tracker-apps-in-2026-complete-comparison-guide),
[Zapier](https://zapier.com/blog/best-fitness-tracking-apps/)

---

## 3. What users HATE

| Complaint | About | LEVL's position |
|---|---|---|
| **No "Next" button between input fields** | Hevy — the top logging complaint | ❌ **LEVL had the same gap.** Partly fixed this pass; `decimal-pad` has no return key on iOS so the full fix is an `InputAccessoryView` toolbar |
| Barbell entry requires total weight | Hevy | ⚠️ same in LEVL — no per-side or plate entry |
| Can't change an exercise mid-workout and save the routine | Hevy | ⚠️ needs checking in LEVL |
| Manual entry is slow | The category | ⚠️ the thing to win on |
| Choice paralysis — too many options on open | The category | ⚠️ the prior audit counted **twenty** systems a new user meets |
| Requires connection to log | Hevy | ✅ **LEVL wins outright** — fully offline-first |
| Subscriptions gating basics | The category | ✅ LEVL has no paywall |
| Social feeds that feel like spam | Hevy's community push | ⚠️ risk to manage, not a current fault |

Sources: [Hevy reviews](https://justuseapp.com/en/app/1458862350/hevy-workout-tracker-gym-log/reviews),
[Setgraph community roundup](https://setgraph.app/ai-blog/best-workout-tracker-app-reddit)

---

## 4. The gap matrix

| Capability | LEVL | Hevy | Strong | Strava | Best example | Opportunity |
|---|---|---|---|---|---|---|
| Set logging speed | ✅ **1 tap to repeat** | good | 2 taps | n/a | **LEVL** | Already at or ahead of the benchmark — see correction below |
| Offline logging | ✅ full | ❌ complaints | ✅ | ✅ | **LEVL** | Say it out loud — it's unclaimed |
| Previous set recall | ✅ | ✅ | ✅ | n/a | parity | — |
| Rest timer | ✅ + Live Activity | ✅ | ✅ | n/a | **LEVL** | Lock Screen timer is genuinely ahead |
| Plate calculator | ❌ | ✅ | ✅ | n/a | Strong | Cheap, high daily value |
| Set types (warm-up/drop) | ❌ | ✅ | ✅ | n/a | Strong | Affects PR correctness |
| Exercise library | ⚠️ 127 | ~400 | ~300 | n/a | Jefit 1,400 | Add variations, not bulk |
| Apple Watch | ❌ | ✅ | ✅ best | ✅ | Strong | Large project, real moat |
| **Workout verification** | ✅ **unique** | ❌ | ❌ | GPS only | **LEVL** | **Nobody else can do this for gym work** |
| Social feed | ✅ photo-based | ✅ basic | ❌ | ✅ best | Strava | Turn effort into social capital |
| Kudos/reactions | ✅ 5 types | ✅ | ❌ | ✅ 14bn/yr | Strava | Reactions are the cheapest retention hook there is |
| Groups/clubs | ❌ | ❌ | ❌ | ✅ | Strava | **Group activity earns 95–121% more kudos** |
| Competitive ladder | ✅ rank + duels | ❌ | ❌ | segments | **LEVL** | Genuinely differentiated |
| Character progression | ✅ Hunter/Forge | ❌ | ❌ | ❌ | **LEVL** | Unique, but weakly tied to training |
| Streaks | ✅ + protection | ✅ | ❌ | ✅ | Duolingo | Social streaks last **5.69 vs 4.25 days** |

---

## 5. Lessons worth stealing (principles, not features)

**Duolingo — one currency, many systems.** XP simultaneously advances the
streak, the league ranking and achievement progress. *That* is why their
gamification reads as one system rather than several bolted together.
([case study](https://trophy.so/blog/duolingo-gamification-case-study))

> **Direct application:** the prior audit found LEVL presents ~20 systems to a
> new user. The fix is not necessarily removing them — it is making one action
> visibly feed several. A logged set should move XP, rank, streak and Hunter in
> one animation, not four separate places the user must go and check.

**Strava — effort becomes social capital.** Strava "succeeded not because it
tracks fitness well, but because it built a social network around activities."
14 billion kudos in 2025, up 20%.
([Sensor Tower](https://sensortower.com/blog/beyond-workouts-stravas-social-transformation-of-fitness-tracking),
[Trophy](https://trophy.so/blog/strava-gamification-case-study))

> **Direct application:** LEVL's reactions exist but are passive. The measured
> finding that *group* activity earns 95–121% more kudos suggests LEVL's missing
> primitive is a small group — the "Crew" idea from the prior audit — not more
> feed features.

**Social streaks outlast private ones.** 5.69 days average vs 4.25 when streak
progress is visible to others.

> **Direct application:** LEVL's streak is currently private. Making it visible
> to friends is a small change with measured effect.

---

## 6. Independent comparisons worth adding (item 34.3)

The brief listed the obvious set. Three others are more instructive for LEVL
specifically:

- **Jefit** — 1,400+ exercises and 12M members. The relevant lesson is *library
  depth as a retention floor*: people leave when their variation isn't listed.
- **Whoop / Oura** — subscription hardware with no logging at all, yet extremely
  high retention, because they deliver a *daily verdict* the user didn't have to
  work for. LEVL's rank is close to this idea and under-exploited.
- **Chess.com / competitive ladders generally** — the honest comparison for
  LEVL's rank system, and where rank decay, placement and division design are
  actually solved. Fitness apps are the wrong reference class for that feature.

---

## 7. What this changes about the plan

Reordered by evidence rather than by the brief's sequence:

1. ~~Set entry to two taps~~ — **already achieved** (one tap to repeat). Only
   `selectTextOnFocus` was missing, now fixed.
2. **Plate calculator + set types** — genuinely absent, repeatedly named in every
   roundup, and pure client-side maths with no security or database surface.
3. **One action, many systems** — Duolingo's coherence lesson, applied to the
   twenty-systems problem.
4. **Make offline-first and Verified Sessions loud** — two genuine wins,
   currently unclaimed.
5. Design system and typography — real, but *below* the above.

**Deliberately not chasing:** exercise-library parity with Jefit (bulk without
curation is not a win), Apple Watch (large, post-launch), and anything requiring
real user data — feed ranking, notification frequency, ideal XP curve. Those get
instrumented, not guessed. 📊
