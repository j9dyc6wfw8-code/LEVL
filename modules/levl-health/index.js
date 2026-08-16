// ============================================================================
// LEVL — levl-health (JS surface)
//
// Apple Health, for context only.
//
// THE RULE, RESTATED WHERE IT IS EASIEST TO BREAK: nothing this module returns
// may reach the XP engine, the stat allocation, the Fitness Rating, a rank or a
// duel score. It is display context beside your training and nothing more. It
// is also never uploaded to Supabase and never attached to a Check In.
//
// Partial permission is the normal case, not an error: iOS deliberately refuses
// to tell an app which read permissions were denied, so a hidden data type
// simply comes back absent. Every field below is independently optional.
// ============================================================================

import { Platform } from 'react-native';

let Native = null;
try {
  // eslint-disable-next-line global-require
  const expo = require('expo');
  Native = expo.requireOptionalNativeModule
    ? expo.requireOptionalNativeModule('LevlHealth')
    : null;
} catch (e) {
  Native = null;
}

export const isModuleLinked = !!(Native && Platform.OS === 'ios');

export function isAvailable() {
  if (!Native) return false;
  try {
    return !!Native.isAvailable();
  } catch (e) {
    return false;
  }
}

// Show the Health permission sheet. Called from the Health card in settings,
// never at launch — asking before the user knows why is how permission prompts
// get denied permanently.
export async function requestAuthorization() {
  if (!Native) return { available: false, requested: false };
  try {
    return await Native.requestAuthorization();
  } catch (e) {
    return { available: false, requested: false, error: String((e && e.message) || e) };
  }
}

/**
 * Today's context. Any subset of:
 *   steps, activeEnergy, exerciseMinutes,
 *   restingHeartRate, bodyMassKg, bodyFatPercent, vo2Max, sleepMinutes
 * Missing keys mean "not shared" or "no data" — both are fine, neither is an
 * error, and the UI simply omits that row.
 */
export async function readToday() {
  if (!Native) return {};
  try {
    return (await Native.readToday()) || {};
  } catch (e) {
    return {};
  }
}

// Because iOS never reports read-permission state, "connected" is decided by
// whether a read actually returns anything.
export async function probeConnection() {
  if (!isAvailable()) return { available: false, connected: false, fields: [] };
  const today = await readToday();
  const fields = Object.keys(today).filter((k) => !k.endsWith('Date'));
  return { available: true, connected: fields.length > 0, fields, today };
}

/**
 * Save a finished LEVL workout to Health.
 *
 * Pass activeEnergyKcal ONLY if you have a real measurement. LEVL does not
 * model calorie burn, so it is normally omitted — writing an invented number
 * into a health record is worse than writing nothing.
 *
 * Re-syncing is safe: the session id travels in Health metadata and a workout
 * already carrying it is not written twice.
 */
export async function saveWorkout(options) {
  if (!Native) return { saved: false, reason: 'unavailable' };
  try {
    return await Native.saveWorkout(options || {});
  } catch (e) {
    return { saved: false, reason: String((e && e.message) || e) };
  }
}

export default {
  isModuleLinked,
  isAvailable,
  requestAuthorization,
  readToday,
  probeConnection,
  saveWorkout,
};
