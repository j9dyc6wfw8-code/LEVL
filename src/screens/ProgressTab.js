// LEVL React Native — Stats screen
//
// Four focused views behind one segmented control, so the screen stays calm
// while holding a lot: Overview · Strength · Volume · History. Each view is
// roughly a screenful rather than one long scroll of everything at once.

import React, { useState, useMemo } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { C, s, MONO, T } from '../theme';
import { Card, Lbl, Chip, LineChart, BarChart, EmptyState, CountUp, ScreenHeader, Segmented } from '../components/ui';
import { dayKeyOf, fmtShort, DAY, EXERCISES } from '../engine/engine';
// EntryEditor lives in TrainTab beside the effort scale it shares. The import
// direction is deliberate: ProgressTab already depended on TrainTab for the
// calculator, so nothing new is introduced and there is no import cycle.
import { CalcView, EntryEditor } from './TrainTab';
import { projectStrength } from '../engine/projection';

/* ------------------------------- model ---------------------------------- */

// e1RM projection for one exercise: fit a line over the last 90 days of
// best-per-day estimates, then dampen the slope for a realistic forecast.
function buildProgressModel(lifts, exName, now, category, bodyweightKg) {
  const cut = now - 180 * DAY;   // wider window: more evidence, better estimate
  const hist = lifts.filter((l) => l.ex === exName && l.t >= cut && l.e1rm > 0);
  if (!hist.length) return null;

  // best per day — one heavy single shouldn't count three times
  const byDay = {};
  hist.forEach((l) => { const k = dayKeyOf(l.t); if (!byDay[k] || l.e1rm > byDay[k].e1rm) byDay[k] = { e1rm: l.e1rm, t: l.t }; });
  const pts = Object.values(byDay).sort((a, b) => a.t - b.t);
  const best = Math.max(...pts.map((p) => p.e1rm));

  const proj = projectStrength(pts, category, bodyweightKg);
  const rows = pts.map((p) => ({ label: fmtShort(p.t), hist: p.e1rm, proj: null }));

  if (!proj.ready) {
    return { rows, best, proj, points: pts.length, first: pts[0].e1rm, last: pts[pts.length - 1].e1rm };
  }

  // stitch the forecast onto the end of the history so the line is continuous
  const stitched = [...rows];
  stitched[stitched.length - 1] = { ...stitched[stitched.length - 1], proj: pts[pts.length - 1].e1rm };
  const projRows = [2, 4, 6, 8, 12].map((wk) => ({
    label: '+' + wk + 'w', hist: null, proj: proj.at(wk),
  }));

  return {
    rows: [...stitched, ...projRows],
    best, proj,
    p4: proj.at(4), p8: proj.at(8), p12: proj.at(12),
    slopePerWeek: proj.perWeek,
    points: pts.length,
    first: pts[0].e1rm, last: pts[pts.length - 1].e1rm,
  };
}

// exercise name -> muscle group, from the built-in library
const EX_GROUP = {};
EXERCISES.forEach((e) => { EX_GROUP[e.n] = e.c; });

// Muscle balance, measured two ways — because raw tonnage is NOT comparable
// across muscle groups. A 70 kg bench and a 25 kg triceps extension move very
// different loads for the same training effort, so ranking groups by kg lifted
// always flatters chest, back and legs and makes arms and shoulders look
// neglected even in a perfectly balanced programme.
//
//   sets     — hard sets per group. This is how training volume is actually
//              prescribed and compared in the literature (roughly 10–20 sets
//              per muscle group per week), and it IS comparable across groups.
//   tonnage  — total kg × reps. Useful for tracking your own load over time,
//              misleading for comparing one muscle against another.
//
// `sets` is the default for exactly that reason.
function muscleBalance(lifts, sinceT, mode) {
  const byTonnage = mode === 'tonnage';
  const totals = {};
  let grand = 0;
  lifts.forEach((l) => {
    if (l.t < sinceT) return;
    const g = EX_GROUP[l.ex] || 'Other';
    const amount = byTonnage ? (l.w || 0) * (l.r || 0) : 1;   // one logged set = one set
    if (byTonnage && !amount) return;                          // skip bodyweight rows in tonnage mode
    totals[g] = (totals[g] || 0) + amount;
    grand += amount;
  });
  return Object.keys(totals)
    .map((g) => ({
      group: g,
      vol: Math.round(totals[g]),
      pct: grand ? (totals[g] / grand) * 100 : 0,
    }))
    .sort((a, b) => b.vol - a.vol);
}

