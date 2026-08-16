// LEVL — strength projection.
//
// The old model fitted a straight line through whatever points existed and
// extrapolated it forever. Two sessions four days apart could produce a
// 632 kg tricep pushdown, because a line has no idea what a human body is.
//
// This replaces it with three things the old one lacked:
//
//   1. A MINIMUM EVIDENCE BAR. Two points define a line but say nothing about
//      a trend. We require 3+ sessions spanning 14+ days before projecting at
//      all — otherwise we say so instead of inventing a number.
//
//   2. DECELERATION. Strength does not increase linearly. Gains slow as you
//      approach your potential — fast as a novice, glacial near the ceiling.
//      We recompute the weekly rate at every step, so the curve flattens the
//      way real training does.
//
//   3. A PHYSIOLOGICAL CEILING. Elite strength standards are expressed as
//      multiples of bodyweight, and they differ enormously between a squat
//      and a lateral raise. The projection asymptotes toward that ceiling and
//      can never cross it.
//
// The user never sees any of this. They see a number that isn't absurd.

// Elite 1RM as a multiple of bodyweight, by muscle group. Drawn from published
// strength-standard tables (ExRx / Strength Level style). "Elite" here means
// roughly the top few percent of trained lifters — a hard ceiling, not a goal.
// Cable and machine work sits higher than free weights because leverage and
// pulley ratios inflate the number on the stack.
const ELITE_BW_MULTIPLE = {
  Quads: 2.75,        // back squat territory
  Hamstrings: 2.50,   // RDL / deadlift pattern
  Glutes: 2.80,       // hip thrust loads are famously high
  Calves: 2.20,       // calves take enormous loads
  Back: 1.90,         // rows and pulldowns
  Chest: 1.90,        // bench press
  Shoulders: 1.20,    // overhead press
  Traps: 2.20,        // shrugs
  Biceps: 0.80,       // curls
  Triceps: 0.95,      // pushdowns, extensions
  Forearms: 0.85,
  Core: 1.10,
  Adductors: 1.10,
  Power: 1.90,        // olympic lifts
};

// Weekly gain as a fraction of current 1RM, by how close you already are to
// your ceiling. A beginner at 30% of potential can add ~1.5% a week; someone
// at 90% is fighting for a tenth of that. These are deliberately conservative:
// a projection that undershoots is a pleasant surprise, one that overshoots
// is the bug we are fixing.
function weeklyRateFor(proximity) {
  if (proximity < 0.45) return 0.015;   // novice
  if (proximity < 0.70) return 0.008;   // intermediate
  if (proximity < 0.85) return 0.004;   // advanced
  if (proximity < 0.95) return 0.002;   // near ceiling
  return 0.0005;                        // at ceiling — maintenance
}

// Without a bodyweight we cannot compute a ceiling, so we fall back to the
// intermediate rate and cap total growth conservatively.
const NO_BW_WEEKLY_RATE = 0.006;

const MIN_SESSIONS = 3;
const MIN_SPAN_DAYS = 14;

/**
 * points: [{ t: ms, e1rm: number }] — best per day, ascending
 * category: muscle group string
 * bodyweightKg: number | null
 * Returns { ready, reason?, weeks:[{w,value}], perWeek, ceiling, confidence }
 */
function projectStrength(points, category, bodyweightKg) {
  const pts = (points || []).slice().sort((a, b) => a.t - b.t);
  if (pts.length < MIN_SESSIONS) {
    return { ready: false, reason: 'need_sessions', have: pts.length, need: MIN_SESSIONS };
  }
  const spanDays = (pts[pts.length - 1].t - pts[0].t) / 86400000;
  if (spanDays < MIN_SPAN_DAYS) {
    return { ready: false, reason: 'need_time', haveDays: Math.floor(spanDays), needDays: MIN_SPAN_DAYS };
  }

  const current = Math.max(...pts.map((p) => p.e1rm));

  // Observed rate, measured from the median of the first and last thirds
  // rather than a raw line fit — one outlier session cannot dominate it.
  const third = Math.max(1, Math.floor(pts.length / 3));
  const med = (arr) => {
    const v = arr.slice().sort((a, b) => a - b);
    return v.length % 2 ? v[(v.length - 1) / 2] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2;
  };
  const early = med(pts.slice(0, third).map((p) => p.e1rm));
  const late = med(pts.slice(-third).map((p) => p.e1rm));
  const observedPerWeek = ((late - early) / spanDays) * 7;

  const rawCeiling = (bodyweightKg && ELITE_BW_MULTIPLE[category])
    ? bodyweightKg * ELITE_BW_MULTIPLE[category]
    : null;

  // These multiples are population tables, and real people beat tables —
  // especially on cable and machine work where the stack number flatters the
  // load. If someone is already above their modelled ceiling, that is not a
  // reason to project them going backwards. Their own best becomes the floor
  // for the ceiling, and they simply get near-maintenance gains from there.
  const ceiling = rawCeiling ? Math.max(rawCeiling, current * 1.04) : null;

  // Walk forward a week at a time. The rate is recalculated every step from
  // how close you now are to the ceiling, so the curve bends by construction
  // instead of needing a fudge factor.
  const weeks = [];
  let v = current;
  for (let w = 1; w <= 12; w++) {
    const proximity = ceiling ? Math.min(1, v / ceiling) : 0.6;
    const pct = ceiling ? weeklyRateFor(proximity) : NO_BW_WEEKLY_RATE;
    const physiologicalMax = v * pct;
    // Never project faster than the person is actually progressing, and never
    // faster than a body can adapt. Whichever is lower wins.
    let step = Math.max(0, Math.min(observedPerWeek, physiologicalMax));
    v += step;
    if (ceiling) v = Math.min(v, ceiling * 0.995);
    weeks.push({ w, value: Math.round(v * 10) / 10 });
  }

  const gain12 = weeks[11].value - current;
  return {
    ready: true,
    current: Math.round(current * 10) / 10,
    weeks,
    at: (w) => (weeks.find((x) => x.w === w) || weeks[weeks.length - 1]).value,
    perWeek: Math.round((gain12 / 12) * 100) / 100,
    ceiling: ceiling ? Math.round(ceiling) : null,
    proximity: ceiling ? Math.min(1, current / ceiling) : null,
    sessions: pts.length,
    spanDays: Math.round(spanDays),
    // How much to trust it. Shown as words, never as a number.
    confidence: pts.length >= 8 && spanDays >= 42 ? 'high'
      : pts.length >= 5 && spanDays >= 28 ? 'medium' : 'low',
  };
}

export { projectStrength, ELITE_BW_MULTIPLE, MIN_SESSIONS, MIN_SPAN_DAYS };
export default projectStrength;
