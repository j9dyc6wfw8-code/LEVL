// LEVL — useFriendProfile: a friend's profile + training history, kept live.
//
// Subscribes to Realtime so their stats and sessions update the moment they
// log something, instead of only when the sheet is opened. Requires Realtime
// replication enabled on `profiles` and `workouts` in the Supabase dashboard;
// without it this still works, just refreshed on open rather than live.

import { useState, useEffect, useCallback, useRef } from 'react';
import { isConfigured } from '../services/supabase/client';
import { getProfile } from '../services/supabase/profileService';
import { getUserWorkouts } from '../services/supabase/workoutService';
import { subscribe } from '../services/supabase/realtimeService';

export default function useFriendProfile(userId) {
  const [profile, setProfile] = useState(null);
  const [workouts, setWorkouts] = useState([]);
  const [loading, setLoading] = useState(false);
  const aliveRef = useRef(true);

  const load = useCallback(async () => {
    if (!isConfigured || !userId) { setProfile(null); setWorkouts([]); return; }
    setLoading(true);
    const [p, w] = await Promise.all([getProfile(userId), getUserWorkouts(userId, 100)]);
    if (!aliveRef.current) return;
    setProfile(p && !p.error ? p.data : null);
    setWorkouts(w && !w.error ? (w.data || []) : []);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    aliveRef.current = true;
    load();
    return () => { aliveRef.current = false; };
  }, [load]);

  // Live: their profile row (level/rank/xp) and any new workout they log.
  useEffect(() => {
    if (!isConfigured || !userId) return undefined;
    const offProfile = subscribe('profiles', `id=eq.${userId}`, (payload) => {
      const row = payload && payload.new;
      if (row && row.id === userId) setProfile((prev) => ({ ...(prev || {}), ...row }));
    });
    const offWorkouts = subscribe('workouts', `user_id=eq.${userId}`, () => { load(); });
    return () => { try { offProfile(); } catch (e) {} try { offWorkouts(); } catch (e) {} };
  }, [userId, load]);

  return { profile, workouts, loading, refresh: load };
}

// ---- helpers the UI uses to summarise a training history -------------------

export function summarizeWorkouts(rows) {
  const list = rows || [];
  const days = new Set(list.map((r) => String(r.date).slice(0, 10)));
  return {
    sessions: list.length,
    days: days.size,
    prs: list.filter((r) => r.is_pr).length,
    totalXp: list.reduce((a, r) => a + (r.xp_earned || 0), 0),
  };
}

// Per-exercise rollup: how often, best weight, total XP — newest first.
export function byExercise(rows) {
  const map = {};
  (rows || []).forEach((r) => {
    const k = r.exercise || 'Workout';
    if (!map[k]) map[k] = { name: k, count: 0, best: 0, xp: 0, prs: 0, last: r.date };
    const m = map[k];
    m.count += 1;
    m.xp += r.xp_earned || 0;
    if (r.is_pr) m.prs += 1;
    if ((r.weight || 0) > m.best) m.best = r.weight || 0;
    if (String(r.date) > String(m.last)) m.last = r.date;
  });
  return Object.values(map).sort((a, b) => b.count - a.count);
}
