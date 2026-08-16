// ============================================================================
// LEVL — levl-live-activity (JS surface)
//
// Workout Live Activity + the home screen widget snapshot.
//
// Every call is safe everywhere: on Android, in Expo Go, on iOS 15, or when the
// user has switched Live Activities off, the functions resolve to a harmless
// value rather than throwing. Callers never have to guard.
// ============================================================================

import { Platform } from 'react-native';

let Native = null;
try {
  // eslint-disable-next-line global-require
  const expo = require('expo');
  Native = expo.requireOptionalNativeModule
    ? expo.requireOptionalNativeModule('LevlLiveActivity')
    : null;
} catch (e) {
  Native = null;
}

export const isModuleLinked = !!(Native && Platform.OS === 'ios');

// { osSupported, enabled } — separates "this iPhone can't" from "you turned it
// off", so the UI can say the right thing instead of a generic apology.
export function getAvailability() {
  if (!Native) return { osSupported: false, enabled: false };
  try {
    return Native.getAvailability();
  } catch (e) {
    return { osSupported: false, enabled: false };
  }
}

export function isSupported() {
  if (!Native) return false;
  try {
    return !!Native.isSupported();
  } catch (e) {
    return false;
  }
}

/**
 * Begin the workout Live Activity.
 *
 * @param {object} state
 *   sessionId       stable id of the workout session (also the deep-link target)
 *   workoutName     e.g. "Push"
 *   exercise        current movement
 *   setNumber       1-based
 *   totalSets       optional planned total
 *   restSeconds     seconds remaining, converted natively to an end date
 *   startedAtMs     epoch ms the workout began
 *   lastWeight/lastReps, nextWeight/nextReps, unit, xpEarned, isPR, duelNote
 * @returns activity id, or null when unavailable
 */
export async function start(state) {
  if (!Native) return null;
  try {
    return await Native.start(state || {});
  } catch (e) {
    return null;
  }
}

export async function update(state) {
  if (!Native) return false;
  try {
    return await Native.update(state || {});
  } catch (e) {
    return false;
  }
}

export async function end() {
  if (!Native) return false;
  try {
    return await Native.end();
  } catch (e) {
    return false;
  }
}

// Run at launch. A force-quit or crash mid-workout can otherwise leave an
// activity counting up on the Lock Screen forever.
export async function endAll() {
  if (!Native) return 0;
  try {
    return await Native.endAll();
  } catch (e) {
    return 0;
  }
}

// A Home Screen Quick Action or Siri phrase that fired before the router was
// mounted. Reading consumes it — call once on launch and once on foreground.
export function takePendingRoute() {
  if (!Native || !Native.takePendingRoute) return null;
  try {
    return Native.takePendingRoute();
  } catch (e) {
    return null;
  }
}

export function currentSessionId() {
  if (!Native) return null;
  try {
    return Native.currentSessionId();
  } catch (e) {
    return null;
  }
}

// Publish the small snapshot the home screen widget renders. Display-safe
// fields only — never HealthKit data, never photographs.
export function setTodaySnapshot(payload) {
  if (!Native) return;
  try {
    Native.setTodaySnapshot(payload || {});
  } catch (e) { /* the widget is a nicety; never let it break the app */ }
}

export default {
  isModuleLinked,
  isSupported,
  getAvailability,
  start,
  update,
  end,
  endAll,
  currentSessionId,
  takePendingRoute,
  setTodaySnapshot,
};
