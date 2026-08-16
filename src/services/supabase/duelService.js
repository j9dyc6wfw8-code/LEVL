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

async function participantDuel(duelId, uid, status) {
  let q = supabase.from('duels').select('*')
    .eq('id', duelId)
    .or('player_one.eq.' + uid + ',player_two.eq.' + uid);
  if (status) q = q.eq('status', status);
  return q.maybeSingle();
}

// Server evidence is the score source of truth. Reading in pages avoids the
// default PostgREST row cap and prevents a second phone with a partial local
// save from accidentally lowering a player's live score.
async function workoutXpTotals(userIds, startISO, endISO) {
  const ids = [...new Set((userIds || []).filter(Boolean))];
  const totals = {};
  ids.forEach((id) => { totals[id] = 0; });
  if (!ids.length) return { data: totals, error: null };

  let from = 0;
  const pageSize = 1000;
  while (true) {
    let q = supabase.from('workouts')
      .select('id, user_id, xp_earned, date')
      .in('user_id', ids);
    if (startISO) q = q.gte('date', startISO);
    if (endISO) q = q.lte('date', endISO);
    q = q.order('date', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + pageSize - 1);
    const page = await q;
    if (page.error) return { data: null, error: page.error };
    const rows = page.data || [];
    rows.forEach((row) => {
      if (Object.prototype.hasOwnProperty.call(totals, row.user_id)) {
        totals[row.user_id] += Math.max(0, Number(row.xp_earned) || 0);
      }
    });
    if (rows.length < pageSize) break;
    from += pageSize;
  }
  Object.keys(totals).forEach((id) => { totals[id] = Math.round(totals[id]); });
  return { data: totals, error: null };
}

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
    // Only the challenged player can answer, and only while it is pending.
    const { data: duel, error: readError } = await supabase.from('duels').select('*')
      .eq('id', duelId)
      .eq('player_two', uid)
      .eq('status', 'pending')
      .maybeSingle();
    if (readError) return { data: null, error: readError };
    if (!duel) return errorResult('This challenge is no longer available.');

    if (!accept) {
      const declined = await supabase.from('duels')
        .update({ status: 'declined' })
        .eq('id', duelId).eq('player_two', uid).eq('status', 'pending')
        .select().maybeSingle();
      if (!declined.error && !declined.data) return errorResult('This challenge was already answered.');
      return declined;
    }

    const active = await hasActiveDuel(uid);
    if (active.error) return { data: null, error: active.error };
    if (active.data) return errorResult('Finish your current duel first.');

    // The seven-day clock starts on ACCEPT, not when the invitation was sent.
    const originalStart = new Date(duel.start_date || 0).getTime();
    const originalEnd = new Date(duel.end_date || 0).getTime();
    const rawDuration = originalEnd - originalStart;
    const duration = Number.isFinite(rawDuration) && rawDuration > 0
      ? Math.max(DAY_MS, Math.min(30 * DAY_MS, rawDuration))
      : 7 * DAY_MS;
    const start = new Date();
    const accepted = await supabase.from('duels')
      .update({
        status: 'active',
        start_date: start.toISOString(),
        end_date: new Date(start.getTime() + duration).toISOString(),
        player_one_score: 0,
        player_two_score: 0,
        winner: null,
      })
      .eq('id', duelId).eq('player_two', uid).eq('status', 'pending')
      .select().maybeSingle();
    if (!accepted.error && !accepted.data) return errorResult('This challenge was already answered.');
    if (!accepted.error) {
      await notify(duel.player_one, 'duel_challenge', { from: uid, duel_id: duel.id, started: true });
    }
    return accepted;
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
    const { data: duel, error } = await participantDuel(duelId, uid, 'active');
    if (error) return { data: null, error };
    if (!duel) return errorResult('This duel is no longer active.');
    const opponentId = duel.player_one === uid ? duel.player_two : duel.player_one;
    const result = await supabase.from('duels')
      .update({ status: 'complete', winner: opponentId })
      .eq('id', duelId).eq('status', 'active')
      .or('player_one.eq.' + uid + ',player_two.eq.' + uid)
      .select().maybeSingle();
    if (!result.error && !result.data) return errorResult('This duel already ended.');
    if (!result.error) await notify(opponentId, 'duel_result', { result: 'win', reason: 'forfeit', from: uid });
    return result;
  } catch (e) {
    return errorResult(String(e && e.message || e));
  }
}

