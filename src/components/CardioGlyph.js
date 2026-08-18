// ============================================================================
// LEVL — CardioGlyph
//
// Vector art for every cardio, martial arts and mobility activity, replacing
// the emoji the Train screen rendered at 15–21px.
//
// WHY, AGAIN
// ItemGlyph.js already made this argument for the Forge and it holds here
// exactly: emoji carry their own palette, so nothing can be tinted by the
// discipline's colour; they carry their own light direction, so they sit at odds
// with a flat stroked UI; and they redraw themselves with every OS update. A
// list of 29 activities rendered as 🏃🚣🥊🧘 is the single loudest "unfinished"
// signal left in the app — the muscle grid directly above it is bespoke vector
// art, which made the mismatch worse, not better.
//
// THE IDIOM — deliberately identical to ItemGlyph and TabIcon
//   · 24x24 viewBox, stroke-based, no fills
//   · round caps and joins, 1.6 default weight
//   · colour is a prop and never baked in, so a glyph reads green under Cardio,
//     orange under Martial Arts and cyan under Mobility from one definition
//
// Several activities share a glyph on purpose. Boxing and Muay Thai bagwork are
// the same movement to a drawing this size; the tile tint and the label do the
// separating. Inventing 29 barely-different silhouettes would read as noise, not
// as detail.
// ============================================================================
import React from 'react';
import Svg, { Path, Circle, Line, Rect, Ellipse, Polygon } from 'react-native-svg';
import { C } from '../theme';

/* Each glyph is a function of the shared stroke props, so weight and cap style
   stay consistent no matter which one is drawn. */
