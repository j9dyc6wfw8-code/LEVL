// LEVL — both players' public workout rows for one active duel.
//
// Realtime is the fast path: a new synced set triggers a debounced re-query for
// both fighters. Foreground refresh and a quiet 15-second poll are deliberate
// fallbacks, so a temporarily disconnected websocket never leaves the screen
// frozen for the rest of the duel.

import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { isConfigured } from '../services/supabase/client';
import { getWorkoutsBetween } from '../services/supabase/workoutService';
import { subscribe } from '../services/supabase/realtimeService';

const POLL_MS = 15000;
const BURST_DEBOUNCE_MS = 220;

export default function useDuelWorkouts({ duelId, meId, theirId, startISO, endISO }) {
  const [mine, setMine] = useState([]);
  const [theirs, setTheirs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [live, setLive] = useState(false);

  const aliveRef = useRef(true);
  const requestRef = useRef(0);
  const hasLoadedRef = useRef(false);
  const burstTimerRef = useRef(null);
  const statusesRef = useRef({ mine: 'CONNECTING', theirs: 'CONNECTING' });

  const load = useCallback(async (showRefresh = false) => {
    if (!isConfigured || !duelId || !meId || !theirId) {
      setMine([]);
      setTheirs([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const requestId = ++requestRef.current;
    if (!hasLoadedRef.current) setLoading(true);
    else if (showRefresh) setRefreshing(true);

    const [myResult, theirResult] = await Promise.all([
      getWorkoutsBetween(meId, startISO, endISO, 500),
      getWorkoutsBetween(theirId, startISO, endISO, 500),
    ]);
    if (!aliveRef.current || requestId !== requestRef.current) return;

    const myError = myResult && myResult.error;
    const theirError = theirResult && theirResult.error;
    if (!myError) setMine((myResult && myResult.data) || []);
    if (!theirError) setTheirs((theirResult && theirResult.data) || []);

    const nextError = myError || theirError;
    setError(nextError ? String(nextError.message || 'Could not refresh duel activity') : null);
    if (!nextError) setLastUpdated(Date.now());
    hasLoadedRef.current = true;
    setLoading(false);
    setRefreshing(false);
  }, [duelId, meId, theirId, startISO, endISO]);

  useEffect(() => {
    aliveRef.current = true;
    hasLoadedRef.current = false;
    setMine([]);
    setTheirs([]);
    setError(null);
    setLastUpdated(null);
    load(false);
    return () => {
      aliveRef.current = false;
      requestRef.current += 1;
      if (burstTimerRef.current) clearTimeout(burstTimerRef.current);
    };
  }, [load]);

  useEffect(() => {
    if (!isConfigured || !duelId || !meId || !theirId) return undefined;
    statusesRef.current = { mine: 'CONNECTING', theirs: 'CONNECTING' };
    setLive(false);

    const scheduleLoad = () => {
      if (burstTimerRef.current) clearTimeout(burstTimerRef.current);
      burstTimerRef.current = setTimeout(() => load(false), BURST_DEBOUNCE_MS);
    };
    const setStatus = (side, status) => {
      if (!aliveRef.current) return;
      statusesRef.current = { ...statusesRef.current, [side]: status };
      setLive(statusesRef.current.mine === 'SUBSCRIBED' && statusesRef.current.theirs === 'SUBSCRIBED');
    };

    const offMine = subscribe(
      'workouts',
      `user_id=eq.${meId}`,
      scheduleLoad,
      (status) => setStatus('mine', status)
    );
    const offTheirs = subscribe(
      'workouts',
      `user_id=eq.${theirId}`,
      scheduleLoad,
      (status) => setStatus('theirs', status)
    );

    const poll = setInterval(() => load(false), POLL_MS);
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') load(false);
    });

    return () => {
      if (burstTimerRef.current) clearTimeout(burstTimerRef.current);
      clearInterval(poll);
      try { appState.remove(); } catch (e) {}
      try { offMine(); } catch (e) {}
      try { offTheirs(); } catch (e) {}
    };
  }, [duelId, meId, theirId, load]);

  const refresh = useCallback(() => load(true), [load]);

  return { mine, theirs, loading, refreshing, error, lastUpdated, live, refresh };
}
