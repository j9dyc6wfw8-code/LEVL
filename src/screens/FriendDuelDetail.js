// LEVL — FriendDuelDetail: the rich head-to-head for an active friend duel.
// Shows both fighters (small characters), live XP, a momentum bar, and each
// player's live workout breakdown for the duel window — grouped activity,
// exercises, weight/reps, RPE, XP and PRs.
//
// Opponent data comes from the synced `workouts` table + their profile, so both
// sides are real. Opponent rows appear as their app syncs (offline-first).

import React, { useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, Pressable } from 'react-native';
import { C, s, MONO, T } from '../theme';
import { Card } from '../components/ui';
import { MiniHunter } from '../components/Hunter';
import { LoadoutCompare } from '../components/LoadoutCard';
import { DEFAULT_DATA } from '../engine/engine';
import useDuelWorkouts from '../hooks/useDuelWorkouts';

const SESSION_GAP_MS = 90 * 60 * 1000;
const asTime = (value) => {
  const t = new Date(value || 0).getTime();
  return Number.isFinite(t) ? t : 0;
};
const dayKey = (iso) => {
  const t = asTime(iso);
  return t ? new Date(t).toISOString().slice(0, 10) : 'unknown';
};
const dayLabel = (iso) => new Date(asTime(iso)).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
const timeLabel = (iso) => new Date(asTime(iso)).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

function summarize(rows, sessions) {
  return {
    totalXp: rows.reduce((a, r) => a + (r.xp_earned || 0), 0),
    sessions: sessions.length,
    sets: rows.reduce((a, r) => a + (Number(r.sets) || 1), 0),
    prs: rows.filter((r) => r.is_pr).length,
    volume: rows.reduce((a, r) => a + ((Number(r.weight) || 0) * (Number(r.reps) || 0) * (Number(r.sets) || 1)), 0),
  };
}
function groupIntoSessions(rows) {
  const sorted = (rows || []).slice().filter((r) => asTime(r.date)).sort((a, b) => asTime(b.date) - asTime(a.date));
  const sessions = [];
  sorted.forEach((row) => {
    const t = asTime(row.date);
    let session = sessions[sessions.length - 1];
    if (!session || session.day !== dayKey(row.date) || session.oldestT - t > SESSION_GAP_MS) {
      session = {
        key: (row.id || row.client_id || String(t)) + ':session',
        day: dayKey(row.date),
        newestT: t,
        oldestT: t,
        rows: [],
      };
      sessions.push(session);
    }
    session.oldestT = t;
    session.rows.push(row);
  });
  return sessions;
}

