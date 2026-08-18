// LEVL — syncService: offline-first cloud save.
//
// THE RULE (Phase 4 requirement): never overwrite newer data with older data.
// Every save — local or cloud — carries an `updatedAt` timestamp. Sync always
// compares the two and keeps whichever is newer. This means:
//   - Playing entirely offline never loses data (nothing to compare against).
//   - Two devices used at different times converge correctly.
//   - A stale pull can never clobber fresh local progress.
//
// This file does NOT change how local save/load works — App.js's existing
// `persist()` and AsyncStorage flow are untouched. Sync is an ADDITIONAL layer
// that runs alongside it: local storage remains the source of truth the app
// always reads from; the cloud is a mirror kept in step opportunistically.

import { isConfigured } from './client';
import { pushSave, pullSave, pushWorkouts, deleteWorkout } from './workoutService';
import { upsertMyProfile } from './profileService';
import telemetry from '../telemetry';

// Local saves don't currently carry an updatedAt field — add one without
// disturbing the existing save shape. Called wherever we're about to compare
// or push, so old local saves get a timestamp lazily rather than needing a
// migration.
function withStamp(data) {
  if (data && data.updatedAt) return data;
  return { ...data, updatedAt: Date.now() };
}

// Merge local + cloud: newer `updatedAt` wins, WHOLESALE (not field-by-field —
// a partial merge of two RPG saves could create impossible states, e.g. XP
// from one save with items from another). This is deliberately simple and
// safe over clever.
export function resolveConflict(local, cloud, cloudUpdatedAt) {
  const localTime = (local && local.updatedAt) || 0;
  const cloudTime = cloudUpdatedAt ? new Date(cloudUpdatedAt).getTime() : 0;
  if (cloud && cloudTime > localTime) return { winner: cloud, source: 'cloud' };
  return { winner: withStamp(local), source: 'local' };
}

// Called once, right after login. Pulls the cloud save (if any), resolves
// against whatever's already local, and returns the data the app should use.
// Never throws — any failure just means "stay on local data," which is always
// safe.
export async function pullAndResolve(localData) {
  if (!isConfigured) return { data: withStamp(localData), source: 'local-only' };
  try {
    const { data: row, error } = await pullSave();
    if (error || !row) return { data: withStamp(localData), source: 'local-only' };
    const { winner, source } = resolveConflict(localData, row.blob, row.updated_at);
    return { data: winner, source };
  } catch (e) {
    return { data: withStamp(localData), source: 'local-only' };
  }
}

// Fire-and-forget push, called after every local persist. Debounced by the
// caller (App.js) so we don't hammer the network on every single set logged.
// Failures are silent by design — offline play must never surface an error
// for something the user didn't ask to do.
// Tracks whether we've already complained about a given failure, so a broken
// column produces ONE readable warning instead of one every 1.5 seconds.
const warned = new Set();
function warnOnce(key, message) {
  if (warned.has(key)) return;
  warned.add(key);
  // eslint-disable-next-line no-console
  console.warn('[LEVL sync] ' + message);
}

export async function pushInBackground(data, dv) {
  if (!isConfigured) return { ok: false, reason: 'not-configured' };
  try {
    const stamped = withStamp(data);
    const saveRes = await pushSave(stamped);
    if (saveRes && saveRes.error && !saveRes.error.offline) {
      warnOnce('save', 'Could not push your save: ' + saveRes.error.message);
    }
    if (dv) {
      const profRes = await upsertMyProfile(stamped, dv);
      // LOUD FAILURE, ON PURPOSE. This used to be swallowed whole, which meant
      // a missing/renamed column on `profiles` would stop level, rank, streak
      // and leaderboard values from EVER updating with no symptom other than
      // stale numbers. One clear console line names the actual cause.
      if (profRes && profRes.error && !profRes.error.offline) {
        const msg = String(profRes.error.message || profRes.error);
        warnOnce('profile', 'Profile row did not save: ' + msg
          + (/column|schema|does not exist/i.test(msg)
            ? '  → a column is missing on public.profiles. Run sql/profile_character_column.sql in Supabase.'
            : ''));
        return { ok: false, reason: 'profile', error: profRes.error };
      }
    }
    return { ok: true };
  } catch (e) {
    warnOnce('throw', 'Background sync threw: ' + String((e && e.message) || e));
    return { ok: false, reason: 'threw', error: e };
  }
}

// Push any workouts logged since the last sync (keeps the activity feed and
// friend visibility current). Safe to call often — owner-scoped client_id
// dedupes, so re-sending an already-synced entry is a no-op.
export async function syncWorkouts(entries, unit) {
  if (!isConfigured) return { data: null, error: { message: 'Backend not configured', offline: true } };
  if (!entries || !entries.length) return { data: [], error: null };
  try {
    const result = await pushWorkouts(entries, unit);
    // A row the server refused as implausible is no longer allowed to be
    // invisible. It used to abort the entire batch and then poison every
    // subsequent sync without a single line anywhere saying so.
    if (result && result.rejected && result.rejected.length) {
      const first = result.rejected[0];
      warnOnce('rejected:' + first.client_id,
        result.rejected.length + ' workout row(s) were refused by the server. First: '
        + first.exercise + ' ' + first.weight + (first.unit || '') + ' — ' + first.reason);
      telemetry.track('workout_rows_rejected', {
        count: result.rejected.length,
        reason: first.reason.slice(0, 120),
      });
    }
    return result;
  } catch (e) {
    // The caller still keeps the local save. Returning the error lets the duel
    // score update wait until the matching public workout rows exist, so the
    // score and visible exercise feed cannot drift apart.
    return { data: null, error: { message: String(e && e.message || e) } };
  }
}

// Remove one set from the cloud log. Called when the user deletes an entry, so
// the public record matches what they see. Silent on failure: the local save is
// already correct, and the next full sync is not blocked by this.
export async function removeSyncedWorkout(clientId) {
  if (!isConfigured || !clientId) return { data: null, error: null };
  try {
    return await deleteWorkout(clientId);
  } catch (e) {
    return { data: null, error: { message: String((e && e.message) || e) } };
  }
}
