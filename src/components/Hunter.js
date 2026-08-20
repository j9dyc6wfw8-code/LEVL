// LEVL React Native — the Hunter: animated vector character with stat-mapped
// body regions, equipped cosmetics, rank armor styles, and color customization.
// (2D vector build for guaranteed reliability; see README for the 3D upgrade path.)
import React, { useEffect, useRef } from 'react';
import { View, Pressable, Animated, Easing, ScrollView } from 'react-native';
import { Text } from './Text';
import Svg, { Circle, Rect, Ellipse, Path, Polygon, G, Defs, LinearGradient, Stop } from 'react-native-svg';
import { C, s, T } from '../theme';
import { useReduceMotion } from '../hooks/useReduceMotion';
import { SKINS, HAIRS, OUTFITS, ACCENTS, STAT_META } from '../engine/engine';

const pal = (arr, i) => arr[(i || 0) % arr.length];
const glowOf = (lv, stat) => 0.35 + (Math.min(lv[stat] || 1, 40) / 40) * 0.65;

// ---------------------------------------------------------------------------
// THE HUNTER — v2 detailed armored figure (merged from the approved web build).
//
// Same contract as before: statLevels / avatar / equipped / rankStyle / onPart /
// height. Everything is still driven by the player: outfit colour becomes the
// armor, accent becomes the energy lines, rank trim plates the edges, stat
// levels drive each region's glow.
//
// NEW — obvious highlight: pass `selected` (a stat key) and that body region
// blazes in its stat colour with a colored outline while the rest of the
// figure dims. Tap zones report the region and HunterStage toggles it.
//
// Simplicity rules kept: front view only, react-native-svg only, one gradient
// set, no new dependencies, tap targets stay as plain overlay Pressables
// (proven reliable in this codebase — SVG hit-testing on concave paths isn't).
// ---------------------------------------------------------------------------

// shade('#26314a', 0.3) lightens 30%, shade(hex, -0.3) darkens.
const shade = (hex, amt) => {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const t = amt < 0 ? 0 : 255, a = Math.abs(amt);
  r = Math.round((t - r) * a + r); g = Math.round((t - g) * a + g); b = Math.round((t - b) * a + b);
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
};

// Right side of the body is the left side flipped. Mirroring the path data at
// module scope (x -> 420 - x) beats a scale(-1,1) group transform because
// transform strings on nested <G>s have been flaky across react-native-svg
// versions — plain paths always render.
const mirror = (d) => d.replace(/(-?\d+(?:\.\d+)?)([, ])(-?\d+(?:\.\d+)?)/g,
  (m, x, sep, y) => (420 - parseFloat(x)) + sep + y);