const RANGES = [['30', '30d', 30], ['90', '90d', 90], ['all', 'All', 3650]];

/* ------------------------------- screen ---------------------------------- */

export default function ProgressTab({ data, dv, onDelete, onEdit }) {
  const now = Date.now();
  const unit = data.unit;
  const [seg, setSeg] = useState('overview');
  const [range, setRange] = useState('90');

  const days = (RANGES.find((r) => r[0] === range) || RANGES[1])[2];
  const sinceT = now - days * DAY;

  const exercisesLogged = useMemo(() => {
    const set = [];
    data.lifts.forEach((l) => { if (!set.includes(l.ex)) set.push(l.ex); });
    return set;
  }, [data.lifts]);

  const [exName, setExName] = useState(exercisesLogged[0] || null);

  if (data.lifts.length + data.cardio.length === 0) {
    return <EmptyState title="No training data yet" body="Log a few sessions to unlock your trends." />;
  }

  const SEGS = [['overview', 'Overview'], ['strength', 'Strength'], ['volume', 'Volume'], ['history', 'History'], ['tools', 'Tools']];

  return (
    <View>
      <ScreenHeader title="Your numbers" hint="Pick a view below" />
      <Segmented options={SEGS} value={seg} onChange={setSeg} style={{ marginBottom: 14 }} />

      {seg === 'overview' && (
        <OverviewView data={data} dv={dv} unit={unit} now={now} sinceT={sinceT}
          range={range} setRange={setRange} exCount={exercisesLogged.length} />
      )}
      {seg === 'strength' && (
        <StrengthView data={data} unit={unit} now={now}
          exercisesLogged={exercisesLogged} exName={exName} setExName={setExName} />
      )}
      {seg === 'volume' && (
        <VolumeView data={data} dv={dv} now={now} sinceT={sinceT} range={range} setRange={setRange} />
      )}
      {seg === 'history' && <HistoryView data={data} unit={unit} onDelete={onDelete} onEdit={onEdit} />}
      {seg === 'tools' && <CalcView data={data} dv={dv} />}
    </View>
  );
}

/* ------------------------------ overview --------------------------------- */

