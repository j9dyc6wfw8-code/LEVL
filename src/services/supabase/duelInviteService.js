// LEVL — duelInviteService: shareable "open" duel invites.
//
// Unlike challenge() (which targets one named friend), an invite is open: anyone
// who opens the link or enters the code joins and the duel auto-starts. Flow:
//   createInvite() -> { code, url }         creator shares this
//   claimInvite(code) -> creates an ACTIVE duel between creator + joiner
//
// Requires the `duel_invites` table (run sql/duel_invites.sql). Never throws.

import { supabase, isConfigured, offline } from './client';
import { currentUserId } from './authService';
import { hasActiveDuel } from './duelService';

export const DUEL_LINK_PREFIX = 'levl://duel/';
// Legacy prefix still accepted so old invite links keep working post-rebrand.
export const LEGACY_DUEL_LINK_PREFIX = 'ascend://duel/';

// Unambiguous charset (no 0/O/1/I) so codes are easy to read/type.
const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function genCode(len = 6) {
  let out = '';
  for (let i = 0; i < len; i++) out += CHARS[Math.floor(Math.random() * CHARS.length)];
  return out;
}

// Parse a code out of an incoming deep link. Accepts:
//   levl://duel/ABC123   levl://duel?code=ABC123   ascend://duel/ABC123 (legacy)   .../duel/ABC123
export function parseDuelCode(url) {
  if (!url || typeof url !== 'string') return null;
  const m = url.match(/duel(?:\/|\?code=)([A-Z0-9]{4,12})/i);
  return m ? m[1].toUpperCase() : null;
}

export async function createInvite(days = 7, reward = 500) {
  if (!isConfigured) return offline();
  const uid = await currentUserId();
  if (!uid) return offline('Not signed in');
  try {
    const active = await hasActiveDuel(uid);
    if (active.error) return { data: null, error: active.error };
    if (active.data) return { data: null, error: { message: 'Finish your current duel first.' } };

    // Reuse the latest open code instead of leaving a trail of valid invites.
    const existing = await supabase.from('duel_invites').select('code')
      .eq('creator', uid).eq('status', 'open')
      .order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (existing.error) return { data: null, error: existing.error };
    if (existing.data && existing.data.code) {
      return { data: { code: existing.data.code, url: DUEL_LINK_PREFIX + existing.data.code }, error: null };
    }

    const safeDays = Math.max(1, Math.min(30, Math.round(Number(days) || 7)));
    for (let attempt = 0; attempt < 3; attempt++) {
      const code = genCode();
      const { error } = await supabase.from('duel_invites').insert({
        code, creator: uid, days: safeDays, reward, status: 'open',
      });
      if (!error) return { data: { code, url: DUEL_LINK_PREFIX + code }, error: null };
      // A generated-code collision is safe to retry; return every other error.
      if (error.code !== '23505') return { data: null, error };
    }
    return { data: null, error: { message: 'Could not make a unique invite. Try again.' } };
  } catch (e) {
    return { data: null, error: { message: String(e && e.message || e) } };
  }
}

// Join a duel from a code. The database function locks the invite, checks both
// players, creates the duel and consumes the code in one transaction. That
// prevents two phones claiming one code at the same moment.
export async function claimInvite(code) {
  if (!isConfigured) return offline();
  const uid = await currentUserId();
  if (!uid) return { data: null, error: { message: 'Sign in to join the duel.', needsAuth: true } };
  const clean = (code || '').trim().toUpperCase();
  if (!clean) return { data: null, error: { message: 'Enter an invite code.' } };
  try {
    const active = await hasActiveDuel(uid);
    if (active.error) return { data: null, error: active.error };
    if (active.data) return { data: null, error: { message: 'Finish your current duel first.' } };

    const { data, error } = await supabase.rpc('claim_duel_invite', { p_code: clean, p_expected_uid: uid });
    if (error) {
      const missingPatch = error.code === 'PGRST202' || error.code === '42883'
        || /claim_duel_invite.*schema cache|function.*does not exist/i.test(String(error.message || ''));
      if (missingPatch) {
        return { data: null, error: { message: 'Duel update required. Run sql/duel_integrity_patch.sql in Supabase.' } };
      }
      return { data: null, error };
    }
    const duel = Array.isArray(data) ? data[0] : data;
    if (!duel) return { data: null, error: { message: 'That invite is no longer available.' } };
    return { data: duel, error: null };
  } catch (e) {
    return { data: null, error: { message: String(e && e.message || e) } };
  }
}
