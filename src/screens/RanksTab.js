// ============================================================================
// LEVL — RanksTab: the practice ladder, and the door to the live boards.
//
// WHAT CHANGED
//   - The standing card moved out. It now lives in CompeteTab as StandingPanel
//     so it renders on every competitive view, not just this one.
//   - tierOfFr/divisionOfFr were local copies of the engine's tierForFR and
//     divisionForFR. Two implementations of a ranking rule is one too many, so
//     the copies are gone and entries carry their own tier, exactly like BOTS.
//   - The field is computed by CompeteTab and passed in. It used to be derived
//     here AND implicitly again by the standing card.
//   - One type scale (T). This file previously mixed raw pixel sizes (32, 9.5,
//     11.5) with s.* helpers while its sibling used TYPE.
//   - The local Real players / Practice toggle is gone. CompeteTab's control is
//     the only one now; keeping a hidden duplicate around invited it back.
// ============================================================================
import React, { useState, useMemo } from 'react';
import { View, Pressable } from 'react-native';
import { Text } from '../components/Text';
import { C, alpha, s, T, RADIUS } from '../theme';
import { Card, Lbl, PBar, Sheet } from '../components/ui';
import { MiniHunter } from '../components/Hunter';
import { TierCrest } from '../components/TierCrest';
import LiveLeaderboard from './LiveLeaderboard';
import { isConfigured } from '../services/supabase/client';
import { BOTS, STAT_META, DEFAULT_DATA, tierForFR, divisionForFR } from '../engine/engine';

const entryTier = (e) => e.tier || tierForFR(e.fr);
const entryDivision = (e) => (e.division != null ? e.division : divisionForFR(e.fr, entryTier(e)));

