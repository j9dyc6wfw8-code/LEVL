// ============================================================================
// LEVL — SESSIONS
//
// The training log stores one record per set. A "workout" is a cluster of those
// records. This module is the single place that turns records into sessions, so
// the Check In composer, the feed card, the Live Activity and the Train summary
// all describe a session exactly the same way.
//
// Records written from Build 28 onward carry `sid` (see resolveSessionId in
// engine.js). Anything logged before that has none, so it is clustered by time
// gap here. Historical saves therefore gain sessions without being migrated,
// rewritten or touched in any way.
//
// Pure functions only — no platform APIs, no Supabase, no React.
// ============================================================================

import { SESSION_GAP_MS, EXERCISES, dayKeyOf, toKg } from './engine';

const catOf = (name) => {
  const ex = EXERCISES.find((e) => e.n === name);
  return ex ? ex.c : null;
};

// Which broad movement pattern a category belongs to. Used only to NAME a
// session; nothing scores off it.
const PUSH = ['Chest', 'Shoulders', 'Triceps'];
const PULL = ['Back', 'Biceps', 'Forearms', 'Traps'];
const LEGS = ['Quads', 'Hamstrings', 'Glutes', 'Calves', 'Adductors'];

/* ---------------------------------------------------------------------------
 * Grouping
 * ------------------------------------------------------------------------ */

// All records for one save, oldest first.
function allEntries(data) {
  return [...((data && data.lifts) || []), ...((data && data.cardio) || [])]
    .filter((e) => e && typeof e.t === 'number')
    .sort((a, b) => a.t - b.t);
}

// Split records into sessions. Prefers the stored `sid`; falls back to a time
// gap for legacy records. Returns newest session first.
export function groupSessions(data) {
  const entries = allEntries(data);
  if (!entries.length) return [];

  const out = [];
  let current = null;

  for (const e of entries) {
    const sameStoredSession = current && e.sid && current.id === e.sid;
    const withinGap = current && !e.sid && !current.stored
      && e.t - current.endedAt <= SESSION_GAP_MS;

    if (sameStoredSession || withinGap) {
      current.entries.push(e);
      current.endedAt = Math.max(current.endedAt, e.t);
      continue;
    }
    current = {
      id: e.sid || ('legacy-' + e.id),
      stored: !!e.sid,
      startedAt: e.t,
      endedAt: e.t,
      entries: [e],
    };
    out.push(current);
  }
  return out.reverse();
}

// Sessions that fall on a given local day key (defaults to today).
export function sessionsOnDay(data, dayKey) {
  const key = dayKey || dayKeyOf(Date.now());
  return groupSessions(data).filter((sn) => dayKeyOf(sn.endedAt) === key);
}

export function findSession(data, sessionId) {
  if (!sessionId) return null;
  return groupSessions(data).find((sn) => sn.id === sessionId) || null;
}

/* ---------------------------------------------------------------------------
 * Naming
 * ------------------------------------------------------------------------ */

// A short, honest name for what was trained. Derived from the movements that
// were actually logged — never invented, never a placeholder.
export function sessionTitle(session) {
  if (!session || !session.entries.length) return 'Session';
  const lifts = session.entries.filter((e) => e.kind !== 'cardio');
  const cardio = session.entries.filter((e) => e.kind === 'cardio');

  if (!lifts.length) {
    if (!cardio.length) return 'Session';
    // A single cardio type names itself; several become a generic label.
    const names = [...new Set(cardio.map((e) => e.ex))];
    if (names.length === 1) return names[0];
    return cardio.some((e) => /Yoga|Stretch|Foam/i.test(e.ex)) ? 'Recovery' : 'Conditioning';
  }

  const cats = lifts.map((l) => catOf(l.ex)).filter(Boolean);
  const has = (list) => cats.some((c) => list.includes(c));
  const push = has(PUSH), pull = has(PULL), legs = has(LEGS);
  const core = cats.includes('Core');
  const power = cats.includes('Power');

  if (push && pull && legs) return 'Full Body';
  if (push && pull) return 'Upper';
  if (legs && !push && !pull) return 'Legs';
  if (push && !pull) return 'Push';
  if (pull && !push) return 'Pull';
  if (power) return 'Power';
  if (core) return 'Core';

  // Single-category session: name it after the muscle group.
  const unique = [...new Set(cats)];
  return unique.length === 1 ? unique[0] : 'Session';
}

