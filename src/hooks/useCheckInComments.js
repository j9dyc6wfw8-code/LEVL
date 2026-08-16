// ============================================================================
// LEVL — useCheckInComments
//
// Comments for one Check In. Realtime, optimistic, and scoped to the single
// post whose sheet is open — the subscription is created when the sheet opens
// and torn down when it closes, so a feed of forty cards never holds forty
// sockets.
// ============================================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import * as checkIns from '../services/supabase/checkInService';
import { subscribe as rtSubscribe } from '../services/supabase/realtimeService';
import { isConfigured } from '../services/supabase/client';
import { currentUserId } from '../services/supabase/authService';

export function useCheckInComments(checkInId, enabled) {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sending, setSending] = useState(false);
  const [me, setMe] = useState(null);
  const alive = useRef(true);

  useEffect(() => () => { alive.current = false; }, []);

  useEffect(() => {
    if (!enabled) return;
    currentUserId().then((id) => { if (alive.current) setMe(id); });
  }, [enabled]);

  const load = useCallback(async () => {
    if (!checkInId || !enabled || !isConfigured) { setComments([]); return; }
    setLoading(true);
    const { data, error: err } = await checkIns.listComments(checkInId);
    if (!alive.current) return;
    if (err) setError(err.message || 'Could not load comments.');
    else { setError(null); setComments(data || []); }
    setLoading(false);
  }, [checkInId, enabled]);

  useEffect(() => { load(); }, [load]);

  // One subscription, one post.
  useEffect(() => {
    if (!checkInId || !enabled || !isConfigured) return undefined;
    const off = rtSubscribe(
      'check_in_comments',
      `check_in_id=eq.${checkInId}`,
      (payload) => {
        // A soft delete arrives as an UPDATE, not a DELETE.
        if (payload.eventType === 'DELETE'
          || (payload.new && payload.new.deleted_at)) {
          const goneId = (payload.old && payload.old.id) || (payload.new && payload.new.id);
          setComments((current) => current.filter((c) => c.id !== goneId));
          return;
        }
        if (payload.eventType === 'INSERT') {
          // Reload rather than render a row with no author: the realtime
          // payload carries the comment, not the poster's profile.
          load();
        }
      },
    );
    return off;
  }, [checkInId, enabled, load]);

  const add = useCallback(async (body) => {
    const clean = checkIns.sanitiseComment(body);
    if (!clean) return { error: { message: 'Write something first.' } };

    // Optimistic, with a temporary id so the reconciling reload can replace it.
    const tempId = 'temp-' + Date.now();
    const optimistic = {
      id: tempId,
      checkInId,
      userId: me,
      body: clean,
      createdAt: new Date().toISOString(),
      createdAtMs: Date.now(),
      author: null,
      pending: true,
    };
    setComments((current) => [...current, optimistic]);
    setSending(true);

    const res = await checkIns.addComment(checkInId, clean);
    if (!alive.current) return res;
    setSending(false);

    if (res.error) {
      setComments((current) => current.filter((c) => c.id !== tempId));
      return { error: res.error };
    }
    await load();
    return { data: res.data };
  }, [checkInId, me, load]);

  const remove = useCallback(async (commentId) => {
    const snapshot = comments;
    setComments((current) => current.filter((c) => c.id !== commentId));
    const res = await checkIns.deleteComment(commentId);
    if (res && res.error && alive.current) {
      setComments(snapshot);
      return { error: res.error };
    }
    return { data: true };
  }, [comments]);

  const report = useCallback(async (comment, reason) => (
    checkIns.reportContent({
      targetType: 'comment',
      targetId: comment.id,
      targetUser: comment.userId,
      reason,
    })
  ), []);

  return { comments, loading, error, sending, me, reload: load, add, remove, report };
}

export default useCheckInComments;
