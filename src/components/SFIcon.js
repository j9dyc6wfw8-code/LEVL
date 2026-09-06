// ============================================================================
// LEVL — SFIcon
//
// Real SF Symbols on iOS, for the UTILITY icons: camera, person, bell, globe,
// settings, share, health. These are the icons users already know from every
// other app on their phone, and drawing our own versions of them would be worse
// in every way — wrong weight, wrong optical alignment, no Dynamic Type
// scaling, no automatic localisation of directional glyphs.
//
// WHAT THIS IS NOT FOR: LEVL's own artwork. The Hunter, the muscle figures, the
// rank crests and the tab icons stay custom, because they are the product's
// identity. SF Symbols are for the plumbing, not the character.
//
// Everywhere that isn't iOS — and any build where expo-symbols is missing —
// falls back to the vector glyph passed in, so nothing ever renders as an empty
// box.
// ============================================================================

import React from 'react';
import { Platform, View } from 'react-native';
import { Text } from './Text';
import Svg, { Path, Circle, Line } from 'react-native-svg';
import { C } from '../theme';

let SymbolView = null;
try {
  // eslint-disable-next-line global-require
  SymbolView = require('expo-symbols').SymbolView;
} catch (e) {
  SymbolView = null;
}

// A minimal stroke fallback for each symbol we use, so Android and Expo Go get
// something correct rather than nothing.
function Fallback({ name, size, color }) {
  const p = { stroke: color, strokeWidth: 1.9, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' };
  switch (name) {
    case 'camera.fill':
    case 'camera':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path d="M3 8.5 H7 L8.5 6 H15.5 L17 8.5 H21 V19 H3 Z" {...p} />
          <Circle cx="12" cy="13.5" r="3.6" {...p} />
        </Svg>
      );
    case 'person.2.fill':
    case 'person.2':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Circle cx="9" cy="8" r="3.4" {...p} />
          <Path d="M2.8 19 C2.8 15.2 5.6 13.2 9 13.2 C12.4 13.2 15.2 15.2 15.2 19" {...p} />
          <Path d="M16 5.2 A3.4 3.4 0 0 1 16 11.6" {...p} />
          <Path d="M17 13.4 C19.6 13.9 21.2 15.8 21.2 19" {...p} />
        </Svg>
      );
    case 'bell.fill':
    case 'bell':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path d="M6 10 A6 6 0 0 1 18 10 C18 15 19.5 16.5 19.5 16.5 H4.5 C4.5 16.5 6 15 6 10 Z" {...p} />
          <Path d="M10 19.5 A2.2 2.2 0 0 0 14 19.5" {...p} />
        </Svg>
      );
    case 'globe':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Circle cx="12" cy="12" r="8.4" {...p} />
          <Path d="M12 3.6 C8.4 7 8.4 17 12 20.4 C15.6 17 15.6 7 12 3.6" {...p} />
          <Line x1="3.6" y1="12" x2="20.4" y2="12" {...p} />
        </Svg>
      );
    case 'gearshape.fill':
    case 'gearshape':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Circle cx="12" cy="12" r="3.2" {...p} />
          <Path d="M12 2.8 L13.4 5.4 L16.2 5 L16.6 7.8 L19.2 9 L18 11.4 L19.2 13.8 L16.6 15 L16.2 17.8 L13.4 17.4 L12 20 L10.6 17.4 L7.8 17.8 L7.4 15 L4.8 13.8 L6 11.4 L4.8 9 L7.4 7.8 L7.8 5 L10.6 5.4 Z" {...p} />
        </Svg>
      );
    case 'square.and.arrow.up':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path d="M12 3 L12 14" {...p} />
          <Path d="M8.4 6.4 L12 2.8 L15.6 6.4" {...p} />
          <Path d="M5.5 11 H4.5 V20.5 H19.5 V11 H18.5" {...p} />
        </Svg>
      );
    case 'heart.text.square':
    case 'heart.fill':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path d="M12 20 C12 20 3.6 14.6 3.6 9.2 A4.4 4.4 0 0 1 12 7.4 A4.4 4.4 0 0 1 20.4 9.2 C20.4 14.6 12 20 12 20 Z" {...p} />
        </Svg>
      );
    case 'chevron.left':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path d="M15 4.5 L7.5 12 L15 19.5" {...p} />
        </Svg>
      );
    case 'chevron.right':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path d="M9 4.5 L16.5 12 L9 19.5" {...p} />
        </Svg>
      );
    case 'xmark':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path d="M5.5 5.5 L18.5 18.5 M18.5 5.5 L5.5 18.5" {...p} />
        </Svg>
      );
    default:
      return (
        <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color, fontSize: size * 0.7 }}>•</Text>
        </View>
      );
  }
}

export default function SFIcon({ name, size = 20, color = C.mut, weight = 'regular' }) {
  if (Platform.OS === 'ios' && SymbolView) {
    return (
      <SymbolView
        name={name}
        size={size}
        tintColor={color}
        weight={weight}
        resizeMode="scaleAspectFit"
        // expo-symbols renders this if the symbol is missing on the running iOS
        // version — a symbol added in iOS 17 on a phone running 16, say.
        fallback={<Fallback name={name} size={size} color={color} />}
        style={{ width: size, height: size }}
      />
    );
  }
  return <Fallback name={name} size={size} color={color} />;
}
