// ============================================================================
// LEVL — breachCheck
//
// "Has this password already appeared in a public data breach?"
//
// WHY THIS FILE EXISTS
// Supabase Auth offers exactly this check built in — and it is gated behind the
// Pro plan. This is the same protection, from the same source, on the free
// plan, done on the device.
//
// THE PASSWORD NEVER LEAVES THE PHONE. That is not a slogan, it is how the
// Have I Been Pwned range API is designed (k-anonymity):
//
//   1. hash the password with SHA-1                → 40 hex characters
//   2. send ONLY THE FIRST FIVE of those           → e.g. "5BAA6"
//   3. HIBP returns every breached hash suffix starting with those five —
//      several hundred of them, one of which may or may not be ours
//   4. we compare locally
//
// The server therefore learns that somebody, somewhere, was interested in one
// of ~800 hashes. It cannot learn which, and it never sees the password, the
// full hash, or who is asking. Adding the `Add-Padding` header makes HIBP pad
// every response to a uniform size, so response LENGTH leaks nothing either.
//
// WHAT THIS IS AND IS NOT
// It protects people from their own reused passwords, which is the entire
// threat model — a determined user could patch the app and skip it, but a
// determined user can also just choose a bad password on any system that only
// checks server-side. This is a guard rail, not a lock.
//
// IT FAILS OPEN, ALWAYS. If HIBP is down, slow, or the phone is offline, signup
// proceeds. A password checker that prevents account creation when a
// third-party API has a bad afternoon is worse than no checker at all.
// ============================================================================

import { sha1Hex } from './platform';

const RANGE_URL = 'https://api.pwnedpasswords.com/range/';
// Short on purpose. This sits between a person tapping "Create account" and
// anything happening, so it must never be the reason signup feels broken.
const TIMEOUT_MS = 4000;

/**
 * @returns {Promise<{breached: boolean, count: number, checked: boolean}>}
 *   checked=false means we could not reach HIBP and the caller should carry on.
 */
export async function checkPassword(password) {
  const miss = { breached: false, count: 0, checked: false };
  if (!password || password.length < 4) return miss;

  let hash;
  try {
    hash = (await sha1Hex(password)).toUpperCase();
  } catch (e) {
    return miss;                       // no hash, no lookup, no opinion
  }
  if (!hash || hash.length !== 40) return miss;

  const prefix = hash.slice(0, 5);
  const suffix = hash.slice(5);

  // AbortController rather than Promise.race, so a slow request is actually
  // torn down instead of left running in the background.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(RANGE_URL + prefix, {
      method: 'GET',
      headers: { 'Add-Padding': 'true' },
      signal: controller.signal,
    });
    if (!res.ok) return miss;
    const body = await res.text();

    for (const line of body.split('\n')) {
      const sep = line.indexOf(':');
      if (sep < 0) continue;
      if (line.slice(0, sep).trim().toUpperCase() !== suffix) continue;
      const count = parseInt(line.slice(sep + 1).trim(), 10) || 0;
      // HIBP's padding entries are real-looking hashes with a count of 0.
      // Treating one as a hit would reject a perfectly good password.
      if (count <= 0) return { breached: false, count: 0, checked: true };
      return { breached: true, count, checked: true };
    }
    return { breached: false, count: 0, checked: true };
  } catch (e) {
    return miss;                       // offline, aborted, DNS, anything
  } finally {
    clearTimeout(timer);
  }
}

/**
 * The message to show, or null if the password is fine / we could not check.
 * Kept here so signup, reset and change-password all say the same thing.
 */
export async function breachWarning(password) {
  const { breached, count } = await checkPassword(password);
  if (!breached) return null;
  const times = count >= 1000
    ? Math.round(count / 1000) + ',000+ times'
    : count + (count === 1 ? ' time' : ' times');
  return 'This password has appeared in a known data breach ' + times
    + '. Please choose a different one — it is not safe even if it looks strong.';
}

export default { checkPassword, breachWarning };
