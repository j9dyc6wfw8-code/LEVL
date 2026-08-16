// LEVL — workoutService: private cloud save + workout history.
//
// Two responsibilities:
//   1. saves   — one row per user holding the full JSON save blob (private).
//   2. workouts — public log of individual sets/cardio activities (feed + duels).
//
// Conflict rule (Phase 4): we never blindly overwrite. Each save carries an
// `updated_at`; the newer timestamp wins. Callers compare before pushing.

import { supabase, isConfigured, offline } from './client';
import { currentUserId } from './authService';

// --- full save blob (private, RLS: owner only) -----------------------------

export async function pushSave(data) {
  if (!isConfigured) return offline();
  const uid = await currentUserId();
  if (!uid) return offline('Not signed in');
  try {
    const row = {
      user_id: uid,
      blob: data,                       // jsonb column; the whole save
      save_version: data.v || 1,
      updated_at: new Date().toISOString(),
    };
    return await supabase.from('saves').upsert(row).select().single();
  } catch (e) {
    return { data: null, error: { message: String(e && e.message || e) } };
  }
}

export async function pullSave() {
  if (!isConfigured) return offline();
  const uid = await currentUserId();
  if (!uid) return offline('Not signed in');
  try {
    return await supabase.from('saves').select('blob, updated_at').eq('user_id', uid).single();
  } catch (e) {
    return { data: null, error: { message: String(e && e.message || e) } };
  }
}

// --- workout log rows (append-only, powers the activity feed) ---------------

// Push any activities not yet uploaded. `entries` is an array of the engine's
// own lift/cardio records. Their real shape (from engine.js) is:
//   lift:   { id, t, kind:'lift',   ex, w, r, rpe, e1rm, pr, xp }
//   cardio: { id, t, kind:'cardio', ex, mins, dist, intensity, xp }
// The mapping below reads those exact fields — not guessed names.
export async function pushWorkouts(entries, preferredUnit = 'kg') {
  if (!isConfigured) return offline();
  if (!entries || !entries.length) return { data: [], error: null };
  const uid = await currentUserId();
  if (!uid) return offline('Not signed in');
  try {
    const safeUnit = preferredUnit === 'lb' ? 'lb' : 'kg';
    const rows = entries.map((e) => {
      const kind = e.kind === 'cardio' ? 'cardio' : 'lift';
      return {
        user_id: uid,
        date: new Date(e.t || Date.now()).toISOString(),
        exercise: e.ex || '',
        kind,
        sets: 1,                              // engine logs one set per record
        reps: kind === 'lift' ? (e.r || 0) : 0,
        weight: kind === 'lift' ? (e.w || 0) : 0,
        unit: kind === 'lift' ? (e.unit === 'lb' ? 'lb' : e.unit === 'kg' ? 'kg' : safeUnit) : null,
        rpe: kind === 'lift' ? (e.rpe || null) : null,
        duration: kind === 'cardio' ? (e.mins || 0) : 0,
        distance: kind === 'cardio' ? (e.dist || 0) : 0,
        xp_earned: e.xp || 0,
        is_pr: !!e.pr,
        // The session this set belongs to. A Check In attaches a session id,
        // never a copy of the workout, and the database recomputes the public
        // summary from these rows — so this column is what makes a Verified
        // Session verifiable at all. Null on records logged before Build 28.
        session_id: e.sid || null,
        // Every engine record has an id. The deterministic fallback protects
        // imported legacy saves while keeping retries idempotent per user.
        client_id: e.id || [uid, e.t || 0, kind, e.ex || 'workout'].join(':'),
      };
    });

    // New installs use the correctly scoped (user_id, client_id) unique key.
    // During rollout, retry against the legacy schema so deploying JS a few
    // minutes before the SQL migration does not stop workout sync entirely.
    let result = await supabase
      .from('workouts')
      .upsert(rows, { onConflict: 'user_id,client_id' })
      .select();
    if (!result.error) return result;

    const message = String(result.error.message || result.error.code || '');
    const canUseLegacySchema = /schema cache|column|constraint|unique|42P10/i.test(message);
    if (!canUseLegacySchema) return result;
    const legacyRows = rows.map(({ kind, unit, rpe, distance, session_id, ...legacy }) => legacy);
    const rolloutAttempts = [
      [legacyRows, 'user_id,client_id'], // new key, old columns
      [rows, 'client_id'],               // old key, new columns
      [legacyRows, 'client_id'],         // fully legacy schema
    ];
    for (const [candidateRows, conflict] of rolloutAttempts) {
      result = await supabase.from('workouts').upsert(candidateRows, { onConflict: conflict }).select();
      if (!result.error) return result;
    }
    return result;
  } catch (e) {
    return { data: null, error: { message: String(e && e.message || e) } };
  }
}

// Recent workouts for one user (their profile history).
export async function getUserWorkouts(userId, limit = 50) {
  if (!isConfigured) return offline();
  try {
    return await supabase
      .from('workouts')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .limit(limit);
  } catch (e) {
    return { data: null, error: { message: String(e && e.message || e) } };
  }
}

// Workouts for one user within a date window — powers the duel head-to-head
// breakdown (each player's exercises/weights/XP during the duel).
export async function getWorkoutsBetween(userId, startISO, endISO, limit = 300) {
  if (!isConfigured) return offline();
  try {
    let q = supabase
      .from('workouts')
      // `*` keeps this reader compatible before and after the realtime-duels
      // migration (new rows add kind/unit/RPE/distance metadata).
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .limit(limit);
    if (startISO) q = q.gte('date', startISO);
    if (endISO) q = q.lte('date', endISO);
    return await q;
  } catch (e) {
    return { data: null, error: { message: String(e && e.message || e) } };
  }
}

// Activity feed: recent workouts across a set of friend IDs, each tagged with
// the friend's name/avatar. Uses the SAME safe two-query join as the friend
// requests fix (fetch rows, fetch profiles, merge in JS) — never the embed
// syntax that fails silently. Returns newest first.
export async function friendsFeed(friendIds, limit = 40) {
  if (!isConfigured) return offline();
  const ids = (friendIds || []).slice();
  if (!ids.length) return { data: [], error: null };
  try {
    const { data: workouts, error } = await supabase
      .from('workouts')
      .select('id, user_id, exercise, weight, reps, duration, xp_earned, is_pr, date')
      .in('user_id', ids)
      .order('date', { ascending: false })
      .limit(limit);
    if (error) return { data: null, error };
    if (!workouts || !workouts.length) return { data: [], error: null };

    const uids = [...new Set(workouts.map((w) => w.user_id))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar')
      .in('id', uids);
    const byId = {};
    (profiles || []).forEach((p) => { byId[p.id] = p; });

    const feed = workouts.map((w) => ({ ...w, actor: byId[w.user_id] || null }));
    return { data: feed, error: null };
  } catch (e) {
    return { data: null, error: { message: String(e && e.message || e) } };
  }
}
