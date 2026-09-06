// ============================================================================
// LEVL — CheckInCameraScreen
//
// Capture, preview, post. Three steps, no wizard.
//
// TWO CAPTURE PATHS, BOTH REAL
//   Modern iPhones (A12 / iPhone XS and later) run both cameras in one
//   AVCaptureMultiCamSession, so the two frames are milliseconds apart. Older
//   hardware physically cannot, so LEVL takes the rear photo and immediately
//   swaps to the front — around a third of a second. The result reports which
//   happened, and the UI says so honestly rather than implying simultaneity it
//   did not achieve.
//
//   Where the native module is unavailable entirely — Expo Go, or Android —
//   expo-camera provides the same two-shot sequence. The feature degrades; it
//   never disappears and never pretends.
//
// PERMISSION is requested here, on the screen that explains why, and a denial
// is a clear explanation with a route to Settings — not a dead end and never a
// crash.
// ============================================================================

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Pressable, ActivityIndicator, Linking, Platform, AppState, StyleSheet, Alert, ScrollView } from 'react-native';
import { Text } from '../components/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { CameraView, useCameraPermissions } from 'expo-camera';
import DualCamera from '../../modules/levl-dual-camera';
import { C, RADIUS, SPACING, T, TOUCH } from '../theme';
import haptics from '../services/haptics';
import CheckInComposer from '../components/social/CheckInComposer';

const SHUTTER = 74;

