// LEVL — LoadoutCard
//
// The "show off your build" surface. Two players can now see exactly HOW the
// other one has customised their hunter: the four cosmetic slots by name and
// rarity, plus the four colour choices as swatches.
//
// Why this exists: everything needed was already syncing. `profiles.avatar`
// carries the colour picks and `profiles.character.equipped` carries the
// cosmetic slots — but nothing in the UI ever read `character`, so a friend's
// build was invisible even though it was in the database. This reads it.
//
// Pure presentation: no engine writes, no rank/stat effect. Cosmetics stay
// cosmetic (the no-pay-to-win rule is untouched).

import React from 'react';
import { View } from 'react-native';
import { Text } from './Text';
import { C, s, RADIUS, T } from '../theme';
import { HunterFigure, MiniHunter } from './Hunter';
import {
  SKINS, HAIRS, OUTFITS, ACCENTS, TIERS, RARITY, STAT_META,
  cosmeticById, rankStyleFor, titleById,
} from '../engine/engine';

const pal = (arr, i) => arr[(i || 0) % arr.length];

// Slots shown, in the order they read on the body: head down, then FX.
const SLOTS = [
  ['helm', 'HELM'],
  ['weapon', 'WEAPON'],
  ['back', 'BACK'],
  ['aura', 'AURA'],
];

// A profile row's rank name -> the tier object rankStyleFor expects.
export function tierByName(name) {
  return TIERS.find((t) => t.name === name) || TIERS[0];
}

// Fill in any missing slot so an older profile row (or a duel bot) still renders
// a complete, valid loadout instead of blank rows.
export function normalizeEquipped(eq) {
  const e = eq || {};
  return {
    helm: e.helm || 'helm_none',
    back: e.back || 'back_none',
    weapon: e.weapon || 'weapon_blade',
    aura: e.aura || 'aura_ring',
    emote: e.emote || 'emote_flex',
  };
}

/* --------------------------- gear + colour rows --------------------------- */

