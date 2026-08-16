// LEVL React Native — Ranks (global leaderboard) screen
import React, { useState, useMemo } from 'react';
import { View, Text, Pressable } from 'react-native';
import { C, s, MONO } from '../theme';
import { Card, Lbl, PBar, Sheet } from '../components/ui';
import { MiniHunter } from '../components/Hunter';
import LiveLeaderboard from './LiveLeaderboard';
import { isConfigured } from '../services/supabase/client';
import { BOTS, TIERS, STAT_META, DEFAULT_DATA } from '../engine/engine';

function tierOfFr(fr) {
  let t = TIERS[0];
  for (const x of TIERS) if (fr >= x.min) t = x;
  return t;
}
function divisionOfFr(fr, tier) {
  const within = fr - tier.min;
  const d = Math.min(2, Math.floor(within / 200));
  return tier.name === 'Grandmaster' ? '' : [' III', ' II', ' I'][d];
}

function LadderRow({ rank, entry, you, onPress }) {
  const tier = tierOfFr(entry.fr);
  return (
    <Pressable onPress={onPress} style={[s.row, { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.line, backgroundColor: you ? C.goldSoft : 'transparent', borderRadius: you ? 8 : 0, paddingHorizontal: you ? 6 : 0 }]}>
      <Text style={{ width: 34, fontSize: 14, fontWeight: '800', color: rank <= 3 ? C.gold : C.mut, fontVariant: ['tabular-nums'] }}>{rank}</Text>
      <MiniHunter avatar={entry.avatar} tierColor={tier.color} size={34} />
      <View style={{ flex: 1, marginLeft: 10 }}>
        <Text style={{ fontSize: 14, fontWeight: '700', color: you ? C.gold : C.text }} numberOfLines={1}>
          {entry.name}{you ? ' (You)' : ''}
        </Text>
        <Text style={{ fontSize: 10, color: C.dim }}>Lv {entry.level} · {entry.title}</Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={{ fontSize: 12, fontWeight: '700', color: tier.color }}>{tier.name.slice(0, 4)}{divisionOfFr(entry.fr, tier)}</Text>
        <Text style={{ fontSize: 12, color: C.mut, fontVariant: ['tabular-nums'] }}>FR {entry.fr}</Text>
      </View>
    </Pressable>
  );
}

