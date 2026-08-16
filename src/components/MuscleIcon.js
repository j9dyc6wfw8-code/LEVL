// LEVL — MuscleIcon
//
// A body silhouette that lights up the region you're about to train.
//
// WHY THIS WAS REDRAWN
// The previous version drew the whole body in C.panel3 at 0.3 opacity — on a
// dark tile that is very nearly invisible. The result was a few coloured blobs
// floating in space: you could see *a colour*, but not *where on a body it sat*,
// which is the entire job of the icon. You cannot judge "this part versus the
// rest" if the rest isn't there.
//
// So the body is now solidly visible in its own right (a light slate figure with
// an outline), and the lit region wins on three axes at once instead of one:
//
//   1. HUE   — colour against neutral slate
//   2. VALUE — the lit part is brighter than the body, and unlit muscles also
//              drop a step, which widens the gap from both directions
//   3. EDGE  — the lit part gets a stroke and a soft halo the body never has
//
// Stacking three cues means it still reads at 22px (the exercise-row size) and
// for anyone with colour-vision deficiency, where hue alone would fail.
//
// Pure react-native-svg — no images, no new dependencies, scales to any size.

import React from 'react';
import Svg, { Circle, Ellipse, Rect, Path, G } from 'react-native-svg';
import { C } from '../theme';

// Which shapes each group lights up.
const LIT = {
  chest:     ['chest'],
  back:      ['latL', 'latR', 'traps'],
  shoulders: ['deltL', 'deltR'],
  arms:      ['upArmL', 'upArmR', 'foreL', 'foreR'],
  legs:      ['thighL', 'thighR', 'calfL', 'calfR'],
  core:      ['abs'],
  power:     ['chest', 'abs', 'thighL', 'thighR', 'deltL', 'deltR'],
};

// These three values were picked by measuring WCAG contrast ratios against the
// card background (#181c27), not by eye:
//
//   body, nothing lit   #515a77   2.49:1 vs the card  — clearly a figure
//   unlit muscle        #343b51   1.53:1 vs the card  — present, recedes
//   lit muscle          colour lightened 22%          — 4.4:1+ vs unlit muscle
//
// The first attempt kept the raw region colours and landed at 2.97:1 for purple
// (Legs) against the unlit body, which is weak. Lightening the lit fill instead
// of darkening the body raises the target without making the figure vanish
// again, and takes the worst case to 4.38:1.
const BODY = '#515a77';
const BODY_EDGE = '#6b7591';
const BODY_OFF = '#343b51';
// Head, neck and hips are never a target — always neutral, so they read as
// anatomy rather than as an unlit option you could have picked.
const BODY_NEUTRAL = '#434b63';

// Lighten toward white. Used on the lit region so it gains value contrast, not
// just hue contrast, against the rest of the body.
const lift = (hex, amt) => {
  const h = String(hex).replace('#', '');
  if (h.length !== 6) return hex;
  let out = '#';
  for (let i = 0; i < 6; i += 2) {
    const c = parseInt(h.slice(i, i + 2), 16);
    out += Math.round(c + (255 - c) * amt).toString(16).padStart(2, '0');
  }
  return out;
};