function GearRow({ equipped }) {
  const eq = normalizeEquipped(equipped);
  return (
    <View style={{ marginTop: 10 }}>
      {SLOTS.map(([slot, label]) => {
        const item = cosmeticById(eq[slot]);
        const rarity = RARITY[item.rarity] || RARITY.common;
        return (
          <View
            key={slot}
            style={[s.row, {
              alignItems: 'center',
              paddingVertical: 8,
              paddingHorizontal: 10,
              marginBottom: 6,
              borderRadius: RADIUS.md,
              backgroundColor: C.panel2,
              borderWidth: 1,
              borderColor: C.line,
              borderLeftWidth: 3,
              borderLeftColor: rarity.color,
            }]}>
            <Text style={{ fontSize: 16 }}>{item.emoji}</Text>
            <View style={{ flex: 1, marginLeft: 9 }}>
              <Text style={{ ...T.micro, fontWeight: '800', color: C.dim, letterSpacing: 1 }}>{label}</Text>
              <Text style={{ ...T.footnote, fontWeight: '800', color: C.text, marginTop: 1 }} numberOfLines={1}>
                {item.name}
              </Text>
            </View>
            <Text style={{ ...T.micro, fontWeight: '900', color: rarity.color, letterSpacing: 0.8 }}>
              {rarity.name.toUpperCase()}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

// Two swatches per row, not four.
//
// This was one row of four, and the labels broke mid-word: ColourRow only ever
// renders inside a half-width CompareColumn, so four flex cells are ~40pt each
// on a 402pt phone (~36pt on an SE), while "ARMOUR" measures 45pt at the 8.5pt
// it used to be set in. "ARMOUR" and "ENERGY" wrapped to "ARMOU"+"R" and
// "ENERG"+"Y", and overflowed into each other on the way.
//
// Type could not fix that. Dropping the letterSpacing still leaves ARMOUR at
// 41pt against a 40pt cell, and shrinking further was already below the scale's
// 10pt floor. adjustsFontSizeToFit would have sized each of the four labels
// differently, which is worse than the wrap. So the layout gives way instead:
// two per row is ~79pt a cell, which fits the longest label with 29pt spare
// (24pt on an SE) and lets these labels sit on T.micro like everything else.
function ColourRow({ avatar }) {
  const av = avatar || {};
  const dots = [
    ['Skin', pal(SKINS, av.skin)],
    ['Trim', pal(HAIRS, av.hair)],
    ['Armour', pal(OUTFITS, av.outfit)],
    ['Energy', pal(ACCENTS, av.accent)],
  ];
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 10, marginTop: 8 }}>
      {dots.map(([label, color]) => (
        <View key={label} style={{ width: '50%', alignItems: 'center' }}>
          <View style={{
            width: 26, height: 26, borderRadius: 13, backgroundColor: color,
            borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.18)',
          }} />
          {/* Belt and braces: at an accessibility text size this truncates
              rather than going back to breaking the word in half. */}
          <Text
            style={{ ...T.micro, fontWeight: '800', color: C.dim, marginTop: 4 }}
            numberOfLines={1}>
            {label.toUpperCase()}
          </Text>
        </View>
      ))}
    </View>
  );
}

/* --------------------------- compact stat readout -------------------------- */
// A friend's six stats in plain language. The levels ride inside the synced
// `character.stats` map; if a friend is on an older build that key is absent and
// we say so rather than inventing numbers.
const STAT_ORDER = ['STR', 'PWR', 'END', 'VIT', 'MOB', 'DIS'];

function StatReadout({ stats }) {
  const have = stats && Object.keys(stats).length > 0;
  if (!have) {
    return (
      <Text style={{ ...T.caption, color: C.dim, marginTop: 8, fontWeight: '600', lineHeight: 18 }}>
        Their stat breakdown appears once they open the latest version of LEVL.
      </Text>
    );
  }
  return (
    <View style={{ marginTop: 6 }}>
      {STAT_ORDER.map((key) => {
        const meta = STAT_META[key];
        const level = stats[key] || 0;
        return (
          <View key={key} style={[s.row, {
            alignItems: 'center', paddingVertical: 9,
            borderBottomWidth: 1, borderBottomColor: C.line,
          }]}>
            <View style={{
              width: 44, height: 44, borderRadius: 11, marginRight: 11,
              backgroundColor: meta.color + '1e', borderWidth: 1, borderColor: meta.color + '44',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Text style={{ ...T.subheadline, fontWeight: '900', color: meta.color }}>{key}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <View style={s.between}>
                <Text style={{ fontSize: 18, fontWeight: '800', color: C.text, letterSpacing: -0.3 }}>{meta.name}</Text>
                <Text style={{ fontSize: 21, fontWeight: '900', color: meta.color }}>{level}</Text>
              </View>
              <Text style={{ ...T.caption, color: C.dim, marginTop: 1, fontWeight: '600' }}>{meta.desc}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

/* ----------------------------- friend showcase ---------------------------- */
// Deliberately small and plain: a portrait-sized hunter (no aura FX, no ground
// ring — they crowd the character at this scale), the four things they're
// wearing, and what their stats actually mean. Nothing else.
// Memoised: this renders the full vector HunterFigure, which is the most
// expensive tree in the app outside the Hunter tab itself. Callers that pass
// stable props (see FriendProfileBody) then get it mounted once per profile
// rather than rebuilt on every state change around it.
export const HunterShowcase = React.memo(function HunterShowcase({ avatar, equipped, rank, name, title, level, stats, username, height }) {
  const rs = rankStyleFor(tierByName(rank));
  const tier = tierByName(rank);
  const t = title ? titleById(title) : null;
  // The figure's own glow follows their real stat levels when we have them.
  const levels = STAT_ORDER.map((stat) => ({ stat, level: (stats && stats[stat]) || 10 }));

  return (
    <View>
      <View style={[s.row, { alignItems: 'center' }]}>
        {/* small hunter portrait */}
        <View style={{
          width: 124, height: height || 170, borderRadius: RADIUS.md,
          backgroundColor: C.bg, borderWidth: 1, borderColor: C.line,
          overflow: 'hidden', alignItems: 'center', justifyContent: 'flex-end',
        }}>
          <HunterFigure
            statLevels={levels}
            avatar={avatar || {}}
            equipped={normalizeEquipped(equipped)}
            rankStyle={rs}
            height={height || 170}
            compact
          />
        </View>

        {/* who they are */}
        <View style={{ flex: 1, marginLeft: 14 }}>
          <Text style={{ fontSize: 21, fontWeight: '800', color: C.text, letterSpacing: -0.4 }} numberOfLines={1}>{name}</Text>
          {username ? (
            <Text style={{ ...T.caption, color: C.dim, marginTop: 1, fontWeight: '600' }} numberOfLines={1}>@{username}</Text>
          ) : null}
          {t ? (
            <Text style={{ ...T.caption, fontWeight: '800', color: C.purp, marginTop: 2 }} numberOfLines={1}>"{t.name}"</Text>
          ) : null}
          <View style={{
            marginTop: 8, alignSelf: 'flex-start',
            paddingHorizontal: 11, paddingVertical: 5, borderRadius: RADIUS.pill,
            backgroundColor: tier.color + '22', borderWidth: 1, borderColor: tier.color,
          }}>
            <Text style={{ ...T.caption2, fontWeight: '800', color: tier.color, letterSpacing: 0.5 }}>
              {level ? 'LV ' + level + ' · ' : ''}{rank || 'Bronze'}
            </Text>
          </View>
          <Text style={{ ...T.caption2, color: C.dim, marginTop: 7, fontWeight: '600' }}>
            {rs.label} armour
          </Text>
        </View>
      </View>

      <Text style={[s.label, { marginTop: 16 }]}>Wearing</Text>
      <GearRow equipped={equipped} />

      <Text style={[s.label, { marginTop: 14 }]}>Their Stats</Text>
      <StatReadout stats={stats} />
    </View>
  );
});

/* -------------------------- side-by-side compare -------------------------- */
// The duel version: two builds next to each other so both players can see what
// they are up against. Compact — emblem, name, gear list, colours.
function CompareColumn({ avatar, equipped, name, tint, label }) {
  const eq = normalizeEquipped(equipped);
  return (
    <View style={{ flex: 1 }}>
      <View style={{ alignItems: 'center' }}>
        <MiniHunter avatar={avatar || {}} tierColor={tint} size={52} />
        <Text style={{ ...T.micro, fontWeight: '900', color: C.dim, letterSpacing: 1, marginTop: 6 }}>{label}</Text>
        <Text style={{ ...T.footnote, fontWeight: '800', color: tint, marginTop: 1 }} numberOfLines={1}>{name}</Text>
      </View>
      <View style={{ marginTop: 10 }}>
        {SLOTS.map(([slot, slotLabel]) => {
          const item = cosmeticById(eq[slot]);
          const rarity = RARITY[item.rarity] || RARITY.common;
          return (
            <View key={slot} style={{
              paddingVertical: 6, paddingHorizontal: 8, marginBottom: 5,
              borderRadius: RADIUS.sm, backgroundColor: C.panel2,
              borderWidth: 1, borderColor: C.line, borderLeftWidth: 3, borderLeftColor: rarity.color,
            }}>
              <Text style={{ ...T.micro, fontWeight: '800', color: C.dim, letterSpacing: 0.8 }}>{slotLabel}</Text>
              <Text style={{ ...T.caption2, fontWeight: '800', color: C.text, marginTop: 1 }} numberOfLines={1}>
                {item.emoji} {item.name}
              </Text>
            </View>
          );
        })}
      </View>
      <ColourRow avatar={avatar} />
    </View>
  );
}

export function LoadoutCompare({ you, them }) {
  return (
    <View style={[s.row, { alignItems: 'flex-start' }]}>
      <CompareColumn
        avatar={you.avatar} equipped={you.equipped} name={you.name}
        tint={you.color || C.gold} label="YOUR BUILD"
      />
      <View style={{ width: 1, backgroundColor: C.line, alignSelf: 'stretch', marginHorizontal: 12 }} />
      <CompareColumn
        avatar={them.avatar} equipped={them.equipped} name={them.name}
        tint={them.color || C.red} label="THEIR BUILD"
      />
    </View>
  );
}

export default HunterShowcase;
