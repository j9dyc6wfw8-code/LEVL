// LEVL — authService: everything about WHO the user is.
//
// UI never touches supabase.auth directly — it calls these functions. That
// keeps auth logic in one testable place and means we can change providers
// without touching screens.
//
// Every function returns { data, error } (Supabase's own shape) so callers
// have one consistent thing to check. When the backend is off, we return a
// clean offline() result instead of throwing.

import { supabase, isConfigured, offline } from './client';

// --- session ---------------------------------------------------------------

// Current session (or null). Used at boot to decide logged-in vs login screen.
export async function getSession() {
  if (!isConfigured) return offline();
  try {
    return await supabase.auth.getSession();
  } catch (e) {
    return { data: null, error: { message: String(e && e.message || e) } };
  }
}

// Subscribe to login/logout events. Returns an unsubscribe function.
export function onAuthChange(cb) {
  if (!isConfigured) return () => {};
  try {
    const { data } = supabase.auth.onAuthStateChange((_event, session) => cb(session));
    return () => { try { data.subscription.unsubscribe(); } catch (e) {} };
  } catch (e) {
    return () => {};
  }
}

// --- email + password ------------------------------------------------------

export async function signUpEmail(email, password) {
  if (!isConfigured) return offline();
  try {
    return await supabase.auth.signUp({ email: email.trim(), password });
  } catch (e) {
    return { data: null, error: { message: String(e && e.message || e) } };
  }
}

export async function signInEmail(email, password) {
  if (!isConfigured) return offline();
  try {
    return await supabase.auth.signInWithPassword({ email: email.trim(), password });
  } catch (e) {
    return { data: null, error: { message: String(e && e.message || e) } };
  }
}

// Where Supabase sends the user back to after they tap the reset link in their
// email. The email itself contains an https:// supabase.co link (tappable in
// every mail app); Supabase verifies the token and then redirects to this
// custom scheme, which opens LEVL. Must be listed under
// Authentication → URL Configuration → Redirect URLs in the dashboard.
export const RESET_REDIRECT = 'levl://reset';

export async function resetPassword(email) {
  if (!isConfigured) return offline();
  try {
    return await supabase.auth.resetPasswordForEmail(
      email.trim().toLowerCase(),
      { redirectTo: RESET_REDIRECT }
    );
  } catch (e) {
    return { data: null, error: { message: String(e && e.message || e) } };
  }
}

// Pull auth params out of a redirect URL. They can arrive in the query string
// (?code=... for PKCE) or the fragment (#access_token=... for implicit), so we
// read both rather than assuming a flow.
function parseAuthParams(url) {
  const out = {};
  if (!url || typeof url !== 'string') return out;
  const take = (str) => {
    if (!str) return;
    str.split('&').forEach((kv) => {
      const i = kv.indexOf('=');
      if (i < 0) return;
      // '+' means space in these redirect params; decodeURIComponent alone
      // leaves it literal, which made error messages read "link+is+invalid".
      const dec = (t) => { try { return decodeURIComponent(String(t).replace(/\+/g, ' ')); } catch (e) { return String(t); } };
      out[dec(kv.slice(0, i))] = dec(kv.slice(i + 1));
    });
  };
  const hashPart = url.split('#')[1];
  const qsPart = url.split('?')[1];
  take(qsPart ? qsPart.split('#')[0] : '');
  take(hashPart);
  return out;
}

// Is this incoming deep link a password-recovery redirect?
export function isRecoveryUrl(url) {
  if (!url || typeof url !== 'string') return false;
  if (url.indexOf('levl://reset') === 0) return true;
  if (url.indexOf('ascend://reset') === 0) return true; // legacy links from pre-rebrand emails
  const p = parseAuthParams(url);
  return p.type === 'recovery' && (!!p.access_token || !!p.code);
}

// Turn the recovery redirect into a live session, which is what allows the
// password to be changed. Handles implicit (tokens) and PKCE (code) flows.
export async function completeRecoveryFromUrl(url) {
  if (!isConfigured) return offline();
  const p = parseAuthParams(url);
  if (p.error_description || p.error) {
    return { data: null, error: { message: p.error_description || p.error } };
  }
  try {
    if (p.access_token && p.refresh_token) {
      return await supabase.auth.setSession({
        access_token: p.access_token, refresh_token: p.refresh_token,
      });
    }
    if (p.code) return await supabase.auth.exchangeCodeForSession(p.code);
    return { data: null, error: { message: 'That reset link has expired or is missing its token — request a new one.' } };
  } catch (e) {
    return { data: null, error: { message: String(e && e.message || e) } };
  }
}

