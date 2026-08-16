// ============================================================================
// LEVL — workoutSession
//
// The single source of truth for "a workout is happening right now".
//
// WHY THIS EXISTS AS ITS OWN LAYER
// Active-workout state has four consumers already — the Train screen, the Live
// Activity, the Lock Screen, and the deep link that reopens the exact set you
// were on — and a fifth is coming: an Apple Watch app. If that state lived
// inside a React component, every one of those would need its own copy and they
// would drift. So it lives here, as a plain observable store with no React and
// no platform APIs in its core, and every surface subscribes.
//
// ------------------------------ FOR A FUTURE WATCH APP ----------------------
// A Watch companion needs exactly what is below and nothing more:
//
//   getState()          the full snapshot: exercise, set, rest, elapsed, XP
//   subscribe(fn)       every change, already coalesced
//   start/logSet/
//   startRest/endRest/
//   nextExercise/end    the complete set of transitions
//
// To add the Watch: create a WatchConnectivity bridge that (a) sends this
// snapshot on every `subscribe` callback via `updateApplicationContext`, and
// (b) forwards watch-side actions back into these same transition functions.
// No workout logic needs to move, because none of it lives in the UI. The
// snapshot is deliberately small and JSON-serialisable for exactly this reason.
//
// The store also persists itself, so a force-quit mid-session is recoverable
// rather than losing the workout and stranding a Live Activity.
// ============================================================================

import { stGet, stSet, stDel } from './platform';
import LiveActivity from '../../modules/levl-live-activity';
import notifications from './notifications';

const KEY = 'levl.activeWorkout.v1';

// A session left running this long was abandoned, not paused — most likely the
// app was killed and never reopened that day.
const STALE_MS = 8 * 3600 * 1000;

let state = null;
const listeners = new Set();

/* ---------------------------------------------------------------------------
 * Store
 * ------------------------------------------------------------------------ */

function emit() {
  const snapshot = getState();
  listeners.forEach((fn) => {
    try { fn(snapshot); } catch (e) { /* a bad subscriber must not stop the rest */ }
  });
}

function persist() {
  if (!state) { stDel(KEY).catch(() => {}); return; }
  stSet(KEY, JSON.stringify(state)).catch(() => {});
}

export function subscribe(fn) {
  listeners.add(fn);
  try { fn(getState()); } catch (e) {}
  return () => listeners.delete(fn);
}

// A plain, serialisable snapshot. This is the contract a Watch app would read.
export function getState() {
  if (!state) return { active: false };
  const now = Date.now();
  const restRemaining = state.restEndsAt ? Math.max(0, Math.round((state.restEndsAt - now) / 1000)) : 0;
  return {
    active: true,
    sessionId: state.sessionId,
    workoutName: state.workoutName,
    exercise: state.exercise,
    setNumber: state.setNumber,
    totalSets: state.totalSets,
    startedAt: state.startedAt,
    elapsedMs: now - state.startedAt,
    resting: restRemaining > 0,
    restRemaining,
    restEndsAt: state.restEndsAt,
    lastWeight: state.lastWeight,
    lastReps: state.lastReps,
    nextWeight: state.nextWeight,
    nextReps: state.nextReps,
    unit: state.unit,
    xpEarned: state.xpEarned,
    setsLogged: state.setsLogged,
    isPR: !!state.isPR,
    duelNote: state.duelNote || null,
  };
}

export const isActive = () => !!state;
export const activeSessionId = () => (state ? state.sessionId : null);

/* ---------------------------------------------------------------------------
 * Live Activity mirroring
 *
 * Every transition pushes the current state out. ActivityKit throttles apps
 * that update too often, so the rest COUNTDOWN is deliberately not pushed on a
 * timer — the widget is handed an end date and counts down itself.
 * ------------------------------------------------------------------------ */

function liveActivityPayload() {
  const s = getState();
  return {
    sessionId: s.sessionId,
    workoutName: s.workoutName,
    exercise: s.exercise,
    setNumber: s.setNumber,
    totalSets: s.totalSets,
    restSeconds: s.restRemaining,
    startedAtMs: s.startedAt,
    lastWeight: s.lastWeight,
    lastReps: s.lastReps,
    nextWeight: s.nextWeight,
    nextReps: s.nextReps,
    unit: s.unit,
    xpEarned: s.xpEarned,
    isPR: s.isPR,
    duelNote: s.duelNote,
  };
}

function pushLiveActivity(kind) {
  if (!state) return;
  const payload = liveActivityPayload();
  if (kind === 'start') LiveActivity.start(payload);
  else LiveActivity.update(payload);
}

/* ---------------------------------------------------------------------------
 * Transitions
 * ------------------------------------------------------------------------ */

