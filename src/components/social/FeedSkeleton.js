// ============================================================================
// LEVL — FeedSkeleton
//
// Placeholder cards while the first page loads.
//
// They match the real card's geometry exactly, so content arriving does not
// shove the page around — the single most common cause of a feed feeling
// cheap. A centred spinner on a black screen tells the user nothing about what
// is coming; this tells them "photographs, shortly".
//
// The shimmer stops entirely under Reduce Motion.
// ============================================================================

import React, { useEffect, useRef, useState } from 'react';
import { View, Animated, Easing, AccessibilityInfo } from 'react-native';
import { C, RADIUS, SPACING } from '../../theme';

function Block({ width, height, radius = RADIUS.sm, style, opacity }) {
  return (
    <Animated.View
      style={[
        { width, height, borderRadius: radius, backgroundColor: C.panel2, opacity },
        style,
      ]}
    />
  );
}

export default function FeedSkeleton({ count = 2 }) {
  const pulse = useRef(new Animated.Value(0.45)).current;
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => {});
  }, []);

  useEffect(() => {
    if (reduceMotion) { pulse.setValue(0.6); return undefined; }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.8, duration: 780, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.42, duration: 780, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, reduceMotion]);

  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={{ marginBottom: SPACING.xxl }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
            <Block width={36} height={36} radius={18} opacity={pulse} />
            <View style={{ marginLeft: 10 }}>
              <Block width={120} height={13} opacity={pulse} />
              <Block width={64} height={10} style={{ marginTop: 6 }} opacity={pulse} />
            </View>
          </View>
          {/* Same 4:5 ratio as a real Check In, so nothing jumps on arrival. */}
          <Block width="100%" height={undefined} radius={RADIUS.xl} opacity={pulse}
            style={{ aspectRatio: 1 / 1.25 }} />
          <Block width={150} height={15} style={{ marginTop: 12 }} opacity={pulse} />
          <Block width={210} height={12} style={{ marginTop: 7 }} opacity={pulse} />
          <View style={{ flexDirection: 'row', marginTop: 12 }}>
            {[0, 1, 2].map((k) => (
              <Block key={k} width={54} height={34} radius={RADIUS.pill}
                style={{ marginRight: 7 }} opacity={pulse} />
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}
