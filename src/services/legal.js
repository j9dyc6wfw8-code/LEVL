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

/* GitHub Pages, serving /docs from the LEVL repository.
 *
 * These have now had three homes, and the first two are worth recording so
 * nobody restores one by accident:
 *
 *   1. levl.app — NOT ours. The domain is listed for sale and both paths 404'd.
 *      A privacy policy URL landing on a for-sale page is an instant rejection.
 *   2. claude.ai artifact links — they resolved, but on a third party's domain,
 *      pinned to a snapshot, and revocable by someone other than us. Apple
 *      requires a privacy policy that stays reachable, and GDPR expects you to
 *      be able to publish an updated notice; neither is true of a link you do
 *      not control.
 *   3. Here. Same repository as the app, served from /docs, so the published
 *      policy and the source in legal/ can never silently disagree — updating
 *      one is updating the other.
 *
 * NOTE THE CAPITALS. The repository is `LEVL`, and GitHub Pages paths are
 * case-sensitive: /levl/privacy.html is a 404.
 *
 * Moving to your own domain later is a one-line change here plus a build. */
export const PRIVACY_URL = 'https://j9dyc6wfw8-code.github.io/LEVL/privacy.html';
export const TERMS_URL = 'https://j9dyc6wfw8-code.github.io/LEVL/terms.html';
export const SUPPORT_EMAIL = 'Levlup18@gmail.com';

// True when this user has never accepted, or accepted a version older than the
// current one. Profiles that have not loaded yet return false, so the app never
// blocks posting on a slow network.
export function needsTermsAcceptance(profile) {
  if (!profile) return false;
  if (!profile.terms_accepted_at) return true;
  return (profile.terms_version || '') < TERMS_VERSION;
}
