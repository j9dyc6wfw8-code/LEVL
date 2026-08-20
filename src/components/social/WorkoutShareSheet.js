// ============================================================================
// LEVL — WorkoutShareSheet
//
// The moment a workout ends, LEVL offers exactly one thing.
//
//   Already checked in today  →  "Add this session to your Check In?"
//   Haven't checked in yet    →  "Share today's session"
//
// This is the bridge that makes the social feature reinforce training rather
// than sit beside it. It also covers the ordinary case the brief calls out: you
// Check In at 9:05 when you arrive, finish at 10:10, and LEVL asks whether to
// attach what you just did. No second photograph, no re-entering exercises —
// the workout record already exists and only its id travels.
//
// It appears once per session and is always dismissible. A prompt that nags is
// a prompt people learn to close without reading.
// ============================================================================

import React from 'react';
import { View, Pressable, Modal, ActivityIndicator } from 'react-native';
import { Text } from '../Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, RADIUS, SPACING, T, TOUCH } from '../../theme';
import { formatVolume, formatDuration } from '../../engine/session';
import { SOCIAL_XP } from '../../engine/engine';

export default function WorkoutShareSheet({
  visible,
  session,
  unit,
  hasCheckedIn,
  alreadyVerified,
  busy,
  onAttach,
  onCheckIn,
  onDismiss,
}) {
  if (!session) return null;

  const volume = formatVolume(session.volumeKg, unit);
  const stats = [
    session.sets > 0 ? `${session.sets} sets` : null,
    volume,
    session.prs > 0 ? `${session.prs} PR${session.prs === 1 ? '' : 's'}` : null,
  ].filter(Boolean);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onDismiss}>
      <Pressable
        onPress={onDismiss}
        accessibilityLabel="Dismiss"
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' }}
      />
      <Sheet>
        <Text style={{ ...T.label, color: C.green }}>WORKOUT COMPLETE</Text>
        <Text style={{ ...T.title2, color: C.text, marginTop: 6 }}>{session.title}</Text>
        <Text style={{ ...T.subheadline, ...T.numeric, color: C.mut, marginTop: 4 }}>
          {stats.join(' · ')}
          {session.durationMs > 60000 ? ` · ${formatDuration(session.durationMs)}` : ''}
        </Text>
        {session.xp > 0 ? (
          <Text style={{ ...T.subheadline, ...T.numeric, color: C.gold, marginTop: 2 }}>
            +{session.xp.toLocaleString()} workout XP
          </Text>
        ) : null}

        <View style={{ height: 1, backgroundColor: C.lineSoft, marginVertical: SPACING.xl }} />

        {alreadyVerified ? (
          <>
            <Text style={{ ...T.headline, color: C.text }}>
              Today&apos;s Check In already has a workout
            </Text>
            <Text style={{ ...T.footnote, color: C.mut, marginTop: 4, lineHeight: 18 }}>
              Nothing else to do — nice session.
            </Text>
            <Primary label="DONE" onPress={onDismiss} />
          </>
        ) : hasCheckedIn ? (
          <>
            <Text style={{ ...T.headline, color: C.text }}>
              Add this session to your Check In?
            </Text>
            <Text style={{ ...T.footnote, color: C.mut, marginTop: 4, lineHeight: 18 }}>
              It becomes a Verified Session. Friends see the summary above —
              never your notes or effort ratings.
            </Text>
            <Primary label="ADD WORKOUT" onPress={onAttach} busy={busy} />
            <Secondary label={`+${SOCIAL_XP.VERIFIED_BONUS} XP · Not now`} onPress={onDismiss} />
          </>
        ) : (
          <>
            <Text style={{ ...T.headline, color: C.text }}>Share today&apos;s session</Text>
            <Text style={{ ...T.footnote, color: C.mut, marginTop: 4, lineHeight: 18 }}>
              One Check In, both cameras, with this workout attached.
            </Text>
            <Primary label="SHARE TODAY’S SESSION" onPress={onCheckIn} />
            <Secondary label="Not now" onPress={onDismiss} />
          </>
        )}
      </Sheet>
    </Modal>
  );
}

function Sheet({ children }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{
      backgroundColor: C.bgElev,
      borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl,
      borderTopWidth: 1, borderColor: C.line,
      paddingHorizontal: SPACING.xl,
      paddingTop: SPACING.lg,
      paddingBottom: Math.max(insets.bottom, 16) + 8,
    }}>
      <View style={{ alignItems: 'center', marginBottom: SPACING.lg }}>
        <View style={{ width: 38, height: 4, borderRadius: 2, backgroundColor: C.line }} />
      </View>
      {children}
    </View>
  );
}

function Primary({ label, onPress, busy }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{
        marginTop: SPACING.xl, minHeight: 52, borderRadius: RADIUS.md,
        backgroundColor: C.gold, alignItems: 'center', justifyContent: 'center',
        opacity: busy ? 0.65 : 1,
      }}>
      {busy
        ? <ActivityIndicator color={C.ink} />
        : <Text style={{ ...T.callout, fontWeight: '700', color: C.ink, letterSpacing: 0.4 }}>{label}</Text>}
    </Pressable>
  );
}

function Secondary({ label, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={{ minHeight: TOUCH, alignItems: 'center', justifyContent: 'center', marginTop: 6 }}>
      <Text style={{ ...T.footnote, color: C.dim }}>{label}</Text>
    </Pressable>
  );
}