// Compatibility accepts both updateMyScore(id, score) and the older
// updateMyScore(id, isPlayerOne, score), but never trusts the caller's slot.
export async function updateMyScore(duelId, scoreOrLegacySlot, legacyScore) {
  if (!isConfigured) return offline();
  const uid = await currentUserId();
  if (!uid) return offline('Not signed in');
  try {
    const { data: duel, error } = await participantDuel(duelId, uid, 'active');
    if (error) return { data: null, error };
    if (!duel) return errorResult('This duel is no longer active.');
    const col = duel.player_one === uid ? 'player_one_score' : 'player_two_score';
    const rawScore = legacyScore === undefined ? scoreOrLegacySlot : legacyScore;
    const score = Math.max(0, Math.round(Number(rawScore) || 0));
    return await supabase.from('duels').update({ [col]: score })
      .eq('id', duelId).eq('status', 'active').select().maybeSingle();
  } catch (e) {
    return errorResult(String(e && e.message || e));
  }
}

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
    const { data: duels, error } = await supabase.from('duels').select('*')
      .or('player_one.eq.' + uid + ',player_two.eq.' + uid)
      .eq('status', 'active');
    if (error || !duels) return { data: null, error };
    let updated = 0;
    let updateError = null;
    for (const d of duels) {
      const col = d.player_one === uid ? 'player_one_score' : 'player_two_score';
      const totals = await workoutXpTotals([uid], d.start_date, d.end_date);
      if (totals.error) {
        if (!updateError) updateError = totals.error;
        continue;
      }
      const score = totals.data[uid] || 0;
      const current = Number(d[col]) || 0;
      if (current === score) continue;
      const result = await supabase.from('duels').update({ [col]: score })
        .eq('id', d.id).eq('status', 'active');
      if (!result.error) updated += 1;
      else if (!updateError) updateError = result.error;
    }
    return { data: updated, error: updateError };
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
    const { data: duels, error } = await supabase.from('duels').select('*')
      .or('player_one.eq.' + uid + ',player_two.eq.' + uid)
      .eq('status', 'active');
    if (error || !duels) return { data: null, error };
    let resolved = 0;
    let firstError = null;
    for (const d of duels) {
      if (!d.end_date || new Date(d.end_date).getTime() > Date.now()) continue;   // still running

      // Re-read the evidence rows before settling. A score update and an app
      // foreground can race; trusting the cached duel row here could award the
      // wrong winner even though the final workout already synced.
      const totals = await workoutXpTotals([d.player_one, d.player_two], d.start_date, d.end_date);
      if (totals.error) {
        if (!firstError) firstError = totals.error;
        continue; // fail safe: do not settle from stale scores
      }

      const oneScore = totals.data[d.player_one] || 0;
      const twoScore = totals.data[d.player_two] || 0;
      let winner = null;
      if (oneScore > twoScore) winner = d.player_one;
      else if (twoScore > oneScore) winner = d.player_two;
      const result = await supabase.from('duels').update({
        player_one_score: oneScore,
        player_two_score: twoScore,
        status: 'complete',
        winner,
      }).eq('id', d.id).eq('status', 'active').select('id');
      if (result.error) {
        if (!firstError) firstError = result.error;
      } else if (result.data && result.data.length) {
        resolved += 1;
        const oneResult = winner === null ? 'draw' : winner === d.player_one ? 'win' : 'loss';
        const twoResult = winner === null ? 'draw' : winner === d.player_two ? 'win' : 'loss';
        await Promise.all([
          notify(d.player_one, 'duel_result', { duel_id: d.id, result: oneResult }),
          notify(d.player_two, 'duel_result', { duel_id: d.id, result: twoResult }),
        ]);
      }
    }
    return { data: resolved, error: firstError };
  } catch (e) {
    return errorResult(String(e && e.message || e));
  }
}
