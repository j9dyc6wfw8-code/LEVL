// LEVL — exercise information.
//
// Every exercise gets a plain-language "what it trains" line and three or four
// how-to cues. Writing 126 sets of bespoke instructions would produce a lot of
// padding, so this works two ways:
//
//   1. SPECIFIC — the big lifts people most often get wrong have hand-written
//      cues, because "keep good form" helps nobody on a deadlift.
//   2. PATTERN — everything else is matched on its movement pattern (press,
//      row, curl, hinge, squat, fly, raise, extension…). Cues are written per
//      pattern, so a cable fly and a dumbbell fly both get fly cues rather
//      than generic filler.
//
// No text is invented per-exercise at runtime; if nothing matches, the caller
// gets null and the UI simply shows less rather than something vague.

const SPECIFIC = {
  'Barbell Bench Press': [
    'Lie flat, eyes under the bar, feet planted.',
    'Grip slightly wider than shoulders. Squeeze your shoulder blades down and back.',
    'Lower to mid-chest with control, elbows about 45° from your body.',
    'Press up and slightly back. Keep your wrists stacked over your elbows.',
  ],
  'Back Squat': [
    'Bar on your upper back, not your neck. Feet shoulder-width, toes slightly out.',
    'Brace your core as if about to be punched, then sit down and back.',
    'Descend until your hip crease passes your knee, keeping knees tracking over toes.',
    'Drive up through mid-foot. Hips and chest rise together.',
  ],
  'Deadlift': [
    'Bar over mid-foot, shins almost touching. Grip just outside your legs.',
    'Chest up, back flat, hips higher than knees. Take the slack out of the bar first.',
    'Push the floor away rather than pulling with your back.',
    'Lock out by squeezing your glutes. Lower under control — do not drop and bounce.',
  ],
  'Overhead Barbell Press': [
    'Bar on your front delts, grip just outside shoulders, elbows slightly forward.',
    'Squeeze your glutes and brace — no leaning back.',
    'Press up, moving your head back slightly so the bar travels straight.',
    'Finish with the bar over the middle of your foot, arms locked.',
  ],
  'Romanian Deadlift': [
    'Start standing, bar against your thighs, soft knees.',
    'Push your hips straight back, letting the bar slide down your legs.',
    'Stop when you feel a strong stretch in your hamstrings — usually mid-shin.',
    'Drive your hips forward to stand. Your back stays flat throughout.',
  ],
  'Pull-Up': [
    'Grip slightly wider than shoulders, hang with arms straight.',
    'Pull your shoulder blades down first, then drive your elbows to your ribs.',
    'Chin over the bar without swinging or kipping.',
    'Lower all the way down under control. Full range beats extra reps.',
  ],
  'Bent-Over Barbell Row': [
    'Hinge forward to roughly 45°, back flat, bar hanging under your shoulders.',
    'Pull to your lower ribs, leading with your elbows.',
    'Squeeze your shoulder blades together at the top.',
    'Lower under control. Keep your torso still — do not use momentum.',
  ],
  'Hip Thrust': [
    'Upper back on a bench, bar across your hips with a pad.',
    'Feet flat, shins vertical at the top of the movement.',
    'Drive through your heels and squeeze your glutes hard.',
    'Finish with your body in a straight line — do not arch your lower back.',
  ],
};

