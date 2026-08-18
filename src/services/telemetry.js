// ============================================================================
// LEVL — telemetry
//
// Crash reports and the handful of product events worth having, written to
// Supabase.
//
// WHY NOT SENTRY
// Sentry or Amplitude would each add a native module, and a native module means
// a new binary and a new App Store review. This app already carries Supabase and
// is days from submission. This is not as good as Sentry — no symbolication, no
// breadcrumbs, no alerting — but it exists today, costs no rebuild, and turns
// "launching blind" into "launching with eyes". Swap it for Sentry once there is
// a reason to cut a build for it.
//
// RULES THIS FOLLOWS
//   · Never blocks or throws. A telemetry failure must never affect the app.
//   · Never sends anything a user typed. Names, captions, emails, comment text
//     and photo paths are all excluded — only counts, ids and enum-ish values.
//   · Insert-only: the table has no select policy, so a leaked anon key cannot
//     read anyone's events back out.
// ============================================================================

import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { supabase, isConfigured } from './supabase/client';

// One id per app launch, so a crash can be tied to the events that preceded it.
const SESSION_ID = Math.random().toString(36).slice(2) + Date.now().toString(36);

const VERSION = (Constants.expoConfig && Constants.expoConfig.version) || 'dev';
const BUILD = String(
  (Constants.expoConfig && Constants.expoConfig.ios && Constants.expoConfig.ios.buildNumber)
  || (Constants.expoConfig && Constants.expoConfig.android && Constants.expoConfig.android.versionCode)
  || '0',
);

/* THE SIX EVENTS.
 *
 * Deliberately six, not sixty. These are the ones that answer "is this app
 * working": did they get in, did they log anything, did they come back. Every
 * extra event is noise you have to ignore later, and a decision you cannot make
 * without the first six anyway. */
export const EVENTS = {
  APP_OPEN: 'app_open',
  SIGNED_UP: 'signed_up',
  FIRST_SET: 'first_set_logged',
  THIRD_SET: 'third_set_logged',
  WORKOUT_DAY_CREATED: 'workout_day_created',
  RETURNED: 'returned_day_2',
};

let userId = null;
export function identify(id) { userId = id || null; }

async function send(kind, name, props) {
  if (!isConfigured) return;
  try {
    await supabase.from('telemetry_events').insert({
      user_id: userId,
      session_id: SESSION_ID,
      kind,
      name: String(name).slice(0, 120),
      props: props || {},
      app_version: VERSION,
      build: BUILD,
      platform: Platform.OS,
    });
  } catch (e) {
    // Swallowed on purpose. Telemetry must never surface to a user or retry in
    // a loop against a backend that is already having a bad day.
  }
}

/** A product event. `props` must contain no user-entered text. */
export function track(name, props) {
  send('event', name, props);
}

/** A caught error. Message and stack only — never the values that caused it. */
export function captureError(error, context) {
  const message = String((error && error.message) || error || 'unknown').slice(0, 500);
  const stack = String((error && error.stack) || '').slice(0, 4000);
  send('error', 'exception', { message, stack, ...(context || {}) });
}

/** A render-tree crash from the error boundary. */
export function captureFatal(error, info) {
  const message = String((error && error.message) || error || 'unknown').slice(0, 500);
  send('fatal', 'render_crash', {
    message,
    stack: String((error && error.stack) || '').slice(0, 4000),
    componentStack: String((info && info.componentStack) || '').slice(0, 4000),
  });
}

export default { track, captureError, captureFatal, identify, EVENTS };