export default function FriendDuelDetail({ data, dv, duel, onQuit }) {
  const [confirmQuit, setConfirmQuit] = useState(false);
  const [quitting, setQuitting] = useState(false);
  const [quitError, setQuitError] = useState(null);

  const meId = duel.iAmOne ? duel.player_one : duel.player_two;
  const theirId = duel.iAmOne ? duel.player_two : duel.player_one;
  const opp = duel.opponent || {};
  const unit = data.unit || 'kg';
  const {
    mine, theirs, loading, refreshing, error, lastUpdated, live, refresh,
  } = useDuelWorkouts({
    duelId: duel.id,
    meId,
    theirId,
    startISO: duel.start_date,
    endISO: duel.end_date,
  });

  const winning = duel.myScore > duel.theirScore;
  const tied = duel.myScore === duel.theirScore;
  const total = Math.max(1, (duel.myScore || 0) + (duel.theirScore || 0));
  const myFrac = (duel.myScore || 0) / total;
  const myColor = dv.placed ? dv.tier.color : C.gold;

  const timeLeft = () => {
    if (!duel.end_date) return '';
    const ms = new Date(duel.end_date).getTime() - Date.now();
    if (ms <= 0) return 'ending';
    const d = Math.floor(ms / 86400000);
    return d >= 1 ? d + 'd left' : Math.floor(ms / 3600000) + 'h left';
  };

  return (
    <View style={{ padding: 2, paddingBottom: 20 }}>
      <Card style={{ borderWidth: 1, borderColor: C.gold }}>
        <View style={s.between}>
          <Text style={[s.label, { color: C.gold }]}>Friend Duel</Text>
          <Text style={{ ...T.micro, color: C.orange, fontWeight: '700' }}>{timeLeft()}</Text>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: 16 }}>
          <Fighter name={data.name} avatar={{ ...DEFAULT_DATA.avatar, ...(data.avatar || {}) }} color={myColor}
            level={dv.level} score={duel.myScore} scoreColor={tied ? C.text : winning ? C.green : C.text} />
          <View style={{ paddingHorizontal: 6, alignSelf: 'center' }}>
            <Text style={{ ...T.title2, color: C.faint }}>vs</Text>
          </View>
          <Fighter name={opp.display_name || opp.username || 'Rival'} avatar={{ ...DEFAULT_DATA.avatar, ...(opp.avatar || {}) }} color={C.orange}
            level={opp.level} score={duel.theirScore} scoreColor={tied ? C.text : !winning ? C.red : C.text} />
        </View>

        <View style={{ height: 8, borderRadius: 4, backgroundColor: C.panel2, marginTop: 16, flexDirection: 'row', overflow: 'hidden' }}>
          <View style={{ width: (myFrac * 100) + '%', backgroundColor: winning ? C.green : myColor }} />
          <View style={{ flex: 1, backgroundColor: C.orange, opacity: 0.55 }} />
        </View>

        <Text style={{ ...T.caption, color: winning ? C.green : tied ? C.dim : C.red, textAlign: 'center', marginTop: 12, fontWeight: '700' }}>
          {tied ? 'Dead even — log a workout to pull ahead' : winning ? "You're ahead — keep it up" : 'Behind — time to train'}
        </Text>
      </Card>

      {/* Both builds, side by side — a real friend's cosmetics, read from their
          synced profile. Visual only; nothing here changes the score. */}
      <Card style={{ marginTop: 14 }}>
        <Text style={[s.label, { color: C.gold }]}>Builds · your rival's setup</Text>
        <View style={{ marginTop: 10 }}>
          <LoadoutCompare
            you={{
              avatar: { ...DEFAULT_DATA.avatar, ...(data.avatar || {}) },
              equipped: data.equipped || DEFAULT_DATA.equipped,
              name: data.name,
              color: myColor,
            }}
            them={{
              avatar: { ...DEFAULT_DATA.avatar, ...(opp.avatar || {}) },
              equipped: (opp.character && opp.character.equipped) || DEFAULT_DATA.equipped,
              name: opp.display_name || opp.username || 'Rival',
              color: C.orange,
            }}
          />
        </View>
      </Card>

      {/* Quit — two taps required so it can't happen by accident. */}
      {onQuit && (
        <Pressable
          disabled={quitting}
          onPress={async () => {
            if (!confirmQuit) { setConfirmQuit(true); setTimeout(() => setConfirmQuit(false), 4000); return; }
            setQuitting(true);
            setQuitError(null);
            const result = await onQuit(duel.id);
            if (!result || !result.ok) setQuitError((result && result.error && result.error.message) || 'Could not quit this duel. Try again.');
            setQuitting(false);
          }}
          style={{
            marginTop: 14, paddingVertical: 13, borderRadius: 12, alignItems: 'center',
            borderWidth: 1, borderColor: confirmQuit ? C.red : C.line,
            backgroundColor: confirmQuit ? 'rgba(240,82,95,0.15)' : 'transparent',
          }}>
          <Text style={{ ...T.caption, fontWeight: '700', color: confirmQuit ? C.red : C.dim }}>
            {quitting ? 'Quitting…' : confirmQuit ? 'Tap again to forfeit this duel' : 'Quit duel'}
          </Text>
        </Pressable>
      )}
      {confirmQuit && !quitting && (
        <Text style={{ ...T.micro, color: C.dim, textAlign: 'center', marginTop: 6 }}>
          Forfeiting counts as a loss and can't be undone.
        </Text>
      )}
      {quitError ? (
        <Text style={{ ...T.caption, color: C.red, textAlign: 'center', marginTop: 7, fontWeight: '700' }}>
          {quitError}
        </Text>
      ) : null}

      <View style={{ marginTop: 14, paddingHorizontal: 4 }}>
        <View style={s.between}>
          <View style={s.row}>
            <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: live ? C.green : C.gold, marginRight: 7 }} />
            <Text style={{ ...T.micro, color: live ? C.green : C.mut, fontWeight: '700' }}>
              {live ? 'LIVE WORKOUT ACTIVITY' : 'AUTO-REFRESHING'}
            </Text>
          </View>
          <Pressable disabled={refreshing} onPress={refresh} hitSlop={10} accessibilityRole="button" accessibilityLabel="Refresh duel workouts">
            <Text style={{ ...T.micro, color: refreshing ? C.dim : C.gold, fontWeight: '700' }}>{refreshing ? 'REFRESHING…' : 'REFRESH'}</Text>
          </Pressable>
        </View>
        <Text style={{ ...T.micro, color: C.dim, marginTop: 4 }}>
          {lastUpdated ? 'Updated ' + new Date(lastUpdated).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : 'Connecting to both workout feeds…'}
        </Text>
        {error ? (
          <Text style={{ ...T.micro, color: C.red, marginTop: 4 }}>
            Could not refresh one workout feed. Tap Refresh to retry.
          </Text>
        ) : null}
      </View>

      {loading ? (
        <ActivityIndicator color={C.gold} style={{ marginTop: 28 }} />
      ) : (
        <>
          <PlayerBreakdown title="YOUR WORKOUTS" rows={mine || []} fallbackUnit={unit} accent={myColor} />
          <PlayerBreakdown title={(opp.display_name || opp.username || 'RIVAL').toUpperCase() + "'S WORKOUTS"} rows={theirs || []} fallbackUnit={null} accent={C.orange} />
          <Text style={{ ...T.footnote, color: C.mut, textAlign: 'center', marginTop: 14, paddingHorizontal: 20, fontWeight: '700' }}>
            New sets appear live.
          </Text>
        </>
      )}
    </View>
  );
}