// The same naming, applied to a bare list of exercise names.
//
// A Check In's workout summary is computed in the database (so the numbers are
// the user's real training log rather than something a phone asserted), but the
// database has no idea that Bench Press is a push movement — that mapping lives
// in the exercise library here. So the server sends the names and the client
// names the session, using the identical rules as above.
export function titleFromExerciseNames(names, hasCardioOnly) {
  const list = (names || []).filter(Boolean);
  if (!list.length) return hasCardioOnly ? 'Conditioning' : 'Session';
  return sessionTitle({
    entries: list.map((n) => ({
      ex: n,
      kind: catOf(n) ? 'lift' : 'cardio',
      t: 0,
    })),
  });
}

/* ---------------------------------------------------------------------------
 * Summary
 * ------------------------------------------------------------------------ */

// Everything the UI is allowed to show about a session.
//
// DELIBERATELY OMITTED: RPE, per-set notes, bodyweight, anything about how hard
// something felt. A Check In is public; effort data is not. Only fields that
// genuinely exist in the log appear here — nothing is estimated or invented.
export function summariseSession(session, unit) {
  if (!session || !session.entries.length) return null;
  const u = unit || 'kg';
  const lifts = session.entries.filter((e) => e.kind !== 'cardio');
  const cardio = session.entries.filter((e) => e.kind === 'cardio');

  // Volume is normalised to kg so a lb user and a kg user are describing the
  // same physical work. The display layer converts back if needed.
  const volumeKg = lifts.reduce((sum, l) => sum + toKg(l.w || 0, u) * (l.r || 0), 0);

  // Exercises in the order they were first performed — that is the order the
  // session actually happened in, which reads far better than alphabetical.
  const seen = new Map();
  for (const e of session.entries) {
    if (!e.ex) continue;
    if (!seen.has(e.ex)) seen.set(e.ex, { name: e.ex, sets: 0, first: e.t, cardio: e.kind === 'cardio' });
    seen.get(e.ex).sets += 1;
  }
  const exercises = [...seen.values()].sort((a, b) => a.first - b.first);

  return {
    id: session.id,
    title: sessionTitle(session),
    startedAt: session.startedAt,
    endedAt: session.endedAt,
    durationMs: Math.max(0, session.endedAt - session.startedAt),
    sets: lifts.length,
    volumeKg: Math.round(volumeKg),
    cardioMinutes: cardio.reduce((s, c) => s + (c.mins || 0), 0),
    xp: session.entries.reduce((s, e) => s + (e.xp || 0), 0),
    prs: lifts.filter((l) => l.pr).length,
    exercises,
    exerciseNames: exercises.map((e) => e.name),
    entryCount: session.entries.length,
  };
}

// The sessions logged today, summarised and newest first. This is what the
// Check In composer offers to attach.
export function todaysSessions(data, now) {
  const key = dayKeyOf(now || Date.now());
  return sessionsOnDay(data, key)
    .map((sn) => summariseSession(sn, data && data.unit))
    .filter(Boolean);
}

// The most substantial session today, for the "attach this one" default. Ties
// break toward the one that finished most recently.
export function primarySessionToday(data, now) {
  const list = todaysSessions(data, now);
  if (!list.length) return null;
  return list.slice().sort((a, b) => (b.entryCount - a.entryCount) || (b.endedAt - a.endedAt))[0];
}

/* ---------------------------------------------------------------------------
 * Formatting helpers shared by every surface that renders a session
 * ------------------------------------------------------------------------ */

export function formatVolume(volumeKg, unit) {
  if (!volumeKg) return null;
  const v = unit === 'lb' ? volumeKg * 2.2046226 : volumeKg;
  return Math.round(v).toLocaleString() + ' ' + (unit === 'lb' ? 'lb' : 'kg');
}

export function formatDuration(ms) {
  const total = Math.max(0, Math.round((ms || 0) / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = total % 60;
  if (h > 0) return h + ':' + String(m).padStart(2, '0') + ':' + String(sec).padStart(2, '0');
  return m + ':' + String(sec).padStart(2, '0');
}

// "Now" / "4m" / "3h" / "Yesterday" / "12 Aug" — the relative style iOS uses.
export function relativeTime(t, now) {
  const ms = (now || Date.now()) - t;
  if (!isFinite(ms)) return '';
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return 'Now';
  if (mins < 60) return mins + 'm';
  const hours = Math.floor(mins / 60);
  if (hours < 24) return hours + 'h';
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return days + 'd';
  return new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

// Lateness, phrased the way the feed shows it. Under two minutes counts as on
// time — the point is authenticity, not punctuality to the second.
export function formatLateness(lateSeconds) {
  const late = Math.max(0, Math.round(lateSeconds || 0));
  if (late < 120) return null;
  const mins = Math.round(late / 60);
  if (mins < 60) return mins + 'm late';
  const hours = Math.floor(mins / 60);
  if (hours < 24) return hours + 'h late';
  return Math.floor(hours / 24) + 'd late';
}
