// LEVL — leaderboardService: global / friends / weekly rankings.
//
// Leaderboards read straight from `profiles` (which already holds weekly_xp,
// xp, level, streak). No separate table needed for v1 — an index on each
// sort column keeps it fast. Country rankings (future) will add a filter.

import { supabase, isConfigured, offline } from './client';
import { currentUserId } from './authService';

const COLS = 'id, username, display_name, avatar, level, rank, xp, weekly_xp, streak, longest_streak, best_e1rm, best_lift_name, consistency';

// metric: 'weekly_xp' | 'xp' | 'level' | 'streak' | 'best_e1rm' | 'consistency' | 'longest_streak'
export async function globalTop(metric = 'weekly_xp', limit = 100) {
  if (!isConfigured) return offline();
  try {
    return await supabase.from('profiles').select(COLS).order(metric, { ascending: false }).limit(limit);
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