const GLYPHS = {
  // ---- steady state & conditioning ----
  run: (p) => <>
    <Circle cx="15.2" cy="4.4" r="2.1" {...p} />
    <Path d="M15.6 7 L12.2 12.4" {...p} />
    <Path d="M12.2 12.4 L14.6 16.6 L13.2 21" {...p} />
    <Path d="M12.2 12.4 L8.2 14.2 L7.4 18.8" {...p} />
    <Path d="M14 9.2 L18.4 11.6" {...p} />
    <Path d="M14 9.2 L9.6 8.2" {...p} />
  </>,
  sprint: (p) => <>
    <Circle cx="16.4" cy="4.4" r="2.1" {...p} />
    <Path d="M16.8 7 L13.4 12.4" {...p} />
    <Path d="M13.4 12.4 L15.8 16.6 L14.4 21" {...p} />
    <Path d="M13.4 12.4 L9.6 14.2 L8.8 18.8" {...p} />
    <Path d="M15.2 9.2 L19.6 11.6" {...p} />
    <Line x1="2" y1="7.5" x2="7" y2="7.5" {...p} strokeOpacity="0.55" />
    <Line x1="1.5" y1="11" x2="6" y2="11" {...p} strokeOpacity="0.75" />
    <Line x1="2.5" y1="14.5" x2="6.5" y2="14.5" {...p} strokeOpacity="0.55" />
  </>,
  row: (p) => <>
    <Circle cx="5.2" cy="7.6" r="3.1" {...p} />
    <Path d="M8.2 8.8 L14.8 12.4" {...p} />
    <Line x1="14.8" y1="10.2" x2="14.8" y2="14.6" {...p} />
    <Line x1="3" y1="19.4" x2="21" y2="19.4" {...p} />
    <Rect x="10.6" y="15.8" width="4.6" height="2.4" rx="1" {...p} />
  </>,
  cycle: (p) => <>
    <Circle cx="5.6" cy="16.4" r="3.6" {...p} />
    <Circle cx="18.4" cy="16.4" r="3.6" {...p} />
    <Path d="M5.6 16.4 L10.4 9 L15 16.4" {...p} />
    <Path d="M15 16.4 L18.4 16.4" {...p} />
    <Line x1="9" y1="9" x2="13.4" y2="9" {...p} />
    <Path d="M13.4 9 L18.4 16.4" {...p} />
  </>,
  airbike: (p) => <>
    <Circle cx="12" cy="12" r="7.4" {...p} />
    <Circle cx="12" cy="12" r="1.8" {...p} />
    <Path d="M12 10.2 C12 6.4 13.8 5 16.4 5.4" {...p} />
    <Path d="M13.6 12.8 C16.8 14.8 17.4 17 16 19.2" {...p} />
    <Path d="M10.4 12.8 C7.2 14.8 6.6 17 8 19.2" {...p} />
  </>,
  swim: (p) => <>
    <Circle cx="8.4" cy="8.6" r="2.1" {...p} />
    <Path d="M10.4 7.4 C12.6 4.6 15.8 4.6 17.8 6.8" {...p} />
    <Path d="M10.2 10.4 L18.6 13" {...p} />
    <Path d="M2.6 18 C4.6 16.2 6.6 16.2 8.6 18 C10.6 19.8 12.6 19.8 14.6 18 C16.6 16.2 18.6 16.2 20.6 18" {...p} />
  </>,
  rope: (p) => <>
    <Circle cx="12" cy="5" r="2.1" {...p} />
    <Path d="M12 7.2 V12.6" {...p} />
    <Path d="M12 12.6 L9.6 18.4" {...p} />
    <Path d="M12 12.6 L14.4 18.4" {...p} />
    <Path d="M6.4 9.4 C3.4 19.4 20.6 19.4 17.6 9.4" {...p} strokeOpacity="0.75" />
  </>,
  stairs: (p) => <>
    <Path d="M2.6 20 H7.4 V15.8 H12.2 V11.6 H17 V7.4 H21.4" {...p} />
  </>,
  walk: (p) => <>
    <Line x1="2.4" y1="20.4" x2="21.6" y2="10.4" {...p} strokeOpacity="0.55" />
    <Circle cx="12.6" cy="5.4" r="2.1" {...p} />
    <Path d="M12.6 7.6 L11.4 13" {...p} />
    <Path d="M11.4 13 L13.4 17.4" {...p} />
    <Path d="M11.4 13 L7.8 15.6" {...p} />
    <Path d="M12.2 9.6 L15.6 11.4" {...p} />
  </>,
  hike: (p) => <>
    <Path d="M2 19.6 L9 7.6 L13.2 14.4 L16 9.8 L22 19.6 Z" {...p} />
    <Path d="M7.2 10.6 L9 12.2 L10.8 10.6" {...p} strokeOpacity="0.6" />
  </>,
  intervals: (p) => <>
    <Circle cx="12" cy="13.4" r="7" {...p} />
    <Path d="M12 13.4 V9.4" {...p} />
    <Line x1="9.6" y1="2.4" x2="14.4" y2="2.4" {...p} />
    <Line x1="12" y1="2.4" x2="12" y2="6.2" {...p} />
  </>,
  sled: (p) => <>
    <Path d="M3.4 18.2 H17.4" {...p} />
    <Path d="M3.4 18.2 L1.8 21.2 H19 L17.4 18.2" {...p} />
    <Line x1="7" y1="18.2" x2="7" y2="8" {...p} />
    <Line x1="14" y1="18.2" x2="14" y2="8" {...p} />
    <Line x1="7" y1="9.6" x2="14" y2="9.6" {...p} />
  </>,
  ropes: (p) => <>
    <Path d="M2.6 8.2 C5 5.4 7.4 11 9.8 8.2 C12.2 5.4 14.6 11 17 8.2 C19 5.9 20.4 8 21.4 8.6" {...p} />
    <Path d="M2.6 16 C5 13.2 7.4 18.8 9.8 16 C12.2 13.2 14.6 18.8 17 16 C19 13.7 20.4 15.8 21.4 16.4" {...p} />
  </>,

  // ---- martial arts ----
  bag: (p) => <>
    <Line x1="6.6" y1="2.4" x2="17.4" y2="2.4" {...p} />
    <Path d="M9.4 2.4 L12 6 L14.6 2.4" {...p} />
    <Path d="M6.8 8.4 C6.8 6.4 17.2 6.4 17.2 8.4 V18.6 C17.2 21.4 6.8 21.4 6.8 18.6 Z" {...p} />
    <Line x1="7" y1="12" x2="17" y2="12" {...p} strokeOpacity="0.45" />
    <Line x1="7" y1="16" x2="17" y2="16" {...p} strokeOpacity="0.45" />
  </>,
  glove: (p) => <>
    <Path d="M7.4 8.6 C7.4 5.4 10 3.8 13 3.8 C16.8 3.8 18.8 6.2 18.8 9.6 V13.8 C18.8 17 16.6 19.4 13.2 19.4 H10.4 C8.6 19.4 7.4 18 7.4 16.2 Z" {...p} />
    <Path d="M7.4 10.6 C5.2 10.6 4 11.8 4 13.4 C4 15 5.2 16.2 7.4 16.2" {...p} />
    <Line x1="8.4" y1="14.6" x2="18.4" y2="14.6" {...p} strokeOpacity="0.5" />
  </>,
  knee: (p) => <>
    <Circle cx="9.4" cy="4.6" r="2.2" {...p} />
    <Path d="M9.4 6.8 L10.4 12.2" {...p} />
    <Path d="M10.4 12.2 L15.4 10.6 L14.2 5.6" {...p} />
    <Path d="M10.4 12.4 L8.2 17 L9.8 21.2" {...p} />
    <Path d="M10 9.6 L5.4 11" {...p} strokeOpacity="0.6" />
  </>,
  clinch: (p) => <>
    <Circle cx="12" cy="8.6" r="3.6" {...p} />
    <Path d="M3.2 18.6 C3.2 13.6 6.6 11.4 9.4 12.6" {...p} />
    <Path d="M20.8 18.6 C20.8 13.6 17.4 11.4 14.6 12.6" {...p} />
    <Path d="M6.8 15.2 C9.6 17.6 14.4 17.6 17.2 15.2" {...p} />
  </>,
  kick: (p) => <>
    <Circle cx="8.6" cy="5" r="2.1" {...p} />
    <Path d="M8.6 7.2 L9.4 12.6" {...p} />
    <Path d="M9.4 12.6 L8 18.6 L6.2 21" {...p} />
    <Path d="M9.4 12.4 L15 11 L20 13.6" {...p} />
    <Path d="M9.6 9.4 L13.4 10.4" {...p} strokeOpacity="0.6" />
  </>,
  grapple: (p) => <>
    <Circle cx="7.4" cy="6.4" r="2.3" {...p} />
    <Circle cx="16.6" cy="6.4" r="2.3" {...p} />
    <Path d="M7.4 8.8 C7.4 12.4 10 13.6 12 13.6 C14 13.6 16.6 12.4 16.6 8.8" {...p} />
    <Path d="M5.6 20.4 C5.6 16.4 8.6 14.4 12 14.4 C15.4 14.4 18.4 16.4 18.4 20.4" {...p} />
  </>,
  cage: (p) => <>
    <Polygon points="8.4,2.6 15.6,2.6 21.4,8.4 21.4,15.6 15.6,21.4 8.4,21.4 2.6,15.6 2.6,8.4" {...p} />
    <Line x1="8.4" y1="2.6" x2="8.4" y2="21.4" {...p} strokeOpacity="0.35" />
    <Line x1="15.6" y1="2.6" x2="15.6" y2="21.4" {...p} strokeOpacity="0.35" />
  </>,
  belt: (p) => <>
    <Path d="M2.4 8.8 H9.2" {...p} />
    <Path d="M2.4 13.2 H9.2" {...p} />
    <Path d="M14.8 8.8 H21.6" {...p} />
    <Path d="M14.8 13.2 H21.6" {...p} />
    <Rect x="9.2" y="7.8" width="5.6" height="6.4" rx="1.6" {...p} />
    <Path d="M10.6 14.2 L9.2 21.2" {...p} />
    <Path d="M13.4 14.2 L14.8 21.2" {...p} />
  </>,
  shadow: (p) => <>
    <Circle cx="9" cy="5.6" r="2.2" {...p} />
    <Path d="M9 7.8 V13.4" {...p} />
    <Path d="M9 13.4 L6.6 19.6" {...p} />
    <Path d="M9 13.4 L11.4 19.6" {...p} />
    <Path d="M9 10 L13.2 11.4" {...p} />
    <Path d="M15 6.6 C17.4 8.6 18.6 11.4 18.6 14.4 C18.6 17 17.8 19 16.6 20.6" {...p} strokeOpacity="0.4" strokeDasharray="2.4 2.4" />
  </>,

  // ---- mobility & recovery ----
  yoga: (p) => <>
    <Circle cx="12" cy="5.4" r="2.2" {...p} />
    <Path d="M12 7.6 V12.8" {...p} />
    <Path d="M6.6 12.4 C9 13.8 15 13.8 17.4 12.4" {...p} />
    <Path d="M4.6 19.4 C6.6 15 17.4 15 19.4 19.4 Z" {...p} />
  </>,
  stretch: (p) => <>
    <Circle cx="6.4" cy="6" r="2.2" {...p} />
    <Path d="M6.4 8.2 C6.4 12.6 8.6 15.6 12.6 15.6 H18" {...p} />
    <Path d="M18 15.6 L20.6 13.2" {...p} />
    <Path d="M18 15.6 L20.6 18" {...p} />
    <Path d="M6.4 15.6 V20.4" {...p} strokeOpacity="0.6" />
  </>,
  roller: (p) => <>
    <Rect x="3.4" y="8" width="17.2" height="8" rx="4" {...p} />
    <Ellipse cx="7.6" cy="12" rx="1.4" ry="4" {...p} strokeOpacity="0.55" />
    <Ellipse cx="16.4" cy="12" rx="1.4" ry="4" {...p} strokeOpacity="0.55" />
  </>,
};

