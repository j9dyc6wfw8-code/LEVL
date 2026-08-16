// LEVL — Apple Sign In helper.
//
// Wraps the native Apple authentication flow and hands the resulting identity
// token to Supabase (via signInWithIdToken). Isolated in its own file so the
// rest of auth doesn't depend on the native module being present — if the
// package or platform support is missing, isAppleAuthAvailable() returns false
// and the UI simply hides the button.
//
// IMPORTANT (manual setup, see docs): Apple Sign In only works once you've
// configured it in BOTH the Apple Developer console (an App ID with "Sign In
// with Apple" enabled + a Services ID + key) AND the Supabase dashboard
// (Authentication -> Providers -> Apple, with that key/service id). Until then
// the button appears but the token exchange will error — handled gracefully.

import { Platform } from 'react-native';
import { signInWithIdToken } from './supabase/authService';

// Lazily require the native module so the app doesn't crash on a build where
// it isn't linked yet. Returns the module or null.
function appleModule() {
  try {
    // eslint-disable-next-line global-require
    return require('expo-apple-authentication');
  } catch (e) {
    return null;
  }
}

// Is Apple sign-in usable right now? iOS only, module present.
export async function isAppleAuthAvailable() {
  if (Platform.OS !== 'ios') return false;
  const AppleAuthentication = appleModule();
  if (!AppleAuthentication) return false;
  try {
    return await AppleAuthentication.isAvailableAsync();
  } catch (e) {
    return false;
  }
}

// Run the full native Apple sign-in, then exchange with Supabase.
// Returns { data, error } like the other auth calls.
export async function signInWithApple() {
  const AppleAuthentication = appleModule();
  if (!AppleAuthentication) return { data: null, error: { message: 'Apple sign-in unavailable on this build' } };
  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });
    if (!credential.identityToken) {
      return { data: null, error: { message: 'No identity token returned from Apple' } };
    }
    // Hand Apple's identity token to Supabase to create/sign in the user.
    return await signInWithIdToken('apple', credential.identityToken);
  } catch (e) {
    // User cancelling the native sheet throws with code ERR_REQUEST_CANCELED —
    // treat that as a silent no-op rather than an error to show.
    if (e && (e.code === 'ERR_REQUEST_CANCELED' || e.code === 'ERR_CANCELED')) {
      return { data: null, error: { canceled: true } };
    }
    return { data: null, error: { message: String(e && e.message || e) } };
  }
}
