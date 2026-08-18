// ============================================================================
// LEVL ENGINE — pure game/science logic shared by web and React Native.
// Scoring is shared with the proven web build; no UI, no platform APIs.
// ============================================================================
const DAY = 86400000;

/* ----------------------------- stat system ------------------------------ */
const STATS = ['STR', 'PWR', 'END', 'VIT', 'MOB', 'DIS'];
const STAT_META = {
  STR: { name: 'Strength',   color: '#ff5c6e', desc: 'Heavy compound lifting' },
  PWR: { name: 'Power',      color: '#ff8a3d', desc: 'Explosive & olympic work' },
  END: { name: 'Endurance',  color: '#2fe39b', desc: 'Cardio & high-rep work' },
  VIT: { name: 'Vitality',   color: '#3d9bff', desc: 'Core, recovery, showing up' },
  MOB: { name: 'Mobility',   color: '#2fe0e0', desc: 'Stretching & movement quality' },
  DIS: { name: 'Discipline', color: '#a66bff', desc: 'Streaks & consistency' },
};

// Rank ladder — climbs cool -> hot, so higher tiers feel physically hotter.
const TIERS = [
  { name: 'Bronze',      min: 0,    color: '#cd7f4a' },
  { name: 'Silver',      min: 600,  color: '#c3ccdb' },
  { name: 'Gold',        min: 1200, color: '#ffc933' },
  { name: 'Platinum',    min: 1800, color: '#2fe0e0' },
  { name: 'Diamond',     min: 2400, color: '#3d9bff' },
  { name: 'Champion',    min: 3000, color: '#a66bff' },
  { name: 'Grandmaster', min: 3600, color: '#ff4d6d' },
];

const TITLES = [
  [1, 'Iron Novice'], [5, 'Initiate'], [10, 'Adept'], [15, 'Disciplined'],
  [20, 'Veteran'], [30, 'Elite Lifter'], [40, 'Master'], [50, 'Apex Lifter'],
  [75, 'S-Rank Hunter'],
];

/* --------------------------- exercise library --------------------------- */
// n = name, c = category, p = primary stat, s = secondary stat, v = variations
const X = (n, c, p, s, v) => ({ n, c, p, s: s || null, v: v || null });
const EXERCISES = [
  // Chest
  X('Barbell Bench Press', 'Chest', 'STR', 'PWR', 'flat · incline · decline'),
  X('Dumbbell Bench Press', 'Chest', 'STR', null, 'flat · incline · decline'),
  X('Machine Chest Press', 'Chest', 'STR'),
  X('Smith Machine Bench Press', 'Chest', 'STR'),
  X('Dumbbell Fly', 'Chest', 'STR', null, 'flat · decline'),
  X('Incline Dumbbell Fly', 'Chest', 'STR', null, '30° · 45°'),
  X('Incline Cable Fly', 'Chest', 'STR', null, 'low-to-high'),
  X('Cable Fly / Crossover', 'Chest', 'STR', null, 'high · mid · low'),
  X('Pec Deck', 'Chest', 'STR'),
  X('Push-Up', 'Chest', 'END', 'STR', 'standard · wide · diamond'),
  X('Chest Dips', 'Chest', 'STR', 'END', 'forward lean'),
  X('Landmine Press', 'Chest', 'STR', 'PWR'),
  X('Floor Press', 'Chest', 'STR'),
  X('Dumbbell Pullover', 'Chest', 'STR'),
  // Back
  X('Deadlift', 'Back', 'STR', 'PWR', 'conventional · sumo'),
  X('Rack Pull', 'Back', 'STR'),
  X('Pull-Up', 'Back', 'STR', 'END', 'wide · neutral · close'),
  X('Chin-Up', 'Back', 'STR', null, 'supinated'),
  X('Lat Pulldown', 'Back', 'STR', null, 'wide · close · reverse'),
  X('Straight-Arm Pulldown', 'Back', 'STR'),
  X('Bent-Over Barbell Row', 'Back', 'STR'),
  X('Pendlay Row', 'Back', 'STR', 'PWR'),
  X('One-Arm Dumbbell Row', 'Back', 'STR'),
  X('T-Bar Row', 'Back', 'STR'),
  X('Chest-Supported Row', 'Back', 'STR'),
  X('Seated Cable Row', 'Back', 'STR', null, 'wide · close'),
  X('Machine Row', 'Back', 'STR'),
  X('Inverted Row', 'Back', 'END', 'STR'),
  X('Face Pull', 'Back', 'MOB', 'STR'),
  X('Back Extension', 'Back', 'VIT', 'STR', 'hyperextension'),
  X('Good Morning', 'Back', 'STR'),
  // Shoulders
  X('Overhead Barbell Press', 'Shoulders', 'STR', 'PWR', 'standing · seated'),
  X('Dumbbell Shoulder Press', 'Shoulders', 'STR', null, 'standing · seated'),
  X('Arnold Press', 'Shoulders', 'STR'),
  X('Push Press', 'Shoulders', 'PWR', 'STR'),
  X('Machine Shoulder Press', 'Shoulders', 'STR'),
  X('Front Raise', 'Shoulders', 'STR', null, 'dumbbell · plate · cable'),
  X('Lateral Raise', 'Shoulders', 'STR', null, 'dumbbell · cable · machine'),
  X('Upright Row', 'Shoulders', 'STR'),
  X('Rear-Delt Fly', 'Shoulders', 'STR', null, 'dumbbell · cable'),
  X('Reverse Pec Deck', 'Shoulders', 'STR'),
  X('Cuban Press', 'Shoulders', 'MOB', 'STR'),
  // Biceps
  X('Barbell Curl', 'Biceps', 'STR', null, 'straight · EZ-bar'),
  X('Dumbbell Curl', 'Biceps', 'STR', null, 'standing · seated'),
  X('Hammer Curl', 'Biceps', 'STR'),
  X('Incline Dumbbell Curl', 'Biceps', 'STR'),
  X('Preacher Curl', 'Biceps', 'STR', null, 'barbell · dumbbell · machine'),
  X('Concentration Curl', 'Biceps', 'STR'),
  X('Cable Curl', 'Biceps', 'STR', null, 'bar · rope'),
  X('Spider Curl', 'Biceps', 'STR'),
  X('Zottman Curl', 'Biceps', 'STR'),
  // Triceps
  X('Close-Grip Bench Press', 'Triceps', 'STR'),
  X('Dips', 'Triceps', 'STR', null, 'upright · bench'),
  X('Tricep Pushdown', 'Triceps', 'STR', null, 'rope · bar · V-bar'),
  X('Overhead Tricep Extension', 'Triceps', 'STR', null, 'dumbbell · cable · EZ-bar'),
  X('Skull Crusher', 'Triceps', 'STR'),
  X('JM Press', 'Triceps', 'STR'),
  X('Diamond Push-Up', 'Triceps', 'END', 'STR'),
  // Forearms & grip
  X("Farmer's Carry", 'Forearms', 'END', 'STR'),
  X('Wrist Curl', 'Forearms', 'STR'),
  X('Reverse Curl', 'Forearms', 'STR', null, 'EZ-bar'),
  X('Wrist Roller', 'Forearms', 'STR'),
  X('Dead Hang', 'Forearms', 'END', 'MOB'),
  // Quads
  X('Back Squat', 'Quads', 'STR', 'PWR', 'high-bar · low-bar'),
  X('Front Squat', 'Quads', 'STR', 'PWR'),
  X('Hack Squat', 'Quads', 'STR'),
  X('Leg Press', 'Quads', 'STR'),
  X('Leg Extension', 'Quads', 'STR'),
  X('Goblet Squat', 'Quads', 'STR'),
  X('Bulgarian Split Squat', 'Quads', 'STR', 'END'),
  X('Lunge', 'Quads', 'STR', 'END', 'walking · reverse · stationary'),
  X('Step-Up', 'Quads', 'STR'),
  X('Box Squat', 'Quads', 'STR', 'PWR'),
  X('Sissy Squat', 'Quads', 'STR'),
  // Hamstrings
  X('Romanian Deadlift', 'Hamstrings', 'STR'),
  X('Stiff-Legged Deadlift', 'Hamstrings', 'STR'),
  X('Lying Leg Curl', 'Hamstrings', 'STR'),
  X('Seated Leg Curl', 'Hamstrings', 'STR'),
  X('Nordic Hamstring Curl', 'Hamstrings', 'STR'),
  X('Glute-Ham Raise', 'Hamstrings', 'STR'),
  X('Single-Leg RDL', 'Hamstrings', 'STR', 'MOB'),
  X('Cable Pull-Through', 'Hamstrings', 'STR'),
  // Glutes
  X('Hip Thrust', 'Glutes', 'STR', 'PWR', 'barbell · machine'),
  X('Glute Bridge', 'Glutes', 'STR'),
  X('Cable Kickback', 'Glutes', 'STR'),
  X('Sumo Deadlift', 'Glutes', 'STR', 'PWR'),
  X('Hip Abduction Machine', 'Glutes', 'STR'),
  X('Kettlebell Swing', 'Glutes', 'PWR', 'END'),
  // Calves
  X('Standing Calf Raise', 'Calves', 'STR'),
  X('Seated Calf Raise', 'Calves', 'STR', null, 'soleus focus'),
  X('Leg-Press Calf Raise', 'Calves', 'STR'),
  X('Single-Leg Calf Raise', 'Calves', 'STR'),
  X('Tibialis Raise', 'Calves', 'STR'),
  // Adductors
  X('Hip Adduction Machine', 'Adductors', 'STR'),
  X('Copenhagen Plank', 'Adductors', 'VIT', 'STR'),
  X('Sumo Squat', 'Adductors', 'STR'),
  // Core
  X('Crunch', 'Core', 'VIT'),
  X('Cable Crunch', 'Core', 'VIT', 'STR'),
  X('Hanging Leg Raise', 'Core', 'VIT', 'STR'),
  X('Lying Leg Raise', 'Core', 'VIT'),
  X('Toes-to-Bar', 'Core', 'VIT', 'STR'),
  X('V-Up', 'Core', 'VIT'),
  X('Ab-Wheel Rollout', 'Core', 'VIT', 'STR'),
  X('Plank', 'Core', 'VIT', 'END'),
  X('Dead Bug', 'Core', 'VIT', 'MOB'),
  X('Russian Twist', 'Core', 'VIT'),
  X('Bicycle Crunch', 'Core', 'VIT', 'END'),
  X('Side Plank', 'Core', 'VIT'),
  X('Cable Woodchopper', 'Core', 'VIT', 'PWR'),
  X('Pallof Press', 'Core', 'VIT', 'MOB'),
  X('Dragon Flag', 'Core', 'VIT', 'STR'),
  X('Mountain Climber', 'Core', 'END', 'VIT'),
  // Traps & neck
  X('Barbell Shrug', 'Traps', 'STR'),
  X('Dumbbell Shrug', 'Traps', 'STR'),
  X('Trap-Bar Shrug', 'Traps', 'STR'),
  X('Power Shrug', 'Traps', 'PWR', 'STR'),
  X('Neck Curl / Extension', 'Traps', 'STR', null, 'harness'),
  // Olympic / power / full body
  X('Clean and Jerk', 'Power', 'PWR', 'STR'),
  X('Snatch', 'Power', 'PWR'),
  X('Power Clean', 'Power', 'PWR', 'STR'),
  X('Hang Clean', 'Power', 'PWR'),
  X('Clean and Press', 'Power', 'PWR', 'STR'),
  X('Thruster', 'Power', 'PWR', 'END'),
  X('Snatch-Grip Deadlift', 'Power', 'STR', 'PWR'),
  X('Box Jump', 'Power', 'PWR'),
  X('Wall Ball', 'Power', 'END', 'PWR'),
  X('Turkish Get-Up', 'Power', 'MOB', 'STR'),
];
// Sorted A–Z so browsing and searching is predictable. Category filtering is
// unaffected (it matches on .c), and nothing depends on array position.
EXERCISES.sort((a, b) => a.n.localeCompare(b.n));

