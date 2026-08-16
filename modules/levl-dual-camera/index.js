// ============================================================================
// LEVL — levl-dual-camera (JS surface)
//
// iOS-only native module. Everything below degrades to a clearly-reported
// "unavailable" on Android, in Expo Go, or on a build where the module has not
// been linked, so importing this file can never crash the app.
//
// The caller always learns HOW a capture happened:
//   { front, rear, simultaneous, gapMs }
// `simultaneous` is the hardware truth, not a wish.
// ============================================================================

import { Platform } from 'react-native';

let NativeModule = null;
let NativeView = null;

try {
  // requireOptionalNativeModule returns null instead of throwing when the
  // native side isn't present — which is exactly the Expo Go case.
  // eslint-disable-next-line global-require
  const expo = require('expo');
  NativeModule = expo.requireOptionalNativeModule
    ? expo.requireOptionalNativeModule('LevlDualCamera')
    : null;
  if (NativeModule && expo.requireNativeView) {
    NativeView = expo.requireNativeView('LevlDualCamera');
  }
} catch (e) {
  NativeModule = null;
  NativeView = null;
}

// Is the native dual-camera path available at all on this build/device?
export const isAvailable = !!(NativeModule && NativeView && Platform.OS === 'ios');

// Can this specific device capture both cameras at the same instant?
// A12 (iPhone XS / XR) and later. False here means the sequential path runs.
export const isSimultaneousSupported = !!(
  NativeModule && NativeModule.isSimultaneousSupported
);

export const DualCameraView = NativeView;

// 'granted' | 'denied' | 'restricted' | 'undetermined' | 'unavailable'
export function getPermissionStatus() {
  if (!NativeModule) return 'unavailable';
  try {
    return NativeModule.getPermissionStatus();
  } catch (e) {
    return 'unavailable';
  }
}

export async function requestPermission() {
  if (!NativeModule) return 'unavailable';
  try {
    return await NativeModule.requestPermission();
  } catch (e) {
    return 'denied';
  }
}

export default {
  isAvailable,
  isSimultaneousSupported,
  DualCameraView,
  getPermissionStatus,
  requestPermission,
};
