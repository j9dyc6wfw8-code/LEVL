// LEVL — duelService: friend duels (the core multiplayer loop).
//
// A duel is a row in `duels` with two players, a window (start/end), live
// scores, and a winner once resolved. Scores are XP accrued during the window;
// the app updates them as workouts sync, and Realtime (Phase 11) pushes the
// opponent's changes live.

import { supabase, isConfigured, offline } from './client';
import { currentUserId } from './authService';
import { notify } from './notificationService';

const DAY_MS = 86400000;
const errorResult = (message) => ({ data: null, error: { message } });

// SCORING MOVED SERVER-SIDE (sql/2815).
//
// This file used to compute duel scores here, honestly, by summing xp_earned
// from `workouts` inside each duel's window — and then write the result to the
// duels row. The logic was right; nothing enforced it. The UPDATE policy was
// `using (player_one or player_two)` with no column restriction, so a tampered
// client could skip all of it and write `winner = me, score = 999999`. And
// claim_friend_duel_rewards() pays out on `winner`, so that was money.
//
// levl_duel_xp() in the database is now the single definition of a duel score,
// and levl_duel_sync_scores() / levl_duel_resolve() are the only things that
// can write one. The client no longer holds UPDATE on `duels` at all.
//
// Keeping a second copy of the arithmetic here would be the "two competing
// implementations" problem the pre-launch audit called out, so it is gone
// rather than left commented out.

// Surfaces a missing 2815 as a readable instruction instead of a raw PostgREST
// error, the same way claimDuelRewards handles a missing duel_integrity_patch.
function missingMigration(error, fn) {
  if (!error) return false;
  return error.code === 'PGRST202' || error.code === '42883'
    || new RegExp(fn + '.*schema cache|function.*does not exist', 'i').test(String(error.message || ''));
}
const NEEDS_2815 = 'Duel update required. Run sql/2815_p1_hardening.sql in Supabase.';

// Shared guard for every route that can start another head-to-head. The SQL
// integrity trigger is still the final authority; this gives the UI an early,
// readable answer while the trigger closes concurrent-device races.
export async function hasActiveDuel(uidOverride) {
  if (!isConfigured) return offline();
  const uid = uidOverride || await currentUserId();
  if (!uid) return offline('Not signed in');
  try {
    const { data, error } = await supabase.from('duels').select('id')
      .or('player_one.eq.' + uid + ',player_two.eq.' + uid)
      .eq('status', 'active')
      .limit(1);
    return { data: !!(data && data.length), error };
  } catch (e) {
    return errorResult(String(e && e.message || e));
  }
}

export async function challenge(opponentId, days = 7, reward = 500) {
  if (!isConfigured) return offline();
  const uid = await currentUserId();
  if (!uid) return offline('Not signed in');
  if (!opponentId) return errorResult('Choose a friend to challenge.');
  if (uid === opponentId) return errorResult("You can't duel yourself.");
  try {
    const active = await hasActiveDuel(uid);
    if (active.error) return { data: null, error: active.error };
    if (active.data) return errorResult('Finish your current duel first.');

    // Do not stack duplicate unanswered challenges between the same players.
    const { data: pending, error: pendingError } = await supabase.from('duels').select('id, player_one, player_two')
      .or('player_one.eq.' + uid + ',player_two.eq.' + uid)
      .eq('status', 'pending');
    if (pendingError) return { data: null, error: pendingError };
    const duplicate = (pending || []).some((d) =>
      (d.player_one === uid && d.player_two === opponentId)
      || (d.player_two === uid && d.player_one === opponentId));
    if (duplicate) return errorResult('A challenge with this friend is already waiting.');

    const safeDays = Math.max(1, Math.min(30, Math.round(Number(days) || 7)));
    const start = new Date();
    const end = new Date(start.getTime() + safeDays * DAY_MS);
    const res = await supabase.from('duels').insert({
      player_one: uid, player_two: opponentId,
      status: 'pending',
      start_date: start.toISOString(), end_date: end.toISOString(),
      player_one_score: 0, player_two_score: 0,
      reward,
    }).select().single();
    // Notify the opponent AFTER the duel is created (was unreachable before).
    if (!res.error) notify(opponentId, 'duel_challenge', { from: uid, reward });
    return res;
  } catch (e) {
    return { data: null, error: { message: String(e && e.message || e) } };
  }
}

export async function respondToDuel(duelId, accept) {
  if (!isConfigured) return offline();
  const uid = await currentUserId();
  if (!uid) return offline('Not signed in');
  try {
    // One call. The function checks that you are the challenged player and that
    // it is still pending, enforces the one-active-duel rule under a row lock,
    // starts the clock at ACCEPT while preserving the intended duration, and
    // notifies the challenger — all in a single transaction, so two phones
    // answering at once cannot both succeed.
    const { data, error } = await supabase.rpc('levl_duel_respond', {
      p_duel: duelId,
      p_accept: !!accept,
    });
    if (error) {
      if (missingMigration(error, 'levl_duel_respond')) return errorResult(NEEDS_2815);
      return { data: null, error };
    }
    const duel = Array.isArray(data) ? data[0] : data;
    if (!duel) return errorResult('This challenge was already answered.');
    return { data: duel, error: null };
  } catch (e) {
    return errorResult(String(e && e.message || e));
  }
}

