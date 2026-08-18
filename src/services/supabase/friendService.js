// LEVL — friendService: requests, acceptance, the friend list.
//
// Model (see Phase 2 schema):
//   friend_requests(sender, receiver, status)  — pending/accepted/declined
//   friends(user_one, user_two)                — a symmetric edge, stored once
//                                                 with user_one < user_two.
// Storing the edge once (ordered) avoids duplicate rows and makes "are we
// friends" a single lookup.

import { supabase, isConfigured, offline } from './client';
import { currentUserId } from './authService';
import { notify } from './notificationService';

const ordered = (a, b) => (a < b ? [a, b] : [b, a]);

export async function sendRequest(receiverId) {
  if (!isConfigured) return offline();
  const uid = await currentUserId();
  if (!uid) return offline('Not signed in');
  if (uid === receiverId) return { data: null, error: { message: "You can't add yourself" } };
  try {
    const res = await supabase
      .from('friend_requests')
      .upsert({ sender: uid, receiver: receiverId, status: 'pending' }, { onConflict: 'sender,receiver' })
      .select().single();
    // Notify the receiver AFTER the request is saved (this was previously
    // unreachable — it sat after the return, so no notification ever fired).
    if (!res.error) notify(receiverId, 'friend_request', { from: uid });
    return res;
  } catch (e) {
    return { data: null, error: { message: String(e && e.message || e) } };
  }
}

// Incoming pending requests (for the notifications/requests list).
//
// NOTE: this deliberately does NOT use PostgREST's embedded-resource syntax
// (`profiles:sender(...)`) — that only works when there's a DIRECT foreign key
// between the two tables being queried. Here, friend_requests.sender and
// profiles.id both reference auth.users independently; there is no FK from
// friend_requests to profiles itself, so PostgREST can't resolve the embed.
// The query fails silently as far as the UI is concerned (an error comes
// back, requests just never populate) — which is exactly why a saved request
// could sit in the table and never show up. Two plain queries, joined in JS,
// sidesteps this entirely and is the same safe pattern listFriends() uses.
export async function incomingRequests() {
  if (!isConfigured) return offline();
  const uid = await currentUserId();
  if (!uid) return offline('Not signed in');
  try {
    const { data: reqs, error } = await supabase
      .from('friend_requests')
      .select('sender, status, created_at')
      .eq('receiver', uid)
      .eq('status', 'pending');
    if (error) return { data: null, error };
    if (!reqs || !reqs.length) return { data: [], error: null };

    const ids = reqs.map((r) => r.sender);
    const { data: profiles, error: pErr } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar, level, rank')
      .in('id', ids);
    if (pErr) return { data: null, error: pErr };

    const byId = {};
    (profiles || []).forEach((p) => { byId[p.id] = p; });
    const merged = reqs.map((r) => ({ ...r, profiles: byId[r.sender] || null }));
    return { data: merged, error: null };
  } catch (e) {
    return { data: null, error: { message: String(e && e.message || e) } };
  }
}

// Accepting is ONE server-side call now, not two client writes.
//
// This used to mark the request accepted and then insert the friendship edge
// straight from the phone. That required an INSERT policy on `friends` which
// only checked that you were one of the two people in the row — never that the
// other person had agreed. Anyone could therefore insert an edge with a
// stranger and, because friendship is the key to friends-only content, read
// that stranger's private Check In photographs. The victim simply gained a
// friend they never added.
//
// accept_friend_request() (sql/2813) verifies a pending request exists, honours
// blocks, and writes both rows in one transaction. There is no longer any
// INSERT policy on `friends` at all, so this is the only way in.
export async function acceptRequest(senderId) {
  if (!isConfigured) return offline();
  const uid = await currentUserId();
  if (!uid) return offline('Not signed in');
  try {
    const { error } = await supabase.rpc('accept_friend_request', { p_sender: senderId });
    if (error) return { data: null, error };
    const [a, b] = ordered(uid, senderId);
    return { data: { user_one: a, user_two: b }, error: null };
  } catch (e) {
    return { data: null, error: { message: String(e && e.message || e) } };
  }
}

export async function declineRequest(senderId) {
  if (!isConfigured) return offline();
  const uid = await currentUserId();
  if (!uid) return offline('Not signed in');
  try {
    return await supabase.from('friend_requests')
      .update({ status: 'declined' })
      .eq('sender', senderId).eq('receiver', uid);
  } catch (e) {
    return { data: null, error: { message: String(e && e.message || e) } };
  }
}

export async function removeFriend(otherId) {
  if (!isConfigured) return offline();
  const uid = await currentUserId();
  if (!uid) return offline('Not signed in');
  try {
    const [a, b] = ordered(uid, otherId);
    return await supabase.from('friends').delete().eq('user_one', a).eq('user_two', b);
  } catch (e) {
    return { data: null, error: { message: String(e && e.message || e) } };
  }
}

// My friends, joined to their public profiles (for the Friends screen).
export async function listFriends() {
  if (!isConfigured) return offline();
  const uid = await currentUserId();
  if (!uid) return offline('Not signed in');
  try {
    const { data, error } = await supabase
      .from('friends')
      .select('user_one, user_two')
      .or('user_one.eq.' + uid + ',user_two.eq.' + uid);
    if (error) return { data: null, error };
    const ids = (data || []).map((r) => (r.user_one === uid ? r.user_two : r.user_one));
    if (!ids.length) return { data: [], error: null };
    return await supabase
      .from('profiles')
      .select('id, username, display_name, avatar, level, rank, streak, weekly_xp, last_active')
      .in('id', ids);
  } catch (e) {
    return { data: null, error: { message: String(e && e.message || e) } };
  }
}