function OverviewView({ data, dv, unit, now, sinceT, range, setRange, exCount }) {
  const lifts = data.lifts, cardio = data.cardio;

  const tonnage = useMemo(
    () => lifts.reduce((a, l) => (l.t >= sinceT ? a + (l.w || 0) * (l.r || 0) : a), 0), [lifts, sinceT]);
  const prCount = useMemo(() => lifts.filter((l) => l.pr && l.t >= sinceT).length, [lifts, sinceT]);
  const sessionCount = useMemo(
    () => [...lifts, ...cardio].filter((e) => e.t >= sinceT).length, [lifts, cardio, sinceT]);
  const [balanceMode, setBalanceMode] = useState('sets');
  const balance = useMemo(() => muscleBalance(lifts, sinceT, balanceMode), [lifts, sinceT, balanceMode]);

  const dayXP = useMemo(() => {
    const m = {};
    [...lifts, ...cardio].forEach((e) => { const k = dayKeyOf(e.t); m[k] = (m[k] || 0) + (e.xp || 0); });
    return m;
  }, [lifts, cardio]);

  const topPRs = useMemo(() => {
    const best = {};
    lifts.forEach((l) => {
      if (!l.pr) return;
      if (!best[l.ex] || (l.e1rm || 0) > (best[l.ex].e1rm || 0)) best[l.ex] = l;
    });
    return Object.values(best).sort((a, b) => (b.e1rm || 0) - (a.e1rm || 0)).slice(0, 3);
  }, [lifts]);

  return (
    <View>
      <RangeBar range={range} setRange={setRange} />

      <Card>
        <View style={{ flexDirection: 'row' }}>
          <Metric label="SESSIONS" value={sessionCount} />
          <Divider />
          <Metric label="DAY STREAK" value={dv.streak || 0} tint={C.orange} />
          <Divider />
          <Metric label="PRs" value={prCount} tint={C.gold} />
        </View>
        <View style={{ height: 1, backgroundColor: C.line, marginVertical: 14 }} />
        <View style={{ flexDirection: 'row' }}>
          <Metric label={'TONNAGE (' + unit + ')'} value={Math.round(tonnage)} big />
          <Divider />
          <Metric label="EXERCISES" value={exCount} />
        </View>
      </Card>

      <Card>
        <View style={s.between}>
          <Lbl style={{ marginBottom: 0 }}>Consistency</Lbl>
          <Text style={{ ...T.micro, color: C.dim, fontVariant: ['tabular-nums'] }}>last 12 weeks</Text>
        </View>
        <Heatmap dayXP={dayXP} now={now} />
      </Card>

      <Card>
        <View style={s.between}>
          <Lbl style={{ marginBottom: 0 }}>Muscle balance</Lbl>
          <View style={{ flexDirection: 'row' }}>
            {[['sets', 'Sets'], ['tonnage', 'Tonnage']].map((m) => (
              <Pressable key={m[0]} onPress={() => setBalanceMode(m[0])} hitSlop={6}
                accessibilityRole="button" accessibilityLabel={'Show ' + m[1]}
                style={{
                  paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, marginLeft: 6,
                  backgroundColor: balanceMode === m[0] ? C.goldSoft : 'transparent',
                  borderWidth: 1, borderColor: balanceMode === m[0] ? C.gold : C.line,
                }}>
                <Text style={{ ...T.micro, fontWeight: '800', color: balanceMode === m[0] ? C.gold : C.dim }}>{m[1]}</Text>
              </Pressable>
            ))}
          </View>
        </View>
        {balance.length === 0 ? (
          <Text style={{ ...T.caption, color: C.dim, marginTop: 10 }}>Nothing logged in this range. Try a longer one.</Text>
        ) : (
          <View>
            {balance.slice(0, 6).map((b) => (
              <View key={b.group} style={{ marginTop: 10 }}>
                <View style={s.between}>
                  <Text style={{ ...T.caption, color: C.text, fontWeight: '600' }}>{b.group}</Text>
                  <Text style={{ ...T.caption2, color: C.dim, fontVariant: ['tabular-nums'] }}>
                    {b.pct.toFixed(0)}%{balanceMode === 'sets' ? ' · ' + b.vol + ' sets' : ''}
                  </Text>
                </View>
                <View style={{ height: 6, borderRadius: 3, backgroundColor: C.panel2, marginTop: 5 }}>
                  <View style={{ width: (Math.max(2, b.pct)) + '%', height: 6, borderRadius: 3, backgroundColor: C.gold }} />
                </View>
              </View>
            ))}
            {balance.length > 1 ? (
              <Text style={{ ...T.footnote, color: C.mut, marginTop: 12, fontWeight: '700' }}>
                {balance[0].pct > 45
                  ? balance[0].group + ' dominates ' + balance[0].pct.toFixed(0) + '%. Balance your volume.'
                  : 'Your training volume looks balanced.'}
              </Text>
            ) : null}
            <Text style={{ ...T.caption2, color: C.dim, marginTop: 10, lineHeight: 17 }}>
              {balanceMode === 'sets'
                ? 'Sets are the fair comparison — every muscle counts the same.'
                : 'Kilos moved. Big lifts dominate this, so it flatters chest, back and legs.'}
            </Text>
          </View>
        )}
      </Card>

      {topPRs.length > 0 ? (
        <Card>
          <Lbl>Personal records</Lbl>
          {topPRs.map((p) => (
            <View key={p.id} style={[s.between, { marginTop: 10, alignItems: 'center' }]}>
              <View style={{ flex: 1 }}>
                <Text style={{ ...T.footnote, color: C.text, fontWeight: '700' }} numberOfLines={1}>{p.ex}</Text>
                <Text style={{ ...T.caption2, color: C.dim, fontVariant: ['tabular-nums'], marginTop: 1 }}>
                  {p.w} {unit} × {p.r} · {fmtShort(p.t)}
                </Text>
              </View>
              <Text style={{ ...T.subheadline, color: C.gold, fontWeight: '800', fontVariant: ['tabular-nums'] }}>
                {p.e1rm}<Text style={{ ...T.micro, color: C.mut }}> {unit}</Text>
              </Text>
            </View>
          ))}
        </Card>
      ) : null}
    </View>
  );
}

