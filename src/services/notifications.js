// ============================================================================
// LEVL — notifications
//
// One coherent notification strategy, with the user in charge of every part.
//
// WHAT IS LOCAL AND WHAT NEEDS A SERVER — stated plainly, because pretending
// otherwise would be the easiest thing to get wrong here:
//
//   LOCAL (fully implemented, no backend needed)
//     • the daily Check In prompt, at an unpredictable time inside the window
//       the user chose
//     • rest timer finishing
//     • a planned workout reminder, if the user opts in
//
//   REMOTE (needs a backend; the device half is implemented and the token is
//   stored, the sending half is a documented Supabase Edge Function)
//     • a friend reacted or commented
//     • friend requests, duel challenges and results, rank changes
//     • rewards becoming claimable
//   These cannot be local notifications by definition: they are triggered by
//   somebody else's action, on their phone. LEVL registers for push and keeps
//   the token current, and the in-app activity centre already shows all of them
//   live over Realtime — so nothing is invisible while push is being set up.
//
// THE CHECK IN PROMPT AND TIME
// Scheduling one repeating notification at a fixed clock time would be wrong in
// three ways: it would be predictable, it would drift an hour at each daylight
// saving change, and it would fire at the old local time after a flight. So
// LEVL schedules a handful of individually-rolled DATE triggers a few days
// ahead and re-rolls them whenever the app opens, the window changes or the
// timezone changes. Each day gets its own random minute inside the window.
// ============================================================================

import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { stGet, stSet } from './platform';

const CHECK_IN_TAG = 'levl.check-in';
const REST_TAG = 'levl.rest';
const LAST_SCHEDULE_KEY = 'levl.notif.lastSchedule.v1';
export const NOTIFIED_AT_KEY = 'levl.notif.checkInFiredAt.v1';

// How many days ahead to roll. Enough that a week away from the app still gets
// prompted, few enough to stay inside iOS's 64-pending-notification limit
// alongside everything else.
const DAYS_AHEAD = 5;

let handlerInstalled = false;

// Foreground presentation. A banner is right for the Check In prompt and the
// rest timer; neither should make noise while you are looking at the app.
export function installHandler() {
  if (handlerInstalled) return;
  handlerInstalled = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

/* ---------------------------------------------------------------------------
 * Permission
 *
 * Asked when the user turns the Check In reminder on — never at launch. A
 * permission prompt with no context in front of it is how apps end up
 * permanently denied.
 * ------------------------------------------------------------------------ */

export async function getPermission() {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    return status;
  } catch (e) {
    return 'undetermined';
  }
}

export async function requestPermission() {
  try {
    const existing = await Notifications.getPermissionsAsync();
    if (existing.status === 'granted') return 'granted';
    // iOS only ever shows the system sheet once. After a denial the only route
    // is Settings, which the UI explains rather than asking again pointlessly.
    if (!existing.canAskAgain) return existing.status;
    const { status } = await Notifications.requestPermissionsAsync();
    return status;
  } catch (e) {
    return 'denied';
  }
}

/* ---------------------------------------------------------------------------
 * Push token (for the server-sent categories)
 * ------------------------------------------------------------------------ */

export async function getPushToken() {
  if (!Device.isDevice) return null;   // simulators cannot register with APNs
  try {
    if ((await getPermission()) !== 'granted') return null;
    const projectId =
      (Constants.expoConfig && Constants.expoConfig.extra
        && Constants.expoConfig.extra.eas && Constants.expoConfig.extra.eas.projectId)
      || (Constants.easConfig && Constants.easConfig.projectId);
    // Without an EAS project id Expo cannot mint a token. That is a
    // configuration step, not a runtime error — return null and move on.
    if (!projectId) return null;
    const res = await Notifications.getExpoPushTokenAsync({ projectId });
    return (res && res.data) || null;
  } catch (e) {
    return null;
  }
}

/* ---------------------------------------------------------------------------
 * The daily Check In prompt
 * ------------------------------------------------------------------------ */

const COPY = [
  { title: '⚡ Time to Check In', body: "Show the squad what you're training." },
  { title: '⚡ Check In', body: 'One photo. Front and rear. Ten seconds.' },
  { title: '⚡ Your window is open', body: 'Capture today\'s session.' },
  { title: '⚡ Check In', body: 'What does today look like?' },
];

// A minute inside [start, end) on a given local day, chosen with a per-day
// seed. Deliberately unpredictable — a prompt that always arrives at 18:30 is
// one you stop noticing.
function rollMinute(startMinute, endMinute) {
  const span = Math.max(1, endMinute - startMinute);
  return startMinute + Math.floor(Math.random() * span);
}

function localDateAt(daysFromToday, minuteOfDay) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromToday);
  // Built from LOCAL components, so it stays correct across a daylight saving
  // boundary and after the device changes timezone.
  d.setHours(0, 0, 0, 0);
  d.setMinutes(minuteOfDay);
  return d;
}

async function cancelTagged(tag) {
  try {
    const all = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
      all
        .filter((n) => {
          const data = (n.content && n.content.data) || {};
          return data.tag === tag;
        })
        .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
    );
  } catch (e) { /* nothing scheduled is a fine outcome */ }
}

/**
 * (Re)schedule the Check In prompts.
 *
 * Safe and cheap to call often — on launch, on foreground, whenever the window
 * or timezone changes. It always clears LEVL's own prompts first, so prompts
 * can never accumulate.
 */
