// ============================================================================
// LEVL — CheckInPrompt
//
// The card at the top of Social that answers one question: have I checked in
// today, and what should I do about it?
//
// It has four states and shows exactly one:
//   pending    the upload is stuck — the most urgent thing, so it wins
//   done       posted; offers to attach today's workout if it isn't verified
//   ready      not posted; the primary call to action
//   locked     signed out; an invitation to join rather than a wall
// ============================================================================

import React from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { C, RADIUS, SPACING, T, TOUCH } from '../../theme';
import { VerifiedBadge } from './WorkoutAttachment';
import { SOCIAL_XP } from '../../engine/engine';

function Shell({ children, tone }) {
  const border = tone === 'alert' ? C.orange + '66' : tone === 'done' ? C.green + '44' : C.gold + '55';
  const fill = tone === 'alert' ? C.orangeSoft : tone === 'done' ? C.greenSoft : C.goldSoft;
  return (
    <View style={{
      borderRadius: RADIUS.xl, padding: SPACING.lg, marginBottom: SPACING.xl,
      backgroundColor: fill, borderWidth: 1, borderColor: border,
    }}>
      {children}
    </View>
  );
}

function PrimaryButton({ label, onPress, tone, busy }) {
  const bg = tone === 'ghost' ? 'transparent' : C.gold;
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{
        minHeight: TOUCH, borderRadius: RADIUS.md,
        alignItems: 'center', justifyContent: 'center',
        paddingHorizontal: 18,
        backgroundColor: bg,
        borderWidth: tone === 'ghost' ? 1 : 0,
        borderColor: C.line,
        opacity: busy ? 0.6 : 1,
      }}>
      {busy
        ? <ActivityIndicator size="small" color={tone === 'ghost' ? C.mut : C.ink} />
        : (
          <Text style={{
            ...T.footnote, fontWeight: '700', letterSpacing: 0.4,
            color: tone === 'ghost' ? C.mut : C.ink,
          }}>
            {label}
          </Text>
        )}
    </Pressable>
  );
}

export default function CheckInPrompt({
  signedIn,
  hasCheckedIn,
  verified,
  pending,
  posting,
  windowText,
  hasWorkoutToday,
  onCheckIn,
  onRetry,
  onDiscard,
  onAttachWorkout,
  onSignIn,
}) {

  /* ---- an upload that has not landed --------------------------------- */
  if (pending) {
    return (
      <Shell tone="alert">
        <Text style={{ ...T.label, color: C.orange }}>NOT POSTED YET</Text>
        <Text style={{ ...T.title3, color: C.text, marginTop: 4 }}>
          Your Check In is waiting for signal
        </Text>
        <Text style={{ ...T.footnote, color: C.mut, marginTop: 4, lineHeight: 18 }}>
          The photos are saved on your phone. LEVL keeps trying in the background —
          you can post it now if you are back online.
        </Text>
        {pending.lastError ? (
          <Text style={{ ...T.caption, color: C.faint, marginTop: 6 }} numberOfLines={2}>
            {pending.lastError}
          </Text>
        ) : null}
        <View style={{ flexDirection: 'row', marginTop: 14 }}>
          <View style={{ flex: 1 }}>
            <PrimaryButton label="TRY AGAIN" onPress={onRetry} busy={posting} />
          </View>
          <View style={{ width: 8 }} />
          <PrimaryButton label="DISCARD" tone="ghost" onPress={onDiscard} />
        </View>
      </Shell>
    );
  }

  /* ---- signed out ------------------------------------------------------ */
  if (!signedIn) {
    return (
      <Shell>
        <Text style={{ ...T.label, color: C.gold }}>CHECK IN</Text>
        <Text style={{ ...T.title3, color: C.text, marginTop: 4 }}>
          Join LEVL to Check In with friends
        </Text>
        <Text style={{ ...T.footnote, color: C.mut, marginTop: 4, lineHeight: 18 }}>
          Training on your own works without an account. Sharing it needs one.
        </Text>
        <View style={{ marginTop: 14 }}>
          <PrimaryButton label="CREATE AN ACCOUNT" onPress={onSignIn} />
        </View>
      </Shell>
    );
  }

  /* ---- already posted -------------------------------------------------- */
  if (hasCheckedIn) {
    return (
      <Shell tone="done">
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ ...T.label, color: C.green, flex: 1 }}>CHECKED IN TODAY</Text>
          {verified ? <VerifiedBadge compact /> : null}
        </View>

        {verified ? (
          <Text style={{ ...T.subheadline, color: C.mut, marginTop: 6 }}>
            Today&apos;s workout is attached. Nice one.
          </Text>
        ) : hasWorkoutToday ? (
          <>
            <Text style={{ ...T.title3, color: C.text, marginTop: 4 }}>
              Add today&apos;s workout?
            </Text>
            <Text style={{ ...T.footnote, color: C.mut, marginTop: 4, lineHeight: 18 }}>
              Attaching the session you logged turns this into a Verified Session
              {` (+${SOCIAL_XP.VERIFIED_BONUS} XP).`}
            </Text>
            <View style={{ flexDirection: 'row', marginTop: 14 }}>
              <PrimaryButton label="ADD WORKOUT" onPress={onAttachWorkout} />
            </View>
          </>
        ) : (
          <Text style={{ ...T.subheadline, color: C.mut, marginTop: 6 }}>
            Log a session today and you can attach it to this Check In.
          </Text>
        )}
      </Shell>
    );
  }

  /* ---- ready to post --------------------------------------------------- */
  return (
    <Shell>
      <Text style={{ ...T.label, color: C.gold }}>TODAY</Text>
      <Text style={{ ...T.title3, color: C.text, marginTop: 4 }}>
        {hasWorkoutToday ? 'Share today’s session' : 'Check In'}
      </Text>
      <Text style={{ ...T.footnote, color: C.mut, marginTop: 4, lineHeight: 18 }}>
        {hasWorkoutToday
          ? 'Both cameras, one moment — with your workout attached.'
          : windowText
            ? `Both cameras, one moment. Your window is ${windowText}.`
            : 'Both cameras, one moment.'}
      </Text>
      <View style={{ flexDirection: 'row', marginTop: 14, alignItems: 'center' }}>
        <PrimaryButton label="CHECK IN" onPress={onCheckIn} busy={posting} />
        <Text style={{ ...T.caption, ...T.numeric, color: C.dim, marginLeft: 12 }}>
          +{SOCIAL_XP.CHECK_IN} XP
          {hasWorkoutToday ? ` · +${SOCIAL_XP.VERIFIED_BONUS} verified` : ''}
        </Text>
      </View>
    </Shell>
  );
}