/* ------------------------------ strength --------------------------------- */

function StrengthView({ data, unit, now, exercisesLogged, exName, setExName }) {
  // category and bodyweight are what let the projection know a pushdown from
  // a squat, and a 60 kg lifter from a 110 kg one
  const exMeta = exName ? EXERCISES.find((e) => e.n === exName) : null;
  const model = exName
    ? buildProgressModel(data.lifts, exName, now, exMeta && exMeta.c, data.bodyweight || null)
    : null;
  const gain = model ? +(model.last - model.first).toFixed(1) : 0;

  return (
    <View>
      <Card>
        <Lbl>Exercise</Lbl>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {exercisesLogged.map((e) => (
            <Chip key={e} active={exName === e} onPress={() => setExName(e)}>{e}</Chip>
          ))}
        </ScrollView>
      </Card>

      {model ? (
        <View>
          <Card>
            <View style={s.between}>
              <Lbl style={{ marginBottom: 0 }}>Estimated 1-rep max</Lbl>
              <Text style={{
                ...T.caption2, fontWeight: '700', fontVariant: ['tabular-nums'],
                color: gain > 0 ? C.green : gain < 0 ? C.red : C.dim,
              }}>
                {gain > 0 ? '▲ +' + gain + ' ' + unit : gain < 0 ? '▼ ' + gain + ' ' + unit : 'flat'}
              </Text>
            </View>
            <View style={{ alignItems: 'center', marginTop: 4, marginBottom: 10 }}>
              <CountUp value={Math.round(model.best)} duration={650}
                style={{ fontSize: 44, fontWeight: '800', color: C.gold, fontVariant: ['tabular-nums'] }} />
              <Text style={{ ...T.caption2, color: C.dim, marginTop: -2 }}>current best · {unit}</Text>
              <Text style={{ ...T.caption2, color: C.dim, marginTop: 5, textAlign: 'center' }}>
                Your heaviest possible single rep. Estimated — never test it.
              </Text>
            </View>
            <LineChart rows={model.rows} height={200} />
          </Card>

          <Card>
            <Lbl>Where this is heading</Lbl>
            {model.proj && model.proj.ready ? (
              <View>
                <View style={{ flexDirection: 'row' }}>
                  <View style={{ flex: 1, alignItems: 'center' }}>
                    <Text style={{ ...T.micro, color: C.dim, fontWeight: '800' }}>+4 WEEKS</Text>
                    <Text style={{ fontSize: 19, fontWeight: '900', color: '#7c7cf5', fontVariant: ['tabular-nums'], marginTop: 3 }}>{model.p4}</Text>
                  </View>
                  <Divider />
                  <View style={{ flex: 1, alignItems: 'center' }}>
                    <Text style={{ ...T.micro, color: C.dim, fontWeight: '800' }}>+8 WEEKS</Text>
                    <Text style={{ fontSize: 19, fontWeight: '900', color: '#7c7cf5', fontVariant: ['tabular-nums'], marginTop: 3 }}>{model.p8}</Text>
                  </View>
                  <Divider />
                  <View style={{ flex: 1, alignItems: 'center' }}>
                    <Text style={{ ...T.micro, color: C.dim, fontWeight: '800' }}>+12 WEEKS</Text>
                    <Text style={{ fontSize: 19, fontWeight: '900', color: '#7c7cf5', fontVariant: ['tabular-nums'], marginTop: 3 }}>{model.p12}</Text>
                  </View>
                </View>

                {/* Plain-language reliability instead of a confidence interval */}
                <View style={[s.between, { marginTop: 14, alignItems: 'center' }]}>
                  <Text style={{ ...T.caption2, color: C.dim }}>
                    {model.proj.sessions} sessions over {Math.round(model.proj.spanDays / 7)} weeks
                  </Text>
                  <View style={{
                    paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999,
                    backgroundColor: model.proj.confidence === 'high' ? 'rgba(47,227,155,0.14)'
                      : model.proj.confidence === 'medium' ? C.goldSoft : C.panel2,
                    borderWidth: 1,
                    borderColor: model.proj.confidence === 'high' ? C.green
                      : model.proj.confidence === 'medium' ? C.gold : C.line,
                  }}>
                    <Text style={{
                      ...T.micro, fontWeight: '800',
                      color: model.proj.confidence === 'high' ? C.green
                        : model.proj.confidence === 'medium' ? C.gold : C.dim,
                    }}>
                      {model.proj.confidence === 'high' ? 'RELIABLE'
                        : model.proj.confidence === 'medium' ? 'FAIR' : 'ROUGH'}
                    </Text>
                  </View>
                </View>

                {/* How close to their realistic ceiling — no jargon */}
                {model.proj.proximity != null ? (
                  <View style={{ marginTop: 14 }}>
                    <View style={s.between}>
                      <Text style={{ ...T.caption2, color: C.mut }}>Toward your realistic peak</Text>
                      <Text style={{ ...T.caption2, color: C.gold, fontVariant: ['tabular-nums'], fontWeight: '700' }}>
                        {Math.round(model.proj.proximity * 100)}%
                      </Text>
                    </View>
                    <View style={{ height: 6, borderRadius: 3, backgroundColor: C.panel2, marginTop: 6 }}>
                      <View style={{ width: Math.max(2, model.proj.proximity * 100) + '%', height: 6, borderRadius: 3, backgroundColor: C.gold }} />
                    </View>
                    <Text style={{ ...T.caption2, color: C.dim, marginTop: 8, lineHeight: 16 }}>
                      {model.proj.proximity > 0.9
                        ? 'You are near the top of what this lift usually reaches. Gains from here are small and hard won.'
                        : model.proj.proximity > 0.7
                        ? 'Well trained on this lift. Progress slows from here — that is normal.'
                        : 'Plenty of room left. This is the fastest-gaining stage.'}
                    </Text>
                  </View>
                ) : (
                  <Text style={{ ...T.caption2, color: C.dim, marginTop: 12, lineHeight: 16 }}>
                    Add your bodyweight in You → Physical Profile for a sharper estimate.
                  </Text>
                )}
              </View>
            ) : (
              <View>
                <Text style={{ ...T.subheadline, fontWeight: '800', color: C.text }}>Not enough to go on yet</Text>
                <Text style={{ ...T.footnote, color: C.mut, marginTop: 6, lineHeight: 19 }}>
                  {model.proj && model.proj.reason === 'need_time'
                    ? 'Keep logging this lift for another ' + Math.max(1, 2 - Math.floor((model.proj.haveDays || 0) / 7)) + ' week' + (Math.max(1, 2 - Math.floor((model.proj.haveDays || 0) / 7)) === 1 ? '' : 's') + '. Two weeks of history is the minimum for a forecast worth showing.'
                    : 'Log this lift on ' + Math.max(1, 3 - ((model.proj && model.proj.have) || 0)) + ' more day' + (Math.max(1, 3 - ((model.proj && model.proj.have) || 0)) === 1 ? '' : 's') + '. Two sessions can show a line, but not a trend.'}
                </Text>
              </View>
            )}
          </Card>
        </View>
      ) : (
        <Card>
          <Text style={{ ...T.subheadline, color: C.text, fontWeight: '700' }}>
            Log this lift on 2 days to unlock projections.
          </Text>
        </Card>
      )}
    </View>
  );
}

