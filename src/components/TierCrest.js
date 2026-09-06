// ============================================================================
// LEVL — TierCrest
//
// Rank insignia for the seven tiers. Before this, a tier was a coloured word:
// "Gold" in #ffc933. That reads as a label, not a rank, and it gave the ladder
// no visual ceiling to climb toward.
//
// WHY ONE PARAMETRIC CREST AND NOT SEVEN DRAWINGS:
// Seven hand-drawn crests drift apart the moment anyone edits one, and they
// break if TIERS ever changes. Here a single shield escalates by tier index —
// chevrons, then a star, then wings, then a crown, then rays. The silhouette
// grows monotonically, so higher always looks like more, and adding an eighth
// tier needs no new art.
//
// Legibility is the constraint: these render at 34px in ladder rows and 84px in
// the standing panel. Detail that dissolves at 34px is worse than no detail, so
// ornament is added at the OUTLINE, never inside it.
// ============================================================================
import React from 'react';
import { View } from 'react-native';
import { Text } from './Text';
import Svg, { Path, Polygon, G, Circle } from 'react-native-svg';
import { C, alpha, T } from '../theme';
import { TIERS } from '../engine/engine';

const IDX = (tier) => Math.max(0, TIERS.findIndex((t) => t.name === tier.name));

// 5-point star, generated so it stays centred whatever radius we pick.
function starPoints(cx, cy, outer, inner) {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (Math.PI / 5) * i - Math.PI / 2;
    pts.push((cx + Math.cos(a) * r).toFixed(2) + ',' + (cy + Math.sin(a) * r).toFixed(2));
  }
  return pts.join(' ');
}

export function TierCrest({ tier, size = 44, dim }) {
  if (!tier) return null;
  const idx = IDX(tier);
  const col = dim ? C.dim : tier.color;
  const W = 64, H = 72;
  const sc = size / W;

  const shield = 'M32,4 L57,13.5 V34 C57,49.5 45.8,61.5 32,68 C18.2,61.5 7,49.5 7,34 V13.5 Z';

  return (
    <Svg width={size} height={size * (H / W)} viewBox={`0 0 ${W} ${H}`}>
      {/* rays — Grandmaster only, the visual ceiling of the ladder */}
      {idx >= 6 && (
        <G opacity={0.85}>
          {[...Array(12)].map((_, i) => {
            const a = (Math.PI * 2 * i) / 12 - Math.PI / 2;
            const x1 = 32 + Math.cos(a) * 27, y1 = 36 + Math.sin(a) * 30;
            const x2 = 32 + Math.cos(a) * 32, y2 = 36 + Math.sin(a) * 35;
            return <Path key={i} d={`M${x1},${y1} L${x2},${y2}`} stroke={col} strokeWidth={2} strokeLinecap="round" />;
          })}
        </G>
      )}

      {/* wings — Diamond and above */}
      {idx >= 4 && (
        <G opacity={0.9}>
          <Path d="M7,22 C1,25 -1,31 1,37 C3,32 5,29 7,28 Z" fill={alpha(col, 0.75)} />
          <Path d="M57,22 C63,25 65,31 63,37 C61,32 59,29 57,28 Z" fill={alpha(col, 0.75)} />
        </G>
      )}

      {/* crown — Champion and above */}
      {idx >= 5 && (
        <Path
          d="M14,10 L20,3 L26,9 L32,1 L38,9 L44,3 L50,10 Z"
          fill={alpha(col, 0.9)}
          stroke={col}
          strokeWidth={1.4}
          strokeLinejoin="round"
        />
      )}

      {/* the shield itself */}
      <Path d={shield} fill={alpha(col, 0.16)} stroke={col} strokeWidth={2.4} strokeLinejoin="round" />
      {/* rim light on the top edge — the cheapest way to make flat vector read as metal */}
      <Path d="M32,4 L57,13.5" stroke={alpha('#ffffff', 0.55)} strokeWidth={1.6} strokeLinecap="round" />
      <Path d="M32,4 L7,13.5" stroke={alpha('#ffffff', 0.28)} strokeWidth={1.4} strokeLinecap="round" />

      {/* inner bevel, Gold and above */}
      {idx >= 2 && (
        <Path
          d="M32,11 L50,18 V34 C50,45.5 41.8,54.5 32,59.5 C22.2,54.5 14,45.5 14,34 V18 Z"
          fill="none"
          stroke={alpha(col, 0.45)}
          strokeWidth={1.2}
        />
      )}

      {/* centre mark: chevrons for the low tiers, a star from Gold up */}
      {idx <= 1 ? (
        <G>
          {[...Array(idx + 1)].map((_, i) => (
            <Path
              key={i}
              d={`M21,${30 + i * 9} L32,${39 + i * 9} L43,${30 + i * 9}`}
              fill="none"
              stroke={col}
              strokeWidth={3.2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
        </G>
      ) : (
        <Polygon
          points={starPoints(32, 34, idx >= 5 ? 14 : 12, idx >= 5 ? 6 : 5.2)}
          fill={col}
          stroke={alpha('#000000', 0.25)}
          strokeWidth={0.8}
        />
      )}

      {/* Platinum+ gets a satellite pip either side — reads as "higher" at 34px */}
      {idx >= 3 && (
        <G>
          <Circle cx={20} cy={50} r={2.6} fill={alpha(col, 0.9)} />
          <Circle cx={44} cy={50} r={2.6} fill={alpha(col, 0.9)} />
        </G>
      )}
    </Svg>
  );
}

/**
 * Crest + tier name + division, the standard way a rank is written anywhere in
 * the app. Keeping it in one component means the ladder, the standing panel and
 * any future surface can never disagree about how a rank is spelled.
 */
export function TierBadge({ tier, division, size = 44, dim, stacked }) {
  if (!tier) return null;
  const col = dim ? C.dim : tier.color;
  return (
    <View style={{ flexDirection: stacked ? 'column' : 'row', alignItems: 'center' }}>
      <TierCrest tier={tier} size={size} dim={dim} />
      <View style={{ marginLeft: stacked ? 0 : 10, marginTop: stacked ? 6 : 0, alignItems: stacked ? 'center' : 'flex-start' }}>
        <Text style={{ ...T.headline, color: col, letterSpacing: 0.4 }}>
          {tier.name}{division || ''}
        </Text>
      </View>
    </View>
  );
}

export default TierCrest;
