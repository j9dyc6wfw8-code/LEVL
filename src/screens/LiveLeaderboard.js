// LEVL — LiveLeaderboard: real-player rankings.
//
// Two boards, because "best" means two different things and one list can't
// say both: STRENGTH (heaviest estimated 1RM, normalised to kg so kg and lb
// users rank fairly) and CONSISTENCY (who actually keeps showing up).
// Each board has its own metric options; scope (Global / Friends) is shared.

import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { C, TYPE, RADIUS, MONO } from '../theme';
import { Card, EmptyState } from '../components/ui';
import { isConfigured } from '../services/supabase/client';
import { MiniHunter } from '../components/Hunter';
import { DEFAULT_DATA } from '../engine/engine';

// board key -> metrics available inside it
const BOARDS = [
  { key: 'best_e1rm',   label: 'Strongest',   blurb: 'Heaviest lift on the platform' },
  { key: 'consistency', label: 'Most consistent', blurb: 'Days trained in the last 28' },
];

function Toggle({ options, value, onChange }) {
  return (
    <View style={{ flexDirection: 'row', backgroundColor: C.panel2, borderRadius: RADIUS.pill, padding: 4 }}>
      {options.map(([k, label]) => (
        <Pressable key={k} onPress={() => onChange(k)}
          accessibilityRole="tab" accessibilityState={{ selected: value === k }} accessibilityLabel={label}
          style={{
            flex: 1, minHeight: 38, borderRadius: RADIUS.pill, alignItems: 'center', justifyContent: 'center',
            backgroundColor: value === k ? C.goldSoft : 'transparent',
            borderWidth: 1, borderColor: value === k ? C.gold : 'transparent',
          }}>
          <Text style={{ ...TYPE.caption, fontWeight: '700', color: value === k ? C.gold : C.dim }}>{label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

// Each metric needs its own formatting — a percentage, a weight and a raw
// count all read wrong if printed the same way.
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
  const medal = row.position === 1 ? '#ffc933' : row.position === 2 ? '#c3ccdb' : row.position === 3 ? '#cd7f4a' : null;
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 12,
      borderRadius: RADIUS.md, marginTop: 6,
      backgroundColor: highlight ? C.goldSoft : 'transparent',
      borderWidth: highlight ? 1 : 0, borderColor: C.gold,
    }}>
      <View style={{ width: 30, alignItems: 'center' }}>
        <Text style={{ ...TYPE.body, fontWeight: '800', fontVariant: ['tabular-nums'], color: medal || C.dim }}>{row.position}</Text>
      </View>
      <View style={{
        width: 34, height: 34, borderRadius: 17, backgroundColor: C.panel3, marginLeft: 4,
        alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: medal || C.line,
        overflow: 'hidden',
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
        <Text style={{ ...TYPE.body, color: C.text, fontWeight: highlight ? '900' : '700' }} numberOfLines={1}>
          {highlight ? 'You' : (row.display_name || row.username)}
        </Text>
        <Text style={{ ...TYPE.micro, color: C.dim }} numberOfLines={1}>{subline(row, metric)}</Text>
      </View>
      <Text style={{ ...TYPE.body, color: C.gold, fontWeight: '800', fontVariant: ['tabular-nums'] }}>
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
      <Toggle options={[['global', 'Global'], ['friends', 'Friends']]} value={lb.scope} onChange={lb.setScope} />

      <View style={{ height: 10 }} />
      <Toggle options={BOARDS.map((b) => [b.key, b.label])} value={board.key} onChange={lb.setMetric} />

      <Text style={{ ...TYPE.micro, color: C.dim, marginTop: 8, textAlign: 'center' }}>
        {board.blurb}
      </Text>

      <Card style={{ marginTop: 12 }}>
        {lb.loading && lb.rows.length === 0 ? (
          <Text style={{ ...TYPE.caption, color: C.dim, textAlign: 'center', paddingVertical: 20 }}>Loading rankings…</Text>
        ) : lb.rows.length === 0 ? (
          <Text style={{ ...TYPE.caption, color: C.dim, textAlign: 'center', paddingVertical: 20 }}>
            {lb.scope === 'friends' ? 'Add friends to see a friends leaderboard.' : 'No ranked players yet — be the first.'}
          </Text>
        ) : (
          <View>
            {lb.rows.map((r) => (
              <Row key={r.id} row={r} metric={lb.metric} highlight={r.isMe} />
            ))}
            {!mine ? (
              <Text style={{ ...TYPE.micro, color: C.dim, textAlign: 'center', marginTop: 12 }}>
                Keep training to climb onto this board.
              </Text>
            ) : null}
          </View>
        )}
      </Card>
    </View>
  );
}
