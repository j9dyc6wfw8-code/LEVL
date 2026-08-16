// ============================================================================
// LEVL — useCheckIn
//
// Today's Check In: whether it exists, posting it, attaching a workout to it
// afterwards, and the pending-upload state when the gym wifi gives up.
//
// The XP path is the part worth reading twice. This hook NEVER decides how much
// XP a Check In is worth — it asks the server, receives the amount actually
// granted, and hands that to the caller to add to the local save. A repeat call
// returns zero, so post/delete/repost earns nothing the second time.
// ============================================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import * as checkIns from '../services/supabase/checkInService';
import upload from '../services/checkInUpload';
import notifications from '../services/notifications';
import { dayKeyOf } from '../engine/engine';
import { isConfigured } from '../services/supabase/client';

// The poster's own local calendar day, as YYYY-MM-DD. Built from local date
// parts rather than toISOString(), which would silently shift the day for
// anyone west of UTC after their afternoon session.
export function localDateKey(t) {
  const d = new Date(t || Date.now());
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-');
}

export function useCheckIn(user, prefs) {
  const [today, setToday] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(null);
  const [posting, setPosting] = useState(false);
  const [stats, setStats] = useState(null);
  const alive = useRef(true);

  useEffect(() => () => { alive.current = false; }, []);

  const localDate = localDateKey();

  const load = useCallback(async () => {
    if (!user || !isConfigured) {
      setToday(null); setLoading(false); return;
    }
    setLoading(true);
    const [mine, queued, s] = await Promise.all([
      checkIns.getMyCheckIn(localDate),
      upload.readPending(),
      checkIns.getStats(null),
    ]);
    if (!alive.current) return;
    setToday((mine && mine.data) || null);
    setPending(queued);
    setStats((s && s.data) || null);
    setLoading(false);
  }, [user, localDate]);

  useEffect(() => { load(); }, [load]);

  /* --------------------------- pending uploads --------------------------- */

  // Push the queue whenever there is a chance the network came back: on mount,
  // and every time the app returns to the foreground. This is what makes a
  // Check In captured on gym wifi eventually land without the user doing
  // anything.
  const flush = useCallback(async () => {
    const queued = await upload.readPending();
    if (!queued) return null;
    setPosting(true);
    const result = await upload.flushPending();
    if (!alive.current) return result;
    setPosting(false);

    if (result.status === 'done') {
      setPending(null);
      await load();
    } else if (result.status === 'pending') {
      setPending(result.job || queued);
    }
    return result;
  }, [load]);

  useEffect(() => {
    if (!user) return undefined;
    flush();
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') flush(); });
    return () => { try { sub.remove(); } catch (e) {} };
  }, [user, flush]);

  // Anything the delete trigger queued but this device never managed to remove.
  useEffect(() => {
    if (!user || !isConfigured) return;
    checkIns.drainStorageCleanup().catch(() => {});
  }, [user]);

  /* ------------------------------- posting ------------------------------- */

  /**
   * Post a Check In. Returns { ok, checkIn, xp, error }.
   *
   * The photographs are compressed and written to durable storage BEFORE any
   * network call, so a failure here never loses the capture — it becomes a
   * pending job that retries itself.
   */
  const post = useCallback(async (capture, options) => {
    setPosting(true);
    try {
      const firedAt = await notifications.getPromptFiredAt();
      await upload.createPending({
        frontUri: capture.front,
        rearUri: capture.rear,
        localDate,
        timezone: (prefs && prefs.timezone) || 'UTC',
        visibility: (options && options.visibility)
          || (prefs && prefs.default_visibility)
          || 'friends',
        primaryPhoto: (options && options.primaryPhoto) || 'rear',
        workoutSessionId: (options && options.workoutSessionId) || null,
        altText: (options && options.altText) || null,
        caption: (options && options.caption) || null,
        windowEndMinute: prefs ? prefs.window_end_minute : null,
        notifiedAt: firedAt,
        simultaneous: capture.simultaneous,
        gapMs: capture.gapMs,
      });

      const result = await upload.flushPending();
      if (!alive.current) return { ok: false };

      if (result.status === 'done') {
        setPending(null);
        await load();
        return { ok: true, checkInId: result.checkInId, verified: result.verified, xp: result.xp, xpDetail: result.xpDetail };
      }
      setPending(result.job || null);
      return { ok: false, queued: true, error: result.error };
    } catch (e) {
      return { ok: false, error: String((e && e.message) || e) };
    } finally {
      if (alive.current) setPosting(false);
    }
  }, [localDate, prefs, load]);

  /* -------------------- attach a workout after posting ------------------- */

  /**
   * Turn today's Check In into a Verified Session.
   *
   * Used both from the composer and from the workout-completion prompt — the
   * "I checked in at 9pm, finished training at 10pm" case. The server verifies
   * the workout is yours and from the right day, recomputes the public summary
   * itself, and pays only the incremental bonus (never the daily award again).
   */
  const attachWorkout = useCallback(async (sessionId) => {
    if (!today) return { error: { message: 'No Check In today yet.' } };
    const res = await checkIns.attachWorkout(today.id, sessionId);
    if (res.error) return { error: res.error };

    const updated = res.data;
    if (alive.current) setToday(updated);

    const verified = updated && updated.check_in_type === 'verified';
    const settled = await upload.settleXP(localDate, verified);
    return { data: updated, verified, xp: settled.granted || 0, xpDetail: settled.detail || [] };
  }, [today, localDate]);

  const detachWorkout = useCallback(async () => {
    if (!today) return { error: { message: 'No Check In today yet.' } };
    const res = await checkIns.attachWorkout(today.id, null);
    if (!res.error && alive.current) setToday(res.data);
    // No XP is refunded: the verified bonus stays spent for the day, which is
    // what stops detach/reattach from being an XP tap.
    return res;
  }, [today]);

  const setVisibility = useCallback(async (visibility) => {
    if (!today) return { error: { message: 'No Check In today yet.' } };
    const res = await checkIns.setVisibility(today.id, visibility);
    if (!res.error && alive.current) setToday(res.data);
    return res;
  }, [today]);

  const remove = useCallback(async () => {
    if (!today) return { error: { message: 'Nothing to delete.' } };
    const res = await checkIns.deleteCheckIn(today.id);
    if (!res.error && alive.current) { setToday(null); load(); }
    return res;
  }, [today, load]);

  const discardPending = useCallback(async () => {
    await upload.discardPending();
    if (alive.current) setPending(null);
  }, []);

  return {
    today,
    hasCheckedIn: !!today,
    verified: !!(today && today.check_in_type === 'verified'),
    localDate,
    todayKey: dayKeyOf(Date.now()),
    loading,
    posting,
    pending,
    stats,
    reload: load,
    post,
    retry: flush,
    discardPending,
    attachWorkout,
    detachWorkout,
    setVisibility,
    remove,
  };
}

export default useCheckIn;