// How a load should be entered for a given exercise. Dumbbell and unilateral
// work is logged PER HAND / PER LIMB — curling two 18 kg dumbbells is "18",
// not "36". Ambiguity here quietly corrupts e1RM and volume, so the UI states
// it explicitly rather than hoping people guess the same way.
function loadNote(name) {
  const n = String(name || '');
  if (/^One-Arm|^Single-|Bulgarian|Pistol|^Lunge|Step-Up|Split Squat/i.test(n)) {
    return 'One limb at a time — enter the weight you use for a single side.';
  }
  if (/Kettlebell/i.test(n)) return 'Enter the weight of ONE kettlebell, not the pair.';
  if (/Dumbbell/i.test(n)) return 'Enter the weight of ONE dumbbell, not the pair.';
  return null;
}

const CATEGORIES = ['All', 'Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps',
  'Forearms', 'Quads', 'Hamstrings', 'Glutes', 'Calves', 'Adductors', 'Core', 'Traps', 'Power'];

/* --------------------------- cardio & recovery --------------------------- */
const CARDIO_TYPES = [
  { n: 'Run (Zone 2)', p: 'END', s: 'VIT', e: '🏃' },
  { n: 'Sprint Intervals', p: 'END', s: 'PWR', e: '⚡' },
  { n: 'Rowing Machine', p: 'END', s: 'PWR', e: '🚣' },
  { n: 'Cycling', p: 'END', s: null, e: '🚴' },
  { n: 'Assault Bike', p: 'END', s: 'PWR', e: '🌀' },
  { n: 'Swimming', p: 'END', s: 'MOB', e: '🏊' },
  { n: 'Jump Rope', p: 'END', s: 'PWR', e: '🪢' },
  { n: 'Stair Climber', p: 'END', s: null, e: '🪜' },
  { n: 'Incline Walk', p: 'END', s: 'VIT', e: '🥾' },
  { n: 'Hiking', p: 'END', s: 'VIT', e: '⛰️' },
  { n: 'HIIT Circuit', p: 'END', s: 'PWR', e: '🔥' },
  { n: 'Sled Push / Pull', p: 'PWR', s: 'END', e: '🛷' },
  { n: 'Battle Ropes', p: 'END', s: 'PWR', e: '🌊' },
  // ---- martial arts ----
  { n: 'Muay Thai (Bag / Pads)', p: 'END', s: 'PWR', e: '🥊', g: 'Martial Arts' },
  { n: 'Muay Thai (Sparring)', p: 'END', s: 'PWR', e: '🥊', g: 'Martial Arts' },
  { n: 'Muay Thai (Clinch)', p: 'PWR', s: 'END', e: '🥊', g: 'Martial Arts' },
  { n: 'Boxing (Bag / Pads)', p: 'END', s: 'PWR', e: '🥊', g: 'Martial Arts' },
  { n: 'Boxing (Sparring)', p: 'END', s: 'PWR', e: '🥊', g: 'Martial Arts' },
  { n: 'Kickboxing', p: 'END', s: 'PWR', e: '🦵', g: 'Martial Arts' },
  { n: 'BJJ / Grappling', p: 'END', s: 'STR', e: '🥋', g: 'Martial Arts' },
  { n: 'Wrestling', p: 'PWR', s: 'END', e: '🤼', g: 'Martial Arts' },
  { n: 'Judo', p: 'PWR', s: 'END', e: '🥋', g: 'Martial Arts' },
  { n: 'Karate / Taekwondo', p: 'END', s: 'MOB', e: '🥋', g: 'Martial Arts' },
  { n: 'MMA Conditioning', p: 'END', s: 'PWR', e: '🔥', g: 'Martial Arts' },
  { n: 'Shadow Boxing', p: 'END', s: 'MOB', e: '👤', g: 'Martial Arts' },
  // ---- mobility & recovery ----
  { n: 'Yoga Flow', p: 'MOB', s: 'VIT', e: '🧘', g: 'Recovery' },
  { n: 'Stretching / Mobility', p: 'MOB', s: null, e: '🤸', g: 'Recovery' },
  { n: 'Foam Rolling / Recovery', p: 'VIT', s: 'MOB', e: '💆', g: 'Recovery' },
];
const INTENSITIES = [
  { k: 'light', label: 'Light', mult: 1.0 },
  { k: 'moderate', label: 'Moderate', mult: 1.6 },
  { k: 'hard', label: 'Hard', mult: 2.4 },
  { k: 'max', label: 'Max', mult: 3.2 },
];

/* ------------------------------ math engine ------------------------------ */
const epley = (w, r) => (r <= 1 ? w : w * (1 + r / 30));
const brzycki = (w, r) => (r <= 1 ? w : r < 36 ? (w * 36) / (37 - r) : w * 2);
const weightForReps = (oneRM, reps) => (reps <= 1 ? oneRM : oneRM / (1 + reps / 30));
const pctForReps = (reps) => (reps <= 1 ? 100 : 100 / (1 + reps / 30));
const roundLoad = (w, unit) => {
  const s = unit === 'lb' ? 5 : 2.5;
  return Math.round(w / s) * s;
};

// XP per set: diminishing returns on tonnage, scaled by effort, PR bonus.
const setXP = (weight, reps, rpe, isPR) => {
  const load = weight > 0 ? weight * reps : reps * 25; // bodyweight fallback
  let xp = Math.pow(Math.max(load, 1), 0.55) * (1 + (rpe - 6) * 0.06);
  xp = Math.max(6, xp);
  if (isPR) xp *= 1.5;
  return Math.round(xp);
};

/* ============================ integrity engine ============================ */
// Client-side deterrents so casual users can't trivially overwrite scores.
// This is a FIRST line of defence for the prototype — the production build
// moves scoring server-side (see the anti-cheat notes in the master plan).
const INTEGRITY = {
  DAILY_XP_CAP: 4000,        // most honest sessions land 300-1200 XP
  MAX_REPS: 50,              // above this it isn't a strength set
  MIN_REST_SECONDS: 20,      // two logged sets closer than this = suspicious
  MAX_SETS_PER_DAY: 60,      // hard ceiling on logged sets/day
  MAX_CARDIO_MIN: 360,       // 6 h is already an ultra; beyond = typo/abuse
  MAX_CARDIO_PER_DAY: 600,   // total cardio minutes/day
  BW_MULTIPLE_CAP: 4.0,      // load ceiling as a multiple of bodyweight (elite DL ~3-3.5x)
  MAX_BATCH_SETS: 10,        // most sets loggable in one "I forgot to log" entry
};
// Absolute per-exercise load ceilings (kg) — set generously above world-class
// so real lifters are never blocked, but a "500 kg curl" is rejected.
const LIFT_CAPS_KG = {
  'Deadlift': 460, 'Sumo Deadlift': 460, 'Rack Pull': 520, 'Back Squat': 420,
  'Front Squat': 320, 'Barbell Bench Press': 360, 'Hip Thrust': 500,
  'Overhead Barbell Press': 230, 'Barbell Curl': 120, 'Dumbbell Curl': 80,
  'Hammer Curl': 90, 'Lateral Raise': 60, 'Tricep Pushdown': 140,
  'Leg Press': 700, 'Romanian Deadlift': 360,
};
const DEFAULT_LIFT_CAP_KG = 400; // catch-all for anything not listed
const toKg = (w, unit) => (unit === 'lb' ? w / 2.2046226 : w);
const toLb = (w) => w * 2.2046226;

// Switching kg <-> lb must rewrite every stored weight, not just the label.
// Lifts store w/e1rm in the display unit, so converting keeps the numbers
// physically correct. XP is already unit-normalized, so it never changes here.
function convertUnits(d, newUnit) {
  const oldUnit = d.unit || 'kg';
  if (newUnit === oldUnit) return d;
  const conv = (v) => {
    if (!v || !isFinite(v)) return v;
    const kg = toKg(v, oldUnit);
    return +(newUnit === 'lb' ? toLb(kg) : kg).toFixed(1);
  };
  return {
    ...d,
    unit: newUnit,
    bodyweight: conv(d.bodyweight),
    lifts: (d.lifts || []).map((l) => ({ ...l, w: conv(l.w), e1rm: conv(l.e1rm) })),
  };
}

