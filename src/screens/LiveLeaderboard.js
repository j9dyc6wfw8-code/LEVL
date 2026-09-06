// LEVL — LiveLeaderboard: real-player rankings.
//
// Two boards, because "best" means two different things and one list can't say
// both: STRONGEST (heaviest estimated 1RM, normalised to kg so kg and lb users
// rank fairly) and MOST CONSISTENT (who actually keeps showing up).
//
// WHAT CHANGED
// This screen used to stack two identical full-width pill toggles — scope, then
// board — underneath CompeteTab's segmented control. Three controls of the same
// visual weight, none obviously primary, before a single row of data.
//
// Now the BOARD is the primary choice and gets the full-width control; SCOPE is
// a compact switch sitting on the blurb line, because global-vs-friends is a
// filter on the chosen board rather than a peer decision. Same two choices, one
// less row, and an obvious hierarchy.
import React from 'react';
import { View, Pressable } from 'react-native';
import { Text } from '../components/Text';
import { C, alpha, T, RADIUS, SPACING } from '../theme';
import { Card, EmptyState, Segmented } from '../components/ui';
import { isConfigured } from '../services/supabase/client';
import { MiniHunter } from '../components/Hunter';
import { DEFAULT_DATA } from '../engine/engine';

const BOARDS = [
  { key: 'best_e1rm',   label: 'Strongest',       blurb: 'Heaviest lift on the platform' },
  { key: 'consistency', label: 'Most consistent', blurb: 'Days trained in the last 28' },
];

/* This screen's board control WAS this pattern's best implementation; it now
   lives in the design system as Segmented, and every other screen uses it too. */
const BoardControl = ({ options, value, onChange }) => (
  <Segmented options={options} value={value} onChange={onChange} />
);

/* Secondary: small, outlined, sits inline. Deliberately NOT gold-filled — it
   must not compete with the board control above it. */
function ScopeSwitch({ value, onChange }) {
  return (
    <View style={{ flexDirection: 'row', borderRadius: RADIUS.pill, borderWidth: 1, borderColor: C.line, overflow: 'hidden' }}>
      {[['global', 'Global'], ['friends', 'Friends']].map(([k, label]) => {
        const on = value === k;
        return (
          <Pressable key={k} onPress={() => onChange(k)}
            accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={label}
            hitSlop={6}
            style={{
              paddingHorizontal: 12, paddingVertical: 5,
              backgroundColor: on ? alpha(C.gold, 0.16) : 'transparent',
            }}>
            <Text style={{ ...T.caption2, fontWeight: '700', color: on ? C.gold : C.dim }}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// Each metric needs its own formatting — a percentage, a weight and a raw count
// all read wrong if printed the same way.
function formatMetric(row, metric) {
  const v = row[metric] != null ? row[metric] : 0;
  if (metric === 'consistency') return v + '%';
  if (metric === 'best_e1rm') return (Math.round(v * 10) / 10) + ' kg';
  if (metric === 'streak' || metric === 'longest_streak') return v + 'd';
  return Number(v).toLocaleString();
}

// A secondary line that explains the number, so a board is self-describing.
function subline(row, metric) {
  if (metric === 'best_e1rm') return row.best_lift_name || 'No lift recorded';
  if (metric === 'consistency') {
    const days = Math.round(((row.consistency || 0) / 100) * 28);
    return days + ' of the last 28 days';
  }
  if (metric === 'streak') return 'Best ' + (row.longest_streak || row.streak || 0) + 'd';
  return 'Lv ' + row.level + ' · ' + row.rank;
}

function Row({ row, metric, highlight }) {
  const medal = row.position === 1 ? C.gold : row.position === 2 ? '#c3ccdb' : row.position === 3 ? '#cd7f4a' : null;
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', paddingVertical: 9, paddingHorizontal: 10,
      borderRadius: RADIUS.md, marginTop: 4,
      backgroundColor: highlight ? alpha(C.gold, 0.10) : 'transparent',
      borderWidth: highlight ? 1 : 0, borderColor: C.gold,
    }}>
      <View style={{ width: 28, alignItems: 'center' }}>
        <Text style={{ ...T.footnote, fontWeight: '800', ...T.numeric, color: medal || C.dim }}>{row.position}</Text>
      </View>
      <View style={{
        width: 34, height: 34, borderRadius: 17, backgroundColor: C.panel3, marginLeft: 4,
        alignItems: 'center', justifyContent: 'center',
        borderWidth: 1, borderColor: medal || C.line, overflow: 'hidden',
      }}>
        {row.avatar && Object.keys(row.avatar).length > 0 ? (
          <MiniHunter avatar={{ ...DEFAULT_DATA.avatar, ...row.avatar }} tierColor={medal || C.gold} size={29} />
        ) : (
          <Text style={{ color: medal || C.gold, fontWeight: '800' }}>
            {((row.display_name || row.username || '?').charAt(0)).toUpperCase()}
          </Text>
        )}
      </View>
      <View style={{ flex: 1, marginLeft: 10 }}>
        <Text style={{ ...T.subheadline, color: C.text, fontWeight: highlight ? '800' : '700' }} numberOfLines={1}>
          {highlight ? 'You' : (row.display_name || row.username)}
        </Text>
        <Text style={{ ...T.caption2, color: C.dim }} numberOfLines={1}>{subline(row, metric)}</Text>
      </View>
      <Text style={{ ...T.subheadline, color: C.gold, fontWeight: '800', ...T.numeric }}>
        {formatMetric(row, metric)}
      </Text>
    </View>
  );
}

export default function LiveLeaderboard({ lb }) {
  if (!isConfigured) {
    return <EmptyState title="Leaderboards need an account" body="Sign in to see how you rank against everyone else." />;
  }

  const board = BOARDS.find((b) => b.key === lb.metric) || BOARDS[0];
  const mine = lb.rows.find((r) => r.isMe);

  return (
    <View>
      <BoardControl options={BOARDS.map((b) => [b.key, b.label])} value={board.key} onChange={lb.setMetric} />

      {/* blurb + scope share one line: the board explains itself and the filter
          sits where a filter belongs, not as a second identical control */}
      <View style={{
        flexDirection: 'row', alignItems: 'center',
        marginTop: 10, marginBottom: SPACING.md,
      }}>
        <Text style={{ ...T.caption, color: C.dim, flex: 1 }} numberOfLines={1}>
          {board.blurb}
        </Text>
        <ScopeSwitch value={lb.scope} onChange={lb.setScope} />
      </View>

      <Card>
        {lb.loading && lb.rows.length === 0 ? (
          <Text style={{ ...T.footnote, color: C.dim, textAlign: 'center', paddingVertical: 20 }}>Loading rankings…</Text>
        ) : lb.rows.length === 0 ? (
          <Text style={{ ...T.footnote, color: C.dim, textAlign: 'center', paddingVertical: 20 }}>
            {lb.scope === 'friends' ? 'Add friends to see a friends leaderboard.' : 'No ranked players yet — be the first.'}
          </Text>
        ) : (
          <View>
            {lb.rows.map((r) => (
              <Row key={r.id} row={r} metric={lb.metric} highlight={r.isMe} />
            ))}
            {!mine ? (
              <Text style={{ ...T.caption2, color: C.dim, textAlign: 'center', marginTop: 12 }}>
                Keep training to climb onto this board.
              </Text>
            ) : null}
          </View>
        )}
      </Card>
    </View>
  );
}