export async function scheduleCheckInPrompts(prefs) {
  await cancelTagged(CHECK_IN_TAG);
  if (!prefs || !prefs.enabled || prefs.notify_check_in === false) return { scheduled: 0 };
  if ((await getPermission()) !== 'granted') return { scheduled: 0, reason: 'no-permission' };

  const start = Math.max(0, Math.min(1439, prefs.window_start_minute ?? 17 * 60));
  const end = Math.max(start + 15, Math.min(1439, prefs.window_end_minute ?? 20 * 60));

  let scheduled = 0;
  for (let day = 0; day < DAYS_AHEAD; day++) {
    const when = localDateAt(day, rollMinute(start, end));
    // Today's slot may already have passed — skip it rather than firing
    // immediately, which would feel broken.
    if (when.getTime() <= Date.now() + 60000) continue;
    const copy = COPY[Math.floor(Math.random() * COPY.length)];
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: copy.title,
          body: copy.body,
          data: { tag: CHECK_IN_TAG, url: 'levl://check-in' },
          sound: false,
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: when },
      });
      scheduled += 1;
    } catch (e) { /* one failed day must not stop the rest */ }
  }

  try {
    await stSet(LAST_SCHEDULE_KEY, JSON.stringify({
      at: Date.now(),
      start,
      end,
      timezone: prefs.timezone || null,
    }));
  } catch (e) {}

  return { scheduled };
}

// Has anything changed that invalidates the current schedule?
export async function needsReschedule(prefs) {
  if (!prefs) return false;
  try {
    const raw = await stGet(LAST_SCHEDULE_KEY);
    if (!raw) return true;
    const last = JSON.parse(raw);
    if (last.start !== prefs.window_start_minute) return true;
    if (last.end !== prefs.window_end_minute) return true;
    if (last.timezone !== prefs.timezone) return true;
    // Re-roll daily so the schedule keeps rolling forward and the times stay
    // unpredictable.
    return Date.now() - (last.at || 0) > 20 * 3600 * 1000;
  } catch (e) {
    return true;
  }
}

export async function cancelCheckInPrompts() {
  await cancelTagged(CHECK_IN_TAG);
}

/* ---------------------------------------------------------------------------
 * Rest timer
 * ------------------------------------------------------------------------ */

// The Live Activity already counts rest down on the Lock Screen, so this is
// only for people who have left the phone entirely.
export async function scheduleRestAlert(seconds, exercise) {
  await cancelTagged(REST_TAG);
  if (!seconds || seconds < 20) return null;
  if ((await getPermission()) !== 'granted') return null;
  try {
    return await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Rest complete',
        body: exercise ? `Next set — ${exercise}` : 'Back to it.',
        data: { tag: REST_TAG, url: 'levl://train' },
        sound: true,
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds },
    });
  } catch (e) {
    return null;
  }
}

export async function cancelRestAlert() {
  await cancelTagged(REST_TAG);
}

/* ---------------------------------------------------------------------------
 * Taps
 *
 * Every notification carries a `url`, so a tap lands on the exact content —
 * never a generic home screen.
 * ------------------------------------------------------------------------ */

export function onNotificationTap(handler) {
  const extract = (response) => {
    const data =
      (response && response.notification && response.notification.request
        && response.notification.request.content && response.notification.request.content.data) || {};
    if (data.url) handler(data.url, data);
  };

  // A tap that cold-launched the app is delivered here, not to the listener.
  Notifications.getLastNotificationResponseAsync()
    .then((response) => { if (response) extract(response); })
    .catch(() => {});

  const sub = Notifications.addNotificationResponseReceivedListener(extract);
  return () => { try { sub.remove(); } catch (e) {} };
}

// Remember when the Check In prompt actually fired, so lateness is measured
// against the real prompt rather than the end of the window.
export function onCheckInPromptReceived() {
  const sub = Notifications.addNotificationReceivedListener((n) => {
    const data = (n && n.request && n.request.content && n.request.content.data) || {};
    if (data.tag === CHECK_IN_TAG) {
      stSet(NOTIFIED_AT_KEY, String(Date.now())).catch(() => {});
    }
  });
  return () => { try { sub.remove(); } catch (e) {} };
}

export async function getPromptFiredAt() {
  try {
    const raw = await stGet(NOTIFIED_AT_KEY);
    const at = raw ? parseInt(raw, 10) : 0;
    // Only meaningful if it fired today.
    if (!at) return null;
    const then = new Date(at);
    const now = new Date();
    const sameDay =
      then.getFullYear() === now.getFullYear()
      && then.getMonth() === now.getMonth()
      && then.getDate() === now.getDate();
    return sameDay ? at : null;
  } catch (e) {
    return null;
  }
}

/* --------------------------- development helpers ------------------------- */

// Fires the Check In prompt in a few seconds so the flow can be exercised
// without waiting for the window. Guarded by __DEV__ at every call site.
export async function debugFireCheckInPrompt(inSeconds = 3) {
  if ((await getPermission()) !== 'granted') return null;
  return Notifications.scheduleNotificationAsync({
    content: {
      title: '⚡ Time to Check In',
      body: "Show the squad what you're training.",
      data: { tag: CHECK_IN_TAG, url: 'levl://check-in' },
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: inSeconds },
  });
}

export async function listScheduled() {
  try {
    return await Notifications.getAllScheduledNotificationsAsync();
  } catch (e) {
    return [];
  }
}

export default {
  installHandler,
  getPermission,
  requestPermission,
  getPushToken,
  scheduleCheckInPrompts,
  needsReschedule,
  cancelCheckInPrompts,
  scheduleRestAlert,
  cancelRestAlert,
  onNotificationTap,
  onCheckInPromptReceived,
  getPromptFiredAt,
  debugFireCheckInPrompt,
  listScheduled,
};
