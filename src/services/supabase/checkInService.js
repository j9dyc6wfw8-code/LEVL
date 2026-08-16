// ============================================================================
// LEVL — checkInService: every Supabase call the Check In feature makes.
//
// Screens and hooks never touch `supabase` directly. Everything returns the
// project's standard { data, error } shape, and every function is a safe no-op
// when the backend isn't configured, exactly like the older services.
//
// PHOTO ACCESS
// The `check-ins` bucket is private. Nothing here ever builds a public URL —
// images are reached through short-lived signed URLs, which Supabase only
// issues when the caller passes the storage SELECT policy. Signed URLs are
// cached in memory until shortly before they expire so scrolling the feed
// doesn't re-sign the same object over and over.
// ============================================================================

import { supabase, isConfigured, offline } from './client';
import { cachedUserId } from './authService';
import { titleFromExerciseNames } from '../../engine/session';

export const BUCKET = 'check-ins';

// Supabase caps signed URLs at whatever we ask for; an hour is long enough that
// a scroll session never re-signs, short enough that a leaked URL dies quickly.
const SIGNED_URL_TTL_SECONDS = 3600;
const SIGNED_URL_REFRESH_MS = (SIGNED_URL_TTL_SECONDS - 300) * 1000;

const signedCache = new Map();   // path -> { url, at }

export function clearSignedUrlCache() {
  signedCache.clear();
}

/* ---------------------------------------------------------------------------
 * Preferences
 * ------------------------------------------------------------------------ */

export const DEFAULT_PREFERENCES = {
  enabled: true,
  window_start_minute: 17 * 60,
  window_end_minute: 20 * 60,
  timezone: 'UTC',
  default_visibility: 'friends',
  public_discovery: true,
  notify_check_in: true,
  notify_social: true,
  notify_duels: true,
  notify_rewards: true,
  notify_training: false,
};

export async function getPreferences() {
  if (!isConfigured) return { data: null, error: null };
  const uid = await cachedUserId();
  if (!uid) return { data: null, error: null };
  try {
    const { data, error } = await supabase
      .from('check_in_preferences')
      .select('*')
      .eq('user_id', uid)
      .maybeSingle();
    if (error) return { data: null, error };
    return { data: data || null, error: null };
  } catch (e) {
    return { data: null, error: { message: String((e && e.message) || e) } };
  }
}