// Returns { ok, reason, flag } — flag marks an entry as 'unverified' rather
// than blocking, when it's odd-but-not-impossible.
function validateLift(d, exName, w, r, rpe, now, opts) {
  const batch = !!(opts && opts.batch);
  const unit = d.unit || 'kg';
  if (!(r >= 1) || r > INTEGRITY.MAX_REPS) return { ok: false, reason: 'Reps must be between 1 and ' + INTEGRITY.MAX_REPS + '.' };
  if (w < 0) return { ok: false, reason: 'Weight cannot be negative.' };
  const wKg = toKg(w, unit);
  const cap = LIFT_CAPS_KG[exName] || DEFAULT_LIFT_CAP_KG;
  if (wKg > cap) return { ok: false, reason: 'That load is above the plausible ceiling for ' + exName + ' (' + Math.round(unit === 'lb' ? cap * 2.2046 : cap) + ' ' + unit + '). Check your entry.' };
  const bw = d.bodyweight ? toKg(d.bodyweight, unit) : 0;
  if (bw > 0 && wKg > bw * INTEGRITY.BW_MULTIPLE_CAP)
    return { ok: false, reason: 'That is over ' + INTEGRITY.BW_MULTIPLE_CAP + '× your bodyweight — double-check the number.' };
  // rate limit + daily set cap
  const today = d.lifts.filter((l) => dayKeyOf(l.t) === dayKeyOf(now));
  if (today.length >= INTEGRITY.MAX_SETS_PER_DAY) return { ok: false, reason: 'Daily set limit reached — take the win and rest.' };
  const lastSet = today.length ? Math.max(...today.map((l) => l.t)) : 0;
  if (!batch && lastSet && (now - lastSet) / 1000 < INTEGRITY.MIN_REST_SECONDS)
    return { ok: false, reason: 'Slow down — log sets as you actually complete them.' };
  // daily XP cap (soft: allow the set, but flag & zero-out overflow)
  const xpToday = [...d.lifts, ...d.cardio].filter((e) => dayKeyOf(e.t) === dayKeyOf(now)).reduce((s, e) => s + (e.xp || 0), 0);
  const flag = xpToday >= INTEGRITY.DAILY_XP_CAP;
  return { ok: true, flag };
}
function validateCardio(d, mins, now) {
  if (!(mins > 0)) return { ok: false, reason: 'Enter a duration.' };
  if (mins > INTEGRITY.MAX_CARDIO_MIN) return { ok: false, reason: 'That duration is unrealistically long — check the number.' };
  const todayMin = d.cardio.filter((c) => dayKeyOf(c.t) === dayKeyOf(now)).reduce((s, c) => s + (c.mins || 0), 0);
  if (todayMin + mins > INTEGRITY.MAX_CARDIO_PER_DAY) return { ok: false, reason: 'Daily cardio limit reached for today.' };
  const xpToday = [...d.lifts, ...d.cardio].filter((e) => dayKeyOf(e.t) === dayKeyOf(now)).reduce((s, e) => s + (e.xp || 0), 0);
  const flag = xpToday >= INTEGRITY.DAILY_XP_CAP;
  return { ok: true, flag };
}
// XP actually granted after the daily cap: overflow above the cap earns 0.
function cappedXP(d, rawXP, now) {
  const xpToday = [...d.lifts, ...d.cardio].filter((e) => dayKeyOf(e.t) === dayKeyOf(now)).reduce((s, e) => s + (e.xp || 0), 0);
  const room = Math.max(0, INTEGRITY.DAILY_XP_CAP - xpToday);
  return Math.min(rawXP, room);
}
const cardioXPCalc = (mins, mult) => Math.max(5, Math.round(mins * mult));

const xpForLevel = (L) => Math.round(150 * Math.pow(Math.max(L - 1, 0), 1.6));
const levelFromXP = (xp) => { let L = 1; while (L < 200 && xpForLevel(L + 1) <= xp) L++; return L; };
const titleForLevel = (L) => { let t = TITLES[0][1]; for (const p of TITLES) if (L >= p[0]) t = p[1]; return t; };
const statLevel = (xp) => Math.min(99, Math.floor(Math.pow(Math.max(xp, 0) / 60, 0.55)) + 1);

const dayKeyOf = (t) => {
  const x = new Date(t);
  return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0');
};
const startOfWeek = (t) => {
  const x = new Date(t); const day = (x.getDay() + 6) % 7;
  x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - day);
  return x.getTime();
};
const fmtShort = (t) => new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

const tierForFR = (fr) => { let t = TIERS[0]; for (const x of TIERS) if (fr >= x.min) t = x; return t; };
const divisionForFR = (fr, tier) => {
  if (tier.name === 'Grandmaster') return '';
  const d = Math.min(3, Math.floor((fr - tier.min) / 200) + 1);
  return ' ' + ['I', 'II', 'III'][d - 1];
};
const seasonLabel = (now) => {
  const d = new Date(now); const q = Math.floor(d.getMonth() / 3) + 1;
  const n = Math.max(1, (d.getFullYear() - 2026) * 4 + q);
  return 'Season ' + n + ' · Q' + q + ' ' + d.getFullYear();
};

const linReg = (pts) => {
  const n = pts.length; if (n < 2) return null;
  let sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (const p of pts) { sx += p.x; sy += p.y; sxx += p.x * p.x; sxy += p.x * p.y; }
  const den = n * sxx - sx * sx; if (den === 0) return null;
  const m = (n * sxy - sx * sy) / den;
  return { m, b: (sy - m * sx) / n };
};

const calcStreak = (entries, now) => {
  const days = [...new Set(entries.map((e) => dayKeyOf(e.t)))].sort().reverse();
  if (!days.length) return 0;
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  if (Math.round((today - new Date(days[0])) / DAY) > 2) return 0;
  let streak = 1;
  for (let i = 1; i < days.length; i++) {
    const g = Math.round((new Date(days[i - 1]) - new Date(days[i])) / DAY);
    if (g <= 2) streak++; else break;
  }
  return streak;
};

/* =============================== sessions ================================
 * A "workout" in LEVL has always been implicit: the log stores one record per
 * SET, and a session was whatever you happened to do that day. That was fine
 * while nothing needed to point at a session — but a Check In does, so sessions
 * now have stable ids.
 *
 * Records created from Build 28 onward carry `sid`. Everything logged before
 * that has none, so readers cluster by time gap instead (see engine/session.js).
 * Nothing is migrated and nothing is rewritten: old saves keep working, they
 * just get their sessions derived rather than stored.
 *
 * 3 hours is the boundary. Long enough that a slow session with a phone call in
 * the middle stays one workout; short enough that a morning lift and an evening
 * run read as the two separate sessions they are.
 */
const SESSION_GAP_MS = 3 * 3600000;

// The session a record at time `t` belongs to: the most recent one still inside
// the gap window, or a brand new id.
function resolveSessionId(d, t) {
  let best = null;
  for (const e of [...(d.lifts || []), ...(d.cardio || [])]) {
    if (!e || e.t > t) continue;
    if (t - e.t > SESSION_GAP_MS) continue;
    if (!best || e.t > best.t) best = e;
  }
  if (best && best.sid) return best.sid;
  return 's' + uid();
}

/* ============================== social XP ================================
 * The Check In economy, in ONE place. Every value here is mirrored by
 * levl_social_xp_amount() in sql/2805_social_xp.sql, which is the authority —
 * these constants exist so the UI can show "+30 XP" before the round trip
 * completes, not so the client can decide what it earns.
 *
 * Calibrated against this engine, not picked because they sounded right:
 *
 *   setXP(80, 8, 8)                    ~ 39 XP   one working set
 *   a 14-set session incl. day bonus   ~ 440 XP
 *   xpForLevel(27) - xpForLevel(26)    = 1320 XP  one mid-game level
 *   DUEL_TIERS.contender.reward.xp     = 500 XP   a won 7-day duel
 *   PACK_XP_STEP                       = 1200 XP  one training pack
 *   INTEGRITY.DAILY_XP_CAP             = 4000 XP
 *
 * CHECK_IN at 30 is about one accessory set: 6.8% of a session, 0.75% of the
 * daily cap. Enough to notice, nowhere near enough to be a strategy.
 *
 * VERIFIED at +60 is only reachable on a day you logged a real workout — one
 * that already paid its own ~440 XP. It rewards sharing training you actually
 * did; it can never stand in for doing it.
 *
 * Photo-only ceiling is 30/day: a full year of posting without ever training is
 * ~11,000 XP (about level 15), which four sessions a week produces in six
 * weeks. Reactions and comments are worth zero, given or received — social
 * popularity must never be a way to level up.
 */
const SOCIAL_XP = {
  CHECK_IN: 30,
  VERIFIED_BONUS: 60,
  STREAK_7: 120,
  STREAK_30: 350,
  STREAK_100: 900,
};
// What a Check In is worth today, before the server confirms it.
const socialXPPreview = (verified) =>
  SOCIAL_XP.CHECK_IN + (verified ? SOCIAL_XP.VERIFIED_BONUS : 0);

/* ------------------------- pure state transitions ------------------------ */
const DEFAULT_DATA = {
  v: 3, name: 'Player', unit: 'kg', xp: 0,
  // physical profile — used for realistic-lift validation and stat context.
  bodyweight: 0, heightCm: 0, age: 0, sex: '', activity: '', experience: '',
  profileComplete: false,
  stats: { STR: 0, PWR: 0, END: 0, VIT: 0, MOB: 0, DIS: 0 },
  avatar: { skin: 0, hair: 0, outfit: 0, accent: 0 },
  // cosmetics: ids the player owns, what they have equipped per slot, and the
  // running total of currency/XP they have spent (so balances derive from XP).
  owned: ['helm_none', 'back_none', 'weapon_blade', 'aura_ring', 'emote_flex'],
  equipped: { helm: 'helm_none', back: 'back_none', weapon: 'weapon_blade', aura: 'aura_ring', emote: 'emote_flex' },
  spentCoins: 0, spentXP: 0,
  // 1v1 weekly duels + coins granted from duel rewards (counted in balance).
  duels: [], bonusCoins: 0,
  // Forge Pass (seasonal battle pass): premium ownership, claimed tier rewards,
  // and coins granted by the pass (added to bonusCoins on claim).
  passPremium: false, passClaimed: [],
  // Packs: unopened pack inventory (by type), plus collected titles/decorations
  // and which are equipped.
  packs: { standard: 0, prime: 0, elite: 0 },
  titles: [], decorations: [],
  equippedTitle: null, equippedDecoration: 'deco_none',
  packsOpened: 0,
  // Forge: crafting materials, per-item forge levels, and pity ("temper").
  materials: { mat_ore: 0, mat_steel: 0, mat_ember: 0, mat_relic: 0 },
  forgeLevels: {}, forgeTemper: {},
  // Saved workout days (e.g. "Chest & Tris") for one-tap logging on the Train tab.
  workoutDays: [],
  // Rest between sets, in seconds. 0 turns the timer off entirely.
  restSeconds: 90,
  lifts: [], cardio: [],
};

function grant(nd, alloc) {
  for (const k of Object.keys(alloc)) nd.stats[k] = (nd.stats[k] || 0) + alloc[k];
}

/* `opts` exists for ONE caller: editEntryPure below, which rebuilds an entry
 * that has already been logged once.
 *
 *   noBonus    — the first-session-of-the-day bonus was granted when the entry
 *                was originally logged and is NOT refunded when it is removed,
 *                so re-granting it on every edit would mint XP out of nothing.
 *   noMaterial — likewise for PR material drops. Without this, nudging a weight
 *                back and forth between two values farms Steel indefinitely.
 *
 * Both default to off, so normal logging is completely unchanged.
 */
