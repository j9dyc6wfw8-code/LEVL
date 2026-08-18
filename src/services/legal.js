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

/* These point at the published copies of /docs/privacy.html and /docs/terms.html.
 *
 * They previously pointed at levl.app, which is NOT ours — the domain is listed
 * for sale on Atom.com, and /privacy and /terms both returned 404. A privacy
 * policy URL that lands on a for-sale page is an immediate App Store rejection,
 * so these had to become links that resolve before anything else.
 *
 * Moving to your own domain later is a one-line change here plus a build: host
 * the two files in /docs and swap these two constants. */
export const PRIVACY_URL = 'https://claude.ai/code/artifact/cb1a58e5-a578-4213-9992-acc108869397';
export const TERMS_URL = 'https://claude.ai/code/artifact/99ef57a5-aead-486e-9d4b-7fa8906b3dee';
export const SUPPORT_EMAIL = 'Levlup18@gmail.com';

// True when this user has never accepted, or accepted a version older than the
// current one. Profiles that have not loaded yet return false, so the app never
// blocks posting on a slow network.
export function needsTermsAcceptance(profile) {
  if (!profile) return false;
  if (!profile.terms_accepted_at) return true;
  return (profile.terms_version || '') < TERMS_VERSION;
}
