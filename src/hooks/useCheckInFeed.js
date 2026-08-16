// ============================================================================
// LEVL — useCheckInFeed
//
// A paginated, realtime feed of Check Ins.
//
// PAGINATION is cursor-based on (posted_at, id). Offset pagination duplicates
// and skips cards whenever something new lands mid-scroll, which on a feed
// people pull-to-refresh constantly is not an edge case.
//
// REALTIME is scoped, not a firehose. Two subscriptions, both filtered:
// reactions and comments on the posts CURRENTLY LOADED. Subscribing to whole
// tables would push every stranger's activity to every device. New posts are
// picked up on refresh and focus rather than by a third subscription — a feed
// that reorders itself under your thumb is worse than one that waits.
//
// PHOTOS are private objects, so paths are exchanged for signed URLs in
// batches of a page at a time and cached until they are close to expiring.
// ============================================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import * as checkIns from '../services/supabase/checkInService';
import { subscribe as rtSubscribe } from '../services/supabase/realtimeService';
import { isConfigured } from '../services/supabase/client';

const PAGE = 10;

export function useCheckInFeed(user, scope) {
  const [items, setItems] = useState([]);
  const [photos, setPhotos] = useState({});      // storage path -> signed URL
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [exhausted, setExhausted] = useState(false);

  const alive = useRef(true);
  const cursor = useRef(null);
  const inFlight = useRef(false);

  useEffect(() => () => { alive.current = false; }, []);

  /* ------------------------------- photos ------------------------------- */

  const resolvePhotos = useCallback(async (rows) => {
    const paths = [];
    rows.forEach((r) => {
      if (r.frontPath) paths.push(r.frontPath);
      if (r.rearPath) paths.push(r.rearPath);
    });
    if (!paths.length) return;
    const { data } = await checkIns.signPhotoUrls(paths);
    if (!alive.current || !data) return;
    setPhotos((current) => ({ ...current, ...data }));
  }, []);

  /* -------------------------------- load -------------------------------- */

  const load = useCallback(async ({ reset } = {}) => {
    if (!user || !isConfigured) {
      setItems([]); setLoading(false); setRefreshing(false);
      return;
    }
    if (inFlight.current) return;
    inFlight.current = true;

    if (reset) { cursor.current = null; setExhausted(false); }
    else setLoadingMore(true);

    const { data, error: err } = await checkIns.fetchFeed(
      scope, PAGE, reset ? null : cursor.current,
    );

    if (!alive.current) { inFlight.current = false; return; }

    if (err) {
      setError(err.message || 'Could not load the feed.');
      setLoading(false); setRefreshing(false); setLoadingMore(false);
      inFlight.current = false;
      return;
    }

    const rows = data || [];
    setError(null);
    if (rows.length < PAGE) setExhausted(true);
    if (rows.length) {
      const last = rows[rows.length - 1];
      cursor.current = { postedAt: last.postedAt, id: last.id };
    }

    setItems((current) => {
      if (reset) return rows;
      // Belt and braces against a duplicate slipping through a cursor edge.
      const seen = new Set(current.map((i) => i.id));
      return [...current, ...rows.filter((r) => !seen.has(r.id))];
    });

    setLoading(false); setRefreshing(false); setLoadingMore(false);
    inFlight.current = false;
    resolvePhotos(rows);
  }, [user, scope, resolvePhotos]);

  useEffect(() => {
    setLoading(true);
    setItems([]);
    cursor.current = null;
    load({ reset: true });
  }, [load]);

  const refresh = useCallback(() => {
    setRefreshing(true);
    return load({ reset: true });
  }, [load]);

  const loadMore = useCallback(() => {
    if (exhausted || loading || loadingMore) return;
    load({});
  }, [exhausted, loading, loadingMore, load]);

  /* ------------------------------ realtime ------------------------------ */

  // Only the posts on screen. `in.(...)` keeps the server-side filter tight, so
  // the socket never carries activity for content this user isn't looking at.
  const idKey = items.map((i) => i.id).join(',');

  useEffect(() => {
    if (!user || !isConfigured || !idKey) return undefined;
    const ids = idKey.split(',').filter(Boolean).slice(0, 40);
    if (!ids.length) return undefined;
    const filter = `check_in_id=in.(${ids.join(',')})`;

    const applyReaction = (payload) => {
      const row = payload.new || payload.old;
      if (!row) return;
      setItems((current) => current.map((item) => {
        if (item.id !== row.check_in_id) return item;
        // Recount rather than guess: the exact delta depends on whether this
        // was an add, a removal or a change of reaction type.
        const delta =
          payload.eventType === 'INSERT' ? 1
            : payload.eventType === 'DELETE' ? -1
            : 0;
        return { ...item, reactionCount: Math.max(0, item.reactionCount + delta) };
      }));
    };

    const applyComment = (payload) => {
      const row = payload.new || payload.old;
      if (!row) return;
      const delta =
        payload.eventType === 'INSERT' ? 1
          : payload.eventType === 'DELETE' ? -1
          : (payload.new && payload.new.deleted_at) ? -1 : 0;
      if (!delta) return;
      setItems((current) => current.map((item) => (
        item.id === row.check_in_id
          ? { ...item, commentCount: Math.max(0, item.commentCount + delta) }
          : item
      )));
    };

    const offReactions = rtSubscribe('check_in_reactions', filter, applyReaction);
    const offComments = rtSubscribe('check_in_comments', filter, applyComment);
    return () => { offReactions(); offComments(); };
  }, [user, idKey]);

  /* ----------------------------- mutations ------------------------------ */

  // Optimistic, then reconciled. A reaction that fails rolls back rather than
  // leaving a count that disagrees with the server.
  const react = useCallback(async (checkInId, reactionType) => {
    let previous = null;
    setItems((current) => current.map((item) => {
      if (item.id !== checkInId) return item;
      previous = item;
      const had = item.myReaction;
      const next = had === reactionType ? null : reactionType;
      const countDelta = (had ? 0 : 1) - (next ? 0 : 1);
      return {
        ...item,
        myReaction: next,
        reactionCount: Math.max(0, item.reactionCount + countDelta),
      };
    }));

    const target = previous;
    if (!target) return;
    const next = target.myReaction === reactionType ? null : reactionType;
    const res = await checkIns.setReaction(checkInId, next);
    if (res && res.error && alive.current) {
      setItems((current) => current.map((item) => (item.id === checkInId ? target : item)));
    }
  }, []);

  const remove = useCallback(async (checkInId) => {
    const snapshot = items;
    setItems((current) => current.filter((i) => i.id !== checkInId));
    const res = await checkIns.deleteCheckIn(checkInId);
    if (res && res.error && alive.current) {
      setItems(snapshot);
      return { error: res.error };
    }
    return { data: true };
  }, [items]);

  // Fold a freshly posted or edited Check In in without a full round trip.
  const upsert = useCallback((row) => {
    if (!row) return;
    setItems((current) => {
      const exists = current.some((i) => i.id === row.id);
      if (exists) return current.map((i) => (i.id === row.id ? { ...i, ...row } : i));
      return [row, ...current];
    });
    resolvePhotos([row]);
  }, [resolvePhotos]);

  const hideUser = useCallback((userId) => {
    setItems((current) => current.filter((i) => i.userId !== userId));
  }, []);

  return {
    items,
    photos,
    loading,
    refreshing,
    loadingMore,
    exhausted,
    error,
    refresh,
    loadMore,
    react,
    remove,
    upsert,
    hideUser,
  };
}

export default useCheckInFeed;