function applyLift(d, t, exName, w, r, rpe, opts) {
  const ex = EXERCISES.find((e) => e.n === exName) || { p: 'STR', s: null };
  let prev = 0;
  for (const l of d.lifts) if (l.ex === exName && l.e1rm > prev) prev = l.e1rm;
  const e1 = w > 0 ? +epley(w, r).toFixed(1) : 0;
  const isPR = e1 > 0 && prev > 0 && e1 > prev;
  // XP must be unit-independent: normalize the load to kg first, or a lb user
  // would earn ~1.5x the XP of a kg user for the exact same physical lift.
  const rawXp = setXP(toKg(w, d.unit || 'kg'), r, rpe, isPR);
  const xp = cappedXP(d, rawXp, t);
  const flagged = xp < rawXp; // hit the daily cap → overflow earned nothing
  const alloc = { [ex.p]: xp };
  if (ex.s) alloc[ex.s] = (alloc[ex.s] || 0) + Math.round(xp * 0.4);
  const firstToday = ![...d.lifts, ...d.cardio].some((e) => dayKeyOf(e.t) === dayKeyOf(t));
  const sid = resolveSessionId(d, t);
  const entry = { id: uid(), t, sid, kind: 'lift', ex: exName, w, r, rpe, e1rm: e1, pr: isPR, xp, alloc, flagged: flagged || undefined };
  const nd = { ...d, lifts: [...d.lifts, entry], cardio: [...d.cardio], stats: { ...d.stats }, materials: { ...(d.materials || {}) } };
  grant(nd, alloc);
  // Personal records drop forge materials — the crafting economy is fed by real
  // training, never by spending. A PR is the only reliable source of Steel.
  let matDrop = null;
  if (isPR && !flagged && !(opts && opts.noMaterial)) {
    const roll = ((t % 100) / 100);
    const mid = roll < 0.72 ? 'mat_ore' : roll < 0.95 ? 'mat_steel' : 'mat_ember';
    nd.materials[mid] = (nd.materials[mid] || 0) + 1;
    matDrop = mid;
  }
  let bonus = 0;
  if (firstToday && !(opts && opts.noBonus)) {
    const streak = calcStreak([...d.lifts, ...d.cardio], t);
    const disB = 20 + Math.min(streak, 15) * 2;
    grant(nd, { DIS: disB, VIT: 10 });
    bonus = disB + 10;
  }
  nd.xp = d.xp + xp + bonus;
  // `id` is returned so the screen that just logged this set can offer to edit
  // or delete it without having to go hunting through the save for it.
  return { nd, meta: { id: entry.id, xp, bonus, isPR, e1, prev, capped: flagged, matDrop } };
}

function applyCardio(d, t, typeName, mins, dist, intensityKey, opts) {
  const ct = CARDIO_TYPES.find((c) => c.n === typeName) || CARDIO_TYPES[0];
  const inten = INTENSITIES.find((i) => i.k === intensityKey) || INTENSITIES[1];
  const rawXp = cardioXPCalc(mins, inten.mult);
  const xp = cappedXP(d, rawXp, t);
  const flagged = xp < rawXp;
  const alloc = { [ct.p]: xp };
  if (ct.s) alloc[ct.s] = (alloc[ct.s] || 0) + Math.round(xp * 0.4);
  const firstToday = ![...d.lifts, ...d.cardio].some((e) => dayKeyOf(e.t) === dayKeyOf(t));
  const sid = resolveSessionId(d, t);
  const entry = { id: uid(), t, sid, kind: 'cardio', ex: typeName, mins, dist: dist || 0, intensity: inten.label, xp, alloc, flagged: flagged || undefined };
  const nd = { ...d, lifts: [...d.lifts], cardio: [...d.cardio, entry], stats: { ...d.stats } };
  grant(nd, alloc);
  let bonus = 0;
  if (firstToday && !(opts && opts.noBonus)) {
    const streak = calcStreak([...d.lifts, ...d.cardio], t);
    const disB = 20 + Math.min(streak, 15) * 2;
    grant(nd, { DIS: disB, VIT: 10 });
    bonus = disB + 10;
  }
  nd.xp = d.xp + xp + bonus;
  return { nd, meta: { id: entry.id, xp, bonus, capped: flagged } };
}

function removeEntryPure(d, id) {
  const e = [...d.lifts, ...d.cardio].find((x) => x.id === id);
  if (!e) return { nd: d, meta: null };
  const nd = {
    ...d, xp: Math.max(0, d.xp - e.xp), stats: { ...d.stats },
    lifts: d.lifts.filter((x) => x.id !== id),
    cardio: d.cardio.filter((x) => x.id !== id),
  };
  for (const k of Object.keys(e.alloc || {})) nd.stats[k] = Math.max(0, (nd.stats[k] || 0) - e.alloc[k]);
  return { nd, meta: e };
}

/* A cardio entry stores its intensity as the LABEL ('Moderate'), because that is
 * what history displays. Re-applying one needs the key back. */
const intensityKeyOf = (v) => {
  const row = INTENSITIES.find((i) => i.k === v || i.label === v);
  return row ? row.k : 'moderate';
};

/* ---------------------------------------------------------------------------
 * Editing an entry that is already logged.
 *
 * People mistype sets — 100 instead of 10, reps in the weight box — and until
 * now the only repair was to delete and re-log, which moved the set's timestamp
 * to now and so moved it into the wrong session and the wrong day.
 *
 * An edit is therefore a REBUILD, not a patch: remove the entry, then apply the
 * corrected values at its ORIGINAL timestamp through the very same code that
 * created it. That is what keeps the save internally consistent — XP, the stat
 * allocation, the daily cap, the PR test and the session id are all re-derived
 * rather than hand-adjusted, so stats can never drift away from the entries
 * that produced them.
 *
 * The two things NOT re-derived are the first-session bonus and PR material
 * drops (see applyLift's `opts`): neither is refunded when an entry is removed,
 * so re-granting them would make editing a source of free XP and free materials.
 * ------------------------------------------------------------------------ */
function editEntryPure(d, id, patch) {
  const p = patch || {};
  const isCardio = (d.cardio || []).some((x) => x.id === id);
  const existing = [...(d.lifts || []), ...(d.cardio || [])].find((x) => x.id === id);
  if (!existing) return { nd: d, meta: null };

  const { nd: cleaned } = removeEntryPure(d, id);
  const t = existing.t;
  const pick = (next, fallback) => (next == null || next === '' ? fallback : next);

  if (isCardio) {
    const res = applyCardio(
      cleaned, t,
      pick(p.ex, existing.ex),
      Math.max(0, parseFloat(pick(p.mins, existing.mins)) || 0),
      Math.max(0, parseFloat(pick(p.dist, existing.dist || 0)) || 0),
      intensityKeyOf(pick(p.intensity, existing.intensity)),
      { noBonus: true },
    );
    return { nd: res.nd, meta: { ...res.meta, kind: 'cardio', edited: true } };
  }

  const res = applyLift(
    cleaned, t,
    pick(p.ex, existing.ex),
    Math.max(0, parseFloat(pick(p.w, existing.w)) || 0),
    Math.max(1, parseInt(pick(p.r, existing.r), 10) || 1),
    Math.max(6, Math.min(10, parseInt(pick(p.rpe, existing.rpe), 10) || 8)),
    { noBonus: true, noMaterial: true },
  );
  return { nd: res.nd, meta: { ...res.meta, kind: 'lift', edited: true } };
}

/* ------------------------------ derivations ------------------------------ */
function computeDerived(data, now) {
  const lifts = data.lifts, cardio = data.cardio;
  const all = [...lifts, ...cardio];
  const daySet = [...new Set(all.map((e) => dayKeyOf(e.t)))];
  const streak = calcStreak(all, now);

  const best = {};
  for (const l of lifts) if (l.e1rm) {
    if (!best[l.ex] || l.e1rm > best[l.ex].e1rm) best[l.ex] = { e1rm: l.e1rm, t: l.t };
  }

  const level = levelFromXP(data.xp);
  const curBase = xpForLevel(level), nextNeed = xpForLevel(level + 1);
  const levelPct = Math.min(100, Math.round(((data.xp - curBase) / Math.max(nextNeed - curBase, 1)) * 100));

  // Fitness Rating over trailing 28 days
  const d28 = now - 28 * DAY, d14 = now - 14 * DAY;
  const days28 = new Set(all.filter((e) => e.t >= d28).map((e) => dayKeyOf(e.t)));
  const consistency = Math.min(1, days28.size / 16);
  const volNow = lifts.filter((l) => l.t >= d14).reduce((s, l) => s + l.w * l.r, 0);
  const volPrev = lifts.filter((l) => l.t >= d28 && l.t < d14).reduce((s, l) => s + l.w * l.r, 0);
  const trend = volPrev > 0
    ? Math.max(0, Math.min(1, 0.5 + (volNow - volPrev) / volPrev))
    : (volNow > 0 ? 0.6 : 0);
  const prs28 = lifts.filter((l) => l.t >= d28 && l.pr).length;
  const prScore = Math.min(1, prs28 / 6);
  const share = {}; let tot28 = 0;
  for (const e of all) if (e.t >= d28) {
    for (const k of Object.keys(e.alloc || {})) { share[k] = (share[k] || 0) + e.alloc[k]; tot28 += e.alloc[k]; }
  }
  let balance = 0;
  if (tot28 > 0) {
    const shares = STATS.map((s) => (share[s] || 0) / tot28);
    const mean = 1 / 6;
    const sd = Math.sqrt(shares.reduce((s, x) => s + (x - mean) * (x - mean), 0) / 6);
    balance = Math.max(0, 1 - sd / 0.3727);
  }
  const fr = Math.round(4200 * (0.35 * consistency + 0.25 * trend + 0.25 * prScore + 0.15 * balance));
  const placed = daySet.length >= 5;
  const tier = tierForFR(fr);

  // Weekly quests
  const wk = startOfWeek(now), lastWk = wk - 7 * DAY;
  const sessionsThisWeek = new Set(all.filter((e) => e.t >= wk).map((e) => dayKeyOf(e.t))).size;
  const volThisWeek = lifts.filter((l) => l.t >= wk).reduce((s, l) => s + l.w * l.r, 0);
  const volLastWeek = lifts.filter((l) => l.t >= lastWk && l.t < wk).reduce((s, l) => s + l.w * l.r, 0);
  const prThisWeek = lifts.some((l) => l.t >= wk && l.pr);
  const cardioThisWeek = cardio.some((e) => e.t >= wk);

  const weeklyVol = [];
  for (let i = 7; i >= 0; i--) {
    const s = wk - i * 7 * DAY, e = s + 7 * DAY;
    weeklyVol.push({
      w: fmtShort(s),
      vol: Math.round(lifts.filter((l) => l.t >= s && l.t < e).reduce((a, l) => a + l.w * l.r, 0)),
    });
  }
  const statLevels = STATS.map((s) => ({ stat: s, level: statLevel(data.stats[s] || 0) }));
  const recentPRs = lifts.filter((l) => l.pr).sort((a, b) => b.t - a.t).slice(0, 5);

  return {
    daySet, streak, best, level, levelPct, nextNeed, curBase, fr, tier,
    division: divisionForFR(fr, tier), placed,
    placementCount: Math.min(daySet.length, 5),
    frParts: { consistency, trend, prScore, balance },
    quests: { sessionsThisWeek, volThisWeek, volLastWeek, prThisWeek, cardioThisWeek },
    weeklyVol, statLevels, recentPRs,
    title: titleForLevel(level), season: seasonLabel(now),
  };
}

