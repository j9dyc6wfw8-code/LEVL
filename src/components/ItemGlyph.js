// ============================================================================
// LEVL — ItemGlyph
//
// Vector art for every cosmetic, replacing the emoji the Forge and Packs used
// to render at 26–84px.
//
// WHY EMOJI HAD TO GO
// Emoji are the single loudest "unfinished" signal in a premium dark UI: they
// carry their own palette (so nothing can be tinted by rarity), their own light
// direction, and they render differently on every OS version. A legendary drop
// revealed at 84px as 👑 undoes the anvil animation that preceded it.
//
// THE APPROACH
// Stroke-based, 24x24 viewBox, round caps and joins — deliberately the same
// idiom as TabIcon.js, so the Forge finally looks like it belongs to the same
// app as the tab bar. One glyph per cosmetic id, with a slot-level fallback so
// a new cosmetic never renders blank.
//
// Colour comes from the RARITY ladder, never from the glyph, which is the whole
// point: the same shape reads common or mythic purely by its frame.
// ============================================================================
import React from 'react';
import { View } from 'react-native';
import { Text } from './Text';
import Svg, { Path, Circle, Line, Polyline, Rect, Ellipse, G } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { C, alpha, RADIUS, T } from '../theme';
import { RARITY } from '../engine/engine';