function Fighter({ name, avatar, color, level, score, scoreColor }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <MiniHunter avatar={avatar} tierColor={color} size={68} />
      <Text numberOfLines={1} style={{ ...T.caption, color: C.text, fontWeight: '700', marginTop: 8, maxWidth: 130 }}>{name || 'You'}</Text>
      {level != null && <Text style={{ ...T.micro, color: C.dim }}>LV {level}</Text>}
      <Text style={{ ...T.display, color: scoreColor, marginTop: 6 }}>{score || 0}</Text>
      <Text style={{ ...T.micro, color: C.dim }}>XP</Text>
    </View>
  );
}

function PlayerBreakdown({ title, rows, fallbackUnit, accent }) {
  const sessions = groupIntoSessions(rows);
  const sum = summarize(rows, sessions);
  const loadedRows = rows.filter((r) => Number(r.weight) > 0 && Number(r.reps) > 0);
  const rowUnit = (r) => (r.unit === 'kg' || r.unit === 'lb') ? r.unit : fallbackUnit;
  const volumeUnits = new Set(loadedRows.map(rowUnit).filter(Boolean));
  const hasUnknownVolumeUnit = loadedRows.some((r) => !rowUnit(r));
  const volumeUnit = !hasUnknownVolumeUnit && volumeUnits.size === 1 ? Array.from(volumeUnits)[0] : null;
  return (
    <Card style={{ marginTop: 14 }}>
      <View style={s.between}>
        <Text style={[s.label, { color: accent }]}>{title}</Text>
        <Text style={{ ...T.micro, color: C.dim, fontVariant: ['tabular-nums'] }}>{sum.totalXp} XP</Text>
      </View>
      <View style={{ flexDirection: 'row', marginTop: 10 }}>
        <Stat n={sum.sessions} label="workouts" />
        <Stat n={sum.sets} label="sets" />
        <Stat n={sum.prs} label="PRs" accent={sum.prs ? C.gold : undefined} />
      </View>
      {sum.volume > 0 && volumeUnit ? (
        <Text style={{ ...T.micro, color: C.dim, marginTop: 8 }}>
          {formatNumber(sum.volume)} {volumeUnit} total load volume
        </Text>
      ) : null}
      {sessions.length === 0 ? (
        <Text style={{ ...T.caption, color: C.dim, marginTop: 10 }}>No workouts synced in this duel yet.</Text>
      ) : sessions.map((session) => {
        const sessionXp = session.rows.reduce((a, r) => a + (Number(r.xp_earned) || 0), 0);
        const sessionSets = session.rows.reduce((a, r) => a + (Number(r.sets) || 1), 0);
        return (
          <View key={session.key} style={{ marginTop: 16 }}>
            <View style={[s.between, { marginBottom: 4 }]}>
              <Text style={{ ...T.micro, color: C.faint, fontWeight: '700' }}>
                {dayLabel(session.newestT).toUpperCase()} · {timeLabel(session.oldestT)}
              </Text>
              <Text style={{ ...T.micro, color: accent, fontVariant: ['tabular-nums'] }}>
                {sessionSets} {sessionSets === 1 ? 'SET' : 'SETS'} · {sessionXp} XP
              </Text>
            </View>
            {session.rows.map((r, i) => (
              <View key={r.id || r.client_id || session.key + ':' + i} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 7, borderBottomWidth: i < session.rows.length - 1 ? StyleSheet.hairlineWidth : 0, borderBottomColor: C.line }}>
                <Text style={{ ...T.caption, color: r.is_pr ? C.gold : C.text, flex: 1 }} numberOfLines={1}>
                  {r.is_pr ? '★ ' : ''}{r.exercise || 'Exercise'}
                </Text>
                <Text style={{ ...T.micro, color: C.mut, marginHorizontal: 8 }}>
                  {workoutDetail(r, fallbackUnit)}
                </Text>
                <Text style={{ ...T.micro, color: accent, fontVariant: ['tabular-nums'], fontWeight: '700' }}>+{r.xp_earned || 0}</Text>
              </View>
            ))}
          </View>
        );
      })}
    </Card>
  );
}

function formatNumber(value) {
  const n = Number(value) || 0;
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, '');
}

function workoutDetail(row, fallbackUnit) {
  const isCardio = row.kind === 'cardio' || Number(row.duration) > 0;
  if (isCardio) {
    const parts = [];
    if (Number(row.duration) > 0) parts.push(formatNumber(row.duration) + ' min');
    if (Number(row.distance) > 0) parts.push(formatNumber(row.distance) + ' km');
    return parts.length ? parts.join(' · ') : 'Cardio';
  }

  const weight = Number(row.weight) || 0;
  const reps = Number(row.reps) || 0;
  const unit = row.unit === 'kg' || row.unit === 'lb' ? row.unit : fallbackUnit;
  let detail = weight > 0
    ? formatNumber(weight) + (unit ? ' ' + unit : '') + ' × ' + reps
    : reps > 0 ? reps + ' reps' : 'Logged set';
  if (row.rpe) detail += ' · RPE ' + formatNumber(row.rpe);
  return detail;
}

function Stat({ n, label, accent }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ ...T.title2, color: accent || C.text, fontVariant: ['tabular-nums'] }}>{n}</Text>
      <Text style={{ ...T.micro, color: C.dim }}>{label}</Text>
    </View>
  );
}