/* ------------------------------- demo save ------------------------------- */
function buildDemoData() {
  let d = JSON.parse(JSON.stringify(DEFAULT_DATA));
  d.name = 'Demo Hunter';
  const now = Date.now();
  const sessions = [];
  for (let k = 0; k < 18; k++) sessions.push({ daysAgo: 31 - Math.round(k * 1.75), idx: k });
  for (const s of sessions) {
    const t = now - s.daysAgo * DAY + 9 * 3600000;
    const g = s.idx * 0.9;
    const type = s.idx % 4;
    if (type === 0) {
      d = applyLift(d, t, 'Barbell Bench Press', roundLoad(57.5 + g, 'kg'), 8, 8).nd;
      d = applyLift(d, t + 600000, 'Barbell Bench Press', roundLoad(57.5 + g, 'kg'), 7, 9).nd;
      d = applyLift(d, t + 1200000, 'Overhead Barbell Press', roundLoad(35 + g * 0.5, 'kg'), 8, 8).nd;
      d = applyLift(d, t + 1800000, 'Tricep Pushdown', roundLoad(25 + g * 0.4, 'kg'), 12, 8).nd;
    } else if (type === 1) {
      d = applyLift(d, t, 'Deadlift', roundLoad(102.5 + g * 1.6, 'kg'), 5, 8).nd;
      d = applyLift(d, t + 600000, 'Bent-Over Barbell Row', roundLoad(55 + g * 0.7, 'kg'), 8, 8).nd;
      d = applyLift(d, t + 1200000, 'Lat Pulldown', roundLoad(50 + g * 0.6, 'kg'), 10, 8).nd;
      d = applyLift(d, t + 1800000, 'Barbell Curl', roundLoad(27.5 + g * 0.3, 'kg'), 10, 9).nd;
    } else if (type === 2) {
      d = applyLift(d, t, 'Back Squat', roundLoad(77.5 + g * 1.3, 'kg'), 6, 8).nd;
      d = applyLift(d, t + 600000, 'Romanian Deadlift', roundLoad(62.5 + g, 'kg'), 8, 8).nd;
      d = applyLift(d, t + 1200000, 'Leg Press', roundLoad(120 + g * 2, 'kg'), 10, 8).nd;
      d = applyLift(d, t + 1800000, 'Hanging Leg Raise', 0, 12, 8).nd;
    } else {
      d = applyCardio(d, t, 'Run (Zone 2)', 30 + (s.idx % 3) * 5, 5, 'moderate').nd;
      d = applyCardio(d, t + 2400000, 'Stretching / Mobility', 15, 0, 'light').nd;
    }
  }
  // Demo-only stipend: credit extra lifetime XP so the Forge shop is fully
  // explorable in the demo (coins derive from XP, so this tops up coins too).
  // Showcase convenience only — not part of the real earning loop.
  // Demo duel: a live 1v1 already 4 days in, so the versus board is populated
  // with real scores from the demo training sessions above.
  const dsd = new Date(now); dsd.setHours(0, 0, 0, 0);
  d.duels = [createDuel('contender', now, 777, dsd.getTime() - 4 * DAY)];
  d.xp += 40000;
  return d;
}


// Expanded palettes (battle-royale style range: more skins, vivid hair, armored outfits)
const SKINS = ['#f5cfae', '#e8b48c', '#c98d5f', '#9c6b45', '#7a4f33', '#5c3a24', '#d9a86c', '#f2d5c0'];
const HAIRS = ['#8b5cf6', '#f0b429', '#15181f', '#e5e7eb', '#ef4444', '#3ecf8e', '#22d3ee', '#ec4899', '#a3e635', '#f97316'];
const OUTFITS = ['#151a26', '#26314a', '#3b1060', '#5c1023', '#0d3b32', '#4a2c00', '#1e293b', '#3f0d3f'];
const ACCENTS = ['#f0b429', '#22d3ee', '#c26bf0', '#3ecf8e', '#f0525f', '#a3e635', '#fb7185', '#38bdf8'];
const PART_LABEL = {
  DIS: 'Head & Helm', STR: 'Arms & Gauntlets', END: 'Chest Core',
  VIT: 'Core & Belt', PWR: 'Legs & Greaves', MOB: 'Shoulders & Aura',
};

// Rank tiers grant escalating armor tiers on the character automatically.
// rankStyleFor returns a visual grade 0..6 from the player's tier index.
const RANK_STYLE = [
  { grade: 0, plate: 0.0, trim: '#7c6142', spikes: 0, cape: false, label: 'Cloth' },        // Bronze
  { grade: 1, plate: 0.25, trim: '#c3ccd9', spikes: 0, cape: false, label: 'Padded' },       // Silver
  { grade: 2, plate: 0.45, trim: '#f2c14e', spikes: 1, cape: false, label: 'Plated' },        // Gold
  { grade: 3, plate: 0.6, trim: '#35d0e0', spikes: 1, cape: true, label: 'Knightly' },        // Platinum
  { grade: 4, plate: 0.75, trim: '#7c7cf5', spikes: 2, cape: true, label: 'Apex' },      // Diamond
  { grade: 5, plate: 0.9, trim: '#c26bf0', spikes: 2, cape: true, label: 'Champion' },         // Champion
  { grade: 6, plate: 1.0, trim: '#f04e5e', spikes: 3, cape: true, label: 'Mythic' },           // Grandmaster
];
function rankStyleFor(tier) {
  const idx = Math.max(0, TIERS.findIndex((t) => t.name === tier.name));
  return RANK_STYLE[Math.min(idx, RANK_STYLE.length - 1)];
}

// ---- Cosmetics catalog (all cosmetic-only; never affects rank/XP/FR) ----
// slot: helm | back | weapon | aura | emote. rarity drives price + color.
// RARITY LADDER — the learned ARPG convention. Legendary is ORANGE, not gold:
// gold is the app's brand accent, and letting it double as a rarity blurred the
// hierarchy. Orange is also what players already expect from Diablo/WoW.
const RARITY = {
  common:    { name: 'Common',    color: '#8e97a8', coins: 150,  xp: 1500 },
  rare:      { name: 'Rare',      color: '#3d9bff', coins: 400,  xp: 4000 },
  epic:      { name: 'Epic',      color: '#a66bff', coins: 900,  xp: 9000 },
  legendary: { name: 'Legendary', color: '#ff8a3d', coins: 1800, xp: 18000 },
  mythic:    { name: 'Mythic',    color: '#ff4d6d', coins: 3200, xp: 32000, reqTier: 'Champion' },
};
const CO = (id, slot, name, rarity, emoji, free) => ({ id, slot, name, rarity, emoji, free: !!free });
const COSMETICS = [
  // Helmets / headgear (DIS region)
  CO('helm_none', 'helm', 'No Helm', 'common', '🚫', true),
  CO('helm_hood', 'helm', 'Shadow Hood', 'common', '🧥'),
  CO('helm_visor', 'helm', 'Neon Visor', 'rare', '🕶️'),
  CO('helm_horns', 'helm', 'Warhorns', 'epic', '🐗'),
  CO('helm_crown', 'helm', 'Apex Crown', 'legendary', '👑'),
  CO('helm_wraith', 'helm', 'Wraith Mask', 'mythic', '💀'),
  // Back bling (behind torso)
  CO('back_none', 'back', 'No Back Gear', 'common', '🚫', true),
  CO('back_wings', 'back', 'Ember Wings', 'epic', '🪽'),
  CO('back_pack', 'back', 'Ranger Pack', 'rare', '🎒'),
  CO('back_reactor', 'back', 'Core Reactor', 'legendary', '🔋'),
  CO('back_dragon', 'back', 'Dragon Sigil', 'mythic', '🐉'),
  // Weapons (MOB region, replaces/augments the blade)
  CO('weapon_blade', 'weapon', 'Energy Blade', 'common', '🗡️', true),
  CO('weapon_axe', 'weapon', 'Plasma Axe', 'rare', '🪓'),
  CO('weapon_scythe', 'weapon', 'Void Scythe', 'epic', '⚰️'),
  CO('weapon_hammer', 'weapon', 'Titan Hammer', 'legendary', '🔨'),
  CO('weapon_glaive', 'weapon', 'Storm Glaive', 'mythic', '⚡'),
  // Auras (ground/orbit FX)
  CO('aura_ring', 'aura', 'Aura Ring', 'common', '⭕', true),
  CO('aura_flames', 'aura', 'Ember Aura', 'rare', '🔥'),
  CO('aura_frost', 'aura', 'Frost Aura', 'epic', '❄️'),
  CO('aura_galaxy', 'aura', 'Galaxy Aura', 'legendary', '🌌'),
  CO('aura_inferno', 'aura', 'Inferno Storm', 'mythic', '☄️'),
  // Emotes (victory pose)
  CO('emote_flex', 'emote', 'Flex', 'common', '💪', true),
  CO('emote_wave', 'emote', 'Salute', 'common', '🫡'),
  CO('emote_dab', 'emote', 'Power Pose', 'rare', '🕺'),
  CO('emote_floss', 'emote', 'Victory Dance', 'epic', '🎉'),
];

/* ================================ packs ================================== */
// Reward packs: earned by leveling / duels / streaks, opened for one random
// reward. Rewards span XP, cosmetics, titles and profile decorations, drawn
// from a rarity-weighted table. All pure + deterministic-testable.

