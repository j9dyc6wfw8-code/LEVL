// LEVL — profileService: the player's public identity + progression row.
//
// The `profiles` table is the one other players can see (via RLS). It mirrors
// the derived values from the engine (level, xp, rank, league, streak) so
// leaderboards and friend lists can query without downloading anyone's full
// save. Private save data lives separately in `saves` (see workoutService).

import { supabase, isConfigured, offline } from './client';
import { currentUserId } from './authService';
import { coinBalance, toKg } from '../../engine/engine';

// Weekly XP isn't a stored field — derive it from this week's records so the
// leaderboard has something real to sort on. Sums xp from lifts+cardio whose
// timestamp falls in the last 7 days.

// Heaviest single estimated 1RM across all logged lifts, normalised to kg so
// kg and lb users are ranked on the same scale.

// Share of the last 28 days with any logged activity. A fairer "most
// consistent" measure than a raw streak, which one missed day resets to zero.

// Map the app's derived view (dv) + save (data) onto a profile row.
// Only public, display-safe fields go here. Every value below is one that
// actually exists — verified against computeDerived's real return shape and
// the engine's coinBalance().
// Build 28: `username` is no longer written here.
//
// It used to be regenerated from the display name on EVERY sync, which meant
// two players called "Matteo" both claimed the handle "matteo", and anyone who
// renamed themselves silently changed the identity their friends knew them by.
// A social feed needs a handle that is unique and stable, so it is now claimed
// once (levl_set_username) and left alone. Existing rows keep whatever they
// have; sql/2801_social_core.sql de-duplicates them and adds the unique index.
export function toProfileRow(userId, data, dv) {
  const streak = (dv && dv.streak) || 0;
  return {
    id: userId,
    display_name: data.name || 'Player',
    avatar: data.avatar || {},
    // `character` is jsonb and already synced, so the six stat levels ride along
    // inside it — no new column, no migration. Friends' profiles can now show a
    // real stat readout instead of a placeholder. Compact map, not an array.
    character: {
      equipped: data.equipped || {},
      title: data.equippedTitle,
      deco: data.equippedDecoration,
      stats: ((dv && dv.statLevels) || []).reduce((acc, x) => { acc[x.stat] = x.level; return acc; }, {}),
    },
    level: (dv && dv.level) || 1,
    xp: data.xp || 0,
    coins: coinBalance(data),
    rank: dv && dv.tier ? dv.tier.name : 'Bronze',
    league: dv && dv.tier ? dv.tier.name : 'Bronze',
    streak,
    longest_streak: Math.max(streak, (data._longestStreak || 0)),  // best-effort; grows over time
    last_active: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

/* WHY weekly_xp, best_e1rm, best_lift_name AND consistency ARE NOT SENT
 *
 * They are the columns the leaderboard sorts by, and they used to be written
 * from the local save — which meant the ladder ranked whatever the client
 * claimed. They are now DERIVED on the server from the workouts table by
 * levl_recompute_profile_stats(), and the authenticated role no longer holds
 * UPDATE on them at all. Including them here would not just be ignored: the
 * grant makes the whole row update fail.
 *
 * Anything added to this object in future must be a column the client is still
 * allowed to write. See sql/2811_leaderboard_integrity.sql.
 */

// Upsert my own profile (called after workouts sync).
export async function upsertMyProfile(data, dv) {
  if (!isConfigured) return offline();
  const uid = await currentUserId();
  if (!uid) return offline('Not signed in');
  try {
    const row = toProfileRow(uid, data, dv);
    return await supabase.from('profiles').upsert(row).select().single();
  } catch (e) {
    return { data: null, error: { message: String(e && e.message || e) } };
  }
}

// Fetch any profile by id (public, subject to RLS read policy).
export async function getProfile(userId) {
  if (!isConfigured) return offline();
  try {
    return await supabase.from('profiles').select('*').eq('id', userId).single();
  } catch (e) {
    return { data: null, error: { message: String(e && e.message || e) } };
  }
}

// Search players by username prefix (for the Friends "add" flow).
export async function searchProfiles(query, limit = 20) {
  if (!isConfigured) return offline();
  const q = (query || '').toLowerCase().replace(/[^a-z0-9_]/g, '');
  if (!q) return { data: [], error: null };
  try {
    return await supabase
      .from('profiles')
      .select('id, username, display_name, avatar, level, rank, streak, weekly_xp, last_active')
      .ilike('username', q + '%')
      .limit(limit);
  } catch (e) {
    return { data: null, error: { message: String(e && e.message || e) } };
  }
}