// Zone silhouettes (used for the selected outline) + glow shapes, left side.
// ROBOTIC REDESIGN: every edge that used to be a spike or a fang is now a
// chamfered panel, a vent slot or a rounded actuator housing. The read should be
// "friendly service android in gym plating", not "demon knight".
const Z = {
  // head — smooth chrome dome + wide wrap visor, no fangs, no jagged crest
  headOutline: 'M170 104 Q210 74 250 104 Q256 138 250 168 Q210 190 170 168 Q164 138 170 104 Z',
  headGlow: 'M174 108 Q210 80 246 108 Q251 138 246 164 Q210 184 174 164 Q169 138 174 108 Z',
  domePlate: 'M176 106 Q210 84 244 106 Q246 118 244 126 Q210 112 176 126 Q174 118 176 106 Z',
  visorBand: 'M172 124 Q210 112 248 124 L246 148 Q210 162 174 148 Z',
  visorGlass: 'M178 128 Q210 118 242 128 L241 144 Q210 156 179 144 Z',
  jawPlate: 'M182 158 Q210 172 238 158 L234 178 Q210 188 186 178 Z',
  neckRing: 'M192 182 L228 182 L232 198 Q210 208 188 198 Z',
  // shoulders — rounded pauldron domes with vent slots
  shoulderPiece: 'M154 196 Q112 178 84 208 Q74 238 92 266 Q128 278 158 248 Z',
  shoulderLayer: 'M150 194 Q116 180 94 202 Q88 220 100 234 Q130 240 154 216 Z',
  shoulderVent: 'M100 244 L134 254 L132 262 L98 252 Z',
  shoulderGlow: 'M148 200 Q114 186 92 210 Q84 236 100 258 Q128 266 152 242 Z',
  ballJoint: 'M118 258 a22 22 0 1 0 0.1 0 Z',
  // chest — clean panelled cuirass, central reactor, hex vents
  chestOutline: 'M148 198 Q210 170 272 198 Q276 268 266 330 Q210 358 154 330 Q144 268 148 198 Z',
  collarPlate: 'M174 196 Q210 180 246 196 L243 214 Q210 226 177 214 Z',
  pecPlate: 'M158 214 Q186 200 204 210 L202 268 Q178 280 160 262 Z',
  pecInlay: 'M166 224 Q186 212 199 220 L198 259 Q182 268 168 255 Z',
  ribVent: 'M162 278 L200 286 L200 294 L163 288 Z M164 298 L200 304 L200 312 L165 306 Z',
  chestGlow: 'M160 216 Q186 202 204 212 L202 268 Q178 282 160 262 Z',
  latSliver: 'M154 228 Q126 248 130 316 Q142 336 156 330 L161 242 Z',
  // arms — segmented actuator limbs, exposed under-suit at the joints
  armPiece: 'M92 254 Q118 240 140 260 L132 330 Q108 346 86 326 Z',
  armInlay: 'M102 266 Q120 256 132 268 L127 318 Q112 328 98 316 Z',
  elbowJoint: 'M88 322 Q110 310 132 326 L130 352 Q108 366 86 346 Z',
  forearm: 'M86 348 Q108 336 130 352 L122 418 Q102 430 82 412 Z',
  forearmInlay: 'M94 358 Q108 350 122 360 L119 396 Q105 404 92 392 Z',
  gauntlet: 'M80 410 Q102 400 124 414 Q126 438 118 452 Q98 464 76 446 Q74 424 80 410 Z',
  armGlow: 'M98 262 Q118 252 134 266 L126 324 Q110 336 94 322 Z M92 354 Q108 344 124 356 L118 414 Q102 424 88 410 Z',
  // core — segmented midriff with a power belt
  coreOutline: 'M158 322 Q210 344 262 322 Q258 360 256 390 Q210 406 164 390 Q162 360 158 322 Z',
  absSeg: 'M186 332 Q210 340 234 332 L232 346 Q210 353 188 346 Z M188 350 Q210 357 232 350 L230 364 Q210 370 190 364 Z M190 368 Q210 374 230 368 L228 380 Q210 386 192 380 Z',
  beltBand: 'M152 374 Q210 392 268 374 Q266 386 264 394 Q210 410 156 394 Q154 386 152 374 Z',
  tasset: 'M158 394 Q174 388 188 396 L184 424 Q170 430 154 420 Z',
  coreGlow: 'M174 332 Q210 346 246 332 Q243 364 242 392 Q210 404 178 392 Q176 364 174 332 Z',
  // legs — rounded thigh housings, piston shins, soft-toe boots
  thigh: 'M164 394 Q184 378 206 388 L202 484 Q180 498 158 480 Z',
  quadPlate: 'M172 402 Q188 392 200 400 L197 468 Q184 478 168 466 Z',
  kneeJoint: 'M160 476 Q182 464 202 478 Q204 496 200 508 Q178 520 156 502 Q156 486 160 476 Z',
  shin: 'M156 504 Q180 494 200 506 L196 582 Q176 596 150 578 Z',
  shinVent: 'M164 520 L192 526 L192 534 L165 528 Z M164 540 L192 545 L192 553 L165 548 Z',
  boot: 'M148 574 Q174 588 198 572 Q202 596 200 610 Q168 628 140 606 Q142 588 148 574 Z',
  bootSole: 'M142 606 Q168 622 200 608 L200 616 Q168 630 141 614 Z',
  legGlow: 'M172 402 Q188 392 200 400 L197 468 Q184 478 168 466 Z M164 508 Q180 498 194 510 L191 570 Q177 582 160 568 Z',
  legFin: 'M154 516 Q136 534 154 552 Q150 534 154 516 Z',
};
const ZR = {};                                   // pre-mirrored right side
Object.keys(Z).forEach((k) => { ZR[k] = mirror(Z[k]); });
const both = (k) => Z[k] + ' ' + ZR[k];          // one path covering both sides

