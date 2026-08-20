// ============================================================================
// LEVL — WorkoutAttachment
//
// The training half of a Check In: the summary line under the photograph, and
// the expanded detail when it is tapped.
//
// EVERY NUMBER HERE COMES FROM THE DATABASE, computed server-side from the
// user's own workout rows. Nothing is estimated, and a field that does not
// exist is simply not rendered — a session with no PRs shows no PR line rather
// than "0 PRs".
//
// ON THE WORD "VERIFIED": it means a workout logged in LEVL is attached to this
// Check In. It does not claim LEVL confirmed anyone was at a gym, and the copy
// is careful never to imply that.
// ============================================================================

import React, { useState, useCallback } from 'react';
import { View, Pressable, LayoutAnimation, Platform, UIManager } from 'react-native';
import { Text } from '../Text';
import { C, RADIUS, T } from '../../theme';
import { formatVolume } from '../../engine/session';
import haptics from '../../services/haptics';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export function VerifiedBadge({ compact }) {
  return (
    <View
      accessible
      accessibilityLabel="Verified Session. A LEVL workout is attached to this Check In."
      style={{
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: compact ? 7 : 9, paddingVertical: compact ? 2.5 : 3.5,
        borderRadius: RADIUS.pill,
        backgroundColor: C.greenSoft, borderWidth: 1, borderColor: C.green + '66',
      }}>
      <Text style={{ ...T.caption2, fontWeight: '700', color: C.green, letterSpacing: 0.4 }}>
        {compact ? 'WORKOUT' : 'VERIFIED SESSION'}
      </Text>
      <Text style={{ fontSize: 10, color: C.green, marginLeft: 3, fontWeight: '700' }}>✓</Text>
    </View>
  );
}

export default function WorkoutAttachment({ workout, title, unit, expandable = true }) {
  const [open, setOpen] = useState(false);

  // EVERY hook runs before the first return. The `if (!workout) return null`
  // used to sit above this useCallback, so a card rendered once without a
  // workout and then again with one ran a different NUMBER of hooks on the two
  // renders — which is the React error "Rendered more hooks than during the
  // previous render", i.e. a hard crash of the feed. The feed hits exactly that
  // transition: a Check In renders first from the list payload and gains its
  // workout attachment when the detail resolves.
  const toggle = useCallback(() => {
    if (!expandable) return;
    haptics.selection();
    LayoutAnimation.configureNext(LayoutAnimation.create(180, 'easeInEaseOut', 'opacity'));
    setOpen((o) => !o);
  }, [expandable]);

  if (!workout) return null;

  // Only the metrics that actually exist get a slot.
  const stats = [];
  if (workout.sets > 0) stats.push(`${workout.sets} sets`);
  const volume = formatVolume(workout.volumeKg, unit);
  if (volume) stats.push(volume);
  if (workout.cardioMinutes > 0) stats.push(`${workout.cardioMinutes} min`);

  const names = workout.exercises || [];
  const summaryNames = names.slice(0, 3).join(' · ');

  return (
    <Pressable
      onPress={toggle}
      disabled={!expandable}
      accessibilityRole={expandable ? 'button' : undefined}
      accessibilityLabel={
        `${title || 'Session'}. ${stats.join(', ')}. ${names.length} exercises.`
        + (expandable ? ' Tap for detail.' : '')
      }
      accessibilityState={{ expanded: open }}>

      <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
        {title ? (
          <Text style={{ ...T.headline, color: C.text, marginRight: 8 }}>{title}</Text>
        ) : null}
        <VerifiedBadge />
      </View>

      {stats.length ? (
        <Text style={{ ...T.subheadline, ...T.numeric, color: C.mut, marginTop: 3 }}>
          {stats.join(' · ')}
        </Text>
      ) : null}

      {summaryNames ? (
        <Text style={{ ...T.footnote, color: C.dim, marginTop: 2 }} numberOfLines={open ? undefined : 1}>
          {open ? names.join(' · ') : summaryNames}
          {!open && names.length > 3 ? ` · +${names.length - 3}` : ''}
        </Text>
      ) : null}

      {open ? (
        <View style={{
          marginTop: 10, paddingTop: 10,
          borderTopWidth: 1, borderTopColor: C.lineSoft,
          flexDirection: 'row', flexWrap: 'wrap',
        }}>
          {workout.xp > 0 ? <Metric label="Workout XP" value={`+${workout.xp.toLocaleString()}`} tint={C.gold} /> : null}
          {workout.prs > 0 ? <Metric label={workout.prs === 1 ? 'PR' : 'PRs'} value={String(workout.prs)} tint={C.green} /> : null}
          {workout.sets > 0 ? <Metric label="Sets" value={String(workout.sets)} /> : null}
          {volume ? <Metric label="Volume" value={volume} /> : null}
        </View>
      ) : null}
    </Pressable>
  );
}

function Metric({ label, value, tint }) {
  return (
    <View style={{ marginRight: 20, marginBottom: 4 }}>
      <Text style={{ ...T.caption2, color: C.faint, letterSpacing: 0.5, textTransform: 'uppercase' }}>{label}</Text>
      <Text style={{ ...T.callout, ...T.numeric, fontWeight: '600', color: tint || C.text, marginTop: 1 }}>
        {value}
      </Text>
    </View>
  );
}