/* ------------------------------- volume ---------------------------------- */

function VolumeView({ data, dv, now, sinceT, range, setRange }) {
  const lifts = data.lifts;
  const weekAgo = now - 7 * DAY, twoWeek = now - 14 * DAY;

  const thisWeek = useMemo(() => lifts.reduce((a, l) => (l.t >= weekAgo ? a + (l.w || 0) * (l.r || 0) : a), 0), [lifts, weekAgo]);
  const lastWeek = useMemo(() => lifts.reduce((a, l) => (l.t >= twoWeek && l.t < weekAgo ? a + (l.w || 0) * (l.r || 0) : a), 0), [lifts, twoWeek, weekAgo]);
  const delta = lastWeek > 0 ? ((thisWeek - lastWeek) / lastWeek) * 100 : 0;

  const inRange = useMemo(() => lifts.filter((l) => l.t >= sinceT), [lifts, sinceT]);
  const totalSets = inRange.length;
  const totalReps = inRange.reduce((a, l) => a + (l.r || 0), 0);
  const avgLoad = totalSets ? inRange.reduce((a, l) => a + (l.w || 0), 0) / totalSets : 0;

  return (
    <View>
      <RangeBar range={range} setRange={setRange} />

      <Card>
        <View style={s.between}>
          <Lbl style={{ marginBottom: 0 }}>This week vs last</Lbl>
          <Text style={{
            ...T.caption, fontWeight: '700', fontVariant: ['tabular-nums'],
            color: delta > 0 ? C.green : delta < 0 ? C.red : C.dim,
          }}>
            {lastWeek === 0 ? '—' : (delta > 0 ? '▲ +' : '▼ ') + Math.abs(delta).toFixed(0) + '%'}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', marginTop: 12 }}>
          <Metric label="THIS WEEK" value={Math.round(thisWeek)} big />
          <Divider />
          <Metric label="LAST WEEK" value={Math.round(lastWeek)} muted />
        </View>
      </Card>

      <Card>
        <Lbl>Weekly volume · last 8 weeks</Lbl>
        <BarChart data={dv.weeklyVol} height={150} />
        {/* set profile folded in here — three numbers about the same thing did
            not need a card of their own, and "Volume by muscle group" was the
            identical breakdown already shown on Overview. */}
        <View style={{ flexDirection: 'row', marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: C.line }}>
          <Metric label="SETS" value={totalSets} />
          <Divider />
          <Metric label="REPS" value={totalReps} />
          <Divider />
          <Metric label="AVG LOAD" value={Math.round(avgLoad)} tint={C.gold} />
        </View>
      </Card>
    </View>
  );
}

