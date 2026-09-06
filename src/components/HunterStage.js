// LEVL — HunterStage: the character viewer.
//
// This renders the 2D vector hunter (react-native-svg only — no GL, no Three.js,
// no legacy native modules). It is fully animated and reacts live to every
// cosmetic and colour change.
//
// HISTORY / WHY NO 3D:
// An earlier version rendered a Three.js character via expo-gl + expo-three.
// Those packages have not been updated for React Native's New Architecture,
// which Expo SDK 54 enables by default. Keeping them forced the whole app onto
// the legacy bridge, which in turn left modern native components (react-native-svg,
// safe-area-context, linear-gradient) unregistered — and react-native-svg calls
// requireNativeComponent at module scope, so it threw an Invariant Violation the
// instant it was imported. In a release build React Native converts that into a
// hard abort: the app crashed ~170ms after launch, before rendering anything.
//
// One stale dependency was holding the entire app hostage. It's gone.
import React, { useState } from 'react';
import { View } from 'react-native';
import { Text } from './Text';
import { C, RADIUS } from '../theme';
import { HunterFigure } from './Hunter';
import { STAT_META, PART_LABEL } from '../engine/engine';

export default function HunterStage({ statLevels, avatar, equipped, rankStyle, onPart, height }) {
  const [part, setPart] = useState(null);

  // Tapping a region selects it; tapping it again clears. The selected region
  // blazes in its stat colour while the rest of the hunter dims, so it is
  // instantly obvious WHICH body part the highlight refers to.
  const pick = (p) => {
    const next = p === part ? null : p;
    setPart(next);
    if (onPart) onPart(next);
  };

  return (
    <View>
      <View style={{ borderRadius: RADIUS.lg, overflow: 'hidden', backgroundColor: C.bg }}>
        <HunterFigure
          statLevels={statLevels}
          avatar={avatar}
          equipped={equipped}
          rankStyle={rankStyle}
          onPart={pick}
          selected={part}
          height={height || 300}
        />
      </View>
      {part ? (
        <View style={{
          marginTop: 8, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5,
          borderRadius: 999, borderWidth: 1.5, borderColor: STAT_META[part].color,
          backgroundColor: STAT_META[part].color + '22',
        }}>
          <Text style={{ fontSize: 11, fontWeight: '800', color: STAT_META[part].color }}>
            {PART_LABEL[part]} · {STAT_META[part].name}
          </Text>
        </View>
      ) : (
        <Text style={{ fontSize: 10, color: C.dim, marginTop: 8 }}>
          Tap a body region to see the stat that drives it
        </Text>
      )}
    </View>
  );
}