export async function savePreferences(patch) {
  if (!isConfigured) return offline();
  const uid = await cachedUserId();
  if (!uid) return offline('Not signed in');
  try {
    return await supabase
      .from('check_in_preferences')
      .upsert({ ...patch, user_id: uid, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
      .select()
      .single();
  } catch (e) {
    return { data: null, error: { message: String((e && e.message) || e) } };
  }
}

/* ---------------------------------------------------------------------------
 * Photos
 * ------------------------------------------------------------------------ */

// check-ins/{user_id}/{yyyy-mm-dd}/{uuid}/{front|rear}.jpg
// The first folder MUST be the owner's id — every storage policy keys on it.
export function buildPhotoPath(userId, localDate, groupId, which) {
  return [userId, localDate, groupId, which + '.jpg'].join('/');
}

// Upload one already-compressed JPEG. `body` is an ArrayBuffer/Uint8Array.
export async function uploadPhoto(path, body, contentType) {
  if (!isConfigured) return offline();
  try {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .upload(path, body, {
        contentType: contentType || 'image/jpeg',
        // Retrying a failed upload must overwrite the half-written object
        // rather than erroring on "already exists" — the path is a fresh uuid
        // per capture, so this can never clobber a different Check In.
        upsert: true,
        cacheControl: '3600',
      });
    if (error) return { data: null, error };
    return { data, error: null };
  } catch (e) {
    return { data: null, error: { message: String((e && e.message) || e) } };
  }
}

export async function removePhotos(paths) {
  if (!isConfigured || !paths || !paths.length) return { data: null, error: null };
  try {
    return await supabase.storage.from(BUCKET).remove(paths.filter(Boolean));
  } catch (e) {
    return { data: null, error: { message: String((e && e.message) || e) } };
  }
}

// Sign a batch of object paths in one round trip. Returns a { path: url } map.
// Paths the viewer isn't allowed to read simply come back missing rather than
// failing the whole batch — a blocked or unfriended post degrades to a
// placeholder instead of an error screen.
export async function signPhotoUrls(paths) {
  const unique = [...new Set((paths || []).filter(Boolean))];
  const out = {};
  if (!unique.length) return { data: out, error: null };
  if (!isConfigured) return { data: out, error: null };

  const now = Date.now();
  const missing = [];
  for (const p of unique) {
    const hit = signedCache.get(p);
    if (hit && now - hit.at < SIGNED_URL_REFRESH_MS) out[p] = hit.url;
    else missing.push(p);
  }
  if (!missing.length) return { data: out, error: null };

  try {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrls(missing, SIGNED_URL_TTL_SECONDS);
    if (error) return { data: out, error };
    (data || []).forEach((row) => {
      if (row && row.signedUrl && row.path) {
        signedCache.set(row.path, { url: row.signedUrl, at: now });
        out[row.path] = row.signedUrl;
      }
    });
    return { data: out, error: null };
  } catch (e) {
    return { data: out, error: { message: String((e && e.message) || e) } };
  }
}

/* ---------------------------------------------------------------------------
 * Posting
 * ------------------------------------------------------------------------ */

// Create today's Check In.
//
// `clientKey` makes this idempotent: the table has a UNIQUE (user_id,
// local_date), so a retry after a timeout that actually succeeded comes back as
// a duplicate-key error, which we convert into "here is the row you already
// have" instead of an error the user has to understand.
export async function createCheckIn(input) {
  if (!isConfigured) return offline();
  const uid = await cachedUserId();
  if (!uid) return offline('Not signed in');
  try {
    const row = {
      user_id: uid,
      local_date: input.localDate,
      timezone: input.timezone || 'UTC',
      posted_at: new Date(input.postedAt || Date.now()).toISOString(),
      window_end_minute: input.windowEndMinute == null ? null : input.windowEndMinute,
      notified_at: input.notifiedAt ? new Date(input.notifiedAt).toISOString() : null,
      visibility: input.visibility === 'public' ? 'public' : 'friends',
      front_photo_path: input.frontPath,
      rear_photo_path: input.rearPath,
      primary_photo: input.primaryPhoto === 'front' ? 'front' : 'rear',
      alt_text: input.altText || null,
      caption: input.caption || null,
      workout_session_id: input.workoutSessionId || null,
    };
    const res = await supabase.from('check_ins').insert(row).select().single();
    if (!res.error) return res;

    // 23505 = unique violation. Already posted today: return that row.
    const code = String((res.error && res.error.code) || '');
    if (code === '23505') {
      const existing = await getMyCheckIn(input.localDate);
      if (existing.data) return { data: existing.data, error: null, deduped: true };
    }
    return res;
  } catch (e) {
    return { data: null, error: { message: String((e && e.message) || e) } };
  }
}

export async function getMyCheckIn(localDate) {
  if (!isConfigured) return { data: null, error: null };
  const uid = await cachedUserId();
  if (!uid) return { data: null, error: null };
  try {
    return await supabase
      .from('check_ins')
      .select('*')
      .eq('user_id', uid)
      .eq('local_date', localDate)
      .is('deleted_at', null)
      .maybeSingle();
  } catch (e) {
    return { data: null, error: { message: String((e && e.message) || e) } };
  }
}

export async function getCheckIn(id) {
  if (!isConfigured) return offline();
  try {
    return await supabase.from('check_ins').select('*').eq('id', id).maybeSingle();
  } catch (e) {
    return { data: null, error: { message: String((e && e.message) || e) } };
  }
}

// One Check In, in the same shape the feed produces — author, your reaction and
// the reaction breakdown included.
//
// The detail screen is where notifications land, and those are usually about
// SOMEBODY ELSE'S post, so this cannot lean on the feed reader (which pages by
// scope). Three small queries joined here; RLS still decides whether the first
// one returns anything at all, so a post that is deleted, friends-only or from
// someone who blocked you simply comes back empty.
export async function getCheckInDetail(id) {
  if (!isConfigured) return offline();
  try {
    const { data: row, error } = await supabase
      .from('check_ins').select('*').eq('id', id).maybeSingle();
    if (error) return { data: null, error };
    if (!row) return { data: null, error: null };

    const uid = await cachedUserId();
    const [profileRes, mineRes, typesRes] = await Promise.all([
      supabase.from('profiles')
        .select('id, username, display_name, avatar, character, level')
        .eq('id', row.user_id).maybeSingle(),
      uid
        ? supabase.from('check_in_reactions')
          .select('reaction_type').eq('check_in_id', id).eq('user_id', uid).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase.from('check_in_reactions').select('reaction_type').eq('check_in_id', id),
    ]);

    const counts = {};
    ((typesRes && typesRes.data) || []).forEach((r) => {
      counts[r.reaction_type] = (counts[r.reaction_type] || 0) + 1;
    });
    const profile = (profileRes && profileRes.data) || {};

    return {
      data: normaliseFeedRow({
        ...row,
        username: profile.username || null,
        display_name: profile.display_name || 'Hunter',
        avatar: profile.avatar || {},
        character: profile.character || {},
        level: profile.level || 1,
        my_reaction: (mineRes && mineRes.data && mineRes.data.reaction_type) || null,
        reaction_types: Object.keys(counts).map((t) => ({ type: t, n: counts[t] })),
      }),
      error: null,
    };
  } catch (e) {
    return { data: null, error: { message: String((e && e.message) || e) } };
  }
}

// Attach (or swap) the workout on an existing Check In. The database verifies
// ownership and the day, then recomputes the public summary itself, so this
// call carries an ID and nothing else — no client-supplied set counts, no
// client-supplied volume.
export async function attachWorkout(checkInId, sessionId) {
  if (!isConfigured) return offline();
  const uid = await cachedUserId();
  if (!uid) return offline('Not signed in');
  try {
    return await supabase
      .from('check_ins')
      .update({ workout_session_id: sessionId || null })
      .eq('id', checkInId)
      .eq('user_id', uid)
      .select()
      .single();
  } catch (e) {
    return { data: null, error: { message: String((e && e.message) || e) } };
  }
}

export async function setVisibility(checkInId, visibility) {
  if (!isConfigured) return offline();
  const uid = await cachedUserId();
  if (!uid) return offline('Not signed in');
  try {
    return await supabase
      .from('check_ins')
      .update({ visibility: visibility === 'public' ? 'public' : 'friends' })
      .eq('id', checkInId)
      .eq('user_id', uid)
      .select()
      .single();
  } catch (e) {
    return { data: null, error: { message: String((e && e.message) || e) } };
  }
}

export async function setPrimaryPhoto(checkInId, primary) {
  if (!isConfigured) return offline();
  const uid = await cachedUserId();
  if (!uid) return offline('Not signed in');
  try {
    return await supabase
      .from('check_ins')
      .update({ primary_photo: primary === 'front' ? 'front' : 'rear' })
      .eq('id', checkInId)
      .eq('user_id', uid)
      .select()
      .single();
  } catch (e) {
    return { data: null, error: { message: String((e && e.message) || e) } };
  }
}

// Delete a Check In and its photographs.
//
// The row goes first: once it is gone nobody can read the images regardless of
// what happens next. Storage removal is attempted immediately, and the database
// trigger has already queued both paths so a failure here is retried later
// rather than orphaning files. THE ATTACHED WORKOUT IS NEVER TOUCHED.
export async function deleteCheckIn(checkInId) {
  if (!isConfigured) return offline();
  const uid = await cachedUserId();
  if (!uid) return offline('Not signed in');
  try {
    const { data: row } = await supabase
      .from('check_ins')
      .select('front_photo_path, rear_photo_path')
      .eq('id', checkInId)
      .eq('user_id', uid)
      .maybeSingle();

    const res = await supabase.from('check_ins').delete().eq('id', checkInId).eq('user_id', uid);
    if (res.error) return res;

    if (row) {
      signedCache.delete(row.front_photo_path);
      signedCache.delete(row.rear_photo_path);
      await removePhotos([row.front_photo_path, row.rear_photo_path]);
    }
    return { data: true, error: null };
  } catch (e) {
    return { data: null, error: { message: String((e && e.message) || e) } };
  }
}

// Drain anything the trigger queued but the device never managed to delete.
export async function drainStorageCleanup() {
  if (!isConfigured) return { data: 0, error: null };
  const uid = await cachedUserId();
  if (!uid) return { data: 0, error: null };
  try {
    const { data: rows, error } = await supabase
      .from('storage_cleanup_queue')
      .select('id, object_path')
      .eq('user_id', uid)
      .limit(50);
    if (error || !rows || !rows.length) return { data: 0, error: error || null };
    await removePhotos(rows.map((r) => r.object_path));
    await supabase.rpc('levl_drain_storage_cleanup', { p_ids: rows.map((r) => r.id) });
    return { data: rows.length, error: null };
  } catch (e) {
    return { data: 0, error: { message: String((e && e.message) || e) } };
  }
}

/* ---------------------------------------------------------------------------
 * Feed
 * ------------------------------------------------------------------------ */

// One page of the feed. `scope` is 'friends' | 'public' | 'mine'.
// Cursor pagination on (posted_at, id): stable even when a new post lands
// mid-scroll, which offset pagination is not.
export async function fetchFeed(scope, limit, cursor) {
  if (!isConfigured) return { data: [], error: null };
  try {
    const { data, error } = await supabase.rpc('levl_check_in_feed', {
      p_scope: scope || 'friends',
      p_limit: limit || 12,
      p_cursor_time: (cursor && cursor.postedAt) || null,
      p_cursor_id: (cursor && cursor.id) || null,
    });
    if (error) return { data: null, error };
    return { data: (data || []).map(normaliseFeedRow), error: null };
  } catch (e) {
    return { data: null, error: { message: String((e && e.message) || e) } };
  }
}

// Turn a database row into the shape the UI renders. Doing it once, here, keeps
// snake_case out of the components entirely.
export function normaliseFeedRow(row) {
  if (!row) return null;
  const snap = row.workout_snapshot || null;
  const exercises = snap && Array.isArray(snap.exercises) ? snap.exercises : [];
  return {
    // "Push" / "Legs" / "Full Body" — named from the movements that were
    // actually logged, using the exercise library the database has no view of.
    workoutTitle: snap ? titleFromExerciseNames(exercises, (snap.sets || 0) === 0) : null,
    id: row.id,
    userId: row.user_id,
    postedAt: row.posted_at,
    postedAtMs: row.posted_at ? new Date(row.posted_at).getTime() : Date.now(),
    localDate: row.local_date,
    lateSeconds: row.late_seconds || 0,
    visibility: row.visibility,
    frontPath: row.front_photo_path,
    rearPath: row.rear_photo_path,
    primaryPhoto: row.primary_photo === 'front' ? 'front' : 'rear',
    altText: row.alt_text || null,
    caption: row.caption || null,
    verified: row.check_in_type === 'verified',
    workout: snap && {
      sessionId: snap.session_id,
      sets: snap.sets || 0,
      volumeKg: snap.volume_kg || 0,
      xp: snap.xp || 0,
      prs: snap.prs || 0,
      cardioMinutes: snap.cardio_min || 0,
      exercises,
    },
    reactionCount: row.reaction_count || 0,
    commentCount: row.comment_count || 0,
    myReaction: row.my_reaction || null,
    reactionTypes: Array.isArray(row.reaction_types) ? row.reaction_types : [],
    author: {
      id: row.user_id,
      username: row.username,
      displayName: row.display_name || row.username || 'Hunter',
      avatar: row.avatar || {},
      character: row.character || {},
      level: row.level || 1,
    },
  };
}

/* ---------------------------------------------------------------------------
 * Reactions
 * ------------------------------------------------------------------------ */

// The five LEVL reactions. Fitness-native, one clear meaning each, and a fixed
// enum both here and in the CHECK constraint — arbitrary strings never reach
// the database.
export const REACTIONS = [
  { key: 'fire',    emoji: '🔥', label: 'Fire',    meaning: 'Serious session' },
  { key: 'strong',  emoji: '💪', label: 'Strong',  meaning: 'Strength showing' },
  { key: 'pr',      emoji: '⚡', label: 'PR',      meaning: 'New ground' },
  { key: 'respect', emoji: '👏', label: 'Respect', meaning: 'Showed up' },
  { key: 'like',    emoji: '❤️', label: 'Like',    meaning: 'Good to see' },
];
export const REACTION_KEYS = REACTIONS.map((r) => r.key);
export const reactionByKey = (k) => REACTIONS.find((r) => r.key === k) || null;

// Set, change, or clear your reaction. One row per person per post is enforced
// by a unique constraint, so nobody can stack reactions to inflate a count.
export async function setReaction(checkInId, reactionType) {
  if (!isConfigured) return offline();
  const uid = await cachedUserId();
  if (!uid) return offline('Not signed in');
  try {
    if (!reactionType) {
      return await supabase
        .from('check_in_reactions')
        .delete()
        .eq('check_in_id', checkInId)
        .eq('user_id', uid);
    }
    if (!REACTION_KEYS.includes(reactionType)) {
      return { data: null, error: { message: 'Unknown reaction' } };
    }
    return await supabase
      .from('check_in_reactions')
      .upsert(
        { check_in_id: checkInId, user_id: uid, reaction_type: reactionType },
        { onConflict: 'check_in_id,user_id' },
      )
      .select()
      .single();
  } catch (e) {
    return { data: null, error: { message: String((e && e.message) || e) } };
  }
}

/* ---------------------------------------------------------------------------
 * Comments
 * ------------------------------------------------------------------------ */

export const COMMENT_MAX = 300;

// Plain text only. Rendered into a <Text>, never interpreted as markup, and
// length-checked here as well as by the CHECK constraint.
export function sanitiseComment(body) {
  return String(body || '')
    .replace(/[\u0000-\u001F\u007F]/g, '')  // strip control characters
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, COMMENT_MAX);
}

export async function listComments(checkInId, limit = 100) {
  if (!isConfigured) return { data: [], error: null };
  try {
    const { data, error } = await supabase
      .from('check_in_comments')
      .select('id, check_in_id, user_id, body, created_at')
      .eq('check_in_id', checkInId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true })
      .limit(limit);
    if (error) return { data: null, error };
    if (!data || !data.length) return { data: [], error: null };

    // Two plain queries joined in JS rather than a PostgREST embed: there is no
    // direct foreign key from check_in_comments to profiles (both point at
    // auth.users), so an embed silently returns nothing. Same pattern the
    // friends service already uses for the same reason.
    const ids = [...new Set(data.map((c) => c.user_id))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar, level')
      .in('id', ids);
    const byId = {};
    (profiles || []).forEach((p) => { byId[p.id] = p; });

    return {
      data: data.map((c) => ({
        id: c.id,
        checkInId: c.check_in_id,
        userId: c.user_id,
        body: c.body,
        createdAt: c.created_at,
        createdAtMs: new Date(c.created_at).getTime(),
        author: byId[c.user_id] || null,
      })),
      error: null,
    };
  } catch (e) {
    return { data: null, error: { message: String((e && e.message) || e) } };
  }
}

export async function addComment(checkInId, body) {
  if (!isConfigured) return offline();
  const uid = await cachedUserId();
  if (!uid) return offline('Not signed in');
  const clean = sanitiseComment(body);
  if (!clean) return { data: null, error: { message: 'Write something first.' } };
  try {
    return await supabase
      .from('check_in_comments')
      .insert({ check_in_id: checkInId, user_id: uid, body: clean })
      .select()
      .single();
  } catch (e) {
    return { data: null, error: { message: String((e && e.message) || e) } };
  }
}

// Soft delete, so the count trigger can adjust and the row survives for
// moderation. Allowed for the comment's author and the post's owner.
export async function deleteComment(commentId) {
  if (!isConfigured) return offline();
  try {
    return await supabase
      .from('check_in_comments')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', commentId);
  } catch (e) {
    return { data: null, error: { message: String((e && e.message) || e) } };
  }
}

/* ---------------------------------------------------------------------------
 * XP
 * ------------------------------------------------------------------------ */

// Ask the server what today's Check In is worth. Returns the XP ACTUALLY
// granted — 0 on every repeat call, which is what makes post/delete/repost
// worthless. The amount comes from the server's rate card; the client never
// proposes a number.
export async function awardCheckInXP(localDate, verified) {
  if (!isConfigured) return { data: { granted: 0, detail: [] }, error: null };
  try {
    const { data, error } = await supabase.rpc('levl_award_check_in_xp', {
      p_local_date: localDate,
      p_verified: !!verified,
    });
    if (error) return { data: null, error };
    const row = Array.isArray(data) ? data[0] : data;
    return {
      data: {
        granted: (row && row.granted) || 0,
        totalToday: (row && row.total_today) || 0,
        detail: (row && row.detail) || [],
      },
      error: null,
    };
  } catch (e) {
    return { data: null, error: { message: String((e && e.message) || e) } };
  }
}

/* ---------------------------------------------------------------------------
 * Profile / archive
 * ------------------------------------------------------------------------ */

export async function getStats(userId) {
  if (!isConfigured) return { data: null, error: null };
  try {
    const { data, error } = await supabase.rpc('levl_check_in_stats', { p_user: userId || null });
    if (error) return { data: null, error };
    const row = Array.isArray(data) ? data[0] : data;
    return {
      data: {
        checkIns: (row && row.check_ins) || 0,
        verified: (row && row.verified) || 0,
        streak: (row && row.streak) || 0,
        bestStreak: (row && row.best_streak) || 0,
      },
      error: null,
    };
  } catch (e) {
    return { data: null, error: { message: String((e && e.message) || e) } };
  }
}

// Every Check In in one calendar month, for the archive grid.
export async function getMonth(userId, monthDate) {
  if (!isConfigured) return { data: [], error: null };
  try {
    const { data, error } = await supabase.rpc('levl_check_in_month', {
      p_user: userId || null,
      p_month: monthDate,
    });
    if (error) return { data: null, error };
    return {
      data: (data || []).map((r) => ({
        localDate: r.local_date,
        id: r.check_in_id,
        verified: r.check_in_type === 'verified',
        frontPath: r.front_photo_path,
        rearPath: r.rear_photo_path,
        primaryPhoto: r.primary_photo,
      })),
      error: null,
    };
  } catch (e) {
    return { data: null, error: { message: String((e && e.message) || e) } };
  }
}

/* ---------------------------------------------------------------------------
 * Safety: blocking and reporting
 * ------------------------------------------------------------------------ */

export async function blockUser(targetId) {
  if (!isConfigured) return offline();
  try {
    return await supabase.rpc('levl_block_user', { p_target: targetId });
  } catch (e) {
    return { data: null, error: { message: String((e && e.message) || e) } };
  }
}

export async function unblockUser(targetId) {
  if (!isConfigured) return offline();
  const uid = await cachedUserId();
  if (!uid) return offline('Not signed in');
  try {
    return await supabase.from('user_blocks').delete().eq('blocker', uid).eq('blocked', targetId);
  } catch (e) {
    return { data: null, error: { message: String((e && e.message) || e) } };
  }
}

export async function listBlocked() {
  if (!isConfigured) return { data: [], error: null };
  const uid = await cachedUserId();
  if (!uid) return { data: [], error: null };
  try {
    const { data, error } = await supabase.from('user_blocks').select('blocked, created_at').eq('blocker', uid);
    if (error || !data || !data.length) return { data: [], error: error || null };
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar, level')
      .in('id', data.map((b) => b.blocked));
    return { data: profiles || [], error: null };
  } catch (e) {
    return { data: [], error: { message: String((e && e.message) || e) } };
  }
}

export const REPORT_REASONS = [
  { key: 'inappropriate', label: 'Inappropriate content' },
  { key: 'harassment',    label: 'Harassment or bullying' },
  { key: 'spam',          label: 'Spam' },
  { key: 'other',         label: 'Something else' },
];

export async function reportContent({ targetType, targetId, targetUser, reason, detail }) {
  if (!isConfigured) return offline();
  const uid = await cachedUserId();
  if (!uid) return offline('Not signed in');
  try {
    const res = await supabase.from('content_reports').insert({
      reporter: uid,
      target_type: targetType,
      target_id: targetId,
      target_user: targetUser || null,
      reason,
      detail: detail ? String(detail).slice(0, 500) : null,
    });
    // Reporting the same thing twice is a no-op, not an error the user sees.
    if (res.error && String(res.error.code) === '23505') return { data: true, error: null };
    return res;
  } catch (e) {
    return { data: null, error: { message: String((e && e.message) || e) } };
  }
}

/* ---------------------------------------------------------------------------
 * Public identity
 * ------------------------------------------------------------------------ */

export async function setUsername(username) {
  if (!isConfigured) return offline();
  try {
    const { data, error } = await supabase.rpc('levl_set_username', { p_username: username });
    if (error) return { data: null, error };
    return { data, error: null };
  } catch (e) {
    return { data: null, error: { message: String((e && e.message) || e) } };
  }
}