export function start({ sessionId, workoutName, exercise, totalSets, unit, duelNote }) {
  state = {
    sessionId: sessionId || ('s' + Date.now().toString(36)),
    workoutName: workoutName || 'Training',
    exercise: exercise || 'Workout',
    setNumber: 1,
    totalSets: totalSets || null,
    startedAt: Date.now(),
    restEndsAt: null,
    lastWeight: null,
    lastReps: null,
    nextWeight: null,
    nextReps: null,
    unit: unit || 'kg',
    xpEarned: 0,
    setsLogged: 0,
    isPR: false,
    duelNote: duelNote || null,
    touchedAt: Date.now(),
  };
  persist();
  pushLiveActivity('start');
  emit();
  return getState();
}

// Called after a set has been committed to the engine.
export function logSet({ weight, reps, xp, isPR, restSeconds, exercise }) {
  if (!state) return null;
  state.setsLogged += 1;
  state.setNumber += 1;
  state.lastWeight = weight == null ? state.lastWeight : weight;
  state.lastReps = reps == null ? state.lastReps : reps;
  // The next set's target defaults to a repeat of the last one, which is what
  // people actually do. It is a suggestion shown on the Lock Screen, never
  // something that gets logged on its own.
  state.nextWeight = state.lastWeight;
  state.nextReps = state.lastReps;
  state.xpEarned += xp || 0;
  if (exercise) state.exercise = exercise;
  state.isPR = !!isPR;
  state.touchedAt = Date.now();

  if (restSeconds > 0) {
    state.restEndsAt = Date.now() + restSeconds * 1000;
    notifications.scheduleRestAlert(restSeconds, state.exercise).catch(() => {});
  }
  persist();
  pushLiveActivity();
  emit();

  // The PR flash is a moment, not a mode. Clear it shortly afterwards so the
  // Dynamic Island returns to showing the set you are on.
  if (isPR) {
    setTimeout(() => {
      if (state && state.isPR) {
        state.isPR = false;
        persist();
        pushLiveActivity();
        emit();
      }
    }, 12000);
  }
  return getState();
}

export function setExercise(exercise, totalSets) {
  if (!state) return null;
  state.exercise = exercise || state.exercise;
  state.setNumber = 1;
  if (totalSets !== undefined) state.totalSets = totalSets;
  state.lastWeight = null;
  state.lastReps = null;
  state.nextWeight = null;
  state.nextReps = null;
  state.touchedAt = Date.now();
  persist();
  pushLiveActivity();
  emit();
  return getState();
}

export function startRest(seconds) {
  if (!state) return null;
  state.restEndsAt = Date.now() + Math.max(0, seconds) * 1000;
  state.touchedAt = Date.now();
  notifications.scheduleRestAlert(seconds, state.exercise).catch(() => {});
  persist();
  pushLiveActivity();
  emit();
  return getState();
}

export function endRest() {
  if (!state) return null;
  state.restEndsAt = null;
  state.touchedAt = Date.now();
  notifications.cancelRestAlert().catch(() => {});
  persist();
  pushLiveActivity();
  emit();
  return getState();
}

export function setDuelNote(note) {
  if (!state) return null;
  if (state.duelNote === note) return getState();
  state.duelNote = note || null;
  persist();
  pushLiveActivity();
  emit();
  return getState();
}

// Finish or abandon. Both end the Live Activity immediately — leaving one
// behind is the single worst failure mode this feature has.
export function end() {
  const finished = state ? getState() : null;
  state = null;
  stDel(KEY).catch(() => {});
  notifications.cancelRestAlert().catch(() => {});
  LiveActivity.end();
  emit();
  return finished;
}

/* ---------------------------------------------------------------------------
 * Recovery
 * ------------------------------------------------------------------------ */

/**
 * Restore an interrupted session at launch.
 *
 * Three outcomes:
 *   • nothing stored             → clear any orphaned Live Activity and stop
 *   • stored but stale (>8h)     → discard it and end the activity
 *   • stored and recent          → resume, and re-sync the Live Activity
 *
 * The `endAll` calls are what guarantee a crash can never leave a workout
 * counting up on somebody's Lock Screen indefinitely.
 */
export async function restore() {
  try {
    const raw = await stGet(KEY);
    if (!raw) { await LiveActivity.endAll(); emit(); return null; }

    const saved = JSON.parse(raw);
    const age = Date.now() - (saved.touchedAt || saved.startedAt || 0);
    if (!saved.sessionId || age > STALE_MS) {
      await stDel(KEY);
      await LiveActivity.endAll();
      state = null;
      emit();
      return null;
    }

    state = saved;
    // Rest may well have elapsed while the app was gone.
    if (state.restEndsAt && state.restEndsAt <= Date.now()) state.restEndsAt = null;
    pushLiveActivity('start');   // adopts the existing activity, or starts one
    emit();
    return getState();
  } catch (e) {
    await LiveActivity.endAll();
    state = null;
    emit();
    return null;
  }
}

export default {
  subscribe,
  getState,
  isActive,
  activeSessionId,
  start,
  logSet,
  setExercise,
  startRest,
  endRest,
  setDuelNote,
  end,
  restore,
};
