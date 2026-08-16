// LEVL — custom vector tab icons (minimal line style, no emoji).
// Each icon is a stroke-based SVG that takes a color + active state.
import React from 'react';
import Svg, { Path, Circle, Line, Polyline, Rect } from 'react-native-svg';

export function TabIcon({ name, color, active }) {
  const sw = active ? 2.2 : 1.9;
  const p = { stroke: color, strokeWidth: sw, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' };
  switch (name) {
    case 'profile': // shield / hunter crest
      return (
        <Svg width={24} height={24} viewBox="0 0 24 24">
          <Path d="M12 3 L20 6 V11 C20 16 16.5 19.5 12 21 C7.5 19.5 4 16 4 11 V6 Z" {...p} />
          <Path d="M12 8 L13 11 L16 11 L13.5 13 L14.5 16 L12 14 L9.5 16 L10.5 13 L8 11 L11 11 Z" {...p} fill={active ? color : 'none'} />
        </Svg>
      );
    case 'train': // dumbbell
      return (
        <Svg width={24} height={24} viewBox="0 0 24 24">
          <Line x1="8" y1="12" x2="16" y2="12" {...p} />
          <Rect x="3.5" y="9" width="3" height="6" rx="1" {...p} />
          <Rect x="17.5" y="9" width="3" height="6" rx="1" {...p} />
          <Line x1="2.5" y1="10.5" x2="2.5" y2="13.5" {...p} />
          <Line x1="21.5" y1="10.5" x2="21.5" y2="13.5" {...p} />
        </Svg>
      );
    case 'duel': // crossed swords
      return (
        <Svg width={24} height={24} viewBox="0 0 24 24">
          <Path d="M5 4 L14 13 L13 15 L11 16 L4 9 Z" {...p} />
          <Path d="M19 4 L10 13 L11 15 L13 16 L20 9 Z" {...p} />
          <Line x1="12" y1="14" x2="12" y2="20" {...p} />
        </Svg>
      );
    case 'packs': // parcel / box
      return (
        <Svg width={24} height={24} viewBox="0 0 24 24">
          <Path d="M12 3 L20 7 V16 L12 21 L4 16 V7 Z" {...p} />
          <Polyline points="4,7 12,11 20,7" {...p} />
          <Line x1="12" y1="11" x2="12" y2="21" {...p} />
          <Line x1="8" y1="5" x2="16" y2="9" {...p} />
        </Svg>
      );
    case 'progress': // bar chart with trend
      return (
        <Svg width={24} height={24} viewBox="0 0 24 24">
          <Line x1="4" y1="20" x2="20" y2="20" {...p} />
          <Rect x="5.5" y="13" width="3" height="7" rx="0.8" {...p} />
          <Rect x="10.5" y="9" width="3" height="11" rx="0.8" {...p} />
          <Rect x="15.5" y="5" width="3" height="15" rx="0.8" {...p} />
        </Svg>
      );
    case 'ranks': // globe / ladder
      return (
        <Svg width={24} height={24} viewBox="0 0 24 24">
          <Circle cx="12" cy="12" r="8.5" {...p} />
          <Path d="M12 3.5 C8 7 8 17 12 20.5 C16 17 16 7 12 3.5" {...p} />
          <Line x1="3.5" y1="12" x2="20.5" y2="12" {...p} />
        </Svg>
      );
    case 'social': // aperture — two cameras, one moment
      return (
        <Svg width={24} height={24} viewBox="0 0 24 24">
          <Rect x="3" y="6.5" width="18" height="13.5" rx="3" {...p} />
          <Path d="M8.4 6.5 L9.7 4 H14.3 L15.6 6.5" {...p} />
          <Circle cx="12" cy="13.2" r="3.8" {...p} fill={active ? color : 'none'} fillOpacity={active ? 0.22 : 0} />
        </Svg>
      );
    case 'shop': // forge / satchel
      return (
        <Svg width={24} height={24} viewBox="0 0 24 24">
          <Path d="M6 8 H18 L19 20 H5 Z" {...p} />
          <Path d="M9 8 V6.5 A3 3 0 0 1 15 6.5 V8" {...p} />
        </Svg>
      );
    default:
      return (
        <Svg width={24} height={24} viewBox="0 0 24 24">
          <Circle cx="12" cy="12" r="7" {...p} />
        </Svg>
      );
  }
}
