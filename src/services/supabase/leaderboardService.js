// LEVL — leaderboardService: global / friends / weekly rankings.
//
// Leaderboards read straight from `profiles` (which already holds weekly_xp,
// xp, level, streak). No separate table needed for v1 — an index on each
// sort column keeps it fast. Country rankings (future) will add a filter.

import { supabase, isConfigured, offline } from './client';
import { currentUserId } from './authService';

const COLS = 'id, username, display_name, avatar, level, rank, xp, weekly_xp, streak, longest_streak, best_e1rm, best_lift_name, consistency';

// A ladder is only motivating if the people on it are still climbing.
//
// This used to sort EVERY profile row with no filter at all, so the global
// board was padded with accounts that had signed up, never logged a set, and
// never come back — which makes a small player base look smaller and deader
// than it is. Two conditions, both cheap and both index-backed:
//
//   consistency > 0    trained at least once in the last 28 days
//                      (derived server-side by levl_recompute_profile_stats,
//                       so it cannot be faked from the client)
//   updated_at recent  has actually opened the app
//
// Someone who stops training drops off the ladder rather than occupying it.
const ACTIVE_WINDOW_DAYS = 30;

// metric: 'weekly_xp' | 'xp' | 'level' | 'streak' | 'best_e1rm' | 'consistency' | 'longest_streak'
export async function globalTop(metric = 'weekly_xp', limit = 100) {
  if (!isConfigured) return offline();
  try {
    const since = new Date(Date.now() - ACTIVE_WINDOW_DAYS * 86400000).toISOString();
    return await supabase.from('profiles').select(COLS)
      .gt('consistency', 0)
      .gte('updated_at', since)
      .order(metric, { ascending: false })
      .limit(limit);
  } catch (e) {
    return { data: null, error: { message: String(e && e.message || e) } };
  }
}

export async function friendsTop(friendIds, metric = 'weekly_xp', limit = 100) {
  if (!isConfigured) return offline();
  const uid = await currentUserId();
  const ids = (friendIds || []).slice();
  if (uid) ids.push(uid);                // include myself in the friends board
  if (!ids.length) return { data: [], error: null };
  try {
    return await supabase.from('profiles').select(COLS).in('id', ids).order(metric, { ascending: false }).limit(limit);
  } catch (e) {
    return { data: null, error: { message: String(e && e.message || e) } };
  }
}
