// ============================================================================
// LEVL — DualPhoto
//
// The two halves of a Check In: what you were looking at, and you.
//
// The rear photo fills the frame; the selfie floats in a corner. Tapping the
// small one swaps which is dominant, with a short spring and a light haptic —
// so the pair reads as two views of one moment rather than a photo with a
// sticker on it.
//
// The design rule is restraint: the photographs are the content, so there is no
// gradient scrim, no overlaid metadata, no chrome. Everything else in the card
// sits outside the image.
// ============================================================================

import React, { useCallback, useRef, useState } from 'react';
import { View, Pressable, Animated, StyleSheet } from 'react-native';
import { Text } from '../Text';
import { useReduceMotion } from '../../hooks/useReduceMotion';
import { Image } from 'expo-image';
import { C, RADIUS } from '../../theme';
import haptics from '../../services/haptics';

// expo-image handles memory + disk caching itself, so scrolling back up a feed
// does not re-download or re-decode. The signed URL is the cache key, and it is
// stable for an hour, which is roughly a session.
const TRANSITION = 180;

export default function DualPhoto({
  frontUrl,
  rearUrl,
  primary,              // 'rear' | 'front' — the photo the poster chose
  altText,
  aspect = 1.25,        // 4:5, the most flattering ratio for a gym photograph
  radius = RADIUS.lg,
  onSwap,
  swappable = true,
  style,
}) {
  const [flipped, setFlipped] = useState(false);
  const reduceMotion = useReduceMotion();
  const scale = useRef(new Animated.Value(1)).current;

  // The poster's choice decides the starting arrangement; the viewer's tap
  // flips it locally without changing anybody's post.
  const rearIsMain = primary === 'front' ? flipped : !flipped;
  const mainUrl = rearIsMain ? rearUrl : frontUrl;
  const pipUrl = rearIsMain ? frontUrl : rearUrl;

  const swap = useCallback(() => {
    if (!swappable || !frontUrl || !rearUrl) return;
    haptics.tap();
    setFlipped((f) => !f);
    if (onSwap) onSwap();
    if (reduceMotion) return;
    Animated.sequence([
      Animated.spring(scale, { toValue: 0.92, useNativeDriver: true, friction: 9, tension: 260 }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 7, tension: 220 }),
    ]).start();
  }, [swappable, frontUrl, rearUrl, onSwap, reduceMotion, scale]);

  const missing = !mainUrl;

  return (
    <View
      style={[{ width: '100%', aspectRatio: 1 / aspect, borderRadius: radius, overflow: 'hidden', backgroundColor: C.sunken }, style]}
      accessible
      accessibilityRole="image"
      accessibilityLabel={
        altText
        || 'Check In photograph. Two views from the same moment: the training, and the person training.'
      }>

      {missing ? (
        // A photo we are not allowed to see, or one that has not loaded yet.
        // Never a broken-image icon, never a spinner that spins forever.
        <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
          <Text style={{ color: C.faint, fontSize: 13 }}>Photo unavailable</Text>
        </View>
      ) : (
        <Image
          source={{ uri: mainUrl }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={TRANSITION}
          cachePolicy="memory-disk"
          // A dark placeholder rather than a white flash on a dark feed.
          placeholderContentFit="cover"
          recyclingKey={mainUrl}
        />
      )}

      {pipUrl ? (
        <Animated.View
          style={{
            position: 'absolute', top: 12, right: 12,
            transform: [{ scale }],
            shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 12,
            shadowOffset: { width: 0, height: 6 },
          }}>
          <Pressable
            onPress={swap}
            disabled={!swappable}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={rearIsMain ? 'Show the selfie full size' : 'Show the training photo full size'}
            style={{
              width: 84, height: 105,
              borderRadius: 14, overflow: 'hidden',
              borderWidth: 2, borderColor: 'rgba(255,255,255,0.72)',
              backgroundColor: C.sunken,
            }}>
            <Image
              source={{ uri: pipUrl }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              transition={TRANSITION}
              cachePolicy="memory-disk"
              recyclingKey={pipUrl}
            />
          </Pressable>
        </Animated.View>
      ) : null}
    </View>
  );
}
