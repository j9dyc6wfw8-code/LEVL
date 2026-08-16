// LEVL — realtimeService: live push from Supabase.
//
// Supabase Realtime lets the database push row changes to the app over a
// websocket, so the UI updates the instant something happens — a friend
// request arrives, a duel score ticks — with no manual refresh.
//
// This service exposes ONE function: subscribe(). You give it a table, an
// optional filter, and a callback; it returns an unsubscribe function. Every
// screen/hook that wants live data calls this rather than touching the
// websocket directly.
//
// Safe by design: if the backend isn't configured, subscribe() returns a no-op
// unsubscribe and does nothing. Nothing breaks offline.

import { supabase, isConfigured } from './client';

let channelSeq = 0;

// Subscribe to INSERT/UPDATE/DELETE on a table.
//   table    — e.g. 'friend_requests'
//   filter   — optional Postgres filter, e.g. `receiver=eq.${userId}`
//   onChange — called with the change payload on every matching event
//   onStatus — optional channel-status callback (SUBSCRIBED, CHANNEL_ERROR,
//              TIMED_OUT, CLOSED). Screens can use this to show whether they
//              are genuinely live rather than assuming a socket connected.
// Returns an unsubscribe function. Always call it on cleanup.
export function subscribe(table, filter, onChange, onStatus) {
  if (!isConfigured) {
    try { if (onStatus) onStatus('UNAVAILABLE'); } catch (e) {}
    return () => {};
  }
  try {
    const name = `rt_${table}_${channelSeq++}`;
    const opts = { event: '*', schema: 'public', table };
    if (filter) opts.filter = filter;

    const channel = supabase
      .channel(name)
      .on('postgres_changes', opts, (payload) => {
        try { onChange(payload); } catch (e) { /* never let a handler crash the socket */ }
      })
      .subscribe((status) => {
        try { if (onStatus) onStatus(status); } catch (e) {}
      });

    return () => {
      try { supabase.removeChannel(channel); } catch (e) {}
    };
  } catch (e) {
    try { if (onStatus) onStatus('CHANNEL_ERROR'); } catch (err) {}
    return () => {};
  }
}

// Presence heartbeat: stamp the user's `last_active` so friends see them as
// online. Called on a light interval by the app shell. Cheap single-row update.
export async function touchPresence(userId) {
  if (!isConfigured || !userId) return;
  try {
    await supabase.from('profiles').update({ last_active: new Date().toISOString() }).eq('id', userId);
  } catch (e) { /* silent — presence is best-effort */ }
}