// Quit an active friend duel. It becomes a completed loss for the quitter and
// a win for the opponent, so both histories remain accurate.
export async function quitDuel(duelId) {
  if (!isConfigured) return offline();
  const uid = await currentUserId();
  if (!uid) return offline('Not signed in');
  try {
    const { data, error } = await supabase.rpc('levl_duel_quit', { p_duel: duelId });
    if (error) {
      if (missingMigration(error, 'levl_duel_quit')) return errorResult(NEEDS_2815);
      return { data: null, error };
    }
    const duel = Array.isArray(data) ? data[0] : data;
    if (!duel) return errorResult('This duel already ended.');
    return { data: duel, error: null };
  } catch (e) {
    return errorResult(String(e && e.message || e));
  }
}

// updateMyScore() was removed with the move to server-side scoring. It had no
// callers — scores have only ever been pushed by pushMyDuelScores() — and a
// client-supplied score is precisely what 2815 exists to stop accepting.

export async function myDuels(status) {
  if (!isConfigured) return offline();
  const uid = await currentUserId();
  if (!uid) return offline('Not signed in');
  try {
    let q = supabase.from('duels').select('*')
      .or('player_one.eq.' + uid + ',player_two.eq.' + uid)
      .order('start_date', { ascending: false });
    if (status) q = q.eq('status', status);
    return await q;
  } catch (e) {
    return { data: null, error: { message: String(e && e.message || e) } };
  }
}

// Exactly-once coin rewards are claimed by the database, not inferred from
// local history. This prevents two devices awarding the same win twice.
export async function claimDuelRewards(expectedUid) {
  if (!isConfigured) return offline();
  const uid = await currentUserId();
  if (!uid) return offline('Not signed in');
  if (expectedUid && uid !== expectedUid) return errorResult('Account changed. Refresh Duels and try again.');
  try {
    const { data, error } = await supabase.rpc('claim_friend_duel_rewards', { p_expected_uid: uid });
    if (error) {
      const missingPatch = error.code === 'PGRST202' || error.code === '42883'
        || /claim_friend_duel_rewards.*schema cache|function.*does not exist/i.test(String(error.message || ''));
      if (missingPatch) return errorResult('Run sql/duel_integrity_patch.sql to finish the Duel update.');
      return { data: null, error };
    }
    return { data: Math.max(0, Number(data) || 0), error: null };
  } catch (e) {
    return errorResult(String(e && e.message || e));
  }
}

// Push my exact in-window score for every active duel I'm in. Called only after
// the matching workout rows successfully sync. Each duel is calculated against
// its own start/end timestamps; the old rolling-seven-day total could include
// activity from before a duel and therefore disagree with the visible feed.
export async function pushMyDuelScores() {
  if (!isConfigured) return offline();
  const uid = await currentUserId();
  if (!uid) return offline('Not signed in');
  try {
    // One call, and it refreshes BOTH players rather than only mine. The old
    // version could only write its own column, which is why an opponent's score
    // sat stale until they next opened the app — two phones showing different
    // numbers for the same duel. Recomputing both server-side is free and ends
    // that entire class of "the score is wrong".
    const { data, error } = await supabase.rpc('levl_duel_sync_scores');
    if (error) {
      if (missingMigration(error, 'levl_duel_sync_scores')) return errorResult(NEEDS_2815);
      return { data: null, error };
    }
    return { data: Math.max(0, Number(data) || 0), error: null };
  } catch (e) {
    return { data: null, error: { message: String(e && e.message || e) } };
  }
}

// Resolve any active duels whose window has ended: set winner + status.
// Idempotent — safe to call repeatedly; already-complete duels are skipped.
// Runs client-side on whoever opens the screen; the higher score wins, ties go
// to nobody (winner stays null).
export async function resolveEndedDuels() {
  if (!isConfigured) return offline();
  const uid = await currentUserId();
  if (!uid) return offline('Not signed in');
  try {
    // The function re-reads the workout evidence at settlement time rather than
    // trusting the cached score columns — a final set can sync in the same
    // moment the screen opens — and notifies both players itself, so the result
    // arrives even for the player who did not happen to open the app. The
    // `and status = 'active'` guard makes it idempotent: a second caller settles
    // nothing and returns 0.
    const { data, error } = await supabase.rpc('levl_duel_resolve');
    if (error) {
      if (missingMigration(error, 'levl_duel_resolve')) return errorResult(NEEDS_2815);
      return { data: null, error };
    }
    return { data: Math.max(0, Number(data) || 0), error: null };
  } catch (e) {
    return errorResult(String(e && e.message || e));
  }
}