export function HunterFigure({ statLevels, avatar, equipped, rankStyle, onPart, height, selected, compact }) {
  const H = height || 300;
  const lv = {};
  statLevels.forEach((x) => { lv[x.stat] = x.level; });
  const g = (st) => glowOf(lv, st);
  const skin = pal(SKINS, avatar.skin), hair = pal(HAIRS, avatar.hair);
  const outfit = pal(OUTFITS, avatar.outfit), accent = pal(ACCENTS, avatar.accent);
  const trim = rankStyle.trim, plate = rankStyle.plate;
  const eq = equipped || {};
  const stat = (st) => STAT_META[st].color;

  // armor shades derived from the chosen outfit colour
  const armor = outfit;
  // Pushed the highlight/steel steps up (0.28/0.16 -> 0.42/0.30): the darkest
  // armour option is nearly black, and at the old spread the panel lines and
  // dome plate vanished into it. Brighter steel is what makes it read as
  // machined hardware rather than a silhouette.
  const armorHi = shade(outfit, 0.42);
  const armorLo = shade(outfit, -0.45);
  const steel = shade(outfit, 0.30);
  // Exposed under-suit / synthetic-muscle segments at the joints. This is where
  // the player's skin swatch still shows, so Appearance keeps mattering on a
  // fully plated robot body.
  const jointSkin = skin;

  // idle bob + aura pulse (unchanged)
  const bob = useRef(new Animated.Value(0)).current;
  const reduceMotion = useReduceMotion();
  useEffect(() => {
    // Parked at 0: no bob, aura held at half brightness.
    if (reduceMotion) { bob.setValue(0); return undefined; }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(bob, { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(bob, { toValue: 0, duration: 1500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [bob, reduceMotion]);
  const ty = bob.interpolate({ inputRange: [0, 1], outputRange: [0, -5] });
  const pulse = bob.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] });

  const shimmer = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    // Mid-travel, NOT 0. auraFade reads 0 opacity at both ends, so parking at 0
    // would delete an aura the player actually bought. 0.5 keeps it lit and still.
    if (reduceMotion) { shimmer.setValue(0.5); return undefined; }
    const loop = Animated.loop(
      Animated.timing(shimmer, { toValue: 1, duration: 2600, easing: Easing.linear, useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, [shimmer, reduceMotion]);
  const auraSpin = shimmer.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const auraRise = shimmer.interpolate({ inputRange: [0, 1], outputRange: [12, -30] });
  const auraFade = shimmer.interpolate({ inputRange: [0, 0.2, 0.8, 1], outputRange: [0, 0.75, 0.4, 0] });

  const helm = eq.helm || 'helm_none';
  const back = eq.back || 'back_none';
  const weapon = eq.weapon || 'weapon_blade';
  const aura = eq.aura || 'aura_ring';
  const auraColor = aura === 'aura_frost' ? '#38bdf8'
    : aura === 'aura_flames' || aura === 'aura_inferno' ? '#fb7185'
    : aura === 'aura_galaxy' ? '#c26bf0' : stat('MOB');
  const showHair = helm !== 'helm_wraith' && helm !== 'helm_hood';

  // Highlight helpers. When a region is selected everything else dims hard —
  // the contrast is what makes "which body part" obvious at a glance.
  const zoneOp = (st) => (!selected ? 1 : selected === st ? 1 : 0.32);
  // Idle glow is deliberately soft: at the old strength (up to 0.42) the stat
  // colour washed over the plating and a gold visor sampled brown. The loud
  // signal is the SELECTED state, not the resting one.
  const glowOp = (st) => (selected === st ? 0.92 : 0.05 + g(st) * 0.15);
  const outlineFor = (st, d) => (selected === st
    ? <Path d={d} fill="none" stroke={stat(st)} strokeWidth="4" opacity={0.95} />
    : null);

  // Width is derived from height at the viewBox's exact aspect ratio, so
  // preserveAspectRatio has nothing to letterbox and nothing can be cropped.
  // Every cosmetic combination was measured to sit inside 0 0 420 680 with
  // margin on all four sides — if geometry is ever added beyond that, widen the
  // viewBox here rather than letting the frame clip it.
  const VB_W = 420, VB_H = 680;
  const W = Math.round((H - 26) * (VB_W / VB_H));

  return (
    <View style={{ height: H, alignItems: 'center', justifyContent: 'flex-end' }}>
      {/* floor ring (pulses independently under the figure).
          `compact` strips the ground ring and the body aura: at portrait size the
          FX crowd out the character, and a small image should read instantly. */}
      {!compact && (
      <Animated.View style={{ position: 'absolute', bottom: 4, opacity: pulse }}>
        <Svg width={170} height={36} viewBox="0 0 170 36">
          <Ellipse cx="85" cy="18" rx="76" ry="13" fill="none" stroke={selected ? stat(selected) : auraColor} strokeWidth={2 + g('MOB') * 2} strokeDasharray={aura === 'aura_ring' ? undefined : '8 6'} opacity={0.55 + g('MOB') * 0.4} />
          <Ellipse cx="85" cy="18" rx="76" ry="13" fill={auraColor} opacity={0.08} />
        </Svg>
      </Animated.View>
      )}

      {/* full-body aura (behind the figure) */}
      {!compact && aura !== 'aura_none' && (
        <BodyAura kind={aura} color={auraColor} h={H} spin={auraSpin} rise={auraRise} fade={auraFade} pulse={pulse} />
      )}

      <Animated.View style={{ transform: [{ translateY: ty }] }}>
        <Svg width={W} height={H - 26} viewBox={`0 0 ${VB_W} ${VB_H}`} preserveAspectRatio="xMidYMid meet">
          <Defs>
            <LinearGradient id="armorMain" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={armorHi} /><Stop offset="0.42" stopColor={armor} /><Stop offset="1" stopColor={armorLo} />
            </LinearGradient>
            <LinearGradient id="armorEdge" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={shade(outfit, 0.5)} /><Stop offset="0.25" stopColor={steel} /><Stop offset="1" stopColor={armorLo} />
            </LinearGradient>
            <LinearGradient id="skinGrad" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={shade(skin, 0.18)} /><Stop offset="0.6" stopColor={skin} /><Stop offset="1" stopColor={shade(skin, -0.35)} />
            </LinearGradient>
            <LinearGradient id="bladeGrad" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor="#667189" /><Stop offset="0.4" stopColor="#dce7f5" /><Stop offset="0.57" stopColor="#ffffff" /><Stop offset="1" stopColor="#3f485d" />
            </LinearGradient>
          </Defs>

          {/* ---- BACK GEAR (behind the body) ---- */}
          {back === 'back_wings' && [Z, ZR].map((S, i) => (
            <Path key={i} d={i === 0 ? 'M198 226 Q120 168 66 196 Q102 214 118 244 Q158 236 198 262 Z' : mirror('M198 226 Q120 168 66 196 Q102 214 118 244 Q158 236 198 262 Z')} fill={accent} opacity={0.5 + g('MOB') * 0.3} />
          ))}
          {back === 'back_dragon' && [0, 1].map((i) => (
            <Path key={i} d={i === 0 ? 'M200 220 Q112 152 78 184 L118 200 Q98 214 92 238 Q150 232 200 258 Z' : mirror('M200 220 Q112 152 78 184 L118 200 Q98 214 92 238 Q150 232 200 258 Z')} fill={stat('MOB')} opacity={0.7} stroke={trim} strokeWidth="2" />
          ))}
          {back === 'back_pack' && <Rect x="164" y="212" width="92" height="96" rx="14" fill={armor} stroke={trim} strokeWidth="3" opacity="0.95" />}
          {back === 'back_reactor' && (
            <>
              <Circle cx="210" cy="258" r="96" fill="none" stroke={accent} strokeWidth="5" opacity={0.35 + g('END') * 0.3} />
              <Circle cx="210" cy="258" r="96" fill={accent} opacity={0.06} />
            </>
          )}
          {rankStyle.cape && back === 'back_none' && (
            <>
              <Path d="M148 206 Q210 232 272 206 L302 512 Q276 536 254 524 L266 556 Q238 572 210 552 Q182 572 154 556 L166 524 Q144 536 118 512 Z" fill={armorLo} stroke={trim} strokeWidth="2" opacity="0.95" />
              <Path d="M164 218 Q210 238 256 218 L272 488 Q238 512 210 500 Q182 512 148 488 Z" fill={armor} opacity="0.6" />
              <Path d="M210 236 L210 500" stroke={trim} strokeWidth="2" opacity="0.3" />
            </>
          )}

          {/* ---- WEAPON on the back (right side, all five variants) ---- */}
          {/* The weapon sits in its own scaled/nudged group. At full size the
              scythe and glaive blades reached x=469 in a 420-wide viewBox, so
              react-native-svg clipped the tips. Pulling the group in keeps every
              variant inside the frame. */}
          {weapon !== 'weapon_none' && (
            <G transform="translate(-16, 12)">
            <G transform="scale(0.9)">
            <G transform="rotate(16 332 290)">
              <Rect x="325" y="96" width="14" height="372" rx="7" fill="#10141f" stroke={trim} strokeWidth="2" opacity="0.95" />
              <Path d="M325 168 h14 M325 240 h14 M325 312 h14 M325 384 h14" stroke={accent} strokeWidth="3" opacity={0.3 + g('MOB') * 0.3} />
              {weapon === 'weapon_blade' && (
                <>
                  <Path d="M310 100 L332 22 L356 92 Q344 116 332 120 Z" fill="url(#bladeGrad)" stroke={trim} strokeWidth="2" />
                  <Path d="M318 66 L332 22 L336 100" fill="none" stroke="#ffffff" strokeWidth="2" opacity="0.6" />
                </>
              )}
              {weapon === 'weapon_axe' && (
                <Path d="M339 76 Q384 92 366 140 L332 116 Z" fill="url(#bladeGrad)" stroke={trim} strokeWidth="2" />
              )}
              {weapon === 'weapon_scythe' && (
                <Path d="M332 66 Q400 70 410 118 Q368 98 334 106 Z" fill={auraColor} opacity="0.9" stroke={trim} strokeWidth="2" />
              )}
              {weapon === 'weapon_hammer' && (
                <Rect x="300" y="60" width="64" height="46" rx="8" fill={steel} stroke={accent} strokeWidth="3" />
              )}
              {weapon === 'weapon_glaive' && (
                <>
                  <Path d="M303 102 L332 18 L368 88 Q352 128 337 134 L326 126 Z" fill="url(#bladeGrad)" stroke={trim} strokeWidth="2" />
                  <Path d="M337 134 Q356 126 366 94" fill="none" stroke={auraColor} strokeWidth="3" opacity="0.85" />
                  <Path d="M306 128 L286 106 L314 113 Z" fill="url(#bladeGrad)" stroke={trim} strokeWidth="1.6" />
                  <Path d="M332 180 l6 8 -6 8 -6 -8 Z M332 268 l6 8 -6 8 -6 -8 Z M332 356 l6 8 -6 8 -6 -8 Z" fill={auraColor} opacity="0.85" />
                </>
              )}
              <Path d="M314 460 L350 460 L344 486 L320 486 Z" fill={trim} opacity="0.85" />
            </G>
            </G>
            </G>
          )}

          {/* ---- LEGS -> PWR : housings + pistons + soft-toe boots ---- */}
          <G opacity={zoneOp('PWR')}>
            <Path d={both('thigh')} fill="url(#armorMain)" stroke={steel} strokeWidth="2" />
            <Path d={both('quadPlate')} fill={steel} opacity={0.35 + plate * 0.4} />
            {/* hip actuators */}
            <Path d={'M172 424 L198 420 M170 444 L196 441 ' + mirror('M172 424 L198 420 M170 444 L196 441')} stroke={accent} strokeWidth="2.5" opacity={g('PWR') * 0.6} strokeLinecap="round" />
            {/* knee joint housing + hub */}
            <Path d={both('kneeJoint')} fill="url(#armorEdge)" stroke={steel} strokeWidth="2" />
            <Circle cx="180" cy="492" r="9" fill={armorLo} stroke={accent} strokeWidth="2" strokeOpacity={0.4 + g('PWR') * 0.5} />
            <Circle cx="240" cy="492" r="9" fill={armorLo} stroke={accent} strokeWidth="2" strokeOpacity={0.4 + g('PWR') * 0.5} />
            <Circle cx="180" cy="492" r="3.5" fill={jointSkin} opacity="0.9" />
            <Circle cx="240" cy="492" r="3.5" fill={jointSkin} opacity="0.9" />
            <Path d={both('shin')} fill="url(#armorEdge)" stroke={steel} strokeWidth="2" />
            <Path d={both('shinVent')} fill={armorLo} opacity="0.85" />
            {/* piston rod down the shin */}
            <Path d={'M176 512 L173 572 ' + mirror('M176 512 L173 572')} stroke={accent} strokeWidth="3" opacity={g('PWR') * 0.75} strokeLinecap="round" />
            {rankStyle.spikes > 2 && <Path d={both('legFin')} fill={trim} opacity="0.7" />}
            <Path d={both('boot')} fill={armorLo} stroke={steel} strokeWidth="2" />
            <Path d={both('bootSole')} fill={accent} opacity={0.35 + g('PWR') * 0.45} />
            <Path d={both('legGlow')} fill={stat('PWR')} opacity={glowOp('PWR')} />
            {outlineFor('PWR', both('thigh') + ' ' + both('shin'))}
          </G>

          {/* ---- CORE -> VIT : segmented midriff + power belt ---- */}
          <G opacity={zoneOp('VIT')}>
            <Path d={both('tasset')} fill="url(#armorMain)" stroke={steel} strokeWidth="2" />
            <Path d={Z.coreOutline} fill="url(#armorMain)" stroke={steel} strokeWidth="2" />
            <Path d={Z.absSeg} fill={armorLo} stroke={steel} strokeWidth="1" opacity="0.95" />
            <Path d="M210 330 L210 384" stroke={steel} strokeWidth="2" opacity="0.6" />
            <Path d={Z.beltBand} fill={armorLo} stroke={accent} strokeWidth="2" strokeOpacity={0.45 + g('VIT') * 0.4} />
            {/* belt power cell */}
            <Rect x="196" y="374" width="28" height="22" rx="6" fill={steel} stroke={accent} strokeWidth="2" />
            <Circle cx="210" cy="385" r="6" fill={stat('VIT')} opacity={0.5 + g('VIT') * 0.5} />
            <Path d={Z.coreGlow} fill={stat('VIT')} opacity={glowOp('VIT')} />
            {outlineFor('VIT', Z.coreOutline)}
          </G>

          {/* ---- CHEST -> END : panelled cuirass + ring reactor ---- */}
          <G opacity={zoneOp('END')}>
            <Path d={Z.chestOutline} fill="url(#armorMain)" stroke={steel} strokeWidth="2.4" />
            <Path d={Z.collarPlate} fill={steel} stroke={shade(outfit, 0.5)} strokeWidth="1.5" opacity="0.95" />
            <Path d={both('pecPlate')} fill={steel} opacity="0.9" />
            <Path d={both('pecInlay')} fill={armorLo} />
            <Path d="M210 200 L210 334" stroke={steel} strokeWidth="3" opacity="0.7" />
            <Path d={both('ribVent')} fill={armorLo} opacity={0.6 + plate * 0.35} />
            <Path d={'M172 240 L198 232 ' + mirror('M172 240 L198 232')} stroke={accent} strokeWidth="2.5" opacity={0.3 + g('END') * 0.45} strokeLinecap="round" />
            <Path d={both('latSliver')} fill={armorLo} stroke={steel} strokeWidth="2" />
            <Path d={both('chestGlow')} fill={stat('END')} opacity={glowOp('END')} />
            {/* ring reactor — clean concentric hardware, no dark fang core */}
            <Circle cx="210" cy="256" r="27" fill={armorLo} stroke={steel} strokeWidth="2" />
            <Circle cx="210" cy="256" r="21" fill="none" stroke={accent} strokeWidth="2" opacity={0.4 + g('END') * 0.5} />
            <Circle cx="210" cy="256" r="13" fill="none" stroke={accent} strokeWidth="3" opacity={0.55 + g('END') * 0.45} />
            <Circle cx="210" cy="256" r="7" fill={selected === 'END' ? stat('END') : accent} opacity={0.7 + g('END') * 0.3} />
            <Path d="M210 229 v-8 M210 283 v8 M183 256 h-8 M237 256 h8" stroke={accent} strokeWidth="2.5" opacity={0.4 + g('END') * 0.4} strokeLinecap="round" />
            {outlineFor('END', Z.chestOutline)}
          </G>

          {/* ---- SHOULDERS -> MOB : rounded pauldrons + vents + ball joints ---- */}
          <G opacity={zoneOp('MOB')}>
            <Path d={both('shoulderPiece')} fill="url(#armorEdge)" stroke={steel} strokeWidth="2" />
            <Path d={both('shoulderLayer')} fill={steel} opacity="0.92" />
            <Path d={both('shoulderVent')} fill={armorLo} opacity="0.9" />
            <Path d={'M96 214 Q124 226 152 212 ' + mirror('M96 214 Q124 226 152 212')} fill="none" stroke={trim} strokeWidth="2.5" opacity={0.45 + plate * 0.45} strokeLinecap="round" />
            {/* rank escalation reads as swept aero fins, not spines */}
            {rankStyle.spikes > 0 && <Path d={'M88 200 Q60 184 46 196 Q66 200 84 214 Z ' + mirror('M88 200 Q60 184 46 196 Q66 200 84 214 Z')} fill={trim} opacity="0.8" />}
            {rankStyle.spikes > 1 && <Path d={'M82 224 Q56 216 44 226 Q62 228 80 236 Z ' + mirror('M82 224 Q56 216 44 226 Q62 228 80 236 Z')} fill={trim} opacity="0.5" />}
            <Circle cx="118" cy="258" r="15" fill={armorLo} stroke={steel} strokeWidth="2" />
            <Circle cx="302" cy="258" r="15" fill={armorLo} stroke={steel} strokeWidth="2" />
            <Circle cx="118" cy="258" r="6" fill={jointSkin} opacity="0.9" />
            <Circle cx="302" cy="258" r="6" fill={jointSkin} opacity="0.9" />
            <Path d={both('shoulderGlow')} fill={stat('MOB')} opacity={glowOp('MOB')} />
            {outlineFor('MOB', both('shoulderPiece'))}
          </G>

          {/* ---- ARMS -> STR : actuator limbs, under-suit at the joints ---- */}
          <G opacity={zoneOp('STR')}>
            <Path d={both('armPiece')} fill="url(#armorMain)" stroke={steel} strokeWidth="2" />
            <Path d={both('armInlay')} fill={steel} opacity="0.6" />
            <Path d={'M100 300 L132 294 ' + mirror('M100 300 L132 294')} stroke={accent} strokeWidth="3" opacity={g('STR') * 0.75} strokeLinecap="round" />
            {/* elbow: exposed synthetic-muscle segment in the skin tone */}
            <Path d={both('elbowJoint')} fill="url(#skinGrad)" stroke={steel} strokeWidth="2" />
            <Circle cx="109" cy="338" r="7" fill={armorLo} stroke={accent} strokeWidth="2" strokeOpacity={0.45 + g('STR') * 0.45} />
            <Circle cx="311" cy="338" r="7" fill={armorLo} stroke={accent} strokeWidth="2" strokeOpacity={0.45 + g('STR') * 0.45} />
            <Path d={both('forearm')} fill="url(#armorEdge)" stroke={steel} strokeWidth="2" />
            <Path d={both('forearmInlay')} fill={jointSkin} opacity={0.85} />
            <Path d={'M100 368 L100 400 ' + mirror('M100 368 L100 400')} stroke={accent} strokeWidth="2.5" opacity={g('STR') * 0.7} strokeLinecap="round" />
            <Path d={both('gauntlet')} fill={armorLo} stroke={steel} strokeWidth="2" />
            <Path d={'M86 432 L118 440 ' + mirror('M86 432 L118 440')} stroke={accent} strokeWidth="3" opacity={0.4 + g('STR') * 0.5} strokeLinecap="round" />
            <Path d={both('armGlow')} fill={stat('STR')} opacity={glowOp('STR')} />
            {outlineFor('STR', both('armPiece') + ' ' + both('forearm'))}
          </G>

          {/* ---- HEAD -> DIS : chrome dome + wrap visor + sensor crest ---- */}
          <G opacity={zoneOp('DIS')}>
            <Path d={Z.neckRing} fill={armorLo} stroke={steel} strokeWidth="2" />
            <Path d="M196 190 L224 190" stroke={accent} strokeWidth="2.5" opacity={0.4 + g('DIS') * 0.45} strokeLinecap="round" />
            <Path d={Z.headOutline} fill="url(#armorEdge)" stroke={steel} strokeWidth="2.4" />
            <Path d={Z.domePlate} fill={steel} opacity="0.95" />
            {/* sensor crest + ear pods — the 'hair' colour now drives the light trim,
                so the Appearance swatch still visibly changes the character */}
            {showHair && (
              <>
                <Path d="M204 82 Q210 66 216 82 L214 108 L206 108 Z" fill={hair} />
                <Path d="M210 68 L210 54" stroke={hair} strokeWidth="3" strokeLinecap="round" />
                <Circle cx="210" cy="50" r="4.5" fill={hair} />
                <Path d="M168 132 Q158 138 160 152 Q168 156 172 148 Z" fill={hair} opacity="0.9" />
                <Path d="M252 132 Q262 138 260 152 Q252 156 248 148 Z" fill={hair} opacity="0.9" />
              </>
            )}
            {/* wrap visor — one soft rounded light bar, friendly not fanged */}
            <Path d={Z.visorBand} fill={armorLo} stroke={steel} strokeWidth="2" />
            <Path d={Z.visorGlass} fill={helm === 'helm_wraith' ? stat('DIS') : accent} opacity={0.55 + g('DIS') * 0.35} />
            <Path d="M184 132 Q210 124 236 132" fill="none" stroke="#ffffff" strokeWidth="2.5" opacity="0.5" strokeLinecap="round" />
            <Path d={Z.jawPlate} fill={steel} stroke={shade(outfit, -0.2)} strokeWidth="1.5" />
            <Path d="M194 168 L226 168 M197 176 L223 176" stroke={armorLo} strokeWidth="2" opacity="0.8" strokeLinecap="round" />
            {/* helm cosmetics, re-cut as tech hardware */}
            {helm === 'helm_visor' && (
              <>
                <Path d="M168 120 Q210 106 252 120 L250 152 Q210 166 170 152 Z" fill={accent} opacity="0.9" />
                <Path d="M180 128 Q210 120 240 128" fill="none" stroke="#ffffff" strokeWidth="2.5" opacity="0.55" strokeLinecap="round" />
              </>
            )}
            {helm === 'helm_horns' && (
              <>
                <Path d="M176 106 Q146 82 134 92 Q152 104 168 126 Z" fill={trim} stroke={steel} strokeWidth="1.5" />
                <Path d="M244 106 Q274 82 286 92 Q268 104 252 126 Z" fill={trim} stroke={steel} strokeWidth="1.5" />
              </>
            )}
            {helm === 'helm_crown' && (
              <>
                <Rect x="176" y="76" width="68" height="13" rx="6" fill={trim} />
                <Rect x="182" y="58" width="9" height="20" rx="4" fill={accent} />
                <Rect x="205" y="50" width="10" height="28" rx="5" fill={accent} />
                <Rect x="229" y="58" width="9" height="20" rx="4" fill={accent} />
              </>
            )}
            {helm === 'helm_hood' && (
              <Path d="M162 138 Q158 70 210 62 Q262 70 258 138 Q248 96 210 94 Q172 96 162 138 Z" fill={armor} stroke={trim} strokeWidth="2" />
            )}
            {helm === 'helm_wraith' && (
              <>
                <Path d="M168 104 Q210 76 252 104 Q258 140 250 172 Q210 192 170 172 Q162 140 168 104 Z" fill="#0f1420" opacity="0.9" />
                <Path d={Z.visorGlass} fill={stat('DIS')} opacity="0.95" />
              </>
            )}
            {/* orbital halo — Discipline made visible */}
            <Ellipse cx="210" cy="34" rx="34" ry="9" fill="none" stroke={stat('DIS')} strokeWidth="3.5" opacity={0.4 + g('DIS') * 0.5} />
            <Path d={Z.headGlow} fill={stat('DIS')} opacity={glowOp('DIS')} />
            {outlineFor('DIS', Z.headOutline)}
          </G>
        </Svg>


        {/* invisible tap zones -> stat inspect (proportions match the new body) */}
        {onPart && (
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
            <Pressable onPress={() => onPart('DIS')} style={{ position: 'absolute', top: 0, left: '33%', width: '34%', height: '27%' }} />
            <Pressable onPress={() => onPart('MOB')} style={{ position: 'absolute', top: '25%', left: 0, width: '24%', height: '15%' }} />
            <Pressable onPress={() => onPart('MOB')} style={{ position: 'absolute', top: '25%', right: 0, width: '24%', height: '15%' }} />
            <Pressable onPress={() => onPart('STR')} style={{ position: 'absolute', top: '40%', left: 0, width: '25%', height: '30%' }} />
            <Pressable onPress={() => onPart('STR')} style={{ position: 'absolute', top: '40%', right: 0, width: '25%', height: '30%' }} />
            <Pressable onPress={() => onPart('END')} style={{ position: 'absolute', top: '27%', left: '33%', width: '34%', height: '21%' }} />
            <Pressable onPress={() => onPart('VIT')} style={{ position: 'absolute', top: '48%', left: '33%', width: '34%', height: '13%' }} />
            <Pressable onPress={() => onPart('PWR')} style={{ position: 'absolute', bottom: 0, left: '27%', width: '46%', height: '38%' }} />
          </View>
        )}
      </Animated.View>
    </View>
  );
}

/* -------- mini hex emblem (leaderboards, duels) -------- */
export function MiniHunter({ avatar, tierColor, size }) {
  const S = size || 36;
  const skin = pal(SKINS, avatar.skin), hair = pal(HAIRS, avatar.hair);
  const outfit = pal(OUTFITS, avatar.outfit), accent = pal(ACCENTS, avatar.accent);
  const steel = shade(outfit, 0.2), deep = shade(outfit, -0.4);
  return (
    <Svg width={S} height={S} viewBox="0 0 40 40">
      <Polygon points="20,1 37,10.5 37,29.5 20,39 3,29.5 3,10.5" fill={tierColor} opacity="0.9" />
      <Polygon points="20,4 34,12 34,28 20,36 6,28 6,12" fill={C.bgElev} />
      {/* sensor crest (hair colour) */}
      <Rect x="19" y="5.5" width="2" height="4" rx="1" fill={hair} />
      {/* helmet dome + wrap visor — the robotic read at emblem scale */}
      <Path d="M13.5 15 Q20 8.5 26.5 15 Q27 19 26.5 21.5 Q20 25 13.5 21.5 Q13 19 13.5 15 Z" fill={steel} />
      <Path d="M14.4 15.6 Q20 12.6 25.6 15.6 L25.3 19 Q20 21.6 14.7 19 Z" fill={deep} />
      <Path d="M15.4 16.4 Q20 14 24.6 16.4 L24.4 18.4 Q20 20.4 15.6 18.4 Z" fill={accent} />
      {/* shoulders + chest reactor */}
      <Path d="M11 36 Q11 26 20 24.5 Q29 26 29 36 Z" fill={outfit} />
      <Circle cx="20" cy="30.5" r="3.2" fill={deep} />
      <Circle cx="20" cy="30.5" r="1.5" fill={accent} />
      {/* joint segments keep the skin swatch visible */}
      <Circle cx="12.6" cy="28.5" r="1.7" fill={skin} />
      <Circle cx="27.4" cy="28.5" r="1.7" fill={skin} />
    </Svg>
  );
}

/* -------- color customizer -------- */
// A single colour swatch. Big enough to tap (Apple's 44pt floor), with a real
// selected state — an outer ring, a soft glow, and a subtle lift — instead of
// the thin border that made this read as a debug menu.
function Swatch({ color, selected, onPress }) {
  return (
    <Pressable onPress={onPress} hitSlop={4} style={{ alignItems: 'center', justifyContent: 'center', width: 46, height: 46, marginRight: 10 }}>
      {selected && (
        <View style={{
          position: 'absolute', width: 46, height: 46, borderRadius: 999,
          borderWidth: 2, borderColor: C.gold,
        }} />
      )}
      {selected && (
        <View style={{
          position: 'absolute', width: 54, height: 54, borderRadius: 999,
          backgroundColor: C.gold, opacity: 0.16,
        }} />
      )}
      <View style={{
        width: selected ? 32 : 34, height: selected ? 32 : 34, borderRadius: 999,
        backgroundColor: color,
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)',
      }} />
    </Pressable>
  );
}

function SwatchRow({ label, colors, value, onPick }) {
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={{ ...T.caption, color: C.mut, fontWeight: '700', marginBottom: 8 }}>{label}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingRight: 12, alignItems: 'center' }}>
        {colors.map((c, i) => (
          <Swatch key={c} color={c} selected={value === i} onPress={() => onPick(i)} />
        ))}
      </ScrollView>
    </View>
  );
}