/* ------------------------------------------------------------- the glyphs -- */
/* Each is a function of the stroke props so weight stays consistent. */
const GLYPHS = {
  /* ---- headgear ---- */
  helm_none: (p) => <><Circle cx="12" cy="12" r="8" {...p} strokeDasharray="3 3" /><Line x1="7" y1="17" x2="17" y2="7" {...p} /></>,
  helm_hood: (p) => <><Path d="M12 3 C7 3 4.5 7 4.5 12 V19 H8 V13 C8 10 9.6 8 12 8 C14.4 8 16 10 16 13 V19 H19.5 V12 C19.5 7 17 3 12 3 Z" {...p} /></>,
  helm_visor: (p) => <><Path d="M4 9.5 C4 6.5 7.5 5 12 5 C16.5 5 20 6.5 20 9.5 V13 C20 15 18 16.5 15 16.5 H9 C6 16.5 4 15 4 13 Z" {...p} /><Line x1="6.5" y1="11.5" x2="17.5" y2="11.5" {...p} /></>,
  helm_horns: (p) => <><Path d="M6 20 V13 C6 9 8.7 6.5 12 6.5 C15.3 6.5 18 9 18 13 V20" {...p} /><Path d="M6 13 C3 12 2 9 2.8 5.6 C5 6.6 6.4 8.4 6.8 10.6" {...p} /><Path d="M18 13 C21 12 22 9 21.2 5.6 C19 6.6 17.6 8.4 17.2 10.6" {...p} /></>,
  helm_crown: (p) => <><Path d="M3.5 18 L5 8 L9 12 L12 5 L15 12 L19 8 L20.5 18 Z" {...p} /><Line x1="3.5" y1="20.5" x2="20.5" y2="20.5" {...p} /></>,
  helm_wraith: (p) => <><Path d="M12 3 C7 3 4 6.6 4 11.5 C4 14.6 5.6 16.8 7.4 18.2 L8 21 H16 L16.6 18.2 C18.4 16.8 20 14.6 20 11.5 C20 6.6 17 3 12 3 Z" {...p} /><Path d="M8.6 11.5 C8.6 10.2 9.4 9.4 10.2 9.4 M15.4 11.5 C15.4 10.2 14.6 9.4 13.8 9.4" {...p} /><Line x1="10" y1="15.5" x2="14" y2="15.5" {...p} /></>,

  /* ---- back gear ---- */
  back_none: (p) => <><Rect x="6" y="6" width="12" height="12" rx="3" {...p} strokeDasharray="3 3" /><Line x1="8" y1="16" x2="16" y2="8" {...p} /></>,
  back_wings: (p) => <><Path d="M12 5 V19" {...p} /><Path d="M12 7 C8.5 5.5 5 6 2.5 9 C5 10 6.5 12.4 7 15 C9 13.4 10.7 12.4 12 12" {...p} /><Path d="M12 7 C15.5 5.5 19 6 21.5 9 C19 10 17.5 12.4 17 15 C15 13.4 13.3 12.4 12 12" {...p} /></>,
  back_pack: (p) => <><Rect x="5.5" y="7" width="13" height="13" rx="3" {...p} /><Path d="M9 7 V5.5 A3 3 0 0 1 15 5.5 V7" {...p} /><Line x1="5.5" y1="13" x2="18.5" y2="13" {...p} /></>,
  back_reactor: (p) => <><Circle cx="12" cy="12" r="4" {...p} /><Circle cx="12" cy="12" r="8.5" {...p} /><Line x1="12" y1="3.5" x2="12" y2="7.5" {...p} /><Line x1="12" y1="16.5" x2="12" y2="20.5" {...p} /><Line x1="3.5" y1="12" x2="7.5" y2="12" {...p} /><Line x1="16.5" y1="12" x2="20.5" y2="12" {...p} /></>,
  back_dragon: (p) => <><Path d="M4 18 C6.5 15 6 11 9 9 C11.4 7.4 14 8 15.6 6 C16.6 4.8 16.8 3.6 16.6 2.6 C19.4 4 20.6 7 20 10 C19.2 14 15.4 15.6 12.6 16 C10 16.4 8 17 6.6 19" {...p} /><Path d="M9.5 9.5 L13 11" {...p} /><Circle cx="17.6" cy="6.4" r="0.9" fill={p.stroke} stroke="none" /></>,

  /* ---- weapons ---- */
  weapon_blade: (p) => <><Path d="M6 18 L16.5 4.5 L18.5 6.5 L9 18 Z" {...p} /><Line x1="5" y1="19" x2="9" y2="19" {...p} /><Line x1="4.5" y1="17" x2="6.5" y2="20.5" {...p} /></>,
  weapon_axe: (p) => <><Line x1="8" y1="20" x2="15" y2="5" {...p} /><Path d="M13.5 4 C17 3 20.5 5 21 9 C18 9.5 15.6 8.6 14 6.6" {...p} /><Path d="M11.8 8.6 C9 9.6 7.4 11.6 7 14.6 C10.6 14.6 13 13 14.2 10.6" {...p} /></>,
  weapon_scythe: (p) => <><Line x1="7" y1="21" x2="15.5" y2="4" {...p} /><Path d="M15.5 4 C19 5.4 21 8.4 21 12 C17 11.4 14.2 9.4 12.6 6.4" {...p} /></>,
  weapon_hammer: (p) => <><Line x1="9.5" y1="21" x2="14" y2="10" {...p} /><Path d="M9 6.4 L18.6 2.6 L21 8 L11.4 11.8 Z" {...p} /></>,
  weapon_glaive: (p) => <><Line x1="5.5" y1="21" x2="13" y2="7" {...p} /><Path d="M13 7 C16.6 6.4 19.6 8 21 11.4 C17.6 12.4 14.8 11.6 12.6 9.4" {...p} /><Polyline points="8,14.5 10.5,14 9,16.5 11.5,16" {...p} /></>,

  /* ---- auras ---- */
  aura_ring: (p) => <><Ellipse cx="12" cy="14" rx="8.5" ry="4" {...p} /><Ellipse cx="12" cy="11" rx="5.5" ry="2.6" {...p} strokeOpacity="0.6" /></>,
  aura_flames: (p) => <><Path d="M12 21 C8 21 5.5 18.4 5.5 15 C5.5 11 9 9 10.5 4 C11.6 6.6 13 7.6 14.6 9.4 C16.6 11.6 18.5 13 18.5 15 C18.5 18.4 16 21 12 21 Z" {...p} /><Path d="M12 21 C10.2 21 9 19.6 9 18 C9 16.2 10.6 15.4 11.2 13 C12.4 14.6 15 16 15 18 C15 19.6 13.8 21 12 21 Z" {...p} strokeOpacity="0.65" /></>,
  aura_frost: (p) => <><Line x1="12" y1="2.5" x2="12" y2="21.5" {...p} /><Line x1="3.8" y1="7.2" x2="20.2" y2="16.8" {...p} /><Line x1="20.2" y1="7.2" x2="3.8" y2="16.8" {...p} /><Polyline points="9.6,4.8 12,6.6 14.4,4.8" {...p} /><Polyline points="9.6,19.2 12,17.4 14.4,19.2" {...p} /></>,
  aura_galaxy: (p) => <><Ellipse cx="12" cy="12" rx="9" ry="3.6" {...p} transform="rotate(-22 12 12)" /><Ellipse cx="12" cy="12" rx="9" ry="3.6" {...p} transform="rotate(22 12 12)" strokeOpacity="0.6" /><Circle cx="12" cy="12" r="2" fill={p.stroke} stroke="none" /></>,
  aura_inferno: (p) => <><Path d="M12 21.5 C7.4 21.5 4.5 18.6 4.5 14.8 C4.5 10 9 7.6 10.4 2 C11.8 5.4 13.4 6.6 15.4 8.8 C17.8 11.4 19.5 12.8 19.5 14.8 C19.5 18.6 16.6 21.5 12 21.5 Z" {...p} /><Path d="M12 21.5 C9.8 21.5 8.4 19.8 8.4 17.8 C8.4 15.4 10.6 14.4 11.2 11.4 C12.8 13.6 15.6 15.4 15.6 17.8 C15.6 19.8 14.2 21.5 12 21.5 Z" {...p} strokeOpacity="0.7" /><Path d="M3 9 C2 7.4 2.2 5.6 3.4 4.2 M21 9 C22 7.4 21.8 5.6 20.6 4.2" {...p} strokeOpacity="0.5" /></>,

  /* ---- emotes ---- */
  emote_flex: (p) => <><Circle cx="8" cy="5.5" r="2.5" {...p} /><Path d="M4 20 V14 C4 11.4 5.8 9.4 8.4 9.4 C11 9.4 12.4 10.6 13.6 12.4 C14.8 14.2 16.4 14.6 18 13.6" {...p} /><Path d="M18 13.6 C20 12.4 20.6 9.8 19.4 7.6" {...p} /></>,
  emote_wave: (p) => <><Circle cx="12" cy="5" r="2.6" {...p} /><Path d="M7.5 21 V14 C7.5 11 9.4 9.4 12 9.4 C14.6 9.4 16.5 11 16.5 14 V21" {...p} /><Path d="M16.5 12 L20 6.5" {...p} /><Path d="M18.6 4.6 C19.8 5.2 20.6 6.4 20.6 7.8" {...p} strokeOpacity="0.6" /></>,
  emote_dab: (p) => <><Circle cx="10.5" cy="5.5" r="2.5" {...p} /><Path d="M6 21 V14.5 C6 11.6 7.8 9.6 10.5 9.6 C12.6 9.6 14 10.6 14.8 12.2" {...p} /><Line x1="14.8" y1="12.2" x2="21" y2="8.5" {...p} /><Line x1="9.5" y1="12.5" x2="3.5" y2="10" {...p} /></>,
  emote_floss: (p) => <><Circle cx="12" cy="5" r="2.6" {...p} /><Path d="M12 8 V15" {...p} /><Path d="M12 15 L9 21 M12 15 L15 21" {...p} /><Path d="M12 10.5 L6.5 8 M12 10.5 L17.5 13" {...p} /></>,
};