// pattern -> { test, trains, cues }
const PATTERNS = [
  { key: 'fly',
    test: /\bfly|crossover|pec deck/i,
    cues: [
      'Soft bend in the elbows, and keep that same bend the whole way.',
      'Open your arms wide until you feel a stretch across the chest.',
      'Bring the handles together in an arc — think hugging, not pressing.',
      'Squeeze at the top for a moment before letting it back out slowly.',
    ] },
  { key: 'pulldown',
    test: /pulldown|pull-down/i,
    cues: [
      'Sit tall, thighs locked under the pad, slight lean back.',
      'Pull your shoulder blades down before your arms bend.',
      'Bring the bar to your upper chest, elbows driving down.',
      'Let it rise slowly until your arms are straight and your lats stretch.',
    ] },
  { key: 'row',
    test: /\brow\b/i,
    cues: [
      'Set your back flat and keep your torso still.',
      'Lead with your elbow, pulling toward your ribs — not your shoulder.',
      'Squeeze your shoulder blade at the end of each rep.',
      'Straighten the arm fully on the way back for a full stretch.',
    ] },
  { key: 'curl',
    test: /curl/i,
    cues: [
      'Elbows tucked at your sides and staying there.',
      'Curl up by bending the elbow only — no swinging the weight.',
      'Squeeze at the top with your wrist straight.',
      'Lower slowly and straighten the arm fully at the bottom.',
    ] },
  { key: 'tricep',
    test: /pushdown|tricep|skull|kickback|dip machine/i,
    cues: [
      'Upper arms locked at your sides — only the forearm moves.',
      'Extend until the elbow is straight, then squeeze.',
      'Return under control until you feel a stretch behind the arm.',
      'Keep your shoulders down and still throughout.',
    ] },
  { key: 'press',
    test: /press|dip\b|push-?up/i,
    cues: [
      'Set your shoulder blades and brace your core before the first rep.',
      'Lower under control through the full range.',
      'Press with your elbows tracking naturally, not flared wide.',
      'Lock out without letting your lower back arch.',
    ] },
  { key: 'raise',
    test: /raise|reverse fly|face pull|shrug/i,
    cues: [
      'Use a weight light enough that you do not need to swing.',
      'Raise with a slight bend in the elbow, leading with the elbow.',
      'Stop at about shoulder height — higher brings other muscles in.',
      'Lower slowly. The way down is where most of the work happens.',
    ] },
  { key: 'squat',
    test: /squat|lunge|step-?up|leg press|split/i,
    cues: [
      'Feet planted, weight through your mid-foot.',
      'Brace your core, then descend under control.',
      'Keep your knees tracking in line with your toes.',
      'Drive up without letting your hips shoot back first.',
    ] },
  { key: 'hinge',
    test: /deadlift|good morning|hip thrust|glute bridge|rdl|back extension/i,
    cues: [
      'The movement comes from your hips, not your lower back.',
      'Keep your back flat and your ribs down the whole time.',
      'Push your hips back on the way down, forward on the way up.',
      'Finish by squeezing your glutes rather than leaning back.',
    ] },
  { key: 'extension',
    test: /extension|leg curl|calf|abduct|adduct/i,
    cues: [
      'Set the machine so the joint lines up with its pivot.',
      'Move only the target joint — everything else stays still.',
      'Pause briefly at the hardest point of the rep.',
      'Return slowly rather than letting the weight drop.',
    ] },
  { key: 'core',
    test: /plank|crunch|sit-?up|hollow|dead bug|ab wheel|leg raise|russian|woodchop|pallof|hanging/i,
    cues: [
      'Brace as if you are about to be punched in the stomach.',
      'Move slowly — speed makes this easier, not harder.',
      'Keep your lower back from arching off its position.',
      'Breathe steadily; do not hold your breath through the set.',
    ] },
  { key: 'olympic',
    test: /clean|snatch|jerk|thruster|swing|slam|jump|throw|plyo/i,
    cues: [
      'This is about speed, not grinding — the weight should move fast.',
      'Start from a strong braced position with a flat back.',
      'Drive explosively through the hips and finish tall.',
      'Reset fully between reps. Stop the set the moment speed drops.',
    ] },
  { key: 'hang',
    test: /dead hang|wrist roller|farmer|grip/i,
    cues: [
      'Grip hard and keep your shoulders active, not fully slack.',
      'Stay tall — do not let your neck sink between your shoulders.',
      'Hold for time rather than chasing reps.',
      'Stop the set when your grip starts sliding, not after it fails.',
    ] },
  { key: 'bodyweightPull',
    test: /chin-?up|toes-?to-?bar|rack pull/i,
    cues: [
      'Start from a full hang with your shoulders engaged.',
      'Pull your shoulder blades down before your arms bend.',
      'Drive your elbows down and back, no swinging.',
      'Lower all the way under control — full range beats extra reps.',
    ] },
  { key: 'bodyweightPush',
    test: /\bdips?\b|pullover/i,
    cues: [
      'Set your shoulders down and back before you start.',
      'Lower until you feel a stretch, without letting your shoulders roll forward.',
      'Press back up under control.',
      'Keep your core braced so your hips do not swing.',
    ] },
  { key: 'coreDynamic',
    test: /rollout|dragon flag|mountain climber|v-?up|get-?up|wall ball|pull-?through/i,
    cues: [
      'Brace your core before you move, and keep it braced throughout.',
      'Move slowly and deliberately — momentum makes this easier, not better.',
      'Do not let your lower back arch away from its start position.',
      'Stop the set when your form changes, not when you fail.',
    ] },
  { key: 'carry',
    test: /carry|farmer|hold/i,
    cues: [
      'Stand tall, shoulders back, ribs down.',
      'Grip hard and keep your core braced the whole way.',
      'Take short controlled steps — do not rush.',
      'Set the weight down deliberately rather than dropping it.',
    ] },
];

const TRAINS = {
  Chest: 'your chest, front shoulders and triceps',
  Back: 'your lats, mid-back and biceps',
  Shoulders: 'your deltoids and upper back',
  Biceps: 'the front of your upper arm',
  Triceps: 'the back of your upper arm',
  Forearms: 'your grip and forearms',
  Traps: 'your upper back and neck',
  Core: 'your abs, obliques and deep core',
  Quads: 'the front of your thighs',
  Hamstrings: 'the back of your thighs',
  Glutes: 'your glutes and hips',
  Calves: 'your lower legs',
  Adductors: 'your inner thighs',
  Power: 'full-body explosive strength',
};

// Returns { trains, cues } or null when nothing sensible can be said.
export function exerciseInfo(name, category) {
  const n = String(name || '');
  const cues = SPECIFIC[n] || (PATTERNS.find((p) => p.test.test(n)) || {}).cues || null;
  const trains = TRAINS[category] || null;
  if (!cues && !trains) return null;
  return {
    trains,
    cues: cues || null,
    specific: !!SPECIFIC[n],
  };
}

export default exerciseInfo;
