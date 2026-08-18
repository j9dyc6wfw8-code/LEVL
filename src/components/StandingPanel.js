// ============================================================================
// LEVL — StandingPanel
//
// The answer to "where do I stand?", rendered on every Compete view.
//
// Two things were wrong before:
//   1. The standing card lived inside RanksTab, so on the Duels view — the
//      screen where you decide whether to pick a fight — your rank was
//      invisible. CompeteTab's header comment claimed otherwise.
//   2. Fitness Rating was a bare number. The engine already computes WHY it is
//      what it is (computeDerived -> frParts) and nothing ever displayed it, so
//      the single most actionable thing the app knows was discarded every frame.
//
// The breakdown is not decoration. FR = 4200 x (0.35 consistency + 0.25 trend +
// 0.25 PRs + 0.15 balance), so a player can see which term is costing them and
// what training would move it. That is the difference between a score and a
// scoreboard.
// ============================================================================
import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { C, alpha, T, RADIUS, SPACING } from '../theme';
import { TierCrest } from './TierCrest';
import { TIERS } from '../engine/engine';

/* The FR formula, mirrored for display only. Kept adjacent to the weights so a
   change in the engine is obvious here — if these drift, the bars lie. */
const FR_MAX = 4200;
const PARTS = [
  { key: 'consistency', label: 'Consistency', weight: 0.35, hint: 'Days trained in the last 28' },
  { key: 'trend',       label: 'Trend',       weight: 0.25, hint: 'Volume vs the previous block' },
  { key: 'prScore',     label: 'Personal records', weight: 0.25, hint: 'PRs in the last 28 days' },
  { key: 'balance',     label: 'Balance',     weight: 0.15, hint: 'Spread across the six stats' },
];

function Meter({ pct, color, height = 6 }) {
  return (
    <View style={{ height, borderRadius: height, backgroundColor: C.sunken, overflow: 'hidden' }}>
      <View style={{ width: Math.max(1.5, Math.min(100, pct)) + '%', height, borderRadius: height, backgroundColor: color }} />
    </View>
  );
}

