// ============================================================================
// LEVL — useCheckInPreferences
//
// The user's Check In window, default audience and notification switches.
//
// The timezone is refreshed from the device on every load rather than stored
// once at sign-up: somebody who flies to another country should be prompted
// during THEIR training window there, not the one they left behind.
// ============================================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import * as Localization from 'expo-localization';
import * as checkIns from '../services/supabase/checkInService';
import notifications from '../services/notifications';

export function deviceTimezone() {
  try {
    const zones = Localization.getCalendars();
    const tz = zones && zones[0] && zones[0].timeZone;
    if (tz) return tz;
  } catch (e) {}
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch (e) {
    return 'UTC';
  }
}

// The four presets, plus a custom range. Chosen to match how people actually
// describe when they train, rather than making them scroll a clock.
export const WINDOW_PRESETS = [
  { key: 'morning',   label: 'Morning',   sub: '6 – 9 AM',   start: 6 * 60,  end: 9 * 60 },
  { key: 'midday',    label: 'Midday',    sub: '11 AM – 2 PM', start: 11 * 60, end: 14 * 60 },
  { key: 'afternoon', label: 'Afternoon', sub: '2 – 5 PM',   start: 14 * 60, end: 17 * 60 },
  { key: 'evening',   label: 'Evening',   sub: '5 – 8 PM',   start: 17 * 60, end: 20 * 60 },
];

export function formatMinute(minute) {
  const m = Math.max(0, Math.min(1439, Math.round(minute || 0)));
  const h24 = Math.floor(m / 60);
  const mm = m % 60;
  const suffix = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return mm === 0 ? `${h12} ${suffix}` : `${h12}:${String(mm).padStart(2, '0')} ${suffix}`;
}

export function windowLabel(prefs) {
  if (!prefs) return '';
  const preset = WINDOW_PRESETS.find(
    (p) => p.start === prefs.window_start_minute && p.end === prefs.window_end_minute,
  );
  if (preset) return `${preset.label} · ${preset.sub}`;
  return `${formatMinute(prefs.window_start_minute)} – ${formatMinute(prefs.window_end_minute)}`;
}

export function useCheckInPreferences(user) {
  const [prefs, setPrefs] = useState(null);
  const [loading, setLoading] = useState(true);
  const [permission, setPermission] = useState('undetermined');
  const alive = useRef(true);

  useEffect(() => () => { alive.current = false; }, []);

  const load = useCallback(async () => {
    if (!user) { setPrefs(null); setLoading(false); return; }
    setLoading(true);
    const [{ data }, perm] = await Promise.all([
      checkIns.getPreferences(),
      notifications.getPermission(),
    ]);
    if (!alive.current) return;
    setPermission(perm);

    const tz = deviceTimezone();
    const merged = { ...checkIns.DEFAULT_PREFERENCES, ...(data || {}), timezone: tz };
    setPrefs(merged);
    setLoading(false);

    // Persist the row the first time, and whenever the device has moved to a
    // different timezone, so the server's lateness maths stays correct.
    if (!data || data.timezone !== tz) {
      checkIns.savePreferences(data ? { timezone: tz } : merged).catch(() => {});
    }

    // Keep the local prompt schedule in step with whatever we just loaded.
    if (await notifications.needsReschedule(merged)) {
      notifications.scheduleCheckInPrompts(merged).catch(() => {});
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const update = useCallback(async (patch) => {
    // Optimistic: settings toggles must feel instant.
    setPrefs((current) => (current ? { ...current, ...patch } : current));
    const res = await checkIns.savePreferences(patch);
    if (res && res.error) {
      await load();     // roll back to server truth
      return { error: res.error };
    }
    const next = { ...(prefs || checkIns.DEFAULT_PREFERENCES), ...patch };
    // Any change to the window or the switch reshuffles the prompts.
    if (
      'window_start_minute' in patch
      || 'window_end_minute' in patch
      || 'enabled' in patch
      || 'notify_check_in' in patch
    ) {
      notifications.scheduleCheckInPrompts(next).catch(() => {});
    }
    return { data: next };
  }, [prefs, load]);

  // Turning the reminder on is the moment the permission prompt makes sense —
  // the user has just told us they want to be reminded.
  const enableReminders = useCallback(async () => {
    const status = await notifications.requestPermission();
    setPermission(status);
    if (status !== 'granted') return { status };
    const res = await update({ enabled: true, notify_check_in: true });
    // Register for push at the same moment, for the categories that need a
    // server (a friend reacting, a duel result). Harmless when unconfigured.
    const token = await notifications.getPushToken();
    if (token) checkIns.savePreferences({ expo_push_token: token }).catch(() => {});
    return { status, ...res };
  }, [update]);

  return { prefs, loading, permission, reload: load, update, enableReminders };
}

export default useCheckInPreferences;
