// LEVL — useFriendProfile: a friend's profile + training history, kept live.
//
// Subscribes to Realtime so their stats and sessions update the moment they log
// something, instead of only when the sheet is opened. Requires Realtime
// replication on `profiles` and `workouts`; without it this still works, just
// refreshed on open rather than live.
//
// ============================ WHY THIS WAS LAGGY ============================
// Three compounding problems, all fixed here:
//
// 1. THUNDERING RELOAD. The workouts subscription called the full loader on
//    every single row event:
//        subscribe('workouts', filter, () => { load(); })
//    `load()` re-fetched the profile AND 100 workout rows. Logging is per-SET
//    and the Train tab has a 1–10 sets stepper, so one friend tapping "log"
//    could fire ten events => ten round-trips and ten full re-renders. Events
//    are now coalesced into a single trailing reload, and a workout event only
//    refetches workouts — the profile row hasn't changed.
//
// 2. ROLLUPS ON EVERY RENDER. summarizeWorkouts() and byExercise() were called
//    in the consumer's render body, so both walked all 100 rows (and byExercise
//    built a map and sorted it) on every keystroke in the Friends search box,
//    every realtime tick and every view-toggle. They're memoised in here now,
//    keyed on the rows, so the UI cannot reintroduce the problem.
//
// 3. A LYING COUNT. `sessions: list.length` counted ROWS, and a row is one set.
//    With batch logging that reads as "247 sessions" for a few weeks of
//    training. Rows carry `session_id`, so sessions are now counted properly and
//    sets are reported separately.
// ===========================================================================

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { isConfigured } from '../services/supabase/client';
import { getProfile } from '../services/supabase/profileService';
import { getUserWorkouts } from '../services/supabase/workoutService';
import { subscribe } from '../services/supabase/realtimeService';

const HISTORY_LIMIT = 100;
const COALESCE_MS = 700;   // one trailing reload per burst of set logs

export default function useFriendProfile(userId) {
  const [profile, setProfile] = useState(null);
  const [workouts, setWorkouts] = useState([]);
  const [loading, setLoading] = useState(false);
  const aliveRef = useRef(true);
  const burstRef = useRef(null);

  /* Full load — profile + history. Used on open and on manual refresh. */
  const load = useCallback(async () => {
    if (!isConfigured || !userId) { setProfile(null); setWorkouts([]); return; }
    setLoading(true);
    const [p, w] = await Promise.all([getProfile(userId), getUserWorkouts(userId, HISTORY_LIMIT)]);
    if (!aliveRef.current) return;
    setProfile(p && !p.error ? p.data : null);
    setWorkouts(w && !w.error ? (w.data || []) : []);
    setLoading(false);
  }, [userId]);

  /* History only. A new set changes their workouts, not their profile row —
     refetching both doubled the payload for no reason. */
  const loadWorkouts = useCallback(async () => {
    if (!isConfigured || !userId) return;
    const w = await getUserWorkouts(userId, HISTORY_LIMIT);
    if (!aliveRef.current) return;
    if (w && !w.error) setWorkouts(w.data || []);
  }, [userId]);

  useEffect(() => {
    aliveRef.current = true;
    load();
    return () => {
      aliveRef.current = false;
      if (burstRef.current) { clearTimeout(burstRef.current); burstRef.current = null; }
    };
  }, [load]);

  // Live: their profile row (level/rank/xp) and any new set they log.
  useEffect(() => {
    if (!isConfigured || !userId) return undefined;

    const offProfile = subscribe('profiles', `id=eq.${userId}`, (payload) => {
      const row = payload && payload.new;
      if (row && row.id === userId) setProfile((prev) => ({ ...(prev || {}), ...row }));
    });

    // Trailing debounce: a ten-set batch lands as ONE refetch, not ten.
    const offWorkouts = subscribe('workouts', `user_id=eq.${userId}`, () => {
      if (burstRef.current) clearTimeout(burstRef.current);
      burstRef.current = setTimeout(() => {
        burstRef.current = null;
        loadWorkouts();
      }, COALESCE_MS);
    });

    return () => {
      try { offProfile(); } catch (e) {}
      try { offWorkouts(); } catch (e) {}
      if (burstRef.current) { clearTimeout(burstRef.current); burstRef.current = null; }
    };
  }, [userId, loadWorkouts]);

  /* Derived data, memoised on the rows. The consumer gets finished numbers so
     it can't accidentally recompute them per render. */
  const summary = useMemo(() => summarizeWorkouts(workouts), [workouts]);
  const exercises = useMemo(() => byExercise(workouts), [workouts]);
  const recent = useMemo(() => recentLifts(workouts, 25), [workouts]);

  return { profile, workouts, summary, exercises, recent, loading, refresh: load };
}

/* ---- helpers the UI uses to summarise a training history ------------------ */

export function summarizeWorkouts(rows) {
  const list = rows || [];
  const days = new Set();
  const sessions = new Set();
  let prs = 0, totalXp = 0, bestLift = 0, bestName = '';

  for (const r of list) {
    const day = String(r.date).slice(0, 10);
    days.add(day);
    // Legacy rows predate session_id; fall back to the day so they still group.
    sessions.add(r.session_id || 'day:' + day);
    if (r.is_pr) prs += 1;
    totalXp += r.xp_earned || 0;
    if ((r.weight || 0) > bestLift) { bestLift = r.weight || 0; bestName = r.exercise || ''; }
  }

  return {
    sets: list.length,          // one row == one logged set
    sessions: sessions.size,    // what "sessions" actually means
    days: days.size,
    prs,
    totalXp,
    bestLift,
    bestName,
    unit: (list.find((r) => r.unit) || {}).unit || 'kg',
  };
}

// Per-exercise rollup: how often, best weight, total XP — most-trained first.
export function byExercise(rows) {
  const map = {};
  (rows || []).forEach((r) => {
    const k = r.exercise || 'Workout';
    if (!map[k]) map[k] = { name: k, sets: 0, best: 0, xp: 0, prs: 0, last: r.date, unit: r.unit || 'kg' };
    const m = map[k];
    m.sets += 1;
    m.xp += r.xp_earned || 0;
    if (r.is_pr) m.prs += 1;
    if ((r.weight || 0) > m.best) { m.best = r.weight || 0; m.unit = r.unit || m.unit; }
    if (String(r.date) > String(m.last)) m.last = r.date;
  });
  return Object.values(map).sort((a, b) => b.sets - a.sets);
}

/* Recent LIFTS specifically — the thing you actually want to see on someone
   else's profile. Cardio rows carry no weight, so they'd otherwise pad the list
   with blank entries; they're kept but marked so the UI can render them right. */
export function recentLifts(rows, limit = 25) {
  return (rows || [])
    .slice(0, limit)
    .map((r) => ({
      id: r.id,
      exercise: r.exercise || 'Workout',
      weight: r.weight || 0,
      reps: r.reps || 0,
      unit: r.unit || 'kg',
      rpe: r.rpe || null,
      duration: r.duration || 0,
      isLift: !!(r.weight && r.reps),
      isPR: !!r.is_pr,
      xp: r.xp_earned || 0,
      date: r.date,
    }));
}
