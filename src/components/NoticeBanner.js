// LEVL — drop-down notification banner.
//
// A badge on a bell is easy to miss. When something actually happens — a friend
// request, a duel challenge, a duel result — this slides down from the top,
// holds long enough to read, then retracts. Tapping it jumps straight to the
// thing it's about; tapping the ✕ dismisses it.
//
// Pure Animated with the native driver. No new dependencies.

import React, { useEffect, useRef } from 'react';
import { View, Pressable, Animated, Easing } from 'react-native';
import { Text } from './Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, RADIUS, T } from '../theme';
import { NoticeGlyph } from './NotificationCenter';

const VISIBLE_MS = 4500;

const META = {
  friend_request: { title: 'New friend request', color: C.cyan, glyph: 'friend' },
  duel_challenge: { title: 'Duel challenge', color: C.orange, glyph: 'duel' },
  duel_result: { title: 'Duel complete', color: C.green, glyph: 'duel' },
  reward: { title: 'Reward ready', color: C.gold, glyph: 'reward' },
};

function metaFor(notice) {
  const payload = notice.payload || {};
  if (notice.kind === 'duel_challenge' && payload.started) {
    return { title: 'Duel started', color: C.green, glyph: 'duel' };
  }
  if (notice.kind === 'duel_result' && payload.result) {
    if (payload.result === 'win') return { title: 'Duel won', color: C.green, glyph: 'duel' };
    if (payload.result === 'loss') return { title: 'Duel lost', color: C.red, glyph: 'duel' };
    return { title: 'Duel drawn', color: C.gold, glyph: 'duel' };
  }
  return META[notice.kind] || { title: 'LEVL update', color: C.purp, glyph: 'bell' };
}

export default function NoticeBanner({ notice, onPress, onDismiss }) {
  const insets = useSafeAreaInsets();
  const y = useRef(new Animated.Value(-160)).current;
  const timerRef = useRef(null);

  useEffect(() => {
    if (!notice) return undefined;

    y.setValue(-160);
    const inAnim = Animated.timing(y, {
      toValue: 0, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true,
    });
    inAnim.start();

    timerRef.current = setTimeout(() => {
      Animated.timing(y, {
        toValue: -160, duration: 320, easing: Easing.in(Easing.cubic), useNativeDriver: true,
      }).start(({ finished }) => { if (finished && onDismiss) onDismiss(); });
    }, VISIBLE_MS);

    return () => {
      inAnim.stop();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // notice.id keys the animation: a second notification restarts it cleanly.
  }, [notice && notice.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!notice) return null;
  const m = metaFor(notice);
  const from = (notice.payload && (notice.payload.fromName || notice.payload.name)) || null;

  return (
    <Animated.View
      pointerEvents="box-none"
      style={{
        position: 'absolute', top: insets.top + 6, left: 12, right: 12,
        zIndex: 9999, transform: [{ translateY: y }],
      }}>
      <Pressable
        onPress={() => { if (onPress) onPress(notice); }}
        accessibilityRole="button"
        accessibilityLabel={m.title + (from ? ' from ' + from : '')}
        style={{
          flexDirection: 'row', alignItems: 'center',
          backgroundColor: C.panel2, borderRadius: RADIUS.md,
          borderWidth: 1, borderColor: m.color,
          borderLeftWidth: 4, borderLeftColor: m.color,
          paddingVertical: 12, paddingHorizontal: 14,
          shadowColor: '#000', shadowOpacity: 0.45, shadowRadius: 14,
          shadowOffset: { width: 0, height: 6 }, elevation: 10,
        }}>
        <NoticeGlyph kind={m.glyph} color={m.color} size={22} />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={{ ...T.footnote, color: C.text, fontWeight: '900' }} numberOfLines={1}>
            {m.title}
          </Text>
          <Text style={{ ...T.micro, color: C.dim, marginTop: 1 }} numberOfLines={1}>
            {from ? from + ' · tap to open' : 'Tap to open'}
          </Text>
        </View>
        <Pressable
          onPress={onDismiss} hitSlop={12}
          accessibilityRole="button" accessibilityLabel="Dismiss notification"
          style={{ paddingHorizontal: 6, paddingVertical: 4 }}>
          <Text style={{ fontSize: 16, color: C.dim, fontWeight: '800' }}>✕</Text>
        </Pressable>
      </Pressable>
    </Animated.View>
  );
}