function CompareModal({ visible, a, b, onClose }) {
  if (!a || !b) return null;
  const bTier = tierOfFr(b.fr);
  return (
    <Sheet visible={visible} title="Head to Head" onClose={onClose}>
      <View style={{ padding: 18 }}>
          <View style={[s.between, { marginBottom: 14 }]}>
            <View style={{ alignItems: 'center', flex: 1 }}>
              <MiniHunter avatar={a.avatar} tierColor={C.gold} size={54} />
              <Text style={{ fontSize: 14, fontWeight: '700', color: C.gold, marginTop: 6 }} numberOfLines={1}>{a.name}</Text>
              <Text style={{ fontSize: 10, color: C.mut, fontVariant: ['tabular-nums'] }}>FR {a.fr}</Text>
            </View>
            <Text style={{ fontSize: 16, fontWeight: '800', color: C.mut, marginHorizontal: 8 }}>VS</Text>
            <View style={{ alignItems: 'center', flex: 1 }}>
              <MiniHunter avatar={b.avatar} tierColor={bTier.color} size={54} />
              <Text style={{ fontSize: 14, fontWeight: '700', color: bTier.color, marginTop: 6 }} numberOfLines={1}>{b.name}</Text>
              <Text style={{ fontSize: 10, color: C.mut, fontVariant: ['tabular-nums'] }}>FR {b.fr}</Text>
            </View>
          </View>
          {Object.keys(STAT_META).map((k) => {
            const av = (a.statLevels && a.statLevels[k]) || 0;
            const bv = (b.statLevels && b.statLevels[k]) || 0;
            const mx = Math.max(av, bv, 1);
            const delta = av - bv;
            return (
              <View key={k} style={{ marginBottom: 8 }}>
                <View style={[s.between, { marginBottom: 3 }]}>
                  <Text style={{ fontSize: 10, fontWeight: '800', color: STAT_META[k].color, fontVariant: ['tabular-nums'] }}>{k}</Text>
                  <Text style={{ fontSize: 10, color: delta >= 0 ? C.green : C.red, fontVariant: ['tabular-nums'] }}>
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

export default function RanksTab({ data, dv, userEmail, leaderboard, view: controlledView }) {
  // One control, three destinations — the old screen had a Players/Practice
  // toggle AND three chips inside it, which meant two different things to
  // understand before you could read your own rank.
  //
  // Build 28: Compete now owns this choice in its own segmented control
  // (DUELS · RANKS · LEADERBOARD), so when a `view` prop is supplied the local
  // toggle is hidden rather than sitting immediately under an identical one.
  // Standalone use is unchanged.
  const [ownView, setView] = useState(isConfigured ? 'global' : 'ladder');
  const controlled = controlledView === 'global' || controlledView === 'ladder';
  const view = controlled ? controlledView : ownView;
  const [compare, setCompare] = useState(null);
  const [shown, setShown] = useState(25);   // Top-100 was a 100-row wall

  const statLevelsMap = useMemo(() => {
    const m = {};
    dv.statLevels.forEach((x) => { m[x.stat] = x.level; });
    return m;
  }, [dv.statLevels]);

  const youEntry = {
    name: data.name, avatar: data.avatar || DEFAULT_DATA.avatar, fr: dv.fr,
    level: dv.level, title: dv.title, statLevels: statLevelsMap, isYou: true,
  };

  // Field = seeded bots plus the player (only once placed), sorted by FR.
  const field = useMemo(() => {
    const arr = BOTS.slice();
    if (dv.placed) arr.push(youEntry);
    return arr.sort((a, b) => b.fr - a.fr);
  }, [dv.placed, dv.fr, data.name, data.avatar]);

  const yourRank = dv.placed ? field.findIndex((e) => e.isYou) + 1 : null;

  const byTier = useMemo(() => {
    const groups = TIERS.slice().reverse().map((t) => ({
      tier: t,
      members: field.filter((e) => tierOfFr(e.fr).name === t.name),
    })).filter((g) => g.members.length > 0);
    return groups;
  }, [field]);


  // Progress toward the next tier — the single most useful thing this screen
  // can tell you, and it wasn't shown anywhere before.
  const tierIdx = TIERS.findIndex((t) => t.name === dv.tier.name);
  const nextTier = tierIdx >= 0 && tierIdx < TIERS.length - 1 ? TIERS[tierIdx + 1] : null;
  const tierPct = nextTier
    ? Math.max(0, Math.min(100, ((dv.fr - dv.tier.min) / (nextTier.min - dv.tier.min)) * 100))
    : 100;

  const VIEWS = isConfigured
    ? [['global', 'Real players'], ['ladder', 'Practice']]
    : [['ladder', 'Practice']];

  return (
    <View>
      {/* ---- your standing: one card, the answer to "where am I?" ---- */}
      <Card style={s.hero}>
        {dv.placed ? (
          <View>
            <View style={s.between}>
              <View>
                <Text style={{ fontSize: 32, fontWeight: '900', color: C.gold, fontVariant: ['tabular-nums'], letterSpacing: -1 }}>
                  #{yourRank}
                </Text>
                <Text style={{ fontSize: 12, color: C.dim, marginTop: 1 }}>of {field.length} on the ladder</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ fontSize: 18, fontWeight: '900', color: dv.tier.color }}>{dv.tier.name}{dv.division}</Text>
                <Text style={{ fontSize: 12, color: C.mut, fontVariant: ['tabular-nums'], marginTop: 2 }}>FR {dv.fr}</Text>
                <Text style={{ fontSize: 9.5, color: C.dim, marginTop: 1 }}>Fitness Rating</Text>
              </View>
            </View>
            <View style={{ height: 8, borderRadius: 4, backgroundColor: C.panel2, marginTop: 14, overflow: 'hidden' }}>
              <View style={{ width: Math.max(2, tierPct) + '%', height: 8, backgroundColor: dv.tier.color }} />
            </View>
            <Text style={{ fontSize: 12, color: C.dim, marginTop: 7 }}>
              {nextTier
                ? (nextTier.min - dv.fr) + ' FR to ' + nextTier.name
                : 'Top tier reached — hold your position.'}
            </Text>
            {/* The one collision worth spending words on: people see Level 35
                AND Champion II AND FR 3268 AND #12 and cannot tell which is
                "how good am I". Eleven words settles it. */}
            <Text style={{ fontSize: 11.5, color: C.dim, marginTop: 9, lineHeight: 16 }}>
              Level is how much you've trained. Rank is how you compare.
            </Text>
          </View>
        ) : (
          <View>
            <Text style={{ fontSize: 20, fontWeight: '900', color: C.text }}>Ladder locked</Text>
            <Text style={{ fontSize: 13.5, color: C.mut, fontWeight: '700', marginTop: 4, lineHeight: 19 }}>
              {5 - dv.placementCount} more training day{5 - dv.placementCount === 1 ? '' : 's'} to earn your placement.
            </Text>
          </View>
        )}
      </Card>

      {/* ---- one control, not two (hidden when Compete supplies the view) ---- */}
      <View style={{
        display: controlled ? 'none' : 'flex',
        flexDirection: 'row', backgroundColor: C.panel2, borderRadius: 12, padding: 4,
        marginBottom: 14, borderWidth: 1, borderColor: C.line,
      }}>
        {VIEWS.map((v) => (
          <Pressable key={v[0]} onPress={() => { setView(v[0]); setShown(25); }}
            accessibilityRole="tab" accessibilityState={{ selected: view === v[0] }} accessibilityLabel={v[1]}
            style={{ flex: 1, minHeight: 40, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: view === v[0] ? C.gold : 'transparent' }}>
            <Text style={{ fontSize: 13, fontWeight: '800', color: view === v[0] ? C.ink : C.mut }}>{v[1]}</Text>
          </Pressable>
        ))}
      </View>

      {view === 'global' && isConfigured && leaderboard ? (
        <LiveLeaderboard lb={leaderboard} />
      ) : null}

      {view === 'ladder' && (
        <Card>
          <View style={s.between}>
            <Lbl style={{ marginBottom: 0 }}>Practice Ladder</Lbl>
            <Text style={{ fontSize: 10.5, color: C.dim, fontVariant: ['tabular-nums'] }}>{field.length} hunters</Text>
          </View>
          <View style={{ marginTop: 6 }}>
            {field.slice(0, shown).map((e, i) => (
              <LadderRow key={e.name + i} rank={i + 1} entry={e} you={e.isYou} onPress={() => !e.isYou && setCompare(e)} />
            ))}
          </View>
          {shown < Math.min(100, field.length) && (
            <Pressable onPress={() => setShown((v) => v + 25)} hitSlop={8}
              accessibilityRole="button" accessibilityLabel="Show more hunters"
              style={{ alignItems: 'center', paddingTop: 14 }}>
              <Text style={{ fontSize: 12.5, color: C.gold, fontWeight: '800' }}>Show 25 more</Text>
            </Pressable>
          )}
          {dv.placed && yourRank > shown && (
            <View style={{ marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: C.line }}>
              <LadderRow rank={yourRank} entry={youEntry} you onPress={() => {}} />
            </View>
          )}
        </Card>
      )}


      <CompareModal visible={!!compare} a={youEntry} b={compare} onClose={() => setCompare(null)} />
    </View>
  );
}
