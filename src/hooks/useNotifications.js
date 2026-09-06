// LEVL — useNotifications: in-app notification state.
//
// Reads the notifications table (owner-only via RLS), exposes an unread count
// for a badge, and marks things read. Live via Realtime so a new notification
// appears the instant it's written — no polling.

import { useState, useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { isConfigured } from '../services/supabase/client';
import { currentUserId } from '../services/supabase/authService';
import { myNotifications, markRead } from '../services/supabase/notificationService';
import { subscribe } from '../services/supabase/realtimeService';
import { readableError } from '../services/errors';

export function useNotifications(accountKey) {
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [live, setLive] = useState(false);
  const accountRef = useRef(accountKey);
  accountRef.current = accountKey;

  const refresh = useCallback(async () => {
    const requestAccount = accountKey;
    if (!isConfigured || !requestAccount) {
      setItems([]); setUnread(0); setLoading(false); setError(null); return;
    }
    setLoading(true);
    try {
      const list = await myNotifications(50);
      if (accountRef.current !== requestAccount) return;
      if (!list.error && Array.isArray(list.data)) {
        setItems(list.data);
        // Derive the badge from the SAME data as the list, so they can never
        // disagree (the old bug: badge showed a count but the list was empty).
        setUnread(list.data.filter((n) => !n.read).length);
        setError(null);
      } else if (list.error) {
        setError(readableError(list.error, 'Could not refresh activity.'));
      }
    } catch (e) {
      if (accountRef.current === requestAccount) setError(readableError(e, 'Could not refresh activity.'));
    } finally {
      if (accountRef.current === requestAccount) setLoading(false);
    }
  }, [accountKey]);

  // Account changes must clear the previous inbox before the next request.
  useEffect(() => {
    setItems([]); setUnread(0); setLive(false); setError(null);
    refresh();
  }, [accountKey, refresh]);

  // Live: any new notification row for me re-pulls.
  useEffect(() => {
    if (!isConfigured || !accountKey) return undefined;
    let unsub = () => {};
    let alive = true;
    (async () => {
      const uid = await currentUserId();
      if (!uid || !alive) return;
      unsub = subscribe(
        'notifications',
        `user_id=eq.${uid}`,
        () => refresh(),
        (status) => { if (alive) setLive(status === 'SUBSCRIBED'); },
      );
    })();
    const poll = setInterval(refresh, 45000);
    const state = AppState.addEventListener('change', (next) => { if (next === 'active') refresh(); });
    return () => {
      alive = false; setLive(false); clearInterval(poll);
      try { state.remove(); } catch (e) {}
      unsub();
    };
  }, [accountKey, refresh]);

  const markOneRead = useCallback(async (id) => {
    if (!id) return;
    const target = items.find((n) => n.id === id);
    if (!target || target.read) return;
    setItems((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
    setUnread((n) => Math.max(0, n - 1));
    const result = await markRead([id]);
    if (result && result.error) refresh();
  }, [items, refresh]);

  const markAllRead = useCallback(async () => {
    const ids = items.filter((n) => !n.read).map((n) => n.id);
    if (!ids.length) return;
    setUnread(0);                       // optimistic
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    const result = await markRead(ids);
    if (result && result.error) refresh();
  }, [items, refresh]);

  return { items, unread, loading, error, live, refresh, markOneRead, markAllRead };
}
