// LEVL — useFriends: all social state in one reusable hook.
//
// Screens call this instead of touching services directly, so the Friends UI
// stays declarative: it renders whatever the hook exposes. Every action returns
// a plain result and never throws; when the backend is off, lists are simply
// empty and actions are no-ops, so the app is fully usable offline.

import { useState, useCallback, useEffect, useRef } from 'react';
import { isConfigured } from '../services/supabase/client';
import {
  listFriends, incomingRequests, sendRequest, acceptRequest,
  declineRequest, removeFriend,
} from '../services/supabase/friendService';
import { searchProfiles, getProfile } from '../services/supabase/profileService';
import { getUserWorkouts, friendsFeed } from '../services/supabase/workoutService';
import { currentUserId } from '../services/supabase/authService';
import { subscribe } from '../services/supabase/realtimeService';

export function useFriends(accountKey) {
  const [friends, setFriends] = useState([]);
  const [requests, setRequests] = useState([]);
  const [feed, setFeed] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const accountRef = useRef(accountKey);
  accountRef.current = accountKey;

  // Pull the friend list + pending requests together.
  const refresh = useCallback(async () => {
    const requestAccount = accountKey;
    if (!isConfigured || !requestAccount) {
      setFriends([]); setRequests([]); setFeed([]); setLoading(false); setError(null); return;
    }
    setLoading(true); setError(null);
    try {
      const [f, r] = await Promise.all([listFriends(), incomingRequests()]);
      if (accountRef.current !== requestAccount) return;
      if (!f.error && f.data) setFriends(f.data);
      if (!r.error && r.data) {
        // flatten the joined profile so the UI has a flat shape
        setRequests(r.data.map((row) => ({
          senderId: row.sender,
          created_at: row.created_at,
          profile: row.profiles || null,
        })));
      }
      if (f.error) setError(f.error.message);

      // activity feed across my friends (best-effort; never blocks the list)
      if (!f.error && f.data) {
        const ids = f.data.map((x) => x.id);
        const { data: fd } = await friendsFeed(ids, 40);
        if (accountRef.current === requestAccount && fd) setFeed(fd);
      }
    } catch (e) {
      if (accountRef.current === requestAccount) setError(String(e && e.message || e));
    } finally {
      if (accountRef.current === requestAccount) setLoading(false);
    }
  }, [accountKey]);

  useEffect(() => {
    setFriends([]); setRequests([]); setFeed([]); setError(null); setLoading(false);
    refresh();
  }, [accountKey, refresh]);

  // Live updates: when a friend request or friendship row changes for me,
  // re-pull the lists. Supabase pushes these over a websocket, so a request
  // appears the instant it's sent — no manual refresh. Cleans up on unmount.
  useEffect(() => {
    if (!isConfigured || !accountKey) return undefined;
    let unsubReq = () => {};
    let unsubFriends = () => {};
    let alive = true;
    (async () => {
      const uid = await currentUserId();
      if (!uid || !alive) return;
      unsubReq = subscribe('friend_requests', `receiver=eq.${uid}`, () => refresh());
      // friends table has two possible columns for me; subscribe unfiltered and
      // let refresh() sort out membership (the table is small per user).
      unsubFriends = subscribe('friends', null, () => refresh());
    })();
    return () => { alive = false; unsubReq(); unsubFriends(); };
  }, [accountKey, refresh]);

  // --- actions. Each refreshes on success so the UI stays in step. ---

  const search = useCallback(async (query) => {
    if (!isConfigured) return [];
    const { data, error: e } = await searchProfiles(query);
    if (e) { setError(e.message); return []; }
    return data || [];
  }, []);

  const add = useCallback(async (userId) => {
    const { error: e } = await sendRequest(userId);
    if (e && !e.offline) { setError(e.message); return false; }
    return !e;
  }, []);

  /* IN-FLIGHT GUARD.
   *
   * Accept and decline had none, and the failure was worse than a wasted
   * request. accept_friend_request() is correctly strict: it requires a PENDING
   * request, so the second of a double-tap finds the row already accepted and
   * raises "No pending request from that person." The user tapped once as far
   * as they are concerned, it worked, and they were shown an error.
   *
   * Tracked per id rather than one global flag so answering one request never
   * freezes the others in the list. The duel buttons already used a single
   * boolean; this is the same idea with the right granularity.
   */
  const [pendingIds, setPendingIds] = useState([]);
  const isPending = useCallback((id) => pendingIds.indexOf(id) >= 0, [pendingIds]);

  // Ref as well as state: two taps in the same frame both read the old state,
  // so the state alone cannot reject the second one.
  const inFlight = useRef(new Set());
  const guarded = useCallback(async (id, run) => {
    if (!id || inFlight.current.has(id)) return false;
    inFlight.current.add(id);
    setPendingIds((p) => (p.indexOf(id) >= 0 ? p : [...p, id]));
    try {
      const { error: e } = await run();
      if (e && !e.offline) setError(e.message);
      if (!e) await refresh();
      return !e;
    } finally {
      inFlight.current.delete(id);
      setPendingIds((p) => p.filter((x) => x !== id));
    }
  }, [refresh]);

  const accept = useCallback(
    (senderId) => guarded(senderId, () => acceptRequest(senderId)), [guarded]);

  const decline = useCallback(
    (senderId) => guarded(senderId, () => declineRequest(senderId)), [guarded]);

  const unfriend = useCallback(
    (userId) => guarded(userId, () => removeFriend(userId)), [guarded]);

  const viewProfile = useCallback(async (userId) => {
    if (!isConfigured) return { profile: null, workouts: [] };
    const [p, w] = await Promise.all([getProfile(userId), getUserWorkouts(userId, 20)]);
    return {
      profile: p.error ? null : p.data,
      workouts: w.error ? [] : (w.data || []),
    };
  }, []);

  return {
    friends, requests, feed, loading, error,
    isPending,
    available: !!accountKey,
    refresh, search, add, accept, decline, unfriend, viewProfile,
  };
}