// Titles (displayed under the hunter name) — cosmetic only.
const PACK_TITLES = [
  { id: 'title_rookie', name: 'The Rookie', rarity: 'common' },
  { id: 'title_grinder', name: 'The Grinder', rarity: 'common' },
  { id: 'title_ironborn', name: 'Ironborn', rarity: 'rare' },
  { id: 'title_relentless', name: 'The Relentless', rarity: 'rare' },
  { id: 'title_ascendant', name: 'Apex', rarity: 'epic' },
  { id: 'title_mythbreaker', name: 'Mythbreaker', rarity: 'epic' },
  { id: 'title_immortal', name: 'The Immortal', rarity: 'legendary' },
  { id: 'title_apex', name: 'Apex Predator', rarity: 'legendary' },
];
const titleById = (id) => PACK_TITLES.find((t) => t.id === id) || null;

// Profile decorations — a colored frame/border around the hunter emblem.
const DECORATIONS = [
  { id: 'deco_none', name: 'No Border', rarity: 'common', color: '#252c3c' },
  { id: 'deco_bronze', name: 'Bronze Frame', rarity: 'common', color: '#b08d57' },
  { id: 'deco_steel', name: 'Steel Frame', rarity: 'rare', color: '#7f8a9e' },
  { id: 'deco_amethyst', name: 'Amethyst Frame', rarity: 'epic', color: '#c26bf0' },
  { id: 'deco_solar', name: 'Solar Frame', rarity: 'legendary', color: '#f5c542' },
  { id: 'deco_aurora', name: 'Aurora Frame', rarity: 'legendary', color: '#3ddc97' },
];
const decorationById = (id) => DECORATIONS.find((d) => d.id === id) || DECORATIONS[0];

// Pack types — each defines how many rewards and its rarity weighting.
const PACK_TYPES = {
  standard: {
    key: 'standard', name: 'Standard Pack', emoji: '📦', color: '#8b93a6',
    // rarity odds (must sum to 1)
    odds: { common: 0.62, rare: 0.28, epic: 0.08, legendary: 0.02 },
    coinRange: { common: [25, 50], rare: [50, 90], epic: [90, 150], legendary: [150, 260] },
  },
  prime: {
    key: 'prime', name: 'Prime Pack', emoji: '🎁', color: '#4b8ef0',
    odds: { common: 0.35, rare: 0.42, epic: 0.18, legendary: 0.05 },
    coinRange: { common: [45, 80], rare: [80, 135], epic: [135, 220], legendary: [220, 380] },
  },
  elite: {
    key: 'elite', name: 'Elite Pack', emoji: '🏆', color: '#f5c542',
    odds: { common: 0.10, rare: 0.40, epic: 0.35, legendary: 0.15 },
    coinRange: { common: [80, 125], rare: [125, 200], epic: [200, 310], legendary: [310, 540] },
  },
};
const packTypeByKey = (k) => PACK_TYPES[k] || PACK_TYPES.standard;

// weighted rarity roll from a pack's odds using a supplied rng (0..1)
function rollRarity(odds, rng) {
  const r = rng();
  let acc = 0;
  for (const key of ['common', 'rare', 'epic', 'legendary']) {
    acc += odds[key] || 0;
    if (r <= acc) return key;
  }
  return 'legendary';
}

// Pool of unowned cosmetics/titles/decorations at a given rarity.
function rewardPoolAt(data, rarity) {
  const owned = new Set(data.owned || []);
  const titles = new Set(data.titles || []);
  const decos = new Set(data.decorations || []);
  const pool = [];
  COSMETICS.forEach((c) => {
    // map mythic cosmetics into the legendary bucket for pack purposes
    const rr = c.rarity === 'mythic' ? 'legendary' : c.rarity;
    if (rr === rarity && !c.free && !owned.has(c.id)) pool.push({ kind: 'cosmetic', id: c.id, name: c.name, emoji: c.emoji, slot: c.slot });
  });
  PACK_TITLES.forEach((t) => { if (t.rarity === rarity && !titles.has(t.id)) pool.push({ kind: 'title', id: t.id, name: t.name, emoji: '🏷️' }); });
  DECORATIONS.forEach((d) => { if (d.rarity === rarity && d.id !== 'deco_none' && !decos.has(d.id)) pool.push({ kind: 'decoration', id: d.id, name: d.name, emoji: '🖼️', color: d.color }); });
  return pool;
}

// Open one pack: returns a reward object { rarity, kind, ... }. Pure — rng
// defaults to Math.random but can be injected for deterministic tests.
function openPack(data, packKey, rng) {
  const r = rng || Math.random;
  const pack = packTypeByKey(packKey);
  const rarity = rollRarity(pack.odds, r);
  const pool = rewardPoolAt(data, rarity);
  const [lo, hi] = pack.coinRange[rarity];
  const coinRoll = () => {
    const coins = Math.round(lo + r() * (hi - lo));
    return { rarity, kind: 'coins', amount: coins, name: coins + ' Coins', emoji: '🪙' };
  };
  // Forge materials matched to the rolled rarity — this is the Forge's supply.
  const matRoll = () => {
    const mat = MATERIALS.find((m) => m.rarity === rarity) || MATERIALS[0];
    const amount = rarity === 'legendary' ? 1 : rarity === 'epic' ? 1 + Math.floor(r() * 2) : 2 + Math.floor(r() * 4);
    return {
      rarity, kind: 'material', id: mat.id, amount,
      name: amount + '× ' + mat.name, emoji: '⬢', color: mat.color,
    };
  };
  // No collectible left at this rarity → split between XP and materials.
  if (pool.length === 0) return r() < 0.55 ? coinRoll() : matRoll();
  const roll = r();
  if (roll < 0.45) {
    const pick = pool[Math.floor(r() * pool.length)];
    return { rarity, ...pick };
  }
  if (roll < 0.72) return coinRoll();
  return matRoll();
}

// Apply a pack reward to data (pure), returning new data.
function applyPackReward(d, reward) {
  const nd = { ...d };
  // Coins, never XP — packs must not drive levelling.
  if (reward.kind === 'coins') { nd.bonusCoins = (d.bonusCoins || 0) + reward.amount; return nd; }
  if (reward.kind === 'xp') { nd.bonusCoins = (d.bonusCoins || 0) + Math.round(reward.amount / 10); return nd; } // legacy saves
  if (reward.kind === 'cosmetic') { nd.owned = Array.from(new Set([...(d.owned || []), reward.id])); return nd; }
  if (reward.kind === 'title') { nd.titles = Array.from(new Set([...(d.titles || []), reward.id])); return nd; }
  if (reward.kind === 'decoration') { nd.decorations = Array.from(new Set([...(d.decorations || []), reward.id])); return nd; }
  if (reward.kind === 'material') {
    nd.materials = { ...(d.materials || {}) };
    nd.materials[reward.id] = (nd.materials[reward.id] || 0) + (reward.amount || 1);
    return nd;
  }
  return nd;
}

/* ================================ forge ================================== */
// A crafting system for COSMETICS ONLY. Forging raises an item's visual tier and
// your "Forge Power" (a flex number shown on your profile). It NEVER touches
// stats, XP, Fitness Rating or rank — that rule is what keeps the ladder honest,
// so no amount of coins or materials can buy competitive advantage.

const MATERIALS = [
  { id: 'mat_ore',   name: 'Iron Ore',        rarity: 'common',    color: '#8b93a6' },
  { id: 'mat_steel', name: 'Steel Ingot',     rarity: 'rare',      color: '#4b8ef0' },
  { id: 'mat_ember', name: 'Ember Core',      rarity: 'epic',      color: '#c26bf0' },
  { id: 'mat_relic', name: 'Apex Relic', rarity: 'legendary', color: '#ffc933' },
];
const materialById = (id) => MATERIALS.find((m) => m.id === id) || null;
const materialBalance = (d, id) => ((d.materials || {})[id] || 0);

const FORGE_MAX = 5;
// Visual grade names for each forge level.
const FORGE_TIERS = ['Base', 'Honed', 'Tempered', 'Radiant', 'Apex', 'Mythforged'];
const forgeLevelOf = (d, itemId) => ((d.forgeLevels || {})[itemId] || 0);
const forgeTemperOf = (d, itemId) => ((d.forgeTemper || {})[itemId] || 0);

// Cost scales with the item's rarity and its current forge level. The coin curve
// is intentionally exponential (power scaling) so each grade costs meaningfully
// more than the last — the top grades are a real climb, not a formality.
function forgeCost(item, level) {
  const rar = RARITY[item.rarity] || RARITY.common;
  const rarMul = { common: 1, rare: 1.6, epic: 2.4, legendary: 3.4, mythic: 4.2 }[item.rarity] || 1;
  const step = level + 1;
  const coins = Math.round(220 * rarMul * Math.pow(2.0, level));
  const mats = {};
  // Ore always; heavier materials required (and sooner) at higher levels.
  mats.mat_ore = Math.round(2 * step * rarMul);
  if (step >= 2) mats.mat_steel = Math.round(1 * (step - 1) * rarMul);
  if (step >= 3) mats.mat_ember = Math.round(1 * (step - 2) * rarMul);
  if (step >= 5) mats.mat_relic = 1;
  return { coins, mats };
}

// Success chance falls as the item gets stronger. Every failure "tempers" the
// item (+8% next time), so a bad streak can't stall you forever. Level 0 is a
// guaranteed forge so getting started never feels punishing.
function forgeChance(level, temper) {
  const table = [1.0, 0.85, 0.62, 0.42, 0.26];
  const base = table[level] != null ? table[level] : 0.26;
  if (base >= 1) return 1;   // a guaranteed forge must actually be guaranteed
  return Math.min(0.98, base + (temper || 0) * 0.08);
}

// Forge Power: a pure flex stat. Shown off, never scored.
const FORGE_POWER_PER_LEVEL = { common: 10, rare: 25, epic: 55, legendary: 110, mythic: 160 };
function forgePower(d) {
  let total = 0;
  Object.keys(d.forgeLevels || {}).forEach((id) => {
    const item = COSMETICS.find((c) => c.id === id);
    if (!item) return;
    total += (FORGE_POWER_PER_LEVEL[item.rarity] || 10) * (d.forgeLevels[id] || 0);
  });
  return total;
}

// Can this item be forged right now?
function canForge(d, itemId) {
  const item = COSMETICS.find((c) => c.id === itemId);
  if (!item) return { ok: false, reason: 'Unknown item' };
  if (!(d.owned || []).includes(itemId) && !item.free) return { ok: false, reason: 'You do not own this item' };
  const level = forgeLevelOf(d, itemId);
  if (level >= FORGE_MAX) return { ok: false, reason: 'Already at maximum forge level' };
  const cost = forgeCost(item, level);
  if (coinBalance(d) < cost.coins) return { ok: false, reason: 'Not enough coins' };
  for (const mid of Object.keys(cost.mats)) {
    if (materialBalance(d, mid) < cost.mats[mid]) {
      return { ok: false, reason: 'Not enough ' + (materialById(mid) || { name: 'materials' }).name };
    }
  }
  return { ok: true, cost, level, chance: forgeChance(level, forgeTemperOf(d, itemId)) };
}

