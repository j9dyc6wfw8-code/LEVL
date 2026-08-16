// ============================================================================
// LEVL — haptics
//
// One vocabulary for touch, so the same physical sensation always means the
// same thing. Screens call `tap()`, `success()`, `pr()` — never
// Haptics.impactAsync directly — which is what stops the app drifting into
// buzzing at everything.
//
// THE RULES
//   • Haptics mark STATE CHANGES, not taps. A button that opens a sheet needs
//     none; a set being logged does.
//   • Weight matches significance. Light for selection, medium for commitment,
//     the notification patterns for outcomes, and the celebration sequence for
//     the two moments that have genuinely earned it — a PR and a level-up.
//   • Never on scroll, never on typing, never repeatedly.
//
// Everything is fire-and-forget and swallows its errors: a device with no
// Taptic Engine, or a simulator, must never surface a haptics failure.
// ============================================================================

import { Platform, AccessibilityInfo } from 'react-native';
import * as Haptics from 'expo-haptics';

const supported = Platform.OS === 'ios' || Platform.OS === 'android';

// Reduce Motion is the closest system signal to "I want less of this".
// Someone who has switched it on gets the meaningful outcome haptics still
// (they carry information) but none of the decorative selection feedback.
let reduceMotion = false;
if (supported) {
  AccessibilityInfo.isReduceMotionEnabled()
    .then((v) => { reduceMotion = !!v; })
    .catch(() => {});
  try {
    AccessibilityInfo.addEventListener('reduceMotionChanged', (v) => { reduceMotion = !!v; });
  } catch (e) { /* older RN: the initial read is enough */ }
}

const run = (fn) => {
  if (!supported) return;
  try { fn(); } catch (e) { /* haptics are never load-bearing */ }
};

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/* --------------------------- selection weight --------------------------- */

// Changing a segmented control, picking a chip, switching tabs.
export const selection = () => {
  if (reduceMotion) return;
  run(() => Haptics.selectionAsync());
};

// A light confirming tap — swapping the Check In photos, toggling a reaction.
export const tap = () => {
  if (reduceMotion) return;
  run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
};

// Something committed: a set logged, a comment posted.
export const commit = () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));

/* ---------------------------- outcome weight ---------------------------- */

export const success = () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
export const warning = () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
export const error   = () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));

/* --------------------------- celebration weight -------------------------- */

// Reserved for a personal record and a level-up. A rising two-beat, so it feels
// like an ascent rather than an alert. Deliberately rationed: if everything
// celebrates, nothing does.
export async function celebrate() {
  if (!supported) return;
  if (reduceMotion) { success(); return; }
  run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
  await wait(90);
  run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy));
  await wait(110);
  run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
}

export default { selection, tap, commit, success, warning, error, celebrate };