/* ------------------------------- history --------------------------------- */

function HistoryView({ data, unit, onDelete, onEdit }) {
  const [filter, setFilter] = useState('all');
  const [limit, setLimit] = useState(25);
  // The id of the entry being edited, not the entry itself: the save is the
  // source of truth, so the sheet always reflects what was actually stored
  // rather than a copy that goes stale the moment the edit commits.
  const [editingId, setEditingId] = useState(null);

  const all = useMemo(() => ([
    ...data.lifts.map((l) => ({ ...l, kind: 'lift' })),
    ...data.cardio.map((c) => ({ ...c, kind: 'cardio' })),
  ].sort((a, b) => b.t - a.t)), [data.lifts, data.cardio]);

  const filtered = useMemo(() => all.filter((h) => (
    filter === 'all' ? true : filter === 'pr' ? !!h.pr : h.kind === filter
  )), [all, filter]);

  const FILTERS = [['all', 'All'], ['lift', 'Lifts'], ['cardio', 'Cardio'], ['pr', 'PRs']];

  return (
    <View>
      <Card>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {FILTERS.map((f) => (
            <Chip key={f[0]} active={filter === f[0]} onPress={() => { setFilter(f[0]); setLimit(25); }}>{f[1]}</Chip>
          ))}
        </View>
      </Card>

      <Card>
        <View style={s.between}>
          <Lbl style={{ marginBottom: 0 }}>History</Lbl>
          <Text style={{ ...T.micro, color: C.dim, fontVariant: ['tabular-nums'] }}>{filtered.length} entries</Text>
        </View>
        {filtered.length > 0 ? (
          <Text style={{ ...T.caption2, color: C.dim, marginTop: 6, marginBottom: 2 }}>
            Tap any entry to correct or delete it.
          </Text>
        ) : null}
        {filtered.length === 0 ? (
          <Text style={{ ...T.caption, color: C.dim, marginTop: 12 }}>Nothing matches this filter.</Text>
        ) : (
          <View>
            {/* The whole row opens the editor. It used to end in a bare ✕ that
                deleted instantly on a single tap, with no confirmation and no
                way to CORRECT a set — the only repair for a typo was to destroy
                the entry and log it again at the wrong time. */}
            {filtered.slice(0, limit).map((h) => (
              <Pressable
                key={h.id}
                onPress={() => setEditingId(h.id)}
                accessibilityRole="button"
                accessibilityLabel={'Edit ' + (h.ex || h.name) + ', ' + fmtShort(h.t)}
                style={[s.between, { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.line }]}>
                <View style={{ flex: 1 }}>
                  <View style={s.row}>
                    {h.kind === 'cardio' ? <View style={{ width: 6, height: 6, borderRadius: 4, backgroundColor: C.green, marginRight: 7 }} /> : null}
                    <Text style={{ ...T.footnote, fontWeight: '700', color: C.text }} numberOfLines={1}>{h.ex || h.name}</Text>
                    {h.pr ? <Text style={{ ...T.micro, color: C.gold, marginLeft: 6, fontWeight: '800' }}>PR</Text> : null}
                    {h.flagged ? <Text style={{ ...T.micro, color: C.red, marginLeft: 6, fontWeight: '800' }}>CAPPED</Text> : null}
                  </View>
                  <Text style={{ ...T.caption2, color: C.dim, marginTop: 2, fontVariant: ['tabular-nums'] }}>
                    {h.kind === 'cardio'
                      ? h.mins + ' min' + (h.dist ? ' · ' + h.dist + ' km' : '') + (h.intensity ? ' · ' + h.intensity : '') + ' · ' + fmtShort(h.t)
                      : h.w + ' ' + unit + ' × ' + h.r + (h.e1rm ? ' · e1RM ' + h.e1rm : '') + ' · ' + fmtShort(h.t)}
                  </Text>
                </View>
                <View style={[s.row, { alignItems: 'center' }]}>
                  <Text style={{ ...T.caption2, color: C.gold, fontVariant: ['tabular-nums'], marginRight: 9 }}>+{h.xp || 0}</Text>
                  <Text style={{ ...T.headline, color: C.faint, fontWeight: '600' }}>›</Text>
                </View>
              </Pressable>
            ))}
            {filtered.length > limit ? (
              <Pressable onPress={() => setLimit((v) => v + 25)} hitSlop={8} style={{ alignItems: 'center', paddingTop: 14 }}>
                <Text style={{ ...T.caption, color: C.gold, fontWeight: '700' }}>
                  Show 25 more ({filtered.length - limit} left)
                </Text>
              </Pressable>
            ) : null}
          </View>
        )}
      </Card>

      {editingId ? (
        <EntryEditor
          entry={all.find((h) => h.id === editingId)}
          unit={unit}
          onSave={(patch) => { if (onEdit) onEdit(editingId, patch); setEditingId(null); }}
          onDelete={() => { if (onDelete) onDelete(editingId); setEditingId(null); }}
          onClose={() => setEditingId(null)}
        />
      ) : null}
    </View>
  );
}

