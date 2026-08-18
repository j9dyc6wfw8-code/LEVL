// ============================================================================
// LEVL — ActiveWorkoutBar
//
// A thin strip that appears while a workout is in progress, on every tab.
//
// It exists for one structural reason: a Live Activity has to END. Without a
// visible, obvious way to finish a session, the only thing stopping a workout
// counting up on someone's Lock Screen all evening is the eight-hour staleness
// sweep — which is a safety net, not a design.
//
// It also mirrors the Live Activity, so the phone and the Lock Screen never
// disagree about what set you are on.
// ============================================================================

import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, Pressable, Alert } from 'react-native';
import { C, RADIUS, T, TOUCH } from '../theme';
import workoutSession from '../services/workoutSession';
import { formatDuration } from '../engine/session';
import haptics from '../services/haptics';

export default function ActiveWorkoutBar({ onFinished }) {
  const [state, setState] = useState(() => workoutSession.getState());
  const [, tick] = useState(0);

  useEffect(() => workoutSession.subscribe(setState), []);

  // One timer for the whole bar, and only while a workout is live.
  useEffect(() => {
    if (!state.active) return undefined;
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [state.active]);

  const end = useCallback(() => {
    haptics.selection();
    Alert.alert('Finish this workout?', 'Your logged sets are already saved.', [
      { text: 'Keep going', style: 'cancel' },
      {
        text: 'Finish',
        onPress: () => {
          const finished = workoutSession.end();
          haptics.success();
          if (onFinished) onFinished(finished);
        },
      },
    ]);
  }, [onFinished]);

  if (!state.active) return null;

  /* Read FRESH on every render, not from the subscription snapshot.
   * The 1s interval above forces a re-render, but `state` only changes when the
   * store publishes — and the rest countdown is derived from a timestamp rather
   * than published each second. Reading the snapshot meant the bar showed the
   * rest length frozen at whatever it was when the set was logged: it said
   * "Rest 1:30" for the entire ninety seconds. Invisible while nothing ever
   * started a rest; obvious the moment one did. */
  const live = workoutSession.getState();
  const resting = live.resting && live.restRemaining > 0;

  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center',
      marginHorizontal: 14, marginBottom: 8,
      paddingHorizontal: 12, paddingVertical: 8,
      borderRadius: RADIUS.md,
      backgroundColor: C.greenSoft, borderWidth: 1, borderColor: C.green + '55',
    }}
      accessible
      accessibilityLabel={
        `Workout in progress. ${state.exercise}, set ${state.setNumber}. `
        + (resting ? `Resting, ${live.restRemaining} seconds left.` : `Elapsed ${formatDuration(live.elapsedMs)}.`)
      }>

      <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: C.green, marginRight: 9 }} />

      <View style={{ flex: 1 }}>
        <Text style={{ ...T.footnote, fontWeight: '600', color: C.text }} numberOfLines={1}>
          {state.exercise} · Set {state.setNumber}
          {state.totalSets ? ` of ${state.totalSets}` : ''}
        </Text>
        <Text style={{ ...T.caption, ...T.numeric, color: C.mut, marginTop: 1 }}>
          {resting
            ? `Rest ${formatDuration(live.restRemaining * 1000)}`
            : formatDuration(live.elapsedMs)}
          {state.xpEarned > 0 ? ` · +${state.xpEarned} XP` : ''}
        </Text>
      </View>

      <Pressable
        onPress={end}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Finish this workout"
        style={{
          minHeight: 32, minWidth: TOUCH, paddingHorizontal: 12,
          borderRadius: RADIUS.pill,
          backgroundColor: C.panel2, borderWidth: 1, borderColor: C.line,
          alignItems: 'center', justifyContent: 'center',
        }}>
        <Text style={{ ...T.caption, fontWeight: '600', color: C.mut }}>Finish</Text>
      </Pressable>
    </View>
  );
}
