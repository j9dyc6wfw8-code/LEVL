// ============================================================================
// LEVL — turning backend errors into sentences a person can act on
//
// THE BUG THIS FIXES
//
// The pattern all over this app was:
//
//     toast(res.error.message || 'Could not attach that workout.')
//
// Read the precedence. The raw message wins, and the sentence someone actually
// wrote is only reached when the backend returns an EMPTY message — which is
// almost never. So the friendly copy was decorative, and what users really got
// was Postgres:
//
//     new row violates row-level security policy for table "friendships"
//     duplicate key value violates unique constraint "profiles_username_key"
//     JWT expired
//
// The design system already says "Never surface a raw backend error to a user".
// AuthScreens honoured it via readableAuthError(); nothing else did.
//
// WHAT THIS DOES
//
// Inverts the precedence. A known error becomes specific human copy. An UNKNOWN
// error becomes the caller's fallback — never the raw string. The raw text is
// not lost: it goes to telemetry, which is where a developer can read it and a
// user cannot.
//
// Keep the mappings about causes the user can do something about. "Try again"
// for a network blip is useful; a constraint name never is.
// ============================================================================

import { captureError } from './telemetry';

export function readableError(err, fallback) {
  const raw = typeof err === 'string' ? err : (err && err.message) || '';
  if (!raw) return fallback;
  const m = raw.toLowerCase();

  // --- offline / transport. The most common real cause in a gym basement. ---
  if (m.includes('network request failed') || m.includes('failed to fetch')
      || m.includes('timeout') || m.includes('timed out')) {
    return 'No connection. Check your signal and try again.';
  }

  // --- the session died under them ---
  if (m.includes('jwt') || m.includes('token is expired') || m.includes('not authenticated')
      || m.includes('invalid claim')) {
    return 'Your session expired. Sign in again.';
  }

  // --- RLS and grants. Usually means "not friends", or acting on someone
  //     else's row. Never explain the policy; say what it means. ---
  if (m.includes('row-level security') || m.includes('violates row')
      || m.includes('permission denied') || m.includes('insufficient privilege')) {
    return 'You do not have access to that.';
  }

  // --- uniqueness. The only one users hit routinely is a taken username. ---
  if (m.includes('duplicate key') || m.includes('unique constraint')
      || m.includes('already exists')) {
    return 'That is already taken — try another.';
  }

  // --- foreign keys / missing rows: the thing was deleted while they looked ---
  if (m.includes('foreign key') || m.includes('violates foreign')
      || m.includes('no rows returned') || m.includes('not found')) {
    return 'That is no longer available — it may have been deleted.';
  }

  if (m.includes('rate limit') || m.includes('too many requests')) {
    return 'Too many attempts. Wait a moment, then try again.';
  }

  if (m.includes('payload too large') || m.includes('entity too large')) {
    return 'That file is too large to upload.';
  }

  // Unknown. The user gets the sentence someone wrote for this situation; the
  // real text goes somewhere a developer will see it.
  try { captureError(err, { surfaced: false, fallback }); } catch (e) {}
  return fallback;
}

export default readableError;
