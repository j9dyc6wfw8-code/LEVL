// ============================================================================
// LEVL — legal
//
// One place for the policy URLs and the terms version, because they are
// referenced from four screens and from App Store Connect, and a link that
// silently 404s is worse than no link at all.
//
// TERMS_VERSION is a DATE, not a counter. Bump it only when the terms change
// MATERIALLY — anyone whose recorded acceptance predates it is asked again, and
// bumping it for a typo fix would nag every user for nothing.
//
// The source of the two documents lives in /legal in this repository. Publish
// them at these URLs before shipping: Apple requires a reachable privacy policy
// for any app that collects data, and doubly so for one touching HealthKit.
// ============================================================================

export const TERMS_VERSION = '2026-08-18';

export const PRIVACY_URL = 'https://levl.app/privacy';
export const TERMS_URL = 'https://levl.app/terms';
export const SUPPORT_EMAIL = 'support@levl.app';

// True when this user has never accepted, or accepted a version older than the
// current one. Profiles that have not loaded yet return false, so the app never
// blocks posting on a slow network.
export function needsTermsAcceptance(profile) {
  if (!profile) return false;
  if (!profile.terms_accepted_at) return true;
  return (profile.terms_version || '') < TERMS_VERSION;
}
