// ============================================================================
// LEVL — HunterAvatar
//
// The small Hunter face used wherever a person appears: feed cards, comments,
// friend rows, the profile button in the header.
//
// It is deliberately a MINIATURE, not the full character. On a social card the
// photograph is the content — a large fantasy figure next to it would fight the
// image and make the feed look like a game menu. So this reads as an avatar
// first and a Hunter second: the colours, the crest and the frame come from the
// player's real Hunter, and nothing else does.
//
// Cosmetics bought in the Forge can change the frame here. They can never
// change reach, ranking or XP.
// ============================================================================

import React from 'react';
import { View } from 'react-native';
import { Text } from './Text';
import Svg, { Path, Circle } from 'react-native-svg';
import { C } from '../theme';
import { SKINS, HAIRS, OUTFITS, ACCENTS, decorationById } from '../engine/engine';

const pick = (list, index, fallback) => {
  const i = Number.isFinite(index) ? index : 0;
  return list[((i % list.length) + list.length) % list.length] || fallback;
};

export function HunterAvatar({ avatar, character, size = 36, dim }) {
  const a = avatar || {};
  const skin = pick(SKINS, a.skin, '#e8b48c');
  const hair = pick(HAIRS, a.hair, '#15181f');
  const outfit = pick(OUTFITS, a.outfit, '#26314a');
  const accent = pick(ACCENTS, a.accent, C.gold);

  // The equipped profile border, if they own one.
  const deco = decorationById((character && character.deco) || 'deco_none');
  const framed = deco && deco.id !== 'deco_none';
  const frameColor = framed ? deco.color : C.line;

  const inner = size - (framed ? 4 : 2);

  return (
    <View
      style={{
        width: size, height: size, borderRadius: size / 2,
        borderWidth: framed ? 2 : 1, borderColor: frameColor,
        backgroundColor: C.panel2,
        alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden',
        opacity: dim ? 0.5 : 1,
      }}>
      <Svg width={inner} height={inner} viewBox="0 0 40 40">
        {/* shoulders */}
        <Path d="M4 40 C4 30 12 26 20 26 C28 26 36 30 36 40 Z" fill={outfit} />
        {/* collar accent — the only place the accent colour appears, so it
            still reads at 24pt in a comment row */}
        <Path d="M14 27 L20 33 L26 27 L26 30 L20 36 L14 30 Z" fill={accent} opacity={0.9} />
        {/* head */}
        <Circle cx="20" cy="17" r="9" fill={skin} />
        {/* hair */}
        <Path d="M11 16 C11 9 15 6 20 6 C25 6 29 9 29 16 C29 12 25 11 20 11 C15 11 11 12 11 16 Z" fill={hair} />
      </Svg>
    </View>
  );
}

// A compact identity row: avatar, name, level and title. Used in the feed
// header, friend lists and anywhere a person needs introducing.
export function HunterIdentity({ profile, size = 36, showTitle, right }) {
  if (!profile) return null;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
      <HunterAvatar avatar={profile.avatar} character={profile.character} size={size} />
      <View style={{ marginLeft: 10, flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ fontSize: 15, fontWeight: '600', color: C.text }} numberOfLines={1}>
            {profile.displayName || profile.display_name || profile.username || 'Player'}
          </Text>
          {profile.level ? (
            <Text style={{
              fontSize: 12, fontWeight: '600', color: C.gold, marginLeft: 7,
              fontVariant: ['tabular-nums'],
            }}>
              LV {profile.level}
            </Text>
          ) : null}
        </View>
        {showTitle && profile.username ? (
          <Text style={{ fontSize: 12, color: C.dim, marginTop: 1 }} numberOfLines={1}>
            @{profile.username}
          </Text>
        ) : null}
      </View>
      {right}
    </View>
  );
}

export default HunterAvatar;