/* ------------------------------- pieces ---------------------------------- */

function RangeBar({ range, setRange }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 10 }}>
      {RANGES.map((rg) => (
        <Pressable key={rg[0]} onPress={() => setRange(rg[0])} hitSlop={6}
          style={{
            paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, marginLeft: 6,
            backgroundColor: range === rg[0] ? C.goldSoft : 'transparent',
            borderWidth: 1, borderColor: range === rg[0] ? C.gold : C.line,
          }}>
          <Text style={{ ...T.caption2, fontWeight: '700', color: range === rg[0] ? C.gold : C.dim, fontVariant: ['tabular-nums'] }}>{rg[1]}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function Metric({ label, value, tint, big, muted }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={{
        fontSize: big ? 26 : 22, fontWeight: '800', fontVariant: ['tabular-nums'],
        color: muted ? C.mut : (tint || C.text),
      }}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </Text>
      <Text style={{ ...T.micro, fontWeight: '700', color: C.dim, letterSpacing: 0.9, marginTop: 3 }}>{label}</Text>
    </View>
  );
}

function Divider() {
  return <View style={{ width: 1, backgroundColor: C.line, marginHorizontal: 4 }} />;
}

// 12-week consistency grid — 7 rows x 12 columns, GitHub-style.
function Heatmap({ dayXP, now }) {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const todayT = today.getTime();
  const start = todayT - (today.getDay() + 11 * 7) * DAY;

  let max = 1;
  Object.keys(dayXP).forEach((k) => { if (dayXP[k] > max) max = dayXP[k]; });

  const cells = [];
  for (let col = 0; col < 12; col++) {
    const week = [];
    for (let row = 0; row < 7; row++) {
      const t = start + (col * 7 + row) * DAY;
      week.push({ t, xp: t > todayT ? -1 : (dayXP[dayKeyOf(t)] || 0) });
    }
    cells.push(week);
  }

  const shade = (xp) => {
    if (xp < 0) return 'transparent';
    if (xp === 0) return C.panel2;
    const r = Math.min(1, xp / max);
    if (r > 0.66) return C.gold;
    if (r > 0.33) return 'rgba(245,192,74,0.62)';
    return 'rgba(245,192,74,0.3)';
  };

  const activeDays = Object.keys(dayXP).length;

  return (
    <View style={{ marginTop: 12 }}>
      <View style={{ flexDirection: 'row' }}>
        {cells.map((week, ci) => (
          <View key={ci} style={{ marginRight: 4 }}>
            {week.map((d, ri) => (
              <View key={ri} style={{
                width: 11, height: 11, borderRadius: 2.5, marginBottom: 4,
                backgroundColor: shade(d.xp),
                borderWidth: d.xp === 0 ? 1 : 0, borderColor: C.line,
              }} />
            ))}
          </View>
        ))}
      </View>
      <View style={[s.between, { marginTop: 8, alignItems: 'center' }]}>
        <Text style={{ ...T.caption2, color: C.dim }}>
          {activeDays} active day{activeDays === 1 ? '' : 's'} logged
        </Text>
        <View style={[s.row, { alignItems: 'center' }]}>
          <Text style={{ ...T.micro, color: C.dim, marginRight: 5 }}>less</Text>
          {[C.panel2, 'rgba(245,192,74,0.3)', 'rgba(245,192,74,0.62)', C.gold].map((c, i) => (
            <View key={i} style={{
              width: 9, height: 9, borderRadius: 2, backgroundColor: c, marginRight: 3,
              borderWidth: i === 0 ? 1 : 0, borderColor: C.line,
            }} />
          ))}
          <Text style={{ ...T.micro, color: C.dim, marginLeft: 2 }}>more</Text>
        </View>
      </View>
    </View>
  );
}