// Attempt an upgrade. Pure; rng injectable for tests.
// On failure the item is NEVER destroyed — you lose the cost but gain temper.
function attemptForge(d, itemId, rng) {
  const r = rng || Math.random;
  const check = canForge(d, itemId);
  if (!check.ok) return { nd: d, result: 'blocked', reason: check.reason };
  const { cost, level, chance } = check;

  // spend
  const materials = { ...(d.materials || {}) };
  Object.keys(cost.mats).forEach((mid) => { materials[mid] = (materials[mid] || 0) - cost.mats[mid]; });
  let nd = { ...d, materials, spentCoins: (d.spentCoins || 0) + cost.coins };

  const success = r() < chance;
  const forgeLevels = { ...(d.forgeLevels || {}) };
  const forgeTemper = { ...(d.forgeTemper || {}) };
  if (success) {
    forgeLevels[itemId] = level + 1;
    forgeTemper[itemId] = 0;               // temper resets on success
  } else {
    forgeTemper[itemId] = (forgeTemper[itemId] || 0) + 1;   // pity builds
  }
  nd = { ...nd, forgeLevels, forgeTemper };
  return {
    nd,
    result: success ? 'success' : 'fail',
    newLevel: success ? level + 1 : level,
    tier: FORGE_TIERS[success ? level + 1 : level],
    chance, cost,
    temper: forgeTemper[itemId] || 0,
  };
}

const SLOTS = [
  { key: 'helm', label: 'Headgear' },
  { key: 'back', label: 'Back Gear' },
  { key: 'weapon', label: 'Weapon' },
  { key: 'aura', label: 'Aura FX' },
  { key: 'emote', label: 'Emote' },
];
const cosmeticById = (id) => COSMETICS.find((c) => c.id === id) || COSMETICS[0];

/* =============================== forge pass =============================== */
// A seasonal battle pass: 20 tiers, each unlocked by reaching a character
// LEVEL (levels come from XP, so training is the only way to climb). Every
// tier has a FREE reward everyone earns, plus a PREMIUM reward unlocked by
// buying the pass. Rewards are cosmetics or Forge Coin bundles — never rank,
// stats or Fitness Rating, so the anti-pay-to-win rule holds.
const PASS_PREMIUM_COST = 2500; // Forge Coins to unlock the premium track
const PASS_SEASON_TIERS = 20;
// reward kinds: { coins: n } | { cosmetic: id } | { xp: n }
const FORGE_PASS = (() => {
  // Cosmetic ids reserved for the pass (exist in COSMETICS, marked pass-only
  // by not being purchasable in the normal shop grid — see PASS_ONLY below).
  const T = [];
  const freeCoin = [40, 0, 60, 0, 80, 0, 100, 0, 120, 0, 150, 0, 180, 0, 220, 0, 260, 0, 320, 500];
  const premCoin = [80, 120, 100, 150, 140, 200, 160, 240, 180, 300, 220, 350, 260, 400, 300, 500, 340, 600, 420, 900];
  // premium cosmetic drops at select tiers (rest are coin bundles)
  const premCos = { 2: 'helm_hood', 4: 'aura_flames', 6: 'weapon_axe', 8: 'back_pack',
    10: 'helm_visor', 12: 'aura_frost', 14: 'weapon_scythe', 16: 'back_wings',
    18: 'helm_horns', 20: 'aura_galaxy' };
  const freeCos = { 3: 'emote_wave', 9: 'emote_dab', 15: 'helm_hood' };
  for (let i = 1; i <= PASS_SEASON_TIERS; i++) {
    const level = i * 2; // tier 1 at level 2, tier 20 at level 40
    const free = freeCos[i] ? { cosmetic: freeCos[i] } : { coins: freeCoin[i - 1] };
    const prem = premCos[i] ? { cosmetic: premCos[i] } : { coins: premCoin[i - 1] };
    T.push({ tier: i, level, free, premium: prem });
  }
  return T;
})();
const rewardLabel = (rw) => {
  if (!rw) return '—';
  if (rw.coins != null) return rw.coins + ' 🪙';
  if (rw.xp != null) return rw.xp + ' XP';
  if (rw.cosmetic) { const c = cosmeticById(rw.cosmetic); return c.emoji + ' ' + c.name; }
  return '—';
};
// how many pass tiers a given character level has unlocked
const passTierUnlocked = (level) => {
  let n = 0;
  for (const t of FORGE_PASS) if (level >= t.level) n = t.tier;
  return n;
};
// key helpers for the claimed-list (e.g. 'f3' free tier 3, 'p8' premium tier 8)
const passKey = (lane, tier) => (lane === 'premium' ? 'p' : 'f') + tier;
// which unlocked rewards are still unclaimed for this player
function passClaimable(data, level) {
  const unlocked = passTierUnlocked(level);
  const claimed = data.passClaimed || [];
  const out = [];
  for (const row of FORGE_PASS) {
    if (row.tier > unlocked) break;
    if (!claimed.includes(passKey('free', row.tier))) out.push({ lane: 'free', row });
    if (data.passPremium && !claimed.includes(passKey('premium', row.tier))) out.push({ lane: 'premium', row });
  }
  return out;
}
// apply a single reward to a data object (pure), returning the new data
function applyPassReward(d, rw) {
  const nd = { ...d };
  if (rw.coins != null) nd.bonusCoins = (d.bonusCoins || 0) + rw.coins;
  else if (rw.xp != null) nd.xp = (d.xp || 0) + rw.xp;
  else if (rw.cosmetic) {
    nd.owned = Array.from(new Set([...(d.owned || []), rw.cosmetic]));
  }
  return nd;
}

// Economy: Forge Coins are earned passively from training (1 coin per 10 XP
// ever earned). Balances derive from lifetime XP minus what's been spent — so
// there is no way to "buy rank": spending only touches cosmetics.
// Packs earned purely from training XP. Because daily XP is capped, this can't
// be farmed — it just means consistent training keeps packs flowing instead of
// them only arriving on level-ups.
const PACK_XP_STEP = 1200;
const packsEarnedFromXP = (xp) => Math.floor(Math.max(0, xp || 0) / PACK_XP_STEP);
const packMeter = (data) => {
  const xp = Math.max(0, (data && data.xp) || 0);
  const into = xp % PACK_XP_STEP;
  return { into, need: PACK_XP_STEP, pct: (into / PACK_XP_STEP) * 100 };
};

const coinsEarnedFromXP = (xp) => Math.floor(xp / 10);
const coinBalance = (data) => Math.max(0, coinsEarnedFromXP(data.xp) + (data.bonusCoins || 0) - (data.spentCoins || 0));
const xpBalance = (data) => Math.max(0, data.xp - (data.spentXP || 0));


const BOT_NAMES = [
  'Ravyn', 'Kairo', 'Seong-Ji', 'Vex', 'Astra', 'Dmitri', 'Noor', 'Blaze',
  'Yuki', 'Onyx', 'Zephyr', 'Mara', 'Kingpin', 'Lyra', 'Titus', 'Echo',
  'Rook', 'Saya', 'Cormac', 'Ivo', 'Nyx', 'Dax', 'Priya', 'Grimm',
  'Halcyon', 'Vera', 'Boone', 'Suki', 'Rhea', 'Falk', 'Juno', 'Kade',
  'Mireille', 'Ozan', 'Wren', 'Idris', 'Cleo', 'Bjorn', 'Anya', 'Fox',
];
const BOT_TITLES_BY_TIER = {
  Grandmaster: 'S-Rank Hunter', Champion: 'Apex Lifter', Diamond: 'Master',
  Platinum: 'Elite Lifter', Gold: 'Veteran', Silver: 'Adept', Bronze: 'Initiate',
};
// tiny seeded PRNG (mulberry32) for reproducible bot fields
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function botStatLevels(fr, rnd) {
  // higher FR -> higher average stat level, with per-bot spread so radars differ
  const base = 4 + (fr / 4200) * 82;
  return STATS.map((stat) => {
    const jitter = (rnd() - 0.5) * 34;
    return { stat, level: Math.max(1, Math.min(99, Math.round(base + jitter))) };
  });
}
// The 10 headline rivals: hand-spread across the tiers for a good demo.
const FEATURED_FR = [3980, 3560, 3210, 2760, 2450, 1980, 1520, 980, 640, 360];
function buildBots() {
  const bots = [];
  // 10 featured rivals
  for (let i = 0; i < 10; i++) {
    const rnd = mulberry32(1000 + i * 97);
    const fr = FEATURED_FR[i];
    const tier = tierForFR(fr);
    bots.push({
      id: 'bot' + i, bot: true, featured: true,
      name: BOT_NAMES[i], fr, tier, division: divisionForFR(fr, tier),
      level: Math.max(1, Math.round(3 + (fr / 4200) * 72 + (rnd() - 0.5) * 8)),
      title: BOT_TITLES_BY_TIER[tier.name],
      streak: Math.round(4 + rnd() * 40),
      statLevels: botStatLevels(fr, rnd),
      avatar: {
        skin: Math.floor(rnd() * SKINS.length), hair: Math.floor(rnd() * HAIRS.length),
        outfit: Math.floor(rnd() * OUTFITS.length), accent: Math.floor(rnd() * ACCENTS.length),
      },
    });
  }
  // deeper filler field so Top 100 is always full (ranks ~11-140)
  for (let i = 0; i < 130; i++) {
    const rnd = mulberry32(50000 + i * 131);
    const fr = Math.max(120, Math.round(4160 - i * 30 - rnd() * 40));
    const tier = tierForFR(fr);
    bots.push({
      id: 'fill' + i, bot: true, featured: false,
      name: BOT_NAMES[(i + 3) % BOT_NAMES.length] + '_' + (10 + i),
      fr, tier, division: divisionForFR(fr, tier),
      level: Math.max(1, Math.round(3 + (fr / 4200) * 72)),
      title: BOT_TITLES_BY_TIER[tier.name],
      streak: Math.round(2 + rnd() * 30),
      statLevels: botStatLevels(fr, rnd),
      avatar: {
        skin: Math.floor(rnd() * SKINS.length), hair: Math.floor(rnd() * HAIRS.length),
        outfit: Math.floor(rnd() * OUTFITS.length), accent: Math.floor(rnd() * ACCENTS.length),
      },
    });
  }
  return bots;
}
const BOTS = buildBots();