export default function MuscleIcon({ group = 'chest', color = C.gold, size = 46 }) {
  const lit = LIT[group] || [];
  const anyLit = lit.length > 0;
  const on = (k) => lit.indexOf(k) >= 0;

  const litFill = lift(color, 0.22);
  const fill = (k) => (on(k) ? litFill : (anyLit ? BODY_OFF : BODY));
  // Stroke only differs on lit parts — an edge cue that survives greyscale.
  // Deliberately the *unlightened* colour, so the lit shape has a defined rim
  // rather than bleeding into its own halo.
  const stroke = (k) => (on(k) ? color : BODY_EDGE);
  const sw = (k) => (on(k) ? 1.6 : 0.7);
  const op = (k) => (on(k) ? 1 : 0.9);

  return (
    <Svg width={size} height={size * 1.28} viewBox="0 0 64 82">
      {/* Halo behind the lit region. Two passes — one wide and soft, one tighter
          and brighter — because a single flat ellipse reads as a smudge at tile
          size instead of as a glow. */}
      {anyLit && (
        <>
          <G opacity={0.28}>
            {on('chest') && <Ellipse cx="32" cy="27.5" rx="19" ry="12" fill={color} />}
            {on('abs') && <Ellipse cx="32" cy="41.5" rx="14" ry="11" fill={color} />}
            {on('traps') && <Ellipse cx="32" cy="20" rx="17" ry="8" fill={color} />}
            {(on('deltL') || on('deltR')) && (
              <>
                <Circle cx="15.5" cy="24" r="10" fill={color} />
                <Circle cx="48.5" cy="24" r="10" fill={color} />
              </>
            )}
            {(on('upArmL') || on('upArmR')) && (
              <>
                <Ellipse cx="13" cy="36.5" rx="8.5" ry="12" fill={color} />
                <Ellipse cx="51" cy="36.5" rx="8.5" ry="12" fill={color} />
              </>
            )}
            {(on('foreL') || on('foreR')) && (
              <>
                <Ellipse cx="13" cy="51.5" rx="7.5" ry="10" fill={color} />
                <Ellipse cx="51" cy="51.5" rx="7.5" ry="10" fill={color} />
              </>
            )}
            {(on('latL') || on('latR')) && (
              <>
                <Ellipse cx="21" cy="31" rx="9" ry="12" fill={color} />
                <Ellipse cx="43" cy="31" rx="9" ry="12" fill={color} />
              </>
            )}
            {(on('thighL') || on('thighR')) && (
              <>
                <Ellipse cx="25.5" cy="64" rx="9.5" ry="13" fill={color} />
                <Ellipse cx="38.5" cy="64" rx="9.5" ry="13" fill={color} />
              </>
            )}
            {(on('calfL') || on('calfR')) && (
              <>
                <Ellipse cx="26" cy="76" rx="7" ry="8" fill={color} />
                <Ellipse cx="38" cy="76" rx="7" ry="8" fill={color} />
              </>
            )}
          </G>
          <G opacity={0.22}>
            {on('chest') && <Ellipse cx="32" cy="27.5" rx="12" ry="7" fill={color} />}
            {on('abs') && <Ellipse cx="32" cy="41.5" rx="8" ry="7" fill={color} />}
            {(on('thighL') || on('thighR')) && (
              <>
                <Ellipse cx="25.5" cy="64" rx="6" ry="8" fill={color} />
                <Ellipse cx="38.5" cy="64" rx="6" ry="8" fill={color} />
              </>
            )}
          </G>
        </>
      )}

      {/* head + neck — structural, never a target */}
      <Circle cx="32" cy="7.5" r="6.2" fill={BODY_NEUTRAL} stroke={BODY_EDGE} strokeWidth="0.7" />
      <Rect x="28.6" y="12.6" width="6.8" height="5" rx="2.2" fill={BODY_NEUTRAL} />

      {/* traps — the slope from neck to shoulder */}
      <Path d="M19.5 20.5 Q32 13.6 44.5 20.5 L44.5 24 Q32 17.6 19.5 24 Z"
        fill={fill('traps')} stroke={stroke('traps')} strokeWidth={sw('traps')} opacity={op('traps')} />

      {/* lats — the V-taper wings, so Back reads differently from Chest */}
      <Path d="M20.5 23.5 L23 41 L27.5 34 L26 23.5 Z"
        fill={fill('latL')} stroke={stroke('latL')} strokeWidth={sw('latL')} opacity={op('latL')} />
      <Path d="M43.5 23.5 L41 41 L36.5 34 L38 23.5 Z"
        fill={fill('latR')} stroke={stroke('latR')} strokeWidth={sw('latR')} opacity={op('latR')} />

      {/* chest — two pecs with a centre split, so it isn't one slab */}
      <Path d="M23 23 Q27.5 21 31.2 22.4 L31.2 33.6 Q26.5 35.4 23 33 Z"
        fill={fill('chest')} stroke={stroke('chest')} strokeWidth={sw('chest')} opacity={op('chest')} />
      <Path d="M41 23 Q36.5 21 32.8 22.4 L32.8 33.6 Q37.5 35.4 41 33 Z"
        fill={fill('chest')} stroke={stroke('chest')} strokeWidth={sw('chest')} opacity={op('chest')} />

      {/* deltoids — after the torso so the caps sit on top of it */}
      <Circle cx="15.5" cy="24.5" r="6.8"
        fill={fill('deltL')} stroke={stroke('deltL')} strokeWidth={sw('deltL')} opacity={op('deltL')} />
      <Circle cx="48.5" cy="24.5" r="6.8"
        fill={fill('deltR')} stroke={stroke('deltR')} strokeWidth={sw('deltR')} opacity={op('deltR')} />

      {/* abs — segmented, so Core is unmistakable */}
      <G opacity={op('abs')}>
        <Rect x="25.8" y="35" width="5.4" height="4.6" rx="1.5" fill={fill('abs')} stroke={stroke('abs')} strokeWidth={sw('abs')} />
        <Rect x="32.8" y="35" width="5.4" height="4.6" rx="1.5" fill={fill('abs')} stroke={stroke('abs')} strokeWidth={sw('abs')} />
        <Rect x="25.8" y="40.6" width="5.4" height="4.6" rx="1.5" fill={fill('abs')} stroke={stroke('abs')} strokeWidth={sw('abs')} />
        <Rect x="32.8" y="40.6" width="5.4" height="4.6" rx="1.5" fill={fill('abs')} stroke={stroke('abs')} strokeWidth={sw('abs')} />
        <Rect x="25.8" y="46.2" width="5.4" height="4.6" rx="1.5" fill={fill('abs')} stroke={stroke('abs')} strokeWidth={sw('abs')} />
        <Rect x="32.8" y="46.2" width="5.4" height="4.6" rx="1.5" fill={fill('abs')} stroke={stroke('abs')} strokeWidth={sw('abs')} />
      </G>

      {/* upper arms */}
      <Rect x="9.4" y="29.5" width="7.4" height="15" rx="3.7"
        fill={fill('upArmL')} stroke={stroke('upArmL')} strokeWidth={sw('upArmL')} opacity={op('upArmL')} />
      <Rect x="47.2" y="29.5" width="7.4" height="15" rx="3.7"
        fill={fill('upArmR')} stroke={stroke('upArmR')} strokeWidth={sw('upArmR')} opacity={op('upArmR')} />

      {/* forearms */}
      <Rect x="9.9" y="45.4" width="6.4" height="13" rx="3.2"
        fill={fill('foreL')} stroke={stroke('foreL')} strokeWidth={sw('foreL')} opacity={op('foreL')} />
      <Rect x="47.7" y="45.4" width="6.4" height="13" rx="3.2"
        fill={fill('foreR')} stroke={stroke('foreR')} strokeWidth={sw('foreR')} opacity={op('foreR')} />

      {/* hips — structural */}
      <Path d="M24.6 51.8 L39.4 51.8 L38.2 57.4 L25.8 57.4 Z" fill={BODY_NEUTRAL} />

      {/* thighs */}
      <Rect x="21" y="57" width="8.8" height="15.6" rx="4.2"
        fill={fill('thighL')} stroke={stroke('thighL')} strokeWidth={sw('thighL')} opacity={op('thighL')} />
      <Rect x="34.2" y="57" width="8.8" height="15.6" rx="4.2"
        fill={fill('thighR')} stroke={stroke('thighR')} strokeWidth={sw('thighR')} opacity={op('thighR')} />

      {/* calves */}
      <Rect x="22.2" y="72.2" width="7.2" height="9.2" rx="3.4"
        fill={fill('calfL')} stroke={stroke('calfL')} strokeWidth={sw('calfL')} opacity={op('calfL')} />
      <Rect x="34.6" y="72.2" width="7.2" height="9.2" rx="3.4"
        fill={fill('calfR')} stroke={stroke('calfR')} strokeWidth={sw('calfR')} opacity={op('calfR')} />
    </Svg>
  );
}