export default function CheckInCameraScreen({
  onClose,
  onPosted,
  sessionsToday,
  defaultVisibility,
  unit,
  posting,
  post,
}) {
  const insets = useSafeAreaInsets();

  const [stage, setStage] = useState('camera');     // camera | composing
  const [capture, setCapture] = useState(null);     // { front, rear, simultaneous, gapMs }
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [primary, setPrimary] = useState('rear');
  const [facing, setFacing] = useState('back');   // fallback path only

  const nativeRef = useRef(null);
  const fallbackRef = useRef(null);
  const [permission, requestPermission] = useCameraPermissions();

  const useNative = DualCamera.isAvailable;
  const granted = useNative
    ? DualCamera.getPermissionStatus() === 'granted'
    : !!(permission && permission.granted);

  /* ------------------------------ permission ----------------------------- */

  const [nativeStatus, setNativeStatus] = useState(() =>
    (useNative ? DualCamera.getPermissionStatus() : 'unavailable'));

  const ask = useCallback(async () => {
    if (useNative) {
      const status = await DualCamera.requestPermission();
      setNativeStatus(status);
      return status === 'granted';
    }
    const res = await requestPermission();
    return !!(res && res.granted);
  }, [useNative, requestPermission]);

  useEffect(() => {
    // Ask on entry — this screen exists solely to use the camera, so the
    // request is in context by construction.
    if (!granted) ask();
    // Coming back from Settings should pick up a newly granted permission.
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active' && useNative) setNativeStatus(DualCamera.getPermissionStatus());
    });
    return () => { try { sub.remove(); } catch (e) {} };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const permissionDenied = useNative
    ? (nativeStatus === 'denied' || nativeStatus === 'restricted')
    : !!(permission && !permission.granted && !permission.canAskAgain);

  /* -------------------------------- capture ------------------------------ */

  const captureNative = useCallback(async () => {
    if (!nativeRef.current) throw new Error('Camera is not ready.');
    return await nativeRef.current.capture();
  }, []);

  // expo-camera fallback: rear, flip, front. Slower than the native path and
  // reported as such — the composer never claims these were simultaneous.
  const captureFallback = useCallback(async () => {
    const cam = fallbackRef.current;
    if (!cam) throw new Error('Camera is not ready.');
    const startedAt = Date.now();
    const rear = await cam.takePictureAsync({ quality: 0.9, skipProcessing: true });
    setFacing('front');
    // Give the hardware a moment to actually switch before firing again;
    // capturing too early returns a black frame on some devices.
    await new Promise((r) => setTimeout(r, 420));
    const front = await cam.takePictureAsync({ quality: 0.9, skipProcessing: true });
    setFacing('back');
    return {
      front: front.uri,
      rear: rear.uri,
      simultaneous: false,
      gapMs: Date.now() - startedAt,
    };
  }, []);

  const shoot = useCallback(async () => {
    if (busy) return;
    if (!granted) { const ok = await ask(); if (!ok) return; }
    setBusy(true);
    haptics.commit();
    try {
      const result = useNative ? await captureNative() : await captureFallback();
      setCapture(result);
      setStage('composing');
      haptics.success();
    } catch (e) {
      haptics.error();
      const message = String((e && (e.message || e.code)) || e);
      // A cancelled capture is not an error worth a dialog.
      if (!/CANCEL/i.test(message)) {
        Alert.alert('Could not take the photo', message);
      }
    } finally {
      setBusy(false);
    }
  }, [busy, granted, ask, useNative, captureNative, captureFallback]);

  const retake = useCallback(() => {
    haptics.selection();
    setCapture(null);
    setStage('camera');
  }, []);

  /* --------------------------------- post -------------------------------- */

  const submit = useCallback(async (options) => {
    const result = await post(capture, { ...options, primaryPhoto: primary });
    if (result.ok) {
      haptics.celebrate();
      onPosted(result);
      return result;
    }
    if (result.queued) {
      // Not a failure the user needs to fix — it is saved and will retry.
      haptics.warning();
      onPosted({ ...result, queued: true });
      return result;
    }
    haptics.error();
    Alert.alert('Could not post', (result.error) || 'Try again in a moment.');
    return result;
  }, [post, capture, primary, onPosted]);

  /* -------------------------------- render ------------------------------- */

  if (stage === 'composing' && capture) {
    return (
      <CheckInComposer
        capture={capture}
        primary={primary}
        onSwapPrimary={() => { haptics.tap(); setPrimary((p) => (p === 'rear' ? 'front' : 'rear')); }}
        sessionsToday={sessionsToday}
        defaultVisibility={defaultVisibility}
        unit={unit}
        posting={posting}
        onRetake={retake}
        onCancel={onClose}
        onPost={submit}
      />
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>

      {/* ---- the live preview -------------------------------------------- */}
      <View style={StyleSheet.absoluteFill}>
        {permissionDenied ? (
          <PermissionWall onOpenSettings={() => Linking.openSettings()} onClose={onClose} />
        ) : !granted ? (
          <Centered><ActivityIndicator color={C.gold} /></Centered>
        ) : useNative ? (
          <DualCamera.DualCameraView
            ref={nativeRef}
            style={StyleSheet.absoluteFill}
            active
            primary={primary}
            onReady={(e) => {
              setReady(true);
              setCameraError(null);
              void e;
            }}
            onCameraError={(e) => {
              const payload = (e && e.nativeEvent) || e || {};
              setCameraError(payload.message || 'The camera could not start.');
            }}
          />
        ) : (
          <CameraView
            ref={fallbackRef}
            style={StyleSheet.absoluteFill}
            facing={facing}
            onCameraReady={() => setReady(true)}
          />
        )}
      </View>

      {/* ---- chrome ------------------------------------------------------- */}
      {!permissionDenied ? (
        <View style={{ flex: 1, justifyContent: 'space-between' }} pointerEvents="box-none">

          <View style={{ paddingTop: insets.top + 6, paddingHorizontal: SPACING.lg }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Pressable
                onPress={onClose}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel="Close the camera"
                style={{
                  width: 36, height: 36, borderRadius: 18,
                  backgroundColor: 'rgba(0,0,0,0.45)',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                <Text style={{ color: '#fff', fontSize: 17, fontWeight: '600', marginTop: -2 }}>✕</Text>
              </Pressable>
              <View style={{ flex: 1 }} />
              <Text style={{
                ...T.caption, color: 'rgba(255,255,255,0.72)',
                backgroundColor: 'rgba(0,0,0,0.4)',
                paddingHorizontal: 10, paddingVertical: 5, borderRadius: RADIUS.pill,
              }}>
                {/* Honest about what the hardware is doing. */}
                {useNative && DualCamera.isSimultaneousSupported
                  ? 'Both cameras at once'
                  : 'Rear, then selfie'}
              </Text>
            </View>
          </View>

          <View style={{ paddingBottom: Math.max(insets.bottom, 16) + 8, alignItems: 'center' }}>
            {cameraError ? (
              <View style={{
                marginBottom: 14, marginHorizontal: SPACING.xl,
                backgroundColor: 'rgba(0,0,0,0.62)', borderRadius: RADIUS.md,
                paddingHorizontal: 14, paddingVertical: 10,
              }}>
                <Text style={{ ...T.footnote, color: '#fff', textAlign: 'center' }}>{cameraError}</Text>
              </View>
            ) : null}

            <Text style={{
              ...T.footnote, color: 'rgba(255,255,255,0.72)', marginBottom: 16,
              textAlign: 'center', paddingHorizontal: SPACING.xxl,
            }}>
              One tap captures what you are training and you.
            </Text>

            <Pressable
              onPress={shoot}
              disabled={busy || !ready}
              accessibilityRole="button"
              accessibilityLabel="Capture your Check In"
              style={{
                width: SHUTTER, height: SHUTTER, borderRadius: SHUTTER / 2,
                borderWidth: 4, borderColor: 'rgba(255,255,255,0.9)',
                alignItems: 'center', justifyContent: 'center',
                opacity: ready ? 1 : 0.45,
              }}>
              <View style={{
                width: SHUTTER - 16, height: SHUTTER - 16, borderRadius: (SHUTTER - 16) / 2,
                backgroundColor: busy ? C.gold : '#fff',
                alignItems: 'center', justifyContent: 'center',
              }}>
                {busy ? <ActivityIndicator size="small" color={C.ink} /> : null}
              </View>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

/* ------------------------------------------------------------------------- */

function Centered({ children }) {
  return (
    <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
      {children}
    </View>
  );
}

function PermissionWall({ onOpenSettings, onClose }) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      contentContainerStyle={{
        flexGrow: 1, justifyContent: 'center',
        padding: SPACING.xxl, paddingTop: insets.top + SPACING.xxl,
        backgroundColor: C.bg,
      }}>
      <Text style={{ ...T.label, color: C.gold }}>CAMERA</Text>
      <Text style={{ ...T.title2, color: C.text, marginTop: 6 }}>
        LEVL needs your camera to Check In
      </Text>
      <Text style={{ ...T.callout, color: C.mut, marginTop: 10, lineHeight: 22 }}>
        A Check In is two photographs taken together — one of what you are
        training, one of you. Without camera access LEVL cannot take them.
      </Text>
      <Text style={{ ...T.footnote, color: C.dim, marginTop: 12, lineHeight: 19 }}>
        Everything else in LEVL keeps working. Training, duels, ranks and the
        Forge do not need the camera at all.
      </Text>

      <Pressable
        onPress={onOpenSettings}
        accessibilityRole="button"
        accessibilityLabel="Open LEVL settings in the Settings app"
        style={{
          marginTop: SPACING.xxl, minHeight: TOUCH, borderRadius: RADIUS.md,
          backgroundColor: C.gold, alignItems: 'center', justifyContent: 'center',
        }}>
        <Text style={{ ...T.footnote, fontWeight: '700', color: C.ink, letterSpacing: 0.4 }}>
          OPEN SETTINGS
        </Text>
      </Pressable>

      <Pressable
        onPress={onClose}
        accessibilityRole="button"
        style={{ marginTop: 10, minHeight: TOUCH, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ ...T.footnote, color: C.mut }}>Not now</Text>
      </Pressable>

      {Platform.OS !== 'ios' ? null : (
        <Text style={{ ...T.caption, color: C.faint, marginTop: SPACING.xl, lineHeight: 17 }}>
          Settings › LEVL › Camera
        </Text>
      )}
    </ScrollView>
  );
}

// Referenced by the fallback path above; kept out of the component body so the
// unused-image warning does not fire when the native module is present.
export const PreviewImage = Image;
