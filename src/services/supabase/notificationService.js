// LEVL — notificationService: in-app notification rows.
//
// A lightweight `notifications` table: one row per event (friend request,
// duel challenge, reward available, etc). Realtime (Phase 11) makes these
// appear instantly. Push notifications (APNs) are a later, separate step —
// this is the in-app backing store they'll build on.

import { supabase, isConfigured, offline } from './client';
import { currentUserId } from './authService';

export async function myNotifications(limit = 50) {
  if (!isConfigured) return offline();
  const uid = await currentUserId();
  if (!uid) return offline('Not signed in');
  try {
    return await supabase.from('notifications')
      .select('*').eq('user_id', uid)
      .order('created_at', { ascending: false }).limit(limit);
  } catch (e) {
    return { data: null, error: { message: String(e && e.message || e) } };
  }
}

export async function markRead(ids) {
  if (!isConfigured) return offline();
  if (!ids || !ids.length) return { data: [], error: null };
  try {
    return await supabase.from('notifications').update({ read: true }).in('id', ids);
  } catch (e) {
    return { data: null, error: { message: String(e && e.message || e) } };
  }
}

export async function unreadCount() {
  if (!isConfigured) return { data: 0, error: null };
  const uid = await currentUserId();
  if (!uid) return { data: 0, error: null };
  try {
    const { count, error } = await supabase.from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', uid).eq('read', false);
    return { data: count || 0, error };
  } catch (e) {
    return { data: 0, error: { message: String(e && e.message || e) } };
  }
}

// Create a notification for ANOTHER user. Fire-and-forget — called when you do
// something they should hear about (send a request, challenge them). The
// notifications INSERT policy allows writing rows for anyone (a friend's action
// notifies you), which is safe because the row is only ever readable by its
// owner. Never throws; a failed notify must not break the action that spawned it.
export async function notify(userId, kind, payload) {
  if (!isConfigured || !userId) return;
  try {
    await supabase.from('notifications').insert({
      user_id: userId,
      kind,
      payload: payload || {},
      read: false,
    });
  } catch (e) { /* silent — notifications are best-effort */ }
}