function LadderRow({ rank, entry, you, onPress }) {
  const tier = entryTier(entry);
  const medal = rank === 1 ? C.gold : rank === 2 ? '#c3ccdb' : rank === 3 ? '#cd7f4a' : null;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${entry.name}, rank ${rank}, ${tier.name}, ${entry.fr} FR`}
      style={{
        flexDirection: 'row', alignItems: 'center',
        paddingVertical: 9, paddingHorizontal: you ? 8 : 0,
        borderBottomWidth: 1, borderBottomColor: C.lineSoft,
        backgroundColor: you ? alpha(C.gold, 0.10) : 'transparent',
        borderRadius: you ? RADIUS.sm : 0,
      }}>
      <Text style={{
        width: 32, ...T.footnote, ...T.numeric, fontWeight: '800',
        color: medal || (you ? C.gold : C.dim),
      }}>
        {rank}
      </Text>

      <MiniHunter avatar={entry.avatar} tierColor={tier.color} size={34} />

      <View style={{ flex: 1, marginLeft: 10 }}>
        <Text style={{ ...T.subheadline, fontWeight: '700', color: you ? C.gold : C.text }} numberOfLines={1}>
          {entry.name}{you ? ' (You)' : ''}
        </Text>
        <Text style={{ ...T.caption2, color: C.dim }} numberOfLines={1}>
          Lv {entry.level} · {entry.title}
        </Text>
      </View>

      {/* The crest carries the tier, so the row needs no coloured tier word and
          the eye can scan the FR column without competing text. */}
      <TierCrest tier={tier} size={26} />
      <View style={{ alignItems: 'flex-end', marginLeft: 8, minWidth: 62 }}>
        <Text style={{ ...T.footnote, ...T.numeric, fontWeight: '700', color: C.text }}>
          {entry.fr.toLocaleString()}
        </Text>
        <Text style={{ ...T.caption2, color: C.faint }}>
          {tier.name.slice(0, 4)}{entryDivision(entry)}
        </Text>
      </View>
    </Pressable>
  );
}

function CompareModal({ visible, a, b, onClose }) {
  if (!a || !b) return null;
  const bTier = entryTier(b);
  return (
    <Sheet visible={visible} title="Head to Head" onClose={onClose}>
      <View style={{ padding: 18 }}>
        <View style={[s.between, { marginBottom: 16 }]}>
          <View style={{ alignItems: 'center', flex: 1 }}>
            <MiniHunter avatar={a.avatar} tierColor={C.gold} size={54} />
            <Text style={{ ...T.subheadline, fontWeight: '700', color: C.gold, marginTop: 6 }} numberOfLines={1}>{a.name}</Text>
            <Text style={{ ...T.caption2, color: C.mut, ...T.numeric }}>FR {a.fr.toLocaleString()}</Text>
          </View>
          <Text style={{ ...T.headline, color: C.dim, marginHorizontal: 8 }}>VS</Text>
          <View style={{ alignItems: 'center', flex: 1 }}>
            <MiniHunter avatar={b.avatar} tierColor={bTier.color} size={54} />
            <Text style={{ ...T.subheadline, fontWeight: '700', color: bTier.color, marginTop: 6 }} numberOfLines={1}>{b.name}</Text>
            <Text style={{ ...T.caption2, color: C.mut, ...T.numeric }}>FR {b.fr.toLocaleString()}</Text>
          </View>
        </View>

        {Object.keys(STAT_META).map((k) => {
          const av = (a.statLevels && a.statLevels[k]) || 0;
          const bv = (b.statLevels && b.statLevels[k]) || 0;
          const mx = Math.max(av, bv, 1);
          const delta = av - bv;
          return (
            <View key={k} style={{ marginBottom: 9 }}>
              <View style={[s.between, { marginBottom: 3 }]}>
                <Text style={{ ...T.caption2, fontWeight: '800', color: STAT_META[k].color }}>{k}</Text>
                <Text style={{ ...T.caption2, ...T.numeric, color: delta >= 0 ? C.green : C.red }}>
                  {delta >= 0 ? '+' : ''}{delta}
                </Text>
              </View>
              <View style={[s.row, { marginBottom: 2 }]}>
                <View style={{ flex: 1, marginRight: 4 }}><PBar pct={(av / mx) * 100} color={C.gold} height={5} /></View>
                <View style={{ flex: 1 }}><PBar pct={(bv / mx) * 100} color={bTier.color} height={5} /></View>
              </View>
            </View>
          );
        })}
      </View>
    </Sheet>
  );
}

export default function RanksTab({
  data, dv, userEmail, leaderboard, view: controlledView,
  field: fieldProp, yourRank: rankProp, youEntry: youProp,
}) {
  const [compare, setCompare] = useState(null);
  const [shown, setShown] = useState(25);   // Top-100 was a 100-row wall

  // Standalone use (no CompeteTab above) still works: derive what wasn't given.
  const youEntry = useMemo(() => {
    if (youProp) return youProp;
    const tier = tierForFR(dv.fr);
    return {
      name: data.name, avatar: data.avatar || DEFAULT_DATA.avatar, fr: dv.fr,
      tier, division: divisionForFR(dv.fr, tier),
      level: dv.level, title: dv.title,
      statLevels: (dv.statLevels || []).reduce((m, x) => { m[x.stat] = x.level; return m; }, {}),
      isYou: true,
    };
  }, [youProp, data.name, data.avatar, dv.fr, dv.level, dv.title, dv.statLevels]);

  const field = useMemo(() => {
    if (fieldProp) return fieldProp;
    const arr = BOTS.slice();
    if (dv.placed) arr.push(youEntry);
    return arr.sort((a, b) => b.fr - a.fr);
  }, [fieldProp, dv.placed, youEntry]);

  const yourRank = rankProp != null ? rankProp : (dv.placed ? field.findIndex((e) => e.isYou) + 1 : null);
  const view = controlledView === 'global' ? 'global' : 'ladder';

  if (view === 'global') {
    return isConfigured && leaderboard
      ? <LiveLeaderboard lb={leaderboard} />
      : <LiveLeaderboard lb={{ rows: [], loading: false, scope: 'global', metric: 'best_e1rm', setScope: () => {}, setMetric: () => {} }} />;
  }

  const visible = field.slice(0, shown);
  const youOffscreen = dv.placed && yourRank > shown;

  return (
    <View>
      <Card>
        <View style={[s.between, { marginBottom: 4 }]}>
          <Lbl style={{ marginBottom: 0 }}>Practice ladder</Lbl>
          <Text style={{ ...T.caption2, color: C.dim, ...T.numeric }}>
            {field.length} players
          </Text>
        </View>
        <Text style={{ ...T.caption2, color: C.faint, marginBottom: 8 }}>
          Seeded challengers. Your position here doesn't affect the live boards.
        </Text>

        <View>
          {visible.map((e, i) => (
            <LadderRow
              key={e.name + i}
              rank={i + 1}
              entry={e}
              you={e.isYou}
              onPress={() => !e.isYou && setCompare(e)}
            />
          ))}
        </View>

        {shown < Math.min(100, field.length) ? (
          <Pressable
            onPress={() => setShown((v) => v + 25)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Show more players"
            style={{ alignItems: 'center', paddingTop: 14 }}>
            <Text style={{ ...T.footnote, color: C.gold, fontWeight: '800' }}>Show 25 more</Text>
          </Pressable>
        ) : null}

        {youOffscreen ? (
          <View style={{ marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: C.line }}>
            <LadderRow rank={yourRank} entry={youEntry} you onPress={() => {}} />
          </View>
        ) : null}
      </Card>

      <CompareModal visible={!!compare} a={youEntry} b={compare} onClose={() => setCompare(null)} />
    </View>
  );
}