/* =============================== duels (1v1) ============================== */
// A 7-day head-to-head: whoever earns more training XP across the week wins.
// Real calendar days (local midnight boundaries), real clock, deterministic
// seeded bots in four strength categories. The daily XP integrity cap bounds
// both sides, so duels inherit the anti-cheat layer for free.
const DUEL_TIERS = [
  { key: 'rookie',    name: 'Rookie',    daily: [120, 420],   color: '#9aa4b6', reward: { coins: 150, xp: 300 } },
  { key: 'contender', name: 'Contender', daily: [350, 800],   color: '#3b82f6', reward: { coins: 250, xp: 500 } },
  { key: 'elite',     name: 'Elite',     daily: [700, 1400],  color: '#c26bf0', reward: { coins: 400, xp: 800 } },
  { key: 'champion',  name: 'Champion',  daily: [1200, 2200], color: '#f0b429', reward: { coins: 600, xp: 1200 } },
];
const DUEL_DURATIONS = [
  { days: 1, label: '1 Day',  sub: 'Sprint',     mult: 0.10 },
  { days: 3, label: '3 Days', sub: 'Short',      mult: 0.36 },
  { days: 7, label: '7 Days', sub: 'Full week',  mult: 1.00 },
];
const duelDurationByDays = (n) => DUEL_DURATIONS.find((d) => d.days === n) || DUEL_DURATIONS[2];
const duelTierByKey = (k) => DUEL_TIERS.find((t) => t.key === k) || DUEL_TIERS[0];

// Estimate the player's recent output (avg XP per ACTIVE day, last 14 days)
// so matchmaking recommends an opponent of roughly equal strength.
function estimateDailyOutput(data, now) {
  const cut = now - 14 * DAY;
  const byDay = {};
  [...data.lifts, ...data.cardio].forEach((e) => {
    if (e.t >= cut) { const k = dayKeyOf(e.t); byDay[k] = (byDay[k] || 0) + (e.xp || 0); }
  });
  const vals = Object.values(byDay);
  if (!vals.length) return 300;
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}
function recommendedDuelTier(est) {
  let best = DUEL_TIERS[0], bd = Infinity;
  for (const t of DUEL_TIERS) {
    const mid = (t.daily[0] + t.daily[1]) / 2;
    const dd = Math.abs(mid - est);
    if (dd < bd) { bd = dd; best = t; }
  }
  return best.key;
}

// Challenger roster rotates daily but is stable within a day (seeded on the
// calendar date), so the bot you preview is exactly the bot you fight.
const duelPreviewSeed = (tierIdx, now) => 9137 + tierIdx * 733 + Math.floor(now / DAY);
function makeDuelBotPersona(seed) {
  const rnd = mulberry32(seed);
  const name = BOT_NAMES[Math.floor(rnd() * BOT_NAMES.length)];
  const avatar = {
    skin: Math.floor(rnd() * SKINS.length), hair: Math.floor(rnd() * HAIRS.length),
    outfit: Math.floor(rnd() * OUTFITS.length), accent: Math.floor(rnd() * ACCENTS.length),
  };
  // A cosmetic loadout so an opponent reads as a distinct build, not a recolour.
  // IMPORTANT: these draws come AFTER name+avatar, so every previously generated
  // challenger keeps the exact same name and colours it had before.
  const pick = (slot) => {
    const opts = COSMETICS.filter((c) => c.slot === slot);
    return opts[Math.floor(rnd() * opts.length)].id;
  };
  return {
    name,
    avatar,
    equipped: { helm: pick('helm'), back: pick('back'), weapon: pick('weapon'), aura: pick('aura'), emote: 'emote_flex' },
  };
}
// Deterministic 7-day bot schedule: up to 2 realistic rest days, training
// days land inside the tier's daily XP range.
function genBotDaily(tier, seed, nDays) {
  const total = Math.max(1, nDays || 7);
  const rnd = mulberry32(seed * 2 + 1);
  const lo = tier.daily[0], hi = tier.daily[1];
  const days = [];
  let rests = 0;
  // Rest days only make sense over a longer duel — a 1-day duel where the
  // opponent rests would be an automatic walkover.
  const maxRests = total >= 7 ? 2 : total >= 3 ? 1 : 0;
  for (let i = 0; i < total; i++) {
    if (rnd() < 0.22 && rests < maxRests) { rests++; days.push(0); continue; }
    days.push(Math.round(lo + rnd() * (hi - lo)));
  }
  if (days.every((v) => v === 0)) days[Math.floor(total / 2)] = Math.round((lo + hi) / 2);
  return days;
}
function createDuel(tierKey, now, seed, forcedStartT, nDays) {
  const tier = duelTierByKey(tierKey);
  const dur = duelDurationByDays(nDays == null ? 7 : nDays);
  const sd = new Date(forcedStartT != null ? forcedStartT : now);
  sd.setHours(0, 0, 0, 0); // day 1 begins at local midnight today
  const startT = sd.getTime();
  const persona = makeDuelBotPersona(seed);
  return {
    id: uid(), createdAt: now, tierKey,
    days: dur.days,
    startT, endT: startT + dur.days * DAY,
    bot: { name: persona.name, avatar: persona.avatar, equipped: persona.equipped, tierKey },
    botDaily: genBotDaily(tier, seed, dur.days),
    status: 'active', result: null, claimed: false,
    reward: {
      coins: Math.round(tier.reward.coins * dur.mult),
      xp: Math.round(tier.reward.xp * dur.mult),
    },
    finalYou: 0, finalBot: 0,
  };
}
// Player total: ONLY activity logged inside the duel window counts.
function duelYouTotal(d, duel) {
  return [...d.lifts, ...d.cardio]
    .filter((e) => e.t >= duel.startT && e.t < duel.endT)
    .reduce((s, e) => s + (e.xp || 0), 0);
}
const duelBotFullTotal = (duel) => duel.botDaily.reduce((a, b) => a + b, 0);
// Per-day rows. Past days reveal the bot's full score; the CURRENT day reveals
// progressively as real hours pass (the bot "trains" across a 16 h window),
// keeping the board in sync with the actual clock. Future days stay hidden.
function duelDayRows(d, duel, now) {
  const rows = [];
  for (let i = 0; i < 7; i++) {
    const ds = duel.startT + i * DAY;
    const key = dayKeyOf(ds);
    const you = [...d.lifts, ...d.cardio]
      .filter((e) => e.t >= duel.startT && e.t < duel.endT && dayKeyOf(e.t) === key)
      .reduce((s, e) => s + (e.xp || 0), 0);
    let bot = null, state = 'future';
    if (now >= ds + DAY) { bot = duel.botDaily[i]; state = 'past'; }
    else if (now >= ds) {
      const frac = Math.max(0, Math.min(1, (now - ds) / (16 * 3600000)));
      bot = Math.round(duel.botDaily[i] * frac);
      state = 'today';
    }
    rows.push({ i, label: fmtShort(ds), you, bot, state });
  }
  return rows;
}
const duelBotRevealedTotal = (rows) => rows.reduce((s, r) => s + (r.bot || 0), 0);
const fmtCountdown = (ms) => {
  if (ms <= 0) return 'ended';
  const dd = Math.floor(ms / DAY);
  const hh = Math.floor((ms % DAY) / 3600000);
  return (dd > 0 ? dd + 'd ' : '') + hh + 'h';
};



/* ------------------------- auth (pure helpers) --------------------------- */
const AUTH_KEY = 'ascend-auth-v1';
const SAVE_PREFIX = 'ascend-save-v1';
const emailKeyOf = (email) =>
  SAVE_PREFIX + ':u:' + email.trim().toLowerCase().replace(/[\s/\\'"]/g, '');
const makeSalt = () => {
  let s = '';
  for (let i = 0; i < 24; i++) s += Math.floor(Math.random() * 16).toString(16);
  return s;
};

export {
  DAY,
  STATS,
  STAT_META,
  TIERS,
  TITLES,
  X,
  EXERCISES,
  CATEGORIES,
  loadNote,
  CARDIO_TYPES,
  INTENSITIES,
  epley,
  brzycki,
  weightForReps,
  pctForReps,
  roundLoad,
  setXP,
  INTEGRITY,
  LIFT_CAPS_KG,
  DEFAULT_LIFT_CAP_KG,
  toKg,
  toLb,
  convertUnits,
  validateLift,
  validateCardio,
  cappedXP,
  cardioXPCalc,
  xpForLevel,
  levelFromXP,
  titleForLevel,
  statLevel,
  dayKeyOf,
  startOfWeek,
  fmtShort,
  uid,
  tierForFR,
  divisionForFR,
  seasonLabel,
  linReg,
  calcStreak,
  SESSION_GAP_MS,
  resolveSessionId,
  SOCIAL_XP,
  socialXPPreview,
  DEFAULT_DATA,
  grant,
  applyLift,
  applyCardio,
  removeEntryPure,
  editEntryPure,
  intensityKeyOf,
  computeDerived,
  buildDemoData,
  SKINS,
  HAIRS,
  OUTFITS,
  ACCENTS,
  PART_LABEL,
  RANK_STYLE,
  rankStyleFor,
  RARITY,
  CO,
  COSMETICS,
  SLOTS,
  cosmeticById,
  PASS_PREMIUM_COST,
  PASS_SEASON_TIERS,
  FORGE_PASS,
  rewardLabel,
  passTierUnlocked,
  passKey,
  passClaimable,
  applyPassReward,
  PACK_TITLES, titleById, DECORATIONS, decorationById,
  PACK_TYPES, packTypeByKey, openPack, applyPackReward, rewardPoolAt,
  PACK_XP_STEP, packsEarnedFromXP, packMeter,
  MATERIALS, materialById, materialBalance,
  FORGE_MAX, FORGE_TIERS, forgeLevelOf, forgeTemperOf,
  forgeCost, forgeChance, forgePower, canForge, attemptForge,
  coinsEarnedFromXP,
  coinBalance,
  xpBalance,
  BOT_NAMES,
  BOT_TITLES_BY_TIER,
  mulberry32,
  botStatLevels,
  FEATURED_FR,
  buildBots,
  BOTS,
  DUEL_TIERS,
  DUEL_DURATIONS,
  duelTierByKey,
  estimateDailyOutput,
  recommendedDuelTier,
  duelPreviewSeed,
  makeDuelBotPersona,
  genBotDaily,
  createDuel,
  duelYouTotal,
  duelBotFullTotal,
  duelDayRows,
  duelBotRevealedTotal,
  fmtCountdown,
  AUTH_KEY,
  SAVE_PREFIX,
  emailKeyOf,
  makeSalt,
};