// Step 2 of reset: verify the 6-digit code from the email. On success the user
// is in a temporary recovery session, which is what lets us set a new password.
// (Requires the Reset Password email template to include {{ .Token }} — see the
// manual steps. Uses an OTP code, not a magic link, because this is a native
// app with no deep-link handling.)
export async function verifyResetCode(email, code) {
  if (!isConfigured) return offline();
  try {
    return await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: (code || '').trim(),
      type: 'recovery',
    });
  } catch (e) {
    return { data: null, error: { message: String(e && e.message || e) } };
  }
}

// Step 3 of reset: set the new password (needs the recovery session from step 2).
export async function setNewPassword(newPassword) {
  if (!isConfigured) return offline();
  try {
    return await supabase.auth.updateUser({ password: newPassword });
  } catch (e) {
    return { data: null, error: { message: String(e && e.message || e) } };
  }
}

// --- OAuth (Apple / Google) ------------------------------------------------
// These use an ID token obtained natively (expo-apple-authentication /
// Google sign-in). The native token flow is added in the Phase 3 UI step; the
// service call itself lives here so the pattern is ready.

export async function signInWithIdToken(provider, idToken, nonce) {
  if (!isConfigured) return offline();
  try {
    return await supabase.auth.signInWithIdToken({ provider, token: idToken, nonce });
  } catch (e) {
    return { data: null, error: { message: String(e && e.message || e) } };
  }
}

// --- logout ----------------------------------------------------------------

export async function signOut() {
  if (!isConfigured) return offline();
  try {
    return await supabase.auth.signOut();
  } catch (e) {
    return { data: null, error: { message: String(e && e.message || e) } };
  }
}

// Convenience: the current user id, or null. Many services need this.
// The email on the CURRENT Supabase session. Used to verify that a cloud pull
// actually belongs to the account being signed into — without this check, a
// stale session from the previous user can pull their save onto a new account
// (the account-switch data-bleed bug).
export async function currentUserEmail() {
  if (!isConfigured) return null;
  try {
    const { data } = await supabase.auth.getUser();
    return (data && data.user && data.user.email) ? data.user.email.toLowerCase() : null;
  } catch (e) { return null; }
}

export async function currentUserId() {
  if (!isConfigured) return null;
  try {
    const { data } = await supabase.auth.getUser();
    return (data && data.user && data.user.id) || null;
  } catch (e) {
    return null;
  }
}

// The signed-in user id, WITHOUT a network round trip.
//
// getUser() above calls the Supabase auth server to validate the token. That is
// the right thing when the answer must be authoritative — but it returns null
// when there is no signal, which made Check In refuse to save a capture in a
// gym with no reception: the user saw "Sign in to Check In" while perfectly
// signed in.
//
// getSession() reads the token AsyncStorage already holds and decodes it
// locally, so it answers offline. Use this for anything that must work without
// a connection; use currentUserId() when the server's opinion actually matters.
export async function cachedUserId() {
  if (!isConfigured) return null;
  try {
    const { data } = await supabase.auth.getSession();
    const id = data && data.session && data.session.user && data.session.user.id;
    if (id) return id;
  } catch (e) { /* fall through to the networked check */ }
  // No stored session — ask the server, in case this is a cold start that has
  // not hydrated yet.
  return currentUserId();
}

/* ---------------------------------------------------------------------------
 * Account deletion (App Store Guideline 5.1.1(v)).
 *
 * The work happens in one Postgres function, delete_own_account(), which takes
 * no arguments and acts only on auth.uid() — there is deliberately no way to
 * point it at somebody else's account. It removes the user's check-ins first so
 * the storage-cleanup trigger can queue their photos while the account still
 * exists, then deletes the auth user, and every remaining table cascades.
 *
 * The local session is cleared afterwards regardless: once the server row is
 * gone the token is worthless, and leaving it behind would show a signed-in
 * shell for an account that no longer exists.
 * ------------------------------------------------------------------------ */
export async function deleteAccount() {
  if (!isConfigured) return { error: { message: 'Not signed in to an account.' } };
  try {
    const { error } = await supabase.rpc('delete_own_account');
    if (error) return { error };
  } catch (e) {
    return { error: { message: String((e && e.message) || e) } };
  }
  // Best effort — the account is already gone, so a failure here is cosmetic.
  try { await supabase.auth.signOut(); } catch (e) {}
  return { error: null };
}