/* Activity name -> glyph. Keyed off the engine's CARDIO_TYPES names, with a
   keyword fallback so a newly added activity gets something sensible instead of
   a blank tile. */
const BY_NAME = {
  'Run (Zone 2)': 'run',
  'Sprint Intervals': 'sprint',
  'Rowing Machine': 'row',
  Cycling: 'cycle',
  'Assault Bike': 'airbike',
  Swimming: 'swim',
  'Jump Rope': 'rope',
  'Stair Climber': 'stairs',
  'Incline Walk': 'walk',
  Hiking: 'hike',
  'HIIT Circuit': 'intervals',
  'Sled Push / Pull': 'sled',
  'Battle Ropes': 'ropes',

  'Muay Thai (Bag / Pads)': 'bag',
  'Muay Thai (Sparring)': 'knee',
  'Muay Thai (Clinch)': 'clinch',
  'Boxing (Bag / Pads)': 'bag',
  'Boxing (Sparring)': 'glove',
  Kickboxing: 'kick',
  'BJJ / Grappling': 'grapple',
  Wrestling: 'grapple',
  Judo: 'belt',
  'Karate / Taekwondo': 'belt',
  'MMA Conditioning': 'cage',
  'Shadow Boxing': 'shadow',

  'Yoga Flow': 'yoga',
  'Stretching / Mobility': 'stretch',
  'Foam Rolling / Recovery': 'roller',
};