export function AvatarCustomizer({ avatar, onChange }) {
  const rows = [['Skin', SKINS, 'skin'], ['Hair', HAIRS, 'hair'], ['Outfit', OUTFITS, 'outfit'], ['Aura', ACCENTS, 'accent']];
  return (
    <View style={{ marginTop: 14, paddingTop: 16, borderTopWidth: 1, borderTopColor: C.line }}>
      <Text style={[s.label, { marginBottom: 14 }]}>Appearance</Text>
      {rows.map((r) => (
        <SwatchRow
          key={r[0]}
          label={r[0]}
          colors={r[1]}
          value={(avatar[r[2]] || 0) % r[1].length}
          onPick={(i) => onChange(r[2], i)}
        />
      ))}
    </View>
  );
}

/* ------------------------------- body aura -------------------------------
 * A real aura around the figure rather than only a ring on the floor. Each
 * type reads differently at a glance so the cosmetic is actually worth owning:
 *   ring    — steady orbiting halo
 *   flames  — embers rising off the body
 *   frost   — slow crystalline shards
 *   galaxy  — rotating dual rings
 *   inferno — dense rising storm, brightest of the set
 * All layered BEHIND the character and pointer-transparent.
 */
function BodyAura({ kind, color, h, spin, rise, fade, pulse }) {
  const rising = kind === 'aura_flames' || kind === 'aura_inferno';
  const dense = kind === 'aura_inferno';
  const count = dense ? 7 : 5;

  return (
    <View pointerEvents="none" style={{ position: 'absolute', bottom: 0, width: 200, height: h, alignItems: 'center', justifyContent: 'flex-end' }}>
      {/* soft body glow */}
      <Animated.View style={{
        position: 'absolute', bottom: h * 0.16, width: 132, height: 132, borderRadius: 66,
        backgroundColor: color, opacity: pulse.interpolate({ inputRange: [0.5, 1], outputRange: [0.06, dense ? 0.20 : 0.13] }),
      }} />

      {/* orbiting rings — galaxy gets two, counter-rotating */}
      {(kind === 'aura_ring' || kind === 'aura_galaxy') && (
        <Animated.View style={{
          position: 'absolute', bottom: h * 0.18, transform: [{ rotate: spin }],
        }}>
          <Svg width={150} height={150} viewBox="0 0 150 150">
            <Ellipse cx="75" cy="75" rx="62" ry="24" fill="none" stroke={color} strokeWidth={2} opacity={0.5} />
            {kind === 'aura_galaxy' && (
              <Ellipse cx="75" cy="75" rx="24" ry="62" fill="none" stroke={color} strokeWidth={1.5} opacity={0.32} />
            )}
          </Svg>
        </Animated.View>
      )}

      {/* frost shards hold position and shimmer instead of rising */}
      {kind === 'aura_frost' && (
        <Animated.View style={{ position: 'absolute', bottom: h * 0.2, opacity: fade }}>
          <Svg width={160} height={160} viewBox="0 0 160 160">
            {[0, 60, 120, 180, 240, 300].map((deg) => {
              const rad = (deg * Math.PI) / 180;
              const cx = 80 + Math.cos(rad) * 58;
              const cy = 80 + Math.sin(rad) * 40;
              return (
                <Polygon key={deg}
                  points={`${cx},${cy - 7} ${cx + 4},${cy} ${cx},${cy + 7} ${cx - 4},${cy}`}
                  fill={color} opacity={0.75} />
              );
            })}
          </Svg>
        </Animated.View>
      )}

      {/* rising embers */}
      {rising && [...Array(count)].map((_, i) => {
        const offset = (i / count) * 2 - 1;                 // -1..1 across the body
        const size = dense ? 5 - (i % 3) : 4 - (i % 2);
        return (
          <Animated.View key={i} style={{
            position: 'absolute',
            bottom: h * 0.14,
            left: 100 + offset * 46 - size / 2,
            width: size, height: size, borderRadius: size / 2,
            backgroundColor: color,
            opacity: fade,
            transform: [{ translateY: Animated.multiply(rise, 1 + (i % 3) * 0.35) }],
          }} />
        );
      })}
    </View>
  );
}