function PartRow({ part, value, color }) {
  const pct = Math.max(0, Math.min(1, value || 0)) * 100;
  const contribution = Math.round(FR_MAX * part.weight * Math.max(0, Math.min(1, value || 0)));
  const ceiling = Math.round(FR_MAX * part.weight);
  return (
    <View style={{ marginTop: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', marginBottom: 4 }}>
        <Text style={{ ...T.caption, color: C.mut, flex: 1 }} numberOfLines={1}>
          {part.label}
        </Text>
        <Text style={{ ...T.caption2, color: C.faint, ...T.numeric, marginRight: 8 }}>
          {Math.round(part.weight * 100)}% weight
        </Text>
        <Text style={{ ...T.caption, color, ...T.numeric, fontWeight: '700' }}>
          {contribution}
          <Text style={{ color: C.faint, fontWeight: '600' }}>/{ceiling}</Text>
        </Text>
      </View>
      <Meter pct={pct} color={color} />
    </View>
  );
}

export default function StandingPanel({ dv, rank, fieldSize, detail, onToggleDetail }) {
  if (!dv) return null;

  // Unplaced: nothing to rank yet, so say exactly what unlocks it.
  if (!dv.placed) {
    const left = Math.max(0, 5 - (dv.placementCount || 0));
    return (
      <View style={{
        backgroundColor: C.panel, borderRadius: RADIUS.lg, padding: SPACING.lg,
        borderWidth: 1, borderColor: C.line, marginBottom: SPACING.md,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TierCrest tier={TIERS[0]} size={44} dim />
          <View style={{ flex: 1, marginLeft: 14 }}>
            <Text style={{ ...T.title3, color: C.text }}>Ladder locked</Text>
            <Text style={{ ...T.footnote, color: C.mut, marginTop: 2 }}>
              {left} more training day{left === 1 ? '' : 's'} to earn your placement.
            </Text>
          </View>
        </View>
        <View style={{ marginTop: 14 }}>
          <Meter pct={((dv.placementCount || 0) / 5) * 100} color={C.gold} height={8} />
        </View>
      </View>
    );
  }

  const tier = dv.tier;
  const idx = TIERS.findIndex((t) => t.name === tier.name);
  const next = idx >= 0 && idx < TIERS.length - 1 ? TIERS[idx + 1] : null;
  const pct = next
    ? Math.max(0, Math.min(100, ((dv.fr - tier.min) / (next.min - tier.min)) * 100))
    : 100;
  const parts = dv.frParts || {};

  return (
    <View style={{
      backgroundColor: C.panel, borderRadius: RADIUS.lg, padding: SPACING.lg,
      borderWidth: 1, borderColor: alpha(tier.color, 0.34), marginBottom: SPACING.md,
    }}>
      {/* ---- identity row ---- */}
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <TierCrest tier={tier} size={54} />
        <View style={{ flex: 1, marginLeft: 14 }}>
          <Text style={{ ...T.title2, color: tier.color, letterSpacing: 0.3 }}>
            {tier.name}{dv.division || ''}
          </Text>
          <Text style={{ ...T.caption, color: C.dim, marginTop: 1 }} numberOfLines={1}>
            {dv.season ? dv.season + ' · ' : ''}Lv {dv.level} · {dv.title}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ ...T.title1, color: C.text, ...T.numeric, letterSpacing: -0.5 }}>
            {dv.fr.toLocaleString()}
          </Text>
          <Text style={{ ...T.caption2, color: C.dim, letterSpacing: 1.2 }}>FITNESS RATING</Text>
        </View>
      </View>

      {/* ---- progress to the next tier ---- */}
      <View style={{ marginTop: 14 }}>
        <Meter pct={pct} color={tier.color} height={8} />
        <View style={{ flexDirection: 'row', marginTop: 7, alignItems: 'center' }}>
          <Text style={{ ...T.footnote, color: C.mut, flex: 1 }}>
            {next
              ? <>
                  <Text style={{ color: tier.color, fontWeight: '700' }}>{(next.min - dv.fr).toLocaleString()} FR</Text>
                  {' to ' + next.name}
                </>
              : 'Top tier reached — hold your position.'}
          </Text>
          {rank != null ? (
            <Text style={{ ...T.footnote, color: C.mut, ...T.numeric }}>
              <Text style={{ color: C.text, fontWeight: '700' }}>#{rank}</Text>
              {fieldSize ? ' of ' + fieldSize : ''}
            </Text>
          ) : null}
        </View>
      </View>

      {/* ---- rank protection ----
          Fitness Rating is a 28-day rolling number, so a layoff drains all four
          of its terms. Rank protection holds you up while you are away — but a
          number that is being propped up and does not say so is exactly the
          kind of unexplained figure that makes people distrust an app. If the
          floor is doing the work, the card says so, and says for how long. */}
      {dv.frProtected ? (
        <View
          accessible
          accessibilityLabel={
            'Rank protected. Your rating is being held at '
            + dv.fr.toLocaleString() + ' for ' + dv.frProtectionDaysLeft
            + ' more days. Train to restore it.'
          }
          style={{
            marginTop: 12, padding: 10, borderRadius: RADIUS.md,
            backgroundColor: alpha(tier.color, 0.10),
            borderWidth: 1, borderColor: alpha(tier.color, 0.28),
          }}>
          <Text style={{ ...T.caption, color: tier.color, fontWeight: '700', letterSpacing: 0.3 }}>
            RANK PROTECTED · {dv.frProtectionDaysLeft} {dv.frProtectionDaysLeft === 1 ? 'DAY' : 'DAYS'} LEFT
          </Text>
          <Text style={{ ...T.caption, color: C.mut, marginTop: 3, lineHeight: 16 }}>
            You are being held at {tier.name} while you are away. Train to earn it back
            before the protection runs out.
          </Text>
        </View>
      ) : null}

      {/* ---- the breakdown: what the number is actually made of ---- */}
      <Pressable
        onPress={onToggleDetail}
        accessibilityRole="button"
        accessibilityLabel={detail ? 'Hide rating breakdown' : 'Show rating breakdown'}
        hitSlop={8}
        style={{
          marginTop: 14, paddingTop: 12,
          borderTopWidth: 1, borderTopColor: C.lineSoft,
          flexDirection: 'row', alignItems: 'center',
        }}>
        <Text style={{ ...T.label, color: C.dim, flex: 1 }}>What makes this number</Text>
        <Text style={{ ...T.caption, color: C.gold, fontWeight: '700' }}>
          {detail ? 'Hide' : 'Show'}
        </Text>
      </Pressable>

      {detail ? (
        <View style={{ marginTop: 2 }}>
          {PARTS.map((p) => (
            <PartRow key={p.key} part={p} value={parts[p.key]} color={tier.color} />
          ))}
          <Text style={{ ...T.caption2, color: C.faint, marginTop: 12, lineHeight: 15 }}>
            Level is how much you've trained. Rank is how you compare.
          </Text>
        </View>
      ) : null}
    </View>
  );
}