function keyFor(name) {
  const n = String(name || '');
  if (BY_NAME[n]) return BY_NAME[n];
  const l = n.toLowerCase();
  if (l.includes('run') || l.includes('jog')) return 'run';
  if (l.includes('sprint')) return 'sprint';
  if (l.includes('row')) return 'row';
  if (l.includes('cycl') || l.includes('bike')) return 'cycle';
  if (l.includes('swim')) return 'swim';
  if (l.includes('rope')) return 'rope';
  if (l.includes('stair')) return 'stairs';
  if (l.includes('walk')) return 'walk';
  if (l.includes('hik')) return 'hike';
  if (l.includes('hiit') || l.includes('circuit') || l.includes('interval')) return 'intervals';
  if (l.includes('sled')) return 'sled';
  if (l.includes('box') || l.includes('muay') || l.includes('pad')) return 'glove';
  if (l.includes('kick')) return 'kick';
  if (l.includes('bjj') || l.includes('grappl') || l.includes('wrestl')) return 'grapple';
  if (l.includes('judo') || l.includes('karate') || l.includes('taekwondo')) return 'belt';
  if (l.includes('mma') || l.includes('cage')) return 'cage';
  if (l.includes('shadow')) return 'shadow';
  if (l.includes('yoga')) return 'yoga';
  if (l.includes('stretch') || l.includes('mobil')) return 'stretch';
  if (l.includes('foam') || l.includes('recover')) return 'roller';
  return 'run';
}

export default function CardioGlyph({ name, size = 22, color, strokeWidth }) {
  const draw = GLYPHS[keyFor(name)] || GLYPHS.run;
  const p = {
    stroke: color || C.gold,
    strokeWidth: strokeWidth || 1.6,
    fill: 'none',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  };
  return <Svg width={size} height={size} viewBox="0 0 24 24">{draw(p)}</Svg>;
}

export { keyFor as cardioGlyphKey };
