// ============================================================================
// LEVL — ReactionBar
//
// Five fitness reactions instead of one generic heart. Emoji-forward with no
// labels in the row itself — the meanings are obvious in context, and words
// would double the width of the busiest line in the card.
//
// One reaction per person per Check In, enforced by a unique constraint in the
// database. Tapping the one you already gave removes it; tapping a different
// one replaces it. Counts therefore cannot be inflated by a single account.
// ============================================================================

import React, { useRef, useCallback } from 'react';
import { View, Pressable, Animated } from 'react-native';
import { Text } from '../Text';
import { C, RADIUS, T, FONT_SCALE_CAP } from '../../theme';
import { REACTIONS } from '../../services/supabase/checkInService';
import haptics from '../../services/haptics';

function ReactionChip({ reaction, count, mine, onPress }) {
  const scale = useRef(new Animated.Value(1)).current;

  const press = useCallback(() => {
    haptics.tap();
    // A small pop, not a firework. This happens dozens of times a session.
    Animated.sequence([
      Animated.spring(scale, { toValue: 1.28, useNativeDriver: true, friction: 5, tension: 320 }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 6, tension: 240 }),
    ]).start();
    onPress(reaction.key);
  }, [onPress, reaction.key, scale]);

  return (
    <Pressable
      onPress={press}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityState={{ selected: mine }}
      accessibilityLabel={
        `${reaction.label}${count ? `, ${count}` : ''}${mine ? ', your reaction' : ''}`
      }
      style={{
        flexDirection: 'row', alignItems: 'center',
        minHeight: 34, paddingHorizontal: 10, marginRight: 7,
        borderRadius: RADIUS.pill,
        backgroundColor: mine ? C.goldSoft : C.panel2,
        borderWidth: 1, borderColor: mine ? C.gold : C.lineSoft,
      }}>
      <Animated.Text maxFontSizeMultiplier={FONT_SCALE_CAP.tight} style={{ fontSize: 15, transform: [{ scale }] }}>{reaction.emoji}</Animated.Text>
      {count > 0 ? (
        <Text
          style={{
            ...T.footnote, ...T.numeric, marginLeft: 5,
            fontWeight: '600', color: mine ? C.gold : C.mut,
          }}>
          {count}
        </Text>
      ) : null}
    </Pressable>
  );
}

export default function ReactionBar({ reactionTypes, myReaction, commentCount, onReact, onComments }) {
  // Counts by type, from the feed query's aggregate.
  const counts = {};
  (reactionTypes || []).forEach((r) => { if (r && r.type) counts[r.type] = r.n || 0; });

  // Everything anyone has used, plus the user's own, plus enough of the rest to
  // make reacting a one-tap action. Reactions nobody has used yet stay
  // available but sit at the end.
  const used = REACTIONS.filter((r) => counts[r.key] > 0 || r.key === myReaction);
  const unused = REACTIONS.filter((r) => !used.includes(r));
  const shown = [...used, ...unused].slice(0, 5);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
      {shown.map((r) => (
        <ReactionChip
          key={r.key}
          reaction={r}
          count={counts[r.key] || 0}
          mine={myReaction === r.key}
          onPress={onReact}
        />
      ))}

      <View style={{ flex: 1 }} />

      <Pressable
        onPress={onComments}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={
          commentCount ? `View ${commentCount} comment${commentCount === 1 ? '' : 's'}` : 'Add a comment'
        }
        style={{ minHeight: 34, justifyContent: 'center', paddingLeft: 8 }}>
        <Text style={{ ...T.footnote, color: C.dim }}>
          {commentCount > 0
            ? `${commentCount} comment${commentCount === 1 ? '' : 's'}`
            : 'Comment'}
        </Text>
      </Pressable>
    </View>
  );
}
