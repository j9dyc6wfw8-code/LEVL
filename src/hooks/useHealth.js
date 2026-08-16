// ============================================================================
// LEVL — useHealth
//
// Apple Health, as context beside your training.
//
// THE RULE, ONCE MORE, BECAUSE THIS IS THE HOOK THAT WOULD BREAK IT: nothing
// returned here reaches the XP engine, the stat allocation, the Fitness Rating,
// a rank or a duel score. It is displayed and nothing else. It is also never
// written to Supabase and never attached to a Check In — health data stays on
// the device and in the user's own Health app.
//
// Because iOS deliberately refuses to tell an app which READ permissions were
// denied, "connected" is inferred by attempting a read: fields that come back
// are shared, fields that don't are simply absent. Partial permission is the
// normal case and renders as fewer rows, never as an error.
// ============================================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import Health from '../../modules/levl-health';
import { stGet, stSet } from '../services/platform';

const OPTED_IN_KEY = 'levl.health.optedIn.v1';

export function useHealth(enabled) {
  const [available] = useState(() => Health.isAvailable());
  const [optedIn, setOptedIn] = useState(false);
  const [today, setToday] = useState({});
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const alive = useRef(true);

  useEffect(() => () => { alive.current = false; }, []);

  // Whether the user has ever accepted the Health card. Until they have, LEVL
  // never touches HealthKit — no permission sheet at launch, ever.
  useEffect(() => {
    stGet(OPTED_IN_KEY)
      .then((v) => { if (alive.current) setOptedIn(v === '1'); })
      .catch(() => {});
  }, []);

  const refresh = useCallback(async () => {
    if (!available || !optedIn || !enabled) return;
    setLoading(true);
    const probe = await Health.probeConnection();
    if (!alive.current) return;
    setToday(probe.today || {});
    setConnected(!!probe.connected);
    setLoading(false);
  }, [available, optedIn, enabled]);

  useEffect(() => { refresh(); }, [refresh]);

  // Steps and energy move while the app is backgrounded, so re-read on return
  // rather than showing a figure from an hour ago.
  useEffect(() => {
    if (!available || !optedIn || !enabled) return undefined;
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') refresh(); });
    return () => { try { sub.remove(); } catch (e) {} };
  }, [available, optedIn, enabled, refresh]);

  // Called from the Health card, never automatically.
  const connect = useCallback(async () => {
    if (!available) return { available: false };
    const res = await Health.requestAuthorization();
    await stSet(OPTED_IN_KEY, '1').catch(() => {});
    if (alive.current) setOptedIn(true);
    await refresh();
    return res;
  }, [available, refresh]);

  const decline = useCallback(async () => {
    await stSet(OPTED_IN_KEY, '0').catch(() => {});
    if (alive.current) { setOptedIn(false); setConnected(false); setToday({}); }
  }, []);

  /**
   * Save a finished LEVL session to Health.
   *
   * No calorie figure is passed, deliberately: LEVL does not model energy
   * expenditure, and writing an invented number into somebody's health record —
   * which other apps and potentially clinicians read — would be worse than
   * writing nothing at all.
   */
  const saveWorkout = useCallback(async (session, workoutName) => {
    if (!available || !optedIn || !session) return { saved: false, reason: 'not-connected' };
    return Health.saveWorkout({
      sessionId: session.id,
      workoutName: workoutName || session.title,
      startedAtMs: session.startedAt,
      endedAtMs: session.endedAt || Date.now(),
      activity: session.sets > 0 ? 'strength' : 'cardio',
    });
  }, [available, optedIn]);

  // Only rows that genuinely exist. A user who shared steps but hid heart rate
  // sees steps, not a row of dashes.
  const rows = [];
  if (today.steps != null) rows.push({ key: 'steps', label: 'Steps', value: Math.round(today.steps).toLocaleString() });
  if (today.activeEnergy != null) rows.push({ key: 'energy', label: 'Active energy', value: `${Math.round(today.activeEnergy).toLocaleString()} kcal` });
  if (today.exerciseMinutes != null) rows.push({ key: 'exercise', label: 'Exercise', value: `${Math.round(today.exerciseMinutes)} min` });
  if (today.restingHeartRate != null) rows.push({ key: 'rhr', label: 'Resting HR', value: `${Math.round(today.restingHeartRate)} bpm` });
  if (today.sleepMinutes != null) {
    const h = Math.floor(today.sleepMinutes / 60);
    const m = Math.round(today.sleepMinutes % 60);
    rows.push({ key: 'sleep', label: 'Sleep', value: `${h}h ${String(m).padStart(2, '0')}m` });
  }
  if (today.vo2Max != null) rows.push({ key: 'vo2', label: 'VO₂ max', value: String(today.vo2Max) });

  return {
    available,
    optedIn,
    connected,
    loading,
    today,
    rows,
    refresh,
    connect,
    decline,
    saveWorkout,
  };
}

export default useHealth;