/* Slot fallbacks so an unrecognised id never renders blank. */
const SLOT_FALLBACK = {
  helm: 'helm_hood', back: 'back_pack', weapon: 'weapon_blade',
  aura: 'aura_ring', emote: 'emote_wave',
};

export function ItemGlyph({ item, size = 28, color, strokeWidth }) {
  if (!item) return null;
  const draw = GLYPHS[item.id] || GLYPHS[SLOT_FALLBACK[item.slot]] || GLYPHS.weapon_blade;
  const p = {
    stroke: color || C.text,
    strokeWidth: strokeWidth || 1.7,
    fill: 'none',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {draw(p)}
    </Svg>
  );
}

/* ------------------------------------------------------------- the frame -- */
/**
 * The glyph in its rarity housing. Escalation is deliberate and monotonic:
 *   common    flat panel, hairline border
 *   rare      tinted gradient + coloured border
 *   epic      + corner ticks
 *   legendary + outer glow
 *   mythic    + double rim
 * so rarity is legible from the frame alone, before the colour registers.
 */
export function ItemTile({ item, size = 56, rarity, forgeLevel = 0, dim, style }) {
  if (!item) return null;
  const r = rarity || RARITY[item.rarity] || RARITY.common;
  const col = dim ? C.dim : r.color;
  const order = { common: 0, rare: 1, epic: 2, legendary: 3, mythic: 4 };
  const lvl = order[r.key || item.rarity] != null ? order[r.key || item.rarity] : 0;
  const radius = Math.round(size * 0.26);
  const tick = Math.max(6, Math.round(size * 0.16));

  return (
    <View style={[{ width: size, height: size }, style]}>
      <LinearGradient
        colors={lvl >= 1 ? [alpha(col, 0.30), alpha(col, 0.06)] : [C.panel2, C.panel]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={{
          width: size, height: size, borderRadius: radius,
          alignItems: 'center', justifyContent: 'center',
          borderWidth: lvl >= 4 ? 2 : 1.5,
          borderColor: lvl >= 1 ? alpha(col, 0.85) : C.line,
          // legendary and mythic throw light; lower rarities stay flat
          shadowColor: col,
          shadowOpacity: lvl >= 3 ? 0.55 : 0,
          shadowRadius: lvl >= 3 ? size * 0.28 : 0,
          shadowOffset: { width: 0, height: 0 },
          elevation: lvl >= 3 ? 6 : 0,
        }}>
        <ItemGlyph item={item} size={Math.round(size * 0.58)} color={dim ? C.dim : col} strokeWidth={1.7} />
      </LinearGradient>

      {/* epic+ corner ticks — reads as "framed" even in greyscale */}
      {lvl >= 2 ? (
        <>
          <View style={{ position: 'absolute', left: -1, top: -1, width: tick, height: 2, backgroundColor: col, borderRadius: 2 }} />
          <View style={{ position: 'absolute', left: -1, top: -1, width: 2, height: tick, backgroundColor: col, borderRadius: 2 }} />
          <View style={{ position: 'absolute', right: -1, bottom: -1, width: tick, height: 2, backgroundColor: col, borderRadius: 2 }} />
          <View style={{ position: 'absolute', right: -1, bottom: -1, width: 2, height: tick, backgroundColor: col, borderRadius: 2 }} />
        </>
      ) : null}

      {/* mythic double rim */}
      {lvl >= 4 ? (
        <View pointerEvents="none" style={{
          position: 'absolute', left: 3, top: 3, right: 3, bottom: 3,
          borderRadius: radius - 3, borderWidth: 1, borderColor: alpha(col, 0.5),
        }} />
      ) : null}

      {/* forge grade, if the piece has been worked */}
      {forgeLevel > 0 ? (
        <View style={{
          position: 'absolute', right: -3, bottom: -3,
          minWidth: 18, height: 18, paddingHorizontal: 4, borderRadius: 9,
          backgroundColor: C.bg, borderWidth: 1.5, borderColor: col,
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Text style={{ ...T.caption2, fontWeight: '800', color: col }}>+{forgeLevel}</Text>
        </View>
      ) : null}
    </View>
  );
}

/* ------------------------------------------------------ packs and rewards -- */
/* Packs escalate in construction, not just colour: a taped carton, a ribboned
   parcel, then a banded chest. You can tell an Elite from a Standard in
   silhouette at 20px, which is the whole job of a drop icon. */
const PACK_GLYPHS = {
  standard: (p) => <>
    <Path d="M12 3 L20 7 V16 L12 21 L4 16 V7 Z" {...p} />
    <Polyline points="4,7 12,11 20,7" {...p} />
    <Line x1="12" y1="11" x2="12" y2="21" {...p} />
  </>,
  prime: (p) => <>
    <Path d="M12 3 L20 7 V16 L12 21 L4 16 V7 Z" {...p} />
    <Polyline points="4,7 12,11 20,7" {...p} />
    <Line x1="12" y1="11" x2="12" y2="21" {...p} />
    <Path d="M12 11 L12 3" {...p} />
    <Path d="M9.4 4.6 C8 3.2 9 1.6 10.6 2.4 C11.6 2.9 12 3.9 12 5 C12 3.9 12.4 2.9 13.4 2.4 C15 1.6 16 3.2 14.6 4.6" {...p} />
  </>,
  elite: (p) => <>
    <Path d="M3.5 9.5 H20.5 V19 A1.5 1.5 0 0 1 19 20.5 H5 A1.5 1.5 0 0 1 3.5 19 Z" {...p} />
    <Path d="M3.5 9.5 C3.5 6 7.3 4 12 4 C16.7 4 20.5 6 20.5 9.5" {...p} />
    <Line x1="10" y1="9.5" x2="10" y2="20.5" {...p} />
    <Line x1="14" y1="9.5" x2="14" y2="20.5" {...p} />
    <Rect x="10.6" y="13" width="2.8" height="3.6" rx="1" {...p} />
  </>,
};

export function PackGlyph({ packKey, size = 40, color, strokeWidth }) {
  const draw = PACK_GLYPHS[packKey] || PACK_GLYPHS.standard;
  const p = {
    stroke: color || C.gold, strokeWidth: strokeWidth || 1.6, fill: 'none',
    strokeLinecap: 'round', strokeLinejoin: 'round',
  };
  return <Svg width={size} height={size} viewBox="0 0 24 24">{draw(p)}</Svg>;
}

/* Reward kinds a pack can contain: engine emits cosmetic, title, decoration,
   coins, material, lift and cardio. Each gets a shape, so the reveal never
   falls back to a generic box. */
const KIND_GLYPHS = {
  title: (p) => <>
    <Path d="M5 4 H19 V20 L12 15.6 L5 20 Z" {...p} />
    <Line x1="8.6" y1="9" x2="15.4" y2="9" {...p} />
  </>,
  decoration: (p) => <>
    <Rect x="3.5" y="3.5" width="17" height="17" rx="2.5" {...p} />
    <Rect x="7" y="7" width="10" height="10" rx="1.5" {...p} strokeOpacity="0.6" />
  </>,
  coins: (p) => <>
    <Ellipse cx="12" cy="7.5" rx="7" ry="3.2" {...p} />
    <Path d="M5 7.5 V12 C5 13.8 8.1 15.2 12 15.2 C15.9 15.2 19 13.8 19 12 V7.5" {...p} />
    <Path d="M5 12 V16.5 C5 18.3 8.1 19.7 12 19.7 C15.9 19.7 19 18.3 19 16.5 V12" {...p} />
  </>,
  material: (p) => <>
    <Path d="M12 2.6 L20 8.2 L17 19.4 H7 L4 8.2 Z" {...p} />
    <Polyline points="4,8.2 12,11.4 20,8.2" {...p} strokeOpacity="0.6" />
    <Line x1="12" y1="11.4" x2="12" y2="19.4" {...p} strokeOpacity="0.6" />
  </>,
  lift: (p) => <>
    <Line x1="8" y1="12" x2="16" y2="12" {...p} />
    <Rect x="3.5" y="9" width="3" height="6" rx="1" {...p} />
    <Rect x="17.5" y="9" width="3" height="6" rx="1" {...p} />
    <Line x1="2.5" y1="10.5" x2="2.5" y2="13.5" {...p} />
    <Line x1="21.5" y1="10.5" x2="21.5" y2="13.5" {...p} />
  </>,
  cardio: (p) => <>
    <Polyline points="2.5,13 7,13 9.5,8 13,18 15.5,13 21.5,13" {...p} />
  </>,
};

export function RewardGlyph({ reward, size = 40, color, strokeWidth }) {
  if (!reward) return null;
  // a cosmetic reward carries the real item shape, not a generic "cosmetic" icon
  if (reward.kind === 'cosmetic' || reward.slot) {
    return <ItemGlyph item={{ id: reward.id, slot: reward.slot }} size={size} color={color} strokeWidth={strokeWidth} />;
  }
  const draw = KIND_GLYPHS[reward.kind] || KIND_GLYPHS.decoration;
  const p = {
    stroke: color || C.gold, strokeWidth: strokeWidth || 1.6, fill: 'none',
    strokeLinecap: 'round', strokeLinejoin: 'round',
  };
  return <Svg width={size} height={size} viewBox="0 0 24 24">{draw(p)}</Svg>;
}

export function LockGlyph({ size = 20, color }) {
  const p = { stroke: color || C.dim, strokeWidth: 1.8, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect x="5" y="10.5" width="14" height="10" rx="2.5" {...p} />
      <Path d="M8.5 10.5 V7.5 A3.5 3.5 0 0 1 15.5 7.5 V10.5" {...p} />
    </Svg>
  );
}

export default ItemGlyph;
