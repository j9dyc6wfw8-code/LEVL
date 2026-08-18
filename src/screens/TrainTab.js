// LEVL React Native — Train hub (Log Lift · Cardio · Calculator)
import React, { useState, useMemo } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet, useWindowDimensions } from 'react-native';
import { C, s, MONO, alpha } from '../theme';
import { Card, Lbl, Chip, PBar, NumField, GoldBtn, GreenBtn, FadeIn, CountUp, Sheet, ScreenHeader, Segmented } from '../components/ui';
import MuscleIcon from '../components/MuscleIcon';
import { exerciseInfo } from '../engine/exerciseInfo';
import { todaysSessions, formatVolume } from '../engine/session';
import {
  EXERCISES, CATEGORIES, CARDIO_TYPES, INTENSITIES, STAT_META, INTEGRITY,
  weightForReps, pctForReps, roundLoad, dayKeyOf,
  loadNote, fmtShort, intensityKeyOf,
  // The engine's own cardio XP formula. Imported rather than re-implemented, so
  // the number the composer previews can never drift from the number awarded.
  cardioXPCalc,
} from '../engine/engine';

// Each muscle group gets an icon + colour, so the exercise list reads visually
// at a glance instead of as a wall of text. Vector emoji — instant load, no
// image library, no licensing, always crisp. Colour draws from the theme accents.
// Muscle groups, organised by body region and drawn as an anatomical figure
// rather than an emoji. Region drives the colour; the stat each exercise
// trains is shown as its own chip, because 11 of the 14 categories are
// STR-dominant — colouring by stat alone would make almost every tile the
// same red and tell you nothing.
const REGIONS = [
  { key: 'chest',     title: 'Chest',     glyph: 'chest',     color: C.red,    cats: ['Chest'] },
  { key: 'back',      title: 'Back',      glyph: 'back',      color: C.blue,   cats: ['Back', 'Traps'] },
  { key: 'shoulders', title: 'Shoulders', glyph: 'shoulders', color: C.orange, cats: ['Shoulders'] },
  { key: 'arms',      title: 'Arms',      glyph: 'arms',      color: C.cyan,   cats: ['Biceps', 'Triceps', 'Forearms'] },
  { key: 'legs',      title: 'Legs',      glyph: 'legs',      color: C.purp,   cats: ['Quads', 'Hamstrings', 'Glutes', 'Calves', 'Adductors'] },
  { key: 'core',      title: 'Core',      glyph: 'core',      color: C.green,  cats: ['Core'] },
  { key: 'power',     title: 'Power',     glyph: 'power',     color: C.gold,   cats: ['Power'] },
];
const CAT_REGION = {};
REGIONS.forEach((r) => r.cats.forEach((c) => { CAT_REGION[c] = r; }));
const catMeta = (c) => CAT_REGION[c] || REGIONS[0];

/* --------------------- Workout Day exercise shape ------------------------
 * A saved Workout Day stores its exercises as OBJECTS — { n, c, p, s } — built
 * by the DayBuilder. The run-a-day UI treated them as plain strings, so the
 * progress chips rendered an object straight into a <Text>. React Native throws
 * on that ("Objects are not valid as a React child"), which is why tapping a
 * Workout Day crashed the screen rather than starting the day.
 *
 * Both shapes are handled here because the very first saves stored bare names,
 * and those days are still sitting in people's saves.
 */
const exName = (e) => (typeof e === 'string' ? e : (e && e.n) || '');

// Resolve to a COMPLETE exercise record. The library is authoritative: a stored
// copy can be missing `p`, and STAT_META[undefined].color throws just as hard.
const resolveEx = (e) => {
  const n = exName(e);
  if (!n) return null;
  const known = EXERCISES.find((x) => x.n === n);
  if (known) return known;
  const src = (e && typeof e === 'object') ? e : {};
  return { n, c: src.c || 'Chest', p: src.p || 'STR', s: src.s || null };
};

// Every exercise in a day, normalised and with anything unreadable dropped.
const dayExercises = (day) => ((day && day.exercises) || []).map(resolveEx).filter(Boolean);

/* ------------------------------- Log Lift -------------------------------- */
// Effort scale. Values are unchanged (6–10) because XP is derived from them —
// only the presentation changes, from a number nobody outside the gym knows to
// a question anyone can answer.
const EFFORT = [
  { v: 6,  label: 'Easy',   hint: 'Could have done 4 or more extra reps.' },
  { v: 7,  label: 'Steady', hint: 'Could have done about 3 more reps.' },
  { v: 8,  label: 'Hard',   hint: 'Could have done about 2 more reps.' },
  { v: 9,  label: 'Very hard', hint: 'Maybe 1 more rep left in the tank.' },
  { v: 10, label: 'Maximal',   hint: 'Nothing left — could not do another rep.' },
];

function LogView({ data, dv, onLog, onLogBatch, workoutDays, onSaveDay, onDeleteDay, session, onEditEntry, onDeleteEntry }) {
  const [query, setQuery] = useState('');
  const [cat, setCat] = useState('All');
  // Selection and in-progress entry live in TrainTab so switching to the
  // Calculator and back doesn't wipe what you were doing (you go to the
  // calculator precisely to work out the weight you're about to log).
  const { sel, setSel, w, setW, r, setR, rpe, setRpe, dayMode, setDayMode } = session;
  const [last, setLast] = useState(null);
  const [sets, setSets] = useState(1);   // >1 = "I did this N times and forgot to log"
  const [pickerOpen, setPickerOpen] = useState(false);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [editDay, setEditDay] = useState(null);
  const { width: winW } = useWindowDimensions();
  const [region, setRegion] = useState(null);   // selected body region, drives the picker
  const [infoOpen, setInfoOpen] = useState(false);
  // Arms the two-tap confirm on END, so a single mistap can't discard a day.
  const [endArmed, setEndArmed] = useState(false);
  // Opens the editor on the set that was just logged — the moment you are most
  // likely to notice you typed 100 instead of 10.
  const [fixOpen, setFixOpen] = useState(false);
  const unit = data.unit;
  const days = workoutDays || [];
  const totalLogged = (data.lifts || []).length + (data.cardio || []).length;
  // The figure was a fixed 40pt, so it filled 37% of the tile on an SE but only
  // 32% on a Pro Max — visibly smaller on the bigger phone. Scale it instead.
  const tileW = (winW - 28) * 0.315;
  const figSize = Math.max(38, Math.min(56, Math.round(tileW * 0.44)));

  /* ------------------------- running a Workout Day -------------------------
   * The old model was a bare cursor: { day, idx }, advanced only by idx + 1.
   * Two things followed from that, both reported as bugs:
   *
   *   - You could never go BACK, and never jump. If the squat rack was busy you
   *     had no way to take exercise 4 first and return to 2 — the day walked in
   *     one direction only.
   *   - END wiped the run instantly with no confirmation, so one stray tap on a
   *     control sitting right next to "NEXT EXERCISE" lost your place entirely.
   *
   * `done` turns the cursor into real progress: which exercises you've actually
   * finished, independent of where you're standing right now.
   * ---------------------------------------------------------------------- */
  const resetEntry = () => { setW(''); setR(''); setRpe(8); setLast(null); };

  const startDay = (day) => {
    const listed = dayExercises(day);
    if (!listed.length) return;
    // Normalised ONCE, on the way in, so every reader below can rely on a full
    // exercise record rather than re-deriving it and getting it wrong.
    setDayMode({ day: { ...day, exercises: listed }, idx: 0, done: [] });
    setSel(listed[0]);
    resetEntry();
    setEndArmed(false);
  };

  // Jump to ANY exercise. Tapping a chip moves you without marking anything
  // done — you're choosing where to stand, not claiming to have finished.
  const goToExercise = (i) => {
    if (!dayMode) return;
    const list = dayMode.day.exercises || [];
    if (i < 0 || i >= list.length) return;
    setDayMode({ day: dayMode.day, idx: i, done: dayMode.done || [] });
    setSel(list[i]);
    resetEntry();
    setEndArmed(false);
  };

  const finishDay = () => {
    setDayMode(null);
    setSel(null);
    setW('');
    setR('');
    setLast(null);
    setEndArmed(false);
  };

  // "Next" ticks off the current exercise and lands on the first one still
  // outstanding, so jumping around never strands you on a finished lift.
  const advanceDay = () => {
    if (!dayMode) return;
    const list = dayMode.day.exercises || [];
    const prev = dayMode.done || [];
    const done = prev.includes(dayMode.idx) ? prev : prev.concat(dayMode.idx);
    const nextUndone = list.findIndex((_, i) => !done.includes(i));
    if (nextUndone === -1) { finishDay(); return; }
    setDayMode({ day: dayMode.day, idx: nextUndone, done });
    setSel(list[nextUndone]);
    resetEntry();
    setEndArmed(false);
  };

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    // A region covers several categories (Arms = biceps + triceps + forearms),
    // so match the region when one is picked and fall back to the flat category.
    const inScope = (e) => {
      if (query.trim()) return true;              // searching ignores the filter
      if (region) return region.cats.indexOf(e.c) >= 0;
      return cat === 'All' || e.c === cat;
    };
    return EXERCISES.filter((e) => inScope(e) && (!q || e.n.toLowerCase().includes(q))).slice(0, 60);
  }, [query, cat, region]);

  const todayCount = sel ? data.lifts.filter((l) => l.ex === sel.n && dayKeyOf(l.t) === dayKeyOf(Date.now())).length : 0;
  const best = sel && dv.best[sel.n] ? dv.best[sel.n].e1rm : 0;

  const log = () => {
    const wN = parseFloat(w) || 0, rN = parseInt(r, 10) || 0;
    if (!sel || rN < 1) return;
    const meta = (sets > 1 && onLogBatch)
      ? onLogBatch(sel.n, wN, rN, rpe, sets)
      : onLog(sel.n, wN, rN, rpe);
    if (meta) setLast({ ...meta, ex: sel.n, seq: Date.now() });
    setSets(1);
  };

  return (
    <View>
      {!sel ? (
        <View>
          {/* First-run guidance. A new account previously landed on a muscle
              grid with no statement of what to do or what happens next, which
              is the hardest moment to get right. Disappears after 3 sets. */}
          {totalLogged < 3 ? (
            <View style={{
              marginTop: 4, marginBottom: 16, padding: 16, borderRadius: 14,
              backgroundColor: C.panel, borderWidth: 1, borderColor: C.gold,
            }}>
              <Text style={{ fontSize: 10, fontWeight: '800', letterSpacing: 1.4, color: C.gold }}>
                {totalLogged === 0 ? 'START HERE' : 'NEXT STEP'}
              </Text>
              <Text style={{ fontSize: 21, fontWeight: '900', color: C.text, marginTop: 6, letterSpacing: -0.4 }}>
                {totalLogged === 0 ? 'Log one set to begin' : 'Log ' + (3 - totalLogged) + ' more set' + (3 - totalLogged === 1 ? '' : 's')}
              </Text>
              <Text style={{ fontSize: 13.5, color: C.mut, marginTop: 6, lineHeight: 19 }}>
                {totalLogged === 0
                  ? 'Pick a muscle, then enter weight and reps.'
                  : 'Five training days unlocks your rank.'}
              </Text>
              <View style={[s.row, { marginTop: 12 }]}>
                {[0, 1, 2].map((i) => (
                  <View key={i} style={{
                    flex: 1, height: 4, borderRadius: 2, marginRight: i < 2 ? 5 : 0,
                    backgroundColor: i < totalLogged ? C.gold : C.panel2,
                  }} />
                ))}
              </View>
            </View>
          ) : null}

          {/* One heading, one instruction. The instruction is suppressed while
              the onboarding card is up, because that card already says it. */}
          <ScreenHeader title="Log a lift" hint={totalLogged < 3 ? null : 'Pick a muscle group'} />

          {/* body-region grid — the figure shows WHERE, the colour groups it.
              Power is handled separately below: it's whole-body rather than a
              region, and as a 7th tile it sat alone on its own row. */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
            {REGIONS.filter((r) => r.key !== 'power').map((rg) => {
              const count = EXERCISES.filter((e) => rg.cats.indexOf(e.c) >= 0).length;
              return (
                <Pressable key={rg.key}
                  onPress={() => { setRegion(rg); setCat(rg.cats[0]); setQuery(''); setPickerOpen(true); }}
                  accessibilityRole="button"
                  accessibilityLabel={rg.title + ', ' + count + ' exercises'}
                  style={{
                    width: '31.5%', marginBottom: 10, paddingVertical: 12,
                    borderRadius: 16, backgroundColor: rg.color + '16',
                    borderWidth: 1.5, borderColor: rg.color + '55',
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                  <MuscleIcon group={rg.glyph} color={rg.color} size={figSize} />
                  <Text style={{ fontSize: 13.5, fontWeight: '800', color: C.text, marginTop: 7 }}>{rg.title}</Text>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: rg.color, marginTop: 1 }}>{count} moves</Text>
                </Pressable>
              );
            })}
          </View>

          {/* Power — whole-body explosive work, so it reads as its own thing */}
          {(() => {
            const pw = REGIONS.find((r) => r.key === 'power');
            const count = EXERCISES.filter((e) => pw.cats.indexOf(e.c) >= 0).length;
            return (
              <Pressable
                onPress={() => { setRegion(pw); setCat(pw.cats[0]); setQuery(''); setPickerOpen(true); }}
                accessibilityRole="button" accessibilityLabel={'Power, ' + count + ' exercises'}
                style={{
                  flexDirection: 'row', alignItems: 'center',
                  paddingVertical: 12, paddingHorizontal: 16, borderRadius: 16, marginBottom: 10,
                  backgroundColor: pw.color + '16', borderWidth: 1.5, borderColor: pw.color + '55',
                }}>
                <MuscleIcon group={pw.glyph} color={pw.color} size={figSize * 0.8} />
                <View style={{ flex: 1, marginLeft: 14 }}>
                  <Text style={{ fontSize: 15, fontWeight: '800', color: C.text }}>Power</Text>
                  <Text style={{ fontSize: 12, color: C.mut, marginTop: 2 }}>Explosive, whole-body movements</Text>
                </View>
                <Text style={{ fontSize: 11, fontWeight: '800', color: pw.color }}>{count} moves</Text>
              </Pressable>
            );
          })()}

          {/* browse-all fallback */}
          <Pressable onPress={() => { setCat('All'); setQuery(''); setPickerOpen(true); }}
            style={{ marginTop: 4, paddingVertical: 14, borderRadius: 14, backgroundColor: C.panel2, borderWidth: 1, borderColor: C.line, alignItems: 'center' }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: C.gold }}>Browse all {EXERCISES.length} exercises  ›</Text>
          </Pressable>

          {/* Workout Days are saved routines, not calendar dates. */}
          <View style={{ marginTop: 18 }}>
            <View style={s.between}>
              <Text style={{ fontSize: 22, fontWeight: '800', color: C.text }}>Workout Days</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Create a Workout Day"
                onPress={() => { setEditDay(null); setBuilderOpen(true); }}
                hitSlop={8}
                style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: C.goldSoft, borderWidth: 1, borderColor: C.gold }}>
                <Text style={{ fontSize: 12, color: C.gold, fontWeight: '800' }}>+ CREATE</Text>
              </Pressable>
            </View>
            {/* The 3-step strip, the headline and the sub-line all explained
                the same idea. One line, shown only when there is nothing saved
                yet — once you have a routine you don't need telling. */}
            {days.length === 0 ? (
              <View style={{
                marginTop: 10, padding: 13, borderRadius: 14,
                backgroundColor: C.cyanSoft, borderWidth: 1, borderColor: C.cyan + '55',
              }}>
                <Text style={{ fontSize: 15, fontWeight: '800', color: C.text }}>Save a routine once, run it any time.</Text>
                <Text style={{ fontSize: 13.5, fontWeight: '600', color: C.mut, marginTop: 4, lineHeight: 19 }}>
                  Tap CREATE, name it, add your moves.
                </Text>
              </View>
            ) : null}

            {days.length === 0 ? (
              <Pressable onPress={() => { setEditDay(null); setBuilderOpen(true); }} style={{
                marginTop: 10, minHeight: 76, borderRadius: 14, borderWidth: 1, borderStyle: 'dashed',
                borderColor: C.line, alignItems: 'center', justifyContent: 'center', padding: 12,
              }}>
                <Text style={{ fontSize: 15, fontWeight: '800', color: C.gold }}>Create your first Workout Day</Text>
                <Text style={{ fontSize: 13, color: C.mut, marginTop: 3 }}>Try Push, Pull or Legs.</Text>
              </Pressable>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
                {days.map((d) => (
                  <View key={d.id} style={{ width: 190, backgroundColor: C.panel2, borderRadius: 14, borderWidth: 1, borderColor: C.line, marginRight: 10, overflow: 'hidden' }}>
                    <Pressable onPress={() => startDay(d)} style={{ padding: 13, minHeight: 108 }}>
                      <Text style={{ fontSize: 17, fontWeight: '800', color: C.text }} numberOfLines={1}>{d.name}</Text>
                      <Text style={{ fontSize: 11, color: C.cyan, fontWeight: '800', marginTop: 3, fontVariant: ['tabular-nums'] }}>{(d.exercises || []).length} EXERCISES</Text>
                      <Text style={{ fontSize: 12, color: C.mut, marginTop: 7, lineHeight: 17 }} numberOfLines={2}>
                        {(d.exercises || []).map(exName).filter(Boolean).join(' · ')}
                      </Text>
                    </Pressable>
                    <View style={{ flexDirection: 'row', borderTopWidth: 1, borderTopColor: C.line }}>
                      <Pressable onPress={() => startDay(d)} style={{ flex: 1, minHeight: 40, alignItems: 'center', justifyContent: 'center', backgroundColor: C.goldSoft }}>
                        <Text style={{ fontSize: 11, fontWeight: '800', color: C.gold }}>START</Text>
                      </Pressable>
                      <Pressable onPress={() => { setEditDay(d); setBuilderOpen(true); }} style={{ width: 64, minHeight: 40, alignItems: 'center', justifyContent: 'center', borderLeftWidth: 1, borderLeftColor: C.line }}>
                        <Text style={{ fontSize: 11, fontWeight: '700', color: C.mut }}>EDIT</Text>
                      </Pressable>
                    </View>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      ) : (
        <View>
        {dayMode && (() => {
          const list = dayMode.day.exercises || [];
          const done = dayMode.done || [];
          const doneCount = done.length;
          const allDone = doneCount >= list.length;
          return (
          <Card style={{ borderWidth: 1, borderColor: C.gold, marginBottom: 10 }}>
            <View style={s.between}>
              <View style={{ flex: 1, marginRight: 12 }}>
                <Text style={{ fontSize: 10, fontWeight: '800', color: C.gold, letterSpacing: 1.1 }}>WORKOUT DAY</Text>
                <Text style={{ fontSize: 18, fontWeight: '800', color: C.text, marginTop: 3 }}>{dayMode.day.name}</Text>
              </View>
              {/* Progress is DONE / total. It used to be idx+1 / total, which
                  claimed exercise 1 was complete the instant you started. */}
              <Text style={{ fontSize: 13, color: C.gold, fontWeight: '800', fontVariant: ['tabular-nums'] }}>
                {doneCount}/{list.length} done
              </Text>
            </View>
            <View style={{ marginTop: 10 }}>
              <PBar pct={(doneCount / Math.max(1, list.length)) * 100} color={C.gold} height={7} />
            </View>

            {/* The whole day, tappable. This is the fix for training out of
                order: take whatever rack is free, come back to the rest. */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginTop: 12, marginHorizontal: -2 }}
              contentContainerStyle={{ paddingHorizontal: 2 }}>
              {list.map((item, i) => {
                const name = exName(item);
                const isDone = done.includes(i);
                const isNow = i === dayMode.idx;
                return (
                  <Pressable
                    key={name + i}
                    onPress={() => goToExercise(i)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isNow }}
                    accessibilityLabel={`${name}${isDone ? ', done' : ''}${isNow ? ', current' : ''}`}
                    style={{
                      minHeight: 40, justifyContent: 'center',
                      paddingHorizontal: 12, marginRight: 6, borderRadius: 10,
                      backgroundColor: isNow ? C.gold : isDone ? C.greenSoft : C.panel2,
                      borderWidth: 1,
                      borderColor: isNow ? C.gold : isDone ? C.green : C.line,
                    }}>
                    <Text
                      numberOfLines={1}
                      style={{
                        fontSize: 12, fontWeight: '800', maxWidth: 132,
                        color: isNow ? C.ink : isDone ? C.green : C.mut,
                      }}>
                      {isDone ? '✓ ' : (i + 1) + '. '}{name}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <View style={{ flexDirection: 'row', marginTop: 12, alignItems: 'center' }}>
              {/* Going backwards was simply impossible before. */}
              <Pressable
                onPress={() => goToExercise(dayMode.idx - 1)}
                disabled={dayMode.idx === 0}
                accessibilityRole="button"
                accessibilityLabel="Previous exercise"
                style={{
                  minWidth: 46, minHeight: 42, borderRadius: 11, marginRight: 7,
                  alignItems: 'center', justifyContent: 'center',
                  backgroundColor: C.panel2, borderWidth: 1, borderColor: C.line,
                  opacity: dayMode.idx === 0 ? 0.4 : 1,
                }}>
                <Text style={{ fontSize: 15, color: C.mut, fontWeight: '800' }}>‹</Text>
              </Pressable>

              <Pressable onPress={advanceDay} style={{ flex: 1, minHeight: 42, borderRadius: 11, backgroundColor: C.gold, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 12, fontWeight: '800', color: C.ink }}>
                  {allDone ? 'FINISH DAY' : 'DONE — NEXT  ›'}
                </Text>
              </Pressable>

              {/* Two-tap confirm. This sits next to the primary action, and
                  wiping an in-progress day on a single stray tap is exactly
                  what people reported losing. */}
              <Pressable
                onPress={() => { if (endArmed) finishDay(); else setEndArmed(true); }}
                accessibilityRole="button"
                accessibilityLabel={endArmed ? 'Confirm end workout day' : 'End workout day'}
                style={{
                  minWidth: 66, minHeight: 42, marginLeft: 7, borderRadius: 11,
                  alignItems: 'center', justifyContent: 'center',
                  backgroundColor: endArmed ? C.redSoft : 'transparent',
                  borderWidth: 1, borderColor: endArmed ? C.red : 'transparent',
                }}>
                <Text style={{ fontSize: 12, color: endArmed ? C.red : C.mut, fontWeight: '800' }}>
                  {endArmed ? 'SURE?' : 'END'}
                </Text>
              </Pressable>
            </View>

            {endArmed ? (
              <Text style={{ fontSize: 11.5, color: C.dim, marginTop: 8, lineHeight: 16 }}>
                Ends the day. Sets you've already logged are kept — tap anywhere else to cancel.
              </Text>
            ) : null}
          </Card>
          );
        })()}
        <Card>
          <View style={[s.between, { alignItems: 'flex-start' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <View style={{
                width: 46, height: 46, borderRadius: 12, marginRight: 12,
                backgroundColor: catMeta(sel.c).color + '22', borderWidth: 1, borderColor: catMeta(sel.c).color + '55',
                alignItems: 'center', justifyContent: 'center',
              }}>
                <MuscleIcon group={catMeta(sel.c).glyph} color={catMeta(sel.c).color} size={26} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: '800', color: C.text }}>{sel.n}</Text>
                <Text style={{ fontSize: 12, fontWeight: '700', marginTop: 2, color: STAT_META[sel.p].color, fontVariant: ['tabular-nums'] }}>
                  {sel.p}{sel.s ? ' + ' + sel.s : ''} · {sel.c}
                </Text>
                {best > 0 && <Text style={{ fontSize: 12, color: C.gold, marginTop: 2, fontVariant: ['tabular-nums'] }}>Best e1RM: {best} {unit}</Text>}
              </View>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Pressable onPress={() => setInfoOpen(true)}
                accessibilityRole="button" accessibilityLabel={'How to do ' + sel.n}
                style={{
                  flexDirection: 'row', alignItems: 'center', minHeight: 32,
                  paddingHorizontal: 11, borderRadius: 999, marginBottom: 6,
                  backgroundColor: catMeta(sel.c).color + '1e',
                  borderWidth: 1, borderColor: catMeta(sel.c).color + '66',
                }}>
                <Text style={{ color: catMeta(sel.c).color, fontSize: 12, fontWeight: '800' }}>How to</Text>
              </Pressable>
              <Pressable onPress={() => setPickerOpen(true)} style={s.smallGhost}>
                <Text style={{ color: C.mut, fontSize: 12 }}>Change</Text>
              </Pressable>
            </View>
          </View>
          <View style={[s.row, { marginTop: 14 }]}>
            <NumField label="Weight" value={w} onChange={setW} suffix={unit} />
            <View style={{ width: 10 }} />
            <NumField label="Reps" value={r} onChange={setR} suffix="reps" />
          </View>
          {/* Effort. The stored values are still 6–10 (XP depends on them), but a
              beginner can't answer "RPE 8" — they can answer "how hard was that?".
              Words first, the number kept small for people who know the scale. */}
          <View style={{ marginTop: 12 }}>
            <Lbl>How hard was that set?</Lbl>
            <View style={s.row}>
              {EFFORT.map((e, i) => (
                <Pressable key={e.v} onPress={() => setRpe(e.v)}
                  accessibilityRole="button"
                  accessibilityLabel={e.label + ', effort ' + e.v + ' of 10'}
                  accessibilityState={{ selected: rpe === e.v }}
                  style={{
                    flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: 'center',
                    marginRight: i < EFFORT.length - 1 ? 5 : 0,
                    backgroundColor: rpe === e.v ? C.goldSoft : C.panel2,
                    borderWidth: 1, borderColor: rpe === e.v ? C.gold : C.line,
                  }}>
                  <Text style={{ fontWeight: '800', fontSize: 11.5, color: rpe === e.v ? C.gold : C.mut }}>{e.label}</Text>
                  <Text style={{ fontSize: 9, color: rpe === e.v ? C.gold : C.dim, fontVariant: ['tabular-nums'], marginTop: 2 }}>{e.v}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={{ fontSize: 11.5, color: C.dim, marginTop: 7, lineHeight: 16 }}>
              {EFFORT.find((e) => e.v === rpe) ? EFFORT.find((e) => e.v === rpe).hint : ''}
            </Text>
          </View>
          {/* how to enter the load for this specific movement */}
          {loadNote(sel.n) ? (
            <View style={{ marginTop: 12, padding: 10, borderRadius: 10, backgroundColor: C.goldSoft, borderWidth: 1, borderColor: C.gold }}>
              <Text style={{ fontSize: 13, color: C.gold, fontWeight: '800', lineHeight: 18 }}>{loadNote(sel.n)}</Text>
            </View>
          ) : null}
          {/* Only shown when the movement has no note of its own — otherwise
              two load hints stacked and contradicted each other in tone. */}
          {!loadNote(sel.n) ? (
            <Text style={{ fontSize: 12.5, color: C.dim, marginTop: 9 }}>
              Bodyweight? Enter added load only. Timed hold? Seconds go in reps.
            </Text>
          ) : null}

          {/* multiple identical sets, for logging after the fact */}
          <View style={{ marginTop: 14 }}>
            <Lbl>Sets</Lbl>
            <View style={[s.row, { alignItems: 'center' }]}>
              <Pressable onPress={() => setSets((v) => Math.max(1, v - 1))} hitSlop={8}
                accessibilityLabel="Fewer sets"
                style={{ width: 46, height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: C.panel2, borderWidth: 1, borderColor: C.line }}>
                <Text style={{ fontSize: 22, fontWeight: '900', color: C.gold, marginTop: -2 }}>−</Text>
              </Pressable>
              <View style={{ flex: 1, alignItems: 'center' }}>
                <Text style={{ fontSize: 26, fontWeight: '900', color: C.text, fontVariant: ['tabular-nums'] }}>{sets}</Text>
                <Text style={{ fontSize: 11, color: C.dim, marginTop: 1 }}>
                  {sets === 1 ? 'single set' : 'identical sets · logged ~3 min apart'}
                </Text>
              </View>
              <Pressable onPress={() => setSets((v) => Math.min(10, v + 1))} hitSlop={8}
                accessibilityLabel="More sets"
                style={{ width: 46, height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: C.panel2, borderWidth: 1, borderColor: C.line }}>
                <Text style={{ fontSize: 22, fontWeight: '900', color: C.gold, marginTop: -2 }}>+</Text>
              </Pressable>
            </View>
          </View>

          <GoldBtn onPress={log} style={{ marginTop: 14 }}>
            {sets > 1 ? 'Log ' + sets + ' Sets' : 'Log Set' + (todayCount > 0 ? ' · #' + (todayCount + 1) + ' today' : '')}
          </GoldBtn>
        </Card>
        </View>
      )}

      {last && (
        <FadeIn key={last.seq}>
        <Card style={last.isPR ? { backgroundColor: C.goldSoft, borderWidth: 1, borderColor: C.gold } : null}>
          <View style={s.between}>
            <Text style={{ fontSize: 14, fontWeight: '800', color: last.isPR ? C.gold : C.green }}>
              {last.isPR ? 'NEW PERSONAL RECORD' : 'Set logged'}
            </Text>
            <CountUp value={last.xp + (last.bonus || 0)} prefix="+" suffix=" XP" duration={600} style={{ fontSize: 14, fontWeight: '700', color: C.gold, fontVariant: ['tabular-nums'] }} />
          </View>
          {last.e1 > 0 && (
            <View style={{ marginTop: 10 }}>
              <Text style={{ fontSize: 12, color: C.mut }}>
                Estimated 1RM: <Text style={{ color: C.text, fontWeight: '700', fontVariant: ['tabular-nums'] }}>{last.e1} {unit}</Text>
                {last.isPR && last.prev > 0 ? <Text style={{ color: C.dim }}> (was {last.prev})</Text> : null}
              </Text>
            </View>
          )}
          {last.bonus > 0 && <Text style={{ fontSize: 12, color: C.purp, marginTop: 8 }}>First session today: +{last.bonus} XP → Discipline & Vitality</Text>}

          {/* Correct it now, while you are still standing at the rack. Anything
              older is edited from Progress → History. */}
          {last.id && onEditEntry ? (
            <Pressable
              onPress={() => setFixOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="Edit or delete the set you just logged"
              hitSlop={6}
              style={{
                marginTop: 12, minHeight: 40, borderRadius: 11,
                alignItems: 'center', justifyContent: 'center',
                backgroundColor: C.panel2, borderWidth: 1, borderColor: C.line,
              }}>
              <Text style={{ fontSize: 12.5, fontWeight: '700', color: C.mut }}>
                Wrong numbers? Edit or delete this set
              </Text>
            </Pressable>
          ) : null}
        </Card>
        </FadeIn>
      )}

      {fixOpen && last && last.id ? (
        <EntryEditor
          entry={(data.lifts || []).find((l) => l.id === last.id)}
          unit={unit}
          onSave={(patch) => {
            if (onEditEntry) onEditEntry(last.id, patch);
            // The rebuilt entry gets a new id, so the old confirmation card no
            // longer points at anything. Clearing it is honest.
            setFixOpen(false);
            setLast(null);
          }}
          onDelete={() => {
            if (onDeleteEntry) onDeleteEntry(last.id);
            setFixOpen(false);
            setLast(null);
          }}
          onClose={() => setFixOpen(false)}
        />
      ) : null}

      <Sheet visible={pickerOpen} title="Choose Exercise" onClose={() => setPickerOpen(false)}>
        <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
          <TextInput value={query} onChangeText={setQuery} placeholder="Search — row, curl, squat…"
            placeholderTextColor={C.dim} style={[s.input, { marginBottom: 10 }]} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
            {CATEGORIES.map((c) => <Chip key={c} active={cat === c} onPress={() => setCat(c)}>{c}</Chip>)}
          </ScrollView>
        </View>
        <ScrollView style={{ maxHeight: 380 }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 8 }} keyboardShouldPersistTaps="handled">
          {list.map((e) => {
            const cm = catMeta(e.c);
            return (
            <Pressable key={e.n}
              onPress={() => { setSel(e); setLast(null); setPickerOpen(false); setQuery(''); }}
              style={{ paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line }}>
              <View style={s.between}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, paddingRight: 10 }}>
                  {/* colour-coded muscle-group tile */}
                  <View style={{
                    width: 38, height: 38, borderRadius: 10, marginRight: 12,
                    backgroundColor: cm.color + '22', borderWidth: 1, borderColor: cm.color + '44',
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <MuscleIcon group={cm.glyph} color={cm.color} size={22} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: C.text, letterSpacing: -0.2 }}>{e.n}</Text>
                    <Text style={{ fontSize: 11, color: cm.color, marginTop: 1, fontWeight: '700' }}>{e.c}{e.v ? ' · ' + e.v : ''}</Text>
                  </View>
                </View>
                <View style={{ paddingVertical: 2.5, paddingHorizontal: 7, borderRadius: 6, backgroundColor: STAT_META[e.p].color + '1a' }}>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: STAT_META[e.p].color, letterSpacing: 0.4 }}>
                    {e.p}{e.s ? ' +' + e.s : ''}
                  </Text>
                </View>
              </View>
            </Pressable>
            );
          })}
          {list.length === 0 && <Text style={{ fontSize: 14, color: C.dim, paddingVertical: 20, textAlign: 'center' }}>No matches — try another term.</Text>}
        </ScrollView>
      </Sheet>

      {infoOpen && sel && (
        <ExerciseInfoSheet ex={sel} meta={catMeta(sel.c)} onClose={() => setInfoOpen(false)} />
      )}

      {builderOpen && (
        <DayBuilder
          initial={editDay}
          onClose={() => setBuilderOpen(false)}
          onSave={onSaveDay}
          onDelete={onDeleteDay}
        />
      )}
    </View>
  );
}

/* ================================= Cardio =================================
 * WHAT WAS WRONG
 * The old screen printed all 29 activities at once as three grids of small
 * two-column tiles — about 400pt of near-identical boxes before you reached a
 * single input. Then it asked for Duration and Distance side by side (km for
 * "Muay Thai (Clinch)"), offered Intensity as four unexplained words, and told
 * you nothing about what any of it was worth.
 *
 * WHAT THIS IS
 * The same data, in the shape of the decision. You pick a DISCIPLINE (three
 * options, not twenty-nine), then an ACTIVITY from a proper native-feeling list,
 * and only then does the session composer appear. Every number the app is about
 * to award is shown before you commit to it — the XP each intensity is worth at
 * the duration you typed, the pace your distance implies, and the week you are
 * building. Nothing is hidden and nothing is decorative.
 * ====================================================================== */

// Three disciplines. Grouping by what the work IS beats grouping by stat: END is
// the primary stat for 24 of the 29 activities, so a stat-first split would put
// yoga next to sprint intervals.
const CARDIO_FAMILIES = [
  {
    key: 'cardio', label: 'Cardio', tint: C.green,
    blurb: 'Steady state, intervals and conditioning',
    items: CARDIO_TYPES.filter((c) => !c.g),
  },
  {
    key: 'martial', label: 'Martial Arts', tint: C.orange,
    blurb: 'Striking, grappling and fight conditioning',
    items: CARDIO_TYPES.filter((c) => c.g === 'Martial Arts'),
  },
  {
    key: 'recovery', label: 'Mobility', tint: C.cyan,
    blurb: 'Flexibility, movement quality and recovery',
    items: CARDIO_TYPES.filter((c) => c.g === 'Recovery'),
  },
].filter((f) => f.items.length);

const familyOf = (ct) => {
  if (!ct) return CARDIO_FAMILIES[0];
  const key = ct.g === 'Martial Arts' ? 'martial' : ct.g === 'Recovery' ? 'recovery' : 'cardio';
  return CARDIO_FAMILIES.find((f) => f.key === key) || CARDIO_FAMILIES[0];
};

/* Distance only belongs to activities that COVER distance. Asking for km after
 * a clinch round or a foam-rolling session is the kind of detail that makes an
 * app feel like it was never used by anyone who trains. */
const PACE_MODES = {
  'Run (Zone 2)':     'perKm',
  'Sprint Intervals': 'perKm',
  'Incline Walk':     'perKm',
  Hiking:             'perKm',
  'Stair Climber':    'perKm',
  'Rowing Machine':   'per500',
  Swimming:           'per100',
  Cycling:            'speed',
  'Assault Bike':     'speed',
};
const tracksDistance = (ct) => !!(ct && PACE_MODES[ct.n]);

// The derived number that a person who does this activity actually quotes.
function paceFor(ct, mins, km) {
  if (!tracksDistance(ct) || !(mins > 0) || !(km > 0)) return null;
  const mode = PACE_MODES[ct.n];
  if (mode === 'speed') return (km / (mins / 60)).toFixed(1) + ' km/h';
  const unitKm = mode === 'per500' ? 0.5 : mode === 'per100' ? 0.1 : 1;
  const perUnit = (mins / km) * unitKm;
  const mm = Math.floor(perUnit);
  const ss = Math.round((perUnit - mm) * 60);
  const label = mode === 'per500' ? ' /500m' : mode === 'per100' ? ' /100m' : ' /km';
  return mm + ':' + String(Math.min(59, ss)).padStart(2, '0') + label;
}

/* Intensity, explained. The stored keys and multipliers are untouched — XP
 * depends on them — but "Moderate" on its own is not an instruction. Each row
 * now says what that effort FEELS like, which is the only way somebody can pick
 * the honest one. */
const INTENSITY_NOTE = {
  light:    'Easy throughout — you could hold a conversation.',
  moderate: 'Working — short sentences only.',
  hard:     'Hard — breathing heavily, a few words at most.',
  max:      'All out — race pace or flat-out intervals.',
};
const INTENSITY_TINT = { light: C.cyan, moderate: C.green, hard: C.orange, max: C.red };

// One-tap presets. Covers the overwhelming majority of real sessions; anything
// else is typed.
const MIN_PRESETS = [10, 15, 20, 30, 45, 60];

const DAY_MS = 86400000;

function CardioView({ data, onLog, onEditEntry, onDeleteEntry }) {
  const [family, setFamily] = useState(CARDIO_FAMILIES[0].key);
  const [type, setType] = useState(null);
  const [mins, setMins] = useState('');
  const [dist, setDist] = useState('');
  const [inten, setInten] = useState('moderate');
  const [last, setLast] = useState(null);
  const [fixOpen, setFixOpen] = useState(false);

  const fam = CARDIO_FAMILIES.find((f) => f.key === family) || CARDIO_FAMILIES[0];
  const minsN = parseFloat(mins) || 0;
  const distN = parseFloat(dist) || 0;

  /* ---- the last seven days, as context rather than as a scoreboard ----
   * Cardio is the one thing in the app people do "some of" — the useful
   * question is whether this week has any in it, not a lifetime total. */
  const week = useMemo(() => {
    const now = Date.now();
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    const startT = start.getTime() - 6 * DAY_MS;
    const perDay = [0, 0, 0, 0, 0, 0, 0];
    let mins7 = 0, sessions = 0;
    (data.cardio || []).forEach((c) => {
      if (!c || c.t < startT) return;
      const i = Math.min(6, Math.max(0, Math.floor((c.t - startT) / DAY_MS)));
      perDay[i] += c.mins || 0;
      mins7 += c.mins || 0;
      sessions += 1;
    });
    return { perDay, mins7, sessions, peak: Math.max(1, ...perDay) };
  }, [data.cardio]);

  // The activities this person actually uses, newest first. Four is enough to
  // cover a routine without becoming a second full list.
  const recent = useMemo(() => {
    const seen = [];
    [...(data.cardio || [])].sort((a, b) => b.t - a.t).forEach((c) => {
      if (seen.length >= 4 || seen.some((x) => x.n === c.ex)) return;
      const ct = CARDIO_TYPES.find((x) => x.n === c.ex);
      if (ct) seen.push(ct);
    });
    return seen;
  }, [data.cardio]);

  const pickType = (ct) => {
    setType(ct);
    setFamily(familyOf(ct).key);
    if (!tracksDistance(ct)) setDist('');
    setLast(null);
  };

  // Exactly what the engine will award, before the daily cap is applied — so the
  // four intensity rows can each show their own consequence.
  const xpAt = (multKey) => {
    const row = INTENSITIES.find((i) => i.k === multKey);
    if (!row || minsN <= 0) return 0;
    return cardioXPCalc(minsN, row.mult);
  };

  const pace = paceFor(type, minsN, distN);
  const ready = !!type && minsN > 0;

  const log = () => {
    if (!ready) return;
    const meta = onLog(type.n, minsN, tracksDistance(type) ? distN : 0, inten);
    if (meta) {
      setLast({
        ...meta, name: type.n, emoji: type.e, mins: minsN,
        dist: tracksDistance(type) ? distN : 0, inten, seq: Date.now(),
      });
      setMins(''); setDist('');
    }
  };

  return (
    <View>
      <ScreenHeader title="Log cardio" hint={type ? null : 'Pick what you did'} />

      {/* ---- the week so far ------------------------------------------------
       * Seven thin bars and two numbers. It answers "have I done any of this
       * lately" in one glance and costs a third of the height of a card. */}
      {week.sessions > 0 ? (
        <Card style={{ paddingVertical: 14 }}>
          <View style={[s.between, { alignItems: 'flex-end' }]}>
            <View>
              <Lbl style={{ marginBottom: 4 }}>Last 7 days</Lbl>
              <Text style={{ fontSize: 21, fontWeight: '800', color: C.text, fontVariant: ['tabular-nums'], letterSpacing: -0.4 }}>
                {Math.round(week.mins7)}
                <Text style={{ fontSize: 13, color: C.mut, fontWeight: '700' }}> min</Text>
              </Text>
            </View>
            {/* the bars, oldest → today */}
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 34 }}>
              {week.perDay.map((m, i) => {
                const isToday = i === 6;
                return (
                  <View key={i} style={{
                    width: 7, marginLeft: i ? 5 : 0,
                    height: Math.max(3, (m / week.peak) * 34),
                    borderRadius: 3.5,
                    backgroundColor: m > 0 ? (isToday ? C.gold : C.green) : C.panel2,
                  }} />
                );
              })}
            </View>
            <Text style={{ fontSize: 12, color: C.dim, fontWeight: '700', fontVariant: ['tabular-nums'] }}>
              {week.sessions} session{week.sessions === 1 ? '' : 's'}
            </Text>
          </View>
        </Card>
      ) : null}

      {/* ---- straight back to what you already do -------------------------- */}
      {recent.length > 0 && !type ? (
        <View style={{ marginBottom: 14 }}>
          <Lbl>Again</Lbl>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -2 }} contentContainerStyle={{ paddingHorizontal: 2 }}>
            {recent.map((ct) => {
              const tint = familyOf(ct).tint;
              return (
                <Pressable key={ct.n} onPress={() => pickType(ct)}
                  accessibilityRole="button" accessibilityLabel={'Log ' + ct.n}
                  style={{
                    flexDirection: 'row', alignItems: 'center', minHeight: 44,
                    paddingHorizontal: 13, borderRadius: 999, marginRight: 8,
                    backgroundColor: C.panel2, borderWidth: 1, borderColor: alpha(tint, 0.45),
                  }}>
                  <Text style={{ fontSize: 15, marginRight: 8 }}>{ct.e}</Text>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: C.text }} numberOfLines={1}>{ct.n}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : null}

      {/* ---- discipline ----------------------------------------------------
       * The same segmented control the Train hub uses at the top of the screen,
       * so the two read as one system. */}
      {!type ? (
        <View>
          <Segmented
            value={family}
            onChange={setFamily}
            options={CARDIO_FAMILIES.map((f) => ({
              key: f.key, label: f.label, sub: f.items.length, tint: f.tint,
              a11y: f.label + ', ' + f.items.length + ' activities',
            }))}
          />
          <Text style={{ fontSize: 12.5, color: C.dim, marginTop: 9, marginBottom: 12, lineHeight: 17 }}>
            {fam.blurb}
          </Text>

          {/* ---- activities, as a list rather than a tile grid ------------
           * A row can carry the name, both stats and a proper 44pt target
           * without truncating anything. "Muay Thai (Bag / Pads)" simply does
           * not fit in a half-width tile. */}
          <Card style={{ padding: 0, overflow: 'hidden' }}>
            {fam.items.map((ct, i) => (
              <Pressable key={ct.n} onPress={() => pickType(ct)}
                accessibilityRole="button"
                accessibilityLabel={ct.n + ', builds ' + STAT_META[ct.p].name + (ct.s ? ' and ' + STAT_META[ct.s].name : '')}
                style={{
                  flexDirection: 'row', alignItems: 'center', minHeight: 62,
                  paddingHorizontal: 14, paddingVertical: 10,
                  borderTopWidth: i ? StyleSheet.hairlineWidth : 0, borderTopColor: C.line,
                }}>
                <View style={{
                  width: 42, height: 42, borderRadius: 12, marginRight: 13,
                  alignItems: 'center', justifyContent: 'center',
                  backgroundColor: alpha(fam.tint, 0.12),
                  borderWidth: 1, borderColor: alpha(fam.tint, 0.3),
                }}>
                  <Text style={{ fontSize: 19 }}>{ct.e}</Text>
                </View>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: C.text, letterSpacing: -0.2 }} numberOfLines={1}>
                    {ct.n}
                  </Text>
                  <View style={[s.row, { marginTop: 3 }]}>
                    <Text style={{ fontSize: 11.5, fontWeight: '700', color: STAT_META[ct.p].color }}>
                      {STAT_META[ct.p].name}
                    </Text>
                    {ct.s ? (
                      <>
                        <Text style={{ fontSize: 11.5, color: C.faint, marginHorizontal: 5 }}>+</Text>
                        <Text style={{ fontSize: 11.5, fontWeight: '700', color: STAT_META[ct.s].color }}>
                          {STAT_META[ct.s].name}
                        </Text>
                      </>
                    ) : null}
                  </View>
                </View>
                <Text style={{ fontSize: 19, color: C.faint, fontWeight: '600' }}>›</Text>
              </Pressable>
            ))}
          </Card>
        </View>
      ) : (
        /* ---------------------------- composer ---------------------------- */
        <View>
          {/* what you picked, and the way back out */}
          <Card style={{ borderWidth: 1, borderColor: alpha(familyOf(type).tint, 0.5) }}>
            <View style={[s.between, { alignItems: 'center' }]}>
              <View style={[s.row, { flex: 1 }]}>
                <View style={{
                  width: 46, height: 46, borderRadius: 13, marginRight: 13,
                  alignItems: 'center', justifyContent: 'center',
                  backgroundColor: alpha(familyOf(type).tint, 0.14),
                  borderWidth: 1, borderColor: alpha(familyOf(type).tint, 0.34),
                }}>
                  <Text style={{ fontSize: 21 }}>{type.e}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16.5, fontWeight: '800', color: C.text, letterSpacing: -0.3 }} numberOfLines={2}>
                    {type.n}
                  </Text>
                  <Text style={{ fontSize: 11.5, fontWeight: '700', color: C.dim, marginTop: 2 }}>
                    {STAT_META[type.p].name}{type.s ? ' · ' + STAT_META[type.s].name : ''}
                  </Text>
                </View>
              </View>
              <Pressable onPress={() => { setType(null); setLast(null); }} hitSlop={8}
                accessibilityRole="button" accessibilityLabel="Choose a different activity"
                style={s.smallGhost}>
                <Text style={{ color: C.mut, fontSize: 12 }}>Change</Text>
              </Pressable>
            </View>

            {/* ---- duration ---- */}
            <View style={{ marginTop: 16 }}>
              <Lbl>How long?</Lbl>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}
                style={{ marginHorizontal: -2, marginBottom: 10 }}
                contentContainerStyle={{ paddingHorizontal: 2 }}>
                {MIN_PRESETS.map((m) => {
                  const on = minsN === m;
                  return (
                    <Pressable key={m} onPress={() => setMins(String(m))}
                      accessibilityRole="button" accessibilityLabel={m + ' minutes'}
                      accessibilityState={{ selected: on }}
                      style={{
                        minWidth: 56, minHeight: 44, alignItems: 'center', justifyContent: 'center',
                        paddingHorizontal: 12, borderRadius: 11, marginRight: 7,
                        backgroundColor: on ? C.gold : C.panel2,
                        borderWidth: 1, borderColor: on ? C.gold : C.line,
                      }}>
                      <Text style={{
                        fontSize: 14, fontWeight: '800', fontVariant: ['tabular-nums'],
                        color: on ? C.ink : C.text,
                      }}>{m}</Text>
                      <Text style={{ fontSize: 9, fontWeight: '700', color: on ? alpha(C.ink, 0.6) : C.dim }}>MIN</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
              <View style={s.row}>
                <NumField label="Exact minutes" value={mins} onChange={setMins} suffix="min" />
                {tracksDistance(type) ? (
                  <>
                    <View style={{ width: 10 }} />
                    <NumField label="Distance (optional)" value={dist} onChange={setDist} suffix="km" />
                  </>
                ) : null}
              </View>
              {pace ? (
                <Text style={{ fontSize: 12.5, color: C.cyan, fontWeight: '700', marginTop: 8, fontVariant: ['tabular-nums'] }}>
                  That is {pace}
                </Text>
              ) : null}
            </View>
          </Card>

          {/* ---- intensity, with its price on it ----------------------------
           * Four rows instead of four chips. Each states the effort in words
           * anyone can self-assess, and — once a duration exists — exactly what
           * it is worth, so the choice is informed rather than a guess. */}
          <Card>
            <View style={s.between}>
              <Lbl style={{ marginBottom: 0 }}>How hard was it?</Lbl>
              {minsN > 0 ? (
                <Text style={{ fontSize: 10.5, color: C.dim, fontWeight: '700' }}>XP AT {Math.round(minsN)} MIN</Text>
              ) : null}
            </View>
            <View style={{ marginTop: 10 }}>
              {INTENSITIES.map((it, i) => {
                const on = inten === it.k;
                const tint = INTENSITY_TINT[it.k] || C.green;
                return (
                  <Pressable key={it.k} onPress={() => setInten(it.k)}
                    accessibilityRole="button" accessibilityState={{ selected: on }}
                    accessibilityLabel={it.label + '. ' + (INTENSITY_NOTE[it.k] || '')}
                    style={{
                      flexDirection: 'row', alignItems: 'center', minHeight: 56,
                      paddingHorizontal: 12, paddingVertical: 9, borderRadius: 12,
                      marginTop: i ? 7 : 0,
                      backgroundColor: on ? alpha(tint, 0.12) : C.panel2,
                      borderWidth: 1, borderColor: on ? tint : C.line,
                    }}>
                    {/* the rail: a filled block reads as "selected" without a tick */}
                    <View style={{
                      width: 4, alignSelf: 'stretch', borderRadius: 2, marginRight: 12,
                      backgroundColor: on ? tint : C.line,
                    }} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14.5, fontWeight: '800', color: on ? tint : C.text }}>
                        {it.label}
                      </Text>
                      <Text style={{ fontSize: 11.5, color: on ? C.mut : C.dim, marginTop: 2, lineHeight: 16 }}>
                        {INTENSITY_NOTE[it.k] || ''}
                      </Text>
                    </View>
                    {minsN > 0 ? (
                      <Text style={{
                        fontSize: 13, fontWeight: '800', marginLeft: 10,
                        fontVariant: ['tabular-nums'], color: on ? tint : C.dim,
                      }}>
                        +{xpAt(it.k)}
                      </Text>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          </Card>

          {/* ---- commit ---- */}
          <Card>
            <View style={[s.between, { alignItems: 'flex-end' }]}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Lbl style={{ marginBottom: 4 }}>Ready to log</Lbl>
                <Text style={{ fontSize: 14, color: ready ? C.text : C.dim, fontWeight: '700', fontVariant: ['tabular-nums'], lineHeight: 19 }}>
                  {ready
                    ? [
                        type.n,
                        Math.round(minsN) + ' min',
                        (INTENSITIES.find((i) => i.k === inten) || {}).label,
                        distN > 0 && tracksDistance(type) ? distN + ' km' : null,
                      ].filter(Boolean).join(' · ')
                    : 'Enter how long it lasted.'}
                </Text>
              </View>
              {ready ? (
                <Text style={{ fontSize: 24, fontWeight: '800', color: C.gold, fontVariant: ['tabular-nums'], letterSpacing: -0.5 }}>
                  +{xpAt(inten)}
                  <Text style={{ fontSize: 12, color: C.mut, fontWeight: '700' }}> XP</Text>
                </Text>
              ) : null}
            </View>
            <GreenBtn onPress={log} style={{ marginTop: 14 }}>
              {ready ? 'Log ' + Math.round(minsN) + ' min session' : 'Log session'}
            </GreenBtn>
            <Text style={{ fontSize: 11.5, color: C.dim, marginTop: 9, lineHeight: 16 }}>
              XP is an estimate — the daily cap still applies. Edit or delete any
              session afterwards from Progress → History.
            </Text>
          </Card>
        </View>
      )}

      {/* ---- confirmation -------------------------------------------------- */}
      {last ? (
        <FadeIn key={last.seq}>
          <Card style={{ borderWidth: 1, borderColor: C.green }}>
            <View style={s.between}>
              <Text style={{ fontSize: 14, fontWeight: '800', color: C.green }}>
                Session logged
              </Text>
              <CountUp value={last.xp + (last.bonus || 0)} prefix="+" suffix=" XP" duration={600}
                style={{ fontSize: 14, fontWeight: '800', color: C.gold, fontVariant: ['tabular-nums'] }} />
            </View>
            <Text style={{ fontSize: 13, color: C.mut, marginTop: 7, fontVariant: ['tabular-nums'] }}>
              {last.emoji} {[
                last.name,
                Math.round(last.mins) + ' min',
                (INTENSITIES.find((i) => i.k === last.inten) || {}).label,
                last.dist > 0 ? last.dist + ' km' : null,
              ].filter(Boolean).join(' · ')}
            </Text>
            {last.bonus > 0 ? (
              <Text style={{ fontSize: 12, color: C.purp, marginTop: 8 }}>
                First session today: +{last.bonus} XP → Discipline &amp; Vitality
              </Text>
            ) : null}
            {last.id && onEditEntry ? (
              <Pressable
                onPress={() => setFixOpen(true)}
                accessibilityRole="button"
                accessibilityLabel="Edit or delete the session you just logged"
                hitSlop={6}
                style={{
                  marginTop: 12, minHeight: 40, borderRadius: 11,
                  alignItems: 'center', justifyContent: 'center',
                  backgroundColor: C.panel2, borderWidth: 1, borderColor: C.line,
                }}>
                <Text style={{ fontSize: 12.5, fontWeight: '700', color: C.mut }}>
                  Wrong numbers? Edit or delete this session
                </Text>
              </Pressable>
            ) : null}
          </Card>
        </FadeIn>
      ) : null}

      {fixOpen && last && last.id ? (
        <EntryEditor
          entry={(data.cardio || []).find((c) => c.id === last.id)}
          unit={data.unit}
          onSave={(patch) => {
            if (onEditEntry) onEditEntry(last.id, patch);
            setFixOpen(false);
            setLast(null);
          }}
          onDelete={() => {
            if (onDeleteEntry) onDeleteEntry(last.id);
            setFixOpen(false);
            setLast(null);
          }}
          onClose={() => setFixOpen(false)}
        />
      ) : null}
    </View>
  );
}

/* ------------------------------ Calculator -------------------------------
 * A full strength workbench, not just a 1RM box:
 *   · prefill from your own best sets (no typing)
 *   · four-formula consensus with an agreement range, not one fragile number
 *   · a percentage explorer you can step through
 *   · a visual plate loader (what actually goes on the bar)
 *   · an auto-generated warm-up ramp
 *   · a load table with intensity bars
 */

const PLATES_KG = [
  { w: 25, color: '#e0483f' }, { w: 20, color: '#3b6fd4' }, { w: 15, color: '#e8b53a' },
  { w: 10, color: '#3f9e57' }, { w: 5, color: '#d8dae2' }, { w: 2.5, color: '#8b90a3' },
  { w: 1.25, color: '#5a5f70' },
];
const PLATES_LB = [
  { w: 45, color: '#3b6fd4' }, { w: 35, color: '#e8b53a' }, { w: 25, color: '#3f9e57' },
  { w: 10, color: '#d8dae2' }, { w: 5, color: '#8b90a3' }, { w: 2.5, color: '#5a5f70' },
];
const BAR_KG = 20, BAR_LB = 45;

// Four accepted 1RM estimators. Showing the spread is more honest — and feels
// more authoritative — than presenting a single number as fact.
const FORMULAS = [
  { key: 'Epley', fn: (w, r) => (r <= 1 ? w : w * (1 + r / 30)) },
  { key: 'Brzycki', fn: (w, r) => (r <= 1 ? w : r < 36 ? (w * 36) / (37 - r) : w * 2) },
  { key: 'Lombardi', fn: (w, r) => (r <= 1 ? w : w * Math.pow(r, 0.10)) },
  { key: "O'Conner", fn: (w, r) => (r <= 1 ? w : w * (1 + 0.025 * r)) },
];

// Greedy plate fill per side. Returns the plates and anything unreachable.
function platesFor(target, unit) {
  const bar = unit === 'kg' ? BAR_KG : BAR_LB;
  const set = unit === 'kg' ? PLATES_KG : PLATES_LB;
  if (!target || target < bar) return { bar, perSide: [], remainder: 0, ok: target === bar };
  let side = (target - bar) / 2;
  const perSide = [];
  set.forEach((p) => {
    while (side >= p.w - 0.001) { perSide.push(p); side -= p.w; }
  });
  return { bar, perSide, remainder: Math.round(side * 100) / 100, ok: side < 0.001 };
}

// Exported so it can live under Stats → Tools. Train stays purely about
// logging a set; a 1RM workbench is a planning tool, not a logging step.
export function CalcView({ data, dv }) {
  const unit = data.unit;
  const [w, setW] = useState('');
  const [r, setR] = useState('');
  const [pct, setPct] = useState(80);
  const [srcName, setSrcName] = useState(null);

  const wN = parseFloat(w) || 0, rN = parseInt(r, 10) || 0;
  const valid = wN > 0 && rN > 0 && rN <= 30;

  // Best real set per exercise, newest-best first — powers one-tap prefill.
  const quickPicks = useMemo(() => {
    const bestSet = {};
    (data.lifts || []).forEach((l) => {
      if (!l || !l.ex || !l.w || !l.r) return;
      const cur = bestSet[l.ex];
      if (!cur || (l.e1rm || 0) > (cur.e1rm || 0)) bestSet[l.ex] = { ex: l.ex, w: l.w, r: l.r, e1rm: l.e1rm || 0 };
    });
    return Object.values(bestSet).sort((a, b) => b.e1rm - a.e1rm).slice(0, 4);
  }, [data.lifts]);

  const results = useMemo(() => {
    if (!valid) return null;
    const vals = FORMULAS.map((f) => ({ key: f.key, v: f.fn(wN, rN) }));
    const nums = vals.map((x) => x.v);
    const lo = Math.min(...nums), hi = Math.max(...nums);
    const mean = nums.reduce((a, b) => a + b, 0) / nums.length;
    return { vals, lo, hi, mean };
  }, [valid, wN, rN]);

  const e1 = results ? results.mean : 0;
  const pctWeight = results ? roundLoad((e1 * pct) / 100, unit) : 0;
  const plates = platesFor(pctWeight, unit);

  // Is this a PR for the picked exercise?
  const prDelta = srcName && dv && dv.best && dv.best[srcName]
    ? Math.round((e1 - dv.best[srcName].e1rm) * 10) / 10 : null;

  const warmups = results
    ? [[0.4, 5], [0.55, 5], [0.7, 3], [0.85, 2]].map(([f, reps]) => ({
        w: roundLoad(pctWeight * f, unit), reps,
      }))
    : [];

  const tableReps = [1, 2, 3, 5, 6, 8, 10, 12, 15, 20];

  const usePick = (p) => { setW(String(p.w)); setR(String(p.r)); setSrcName(p.ex); };

  return (
    <View>
      {/* ---------------- input ---------------- */}
      <Card>
        <Lbl>1RM Workbench</Lbl>
        {quickPicks.length > 0 && (
          <>
            <Text style={{ fontSize: 11.5, color: C.dim, marginBottom: 8 }}>Tap one of your best sets to load it</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              {quickPicks.map((p) => {
                const on = srcName === p.ex && String(p.w) === w && String(p.r) === r;
                return (
                  <Pressable key={p.ex} onPress={() => usePick(p)}
                    style={{
                      paddingHorizontal: 12, paddingVertical: 9, borderRadius: 999, marginRight: 8,
                      backgroundColor: on ? C.gold : C.panel2, borderWidth: 1, borderColor: on ? C.gold : C.line,
                    }}>
                    <Text numberOfLines={1} style={{ fontSize: 11.5, fontWeight: '700', color: on ? C.ink : C.text, maxWidth: 150 }}>
                      {p.ex}
                    </Text>
                    <Text style={{ fontSize: 10.5, color: on ? C.ink : C.dim, fontVariant: ['tabular-nums'], marginTop: 1 }}>
                      {p.w}{unit} × {p.r}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </>
        )}
        <View style={s.row}>
          <NumField label="Weight" value={w} onChange={(v) => { setW(v); setSrcName(null); }} suffix={unit} />
          <View style={{ width: 10 }} />
          <NumField label="Reps" value={r} onChange={(v) => { setR(v); setSrcName(null); }} suffix="reps" />
        </View>
      </Card>

      {!results ? (
        <Card>
          <Text style={{ fontSize: 15, color: C.text, fontWeight: '700', lineHeight: 21 }}>
            One set in. Get your max, plates and warm-up.
          </Text>
        </Card>
      ) : (
        <>
          {/* ---------------- hero result ---------------- */}
          <FadeIn>
            <Card style={{ borderColor: C.gold, borderWidth: 1 }}>
              <View style={s.between}>
                <Lbl style={{ marginBottom: 0 }}>Estimated 1RM</Lbl>
                <Text style={{ fontSize: 11, color: C.dim, fontVariant: ['tabular-nums'] }}>4-formula mean</Text>
              </View>
              <View style={{ alignItems: 'center', marginTop: 6 }}>
                <CountUp value={Math.round(e1)} duration={700}
                  style={{ fontSize: 56, fontWeight: '800', color: C.gold, fontVariant: ['tabular-nums'], letterSpacing: -1 }} />
                <Text style={{ fontSize: 13, color: C.mut, marginTop: -4 }}>{unit}</Text>
                <Text style={{ fontSize: 11.5, color: C.dim, fontVariant: ['tabular-nums'], marginTop: 6 }}>
                  range {results.lo.toFixed(1)} – {results.hi.toFixed(1)} {unit}
                </Text>
              </View>

              {prDelta !== null && (
                <View style={{
                  marginTop: 12, padding: 10, borderRadius: 10, alignItems: 'center',
                  backgroundColor: prDelta > 0 ? 'rgba(62,207,142,0.12)' : C.panel2,
                  borderWidth: 1, borderColor: prDelta > 0 ? C.green : C.line,
                }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: prDelta > 0 ? C.green : C.mut }}>
                    {prDelta > 0
                      ? `New PR pace — ${prDelta}${unit} above your best`
                      : `${Math.abs(prDelta)}${unit} off your best (${dv.best[srcName].e1rm}${unit})`}
                  </Text>
                </View>
              )}

              {/* formula agreement */}
              <View style={{ marginTop: 14 }}>
                {results.vals.map((f) => {
                  const spread = Math.max(0.001, results.hi - results.lo);
                  const rel = (f.v - results.lo) / spread;
                  return (
                    <View key={f.key} style={[s.between, { marginTop: 7, alignItems: 'center' }]}>
                      <Text style={{ width: 74, fontSize: 11.5, color: C.mut }}>{f.key}</Text>
                      <View style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: C.panel2, marginHorizontal: 8, justifyContent: 'center' }}>
                        <View style={{
                          position: 'absolute', left: `${rel * 92}%`, width: 8, height: 8,
                          borderRadius: 4, backgroundColor: C.gold,
                        }} />
                      </View>
                      <Text style={{ width: 62, textAlign: 'right', fontSize: 12, color: C.text, fontVariant: ['tabular-nums'], fontWeight: '700' }}>
                        {f.v.toFixed(1)}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </Card>
          </FadeIn>

          {/* ---------------- percentage explorer ---------------- */}
          <Card>
            <View style={s.between}>
              <Lbl style={{ marginBottom: 0 }}>Percentage explorer</Lbl>
              <Text style={{ fontSize: 12, color: C.gold, fontVariant: ['tabular-nums'], fontWeight: '700' }}>{pct}%</Text>
            </View>
            <View style={[s.row, { alignItems: 'center', marginTop: 10 }]}>
              <Stepper label="−" onPress={() => setPct((v) => Math.max(30, v - 2.5))} />
              <View style={{ flex: 1, alignItems: 'center' }}>
                <Text style={{ fontSize: 34, fontWeight: '800', color: C.text, fontVariant: ['tabular-nums'] }}>
                  {pctWeight}<Text style={{ fontSize: 14, color: C.mut }}> {unit}</Text>
                </Text>
                <Text style={{ fontSize: 11, color: C.dim, marginTop: 2 }}>
                  ≈ {repsAtPct(pct)} reps at this load
                </Text>
              </View>
              <Stepper label="+" onPress={() => setPct((v) => Math.min(100, v + 2.5))} />
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12 }}>
              {[60, 65, 70, 75, 80, 85, 90, 95, 100].map((p) => (
                <Pressable key={p} onPress={() => setPct(p)}
                  style={{
                    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, marginRight: 7,
                    backgroundColor: pct === p ? C.gold : 'transparent',
                    borderWidth: 1, borderColor: pct === p ? C.gold : C.line,
                  }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: pct === p ? C.ink : C.mut, fontVariant: ['tabular-nums'] }}>{p}%</Text>
                </Pressable>
              ))}
            </ScrollView>
          </Card>

          {/* ---------------- plate loader ---------------- */}
          <Card>
            <View style={s.between}>
              <Lbl style={{ marginBottom: 0 }}>Load the bar</Lbl>
              <Text style={{ fontSize: 11, color: C.dim, fontVariant: ['tabular-nums'] }}>{plates.bar}{unit} bar · per side</Text>
            </View>
            {plates.perSide.length === 0 ? (
              <Text style={{ fontSize: 12.5, color: C.dim, marginTop: 10 }}>
                {pctWeight <= plates.bar ? 'Empty bar is enough at this percentage.' : 'Not loadable with standard plates.'}
              </Text>
            ) : (
              <>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 14, minHeight: 66 }}>
                  {/* sleeve */}
                  <View style={{ width: 14, height: 5, borderRadius: 2, backgroundColor: C.mut }} />
                  {plates.perSide.map((p, i) => {
                    const h = 26 + (p.w / (unit === 'kg' ? 25 : 45)) * 38;
                    return (
                      <View key={i} style={{
                        width: p.w >= (unit === 'kg' ? 10 : 25) ? 15 : 10, height: h, marginRight: 3,
                        borderRadius: 3, backgroundColor: p.color, borderWidth: 1, borderColor: 'rgba(0,0,0,0.35)',
                      }} />
                    );
                  })}
                  <View style={{ flex: 1, height: 5, borderRadius: 2, backgroundColor: C.line, marginLeft: 2 }} />
                </View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 12 }}>
                  {collapsePlates(plates.perSide).map((g) => (
                    <View key={g.w} style={{
                      flexDirection: 'row', alignItems: 'center', marginRight: 10, marginBottom: 8,
                      paddingHorizontal: 9, paddingVertical: 6, borderRadius: 999,
                      backgroundColor: C.panel2, borderWidth: 1, borderColor: C.line,
                    }}>
                      <View style={{ width: 9, height: 9, borderRadius: 2, backgroundColor: g.color, marginRight: 6 }} />
                      <Text style={{ fontSize: 12, color: C.text, fontVariant: ['tabular-nums'], fontWeight: '700' }}>
                        {g.n} × {g.w}{unit}
                      </Text>
                    </View>
                  ))}
                </View>
                {!plates.ok && plates.remainder > 0 && (
                  <Text style={{ fontSize: 11.5, color: C.orange, marginTop: 2 }}>
                    {plates.remainder}{unit} per side unreachable — nearest is {roundLoad(pctWeight - plates.remainder * 2, unit)}{unit}.
                  </Text>
                )}
              </>
            )}
          </Card>

          {/* ---------------- warm-up ramp ---------------- */}
          <Card>
            <Lbl>Warm-up to {pctWeight} {unit}</Lbl>
            {warmups.map((s2, i) => (
              <View key={i} style={[s.between, { marginTop: 9, alignItems: 'center' }]}>
                <Text style={{ width: 26, fontSize: 12, color: C.dim, fontVariant: ['tabular-nums'] }}>{i + 1}</Text>
                <View style={{ flex: 1, height: 8, borderRadius: 4, backgroundColor: C.panel2, marginRight: 10 }}>
                  <View style={{ width: `${[40, 55, 70, 85][i]}%`, height: 8, borderRadius: 4, backgroundColor: C.gold, opacity: 0.35 + i * 0.16 }} />
                </View>
                <Text style={{ width: 108, textAlign: 'right', fontSize: 13, color: C.text, fontVariant: ['tabular-nums'], fontWeight: '700' }}>
                  {s2.w} {unit} × {s2.reps}
                </Text>
              </View>
            ))}
          </Card>

          {/* ---------------- load table ---------------- */}
          <Card>
            <Lbl>Load table</Lbl>
            {tableReps.map((reps) => {
              const zone = reps <= 5 ? 'strength' : reps <= 12 ? 'hypertrophy' : 'endurance';
              const tint = zone === 'strength' ? C.red : zone === 'hypertrophy' ? C.gold : C.green;
              const p = pctForReps(reps);
              return (
                <View key={reps} style={[s.between, {
                  paddingVertical: 7, paddingHorizontal: 8, borderRadius: 8, marginTop: 2,
                }]}>
                  <Text style={{ width: 58, color: tint, fontSize: 13, fontVariant: ['tabular-nums'], fontWeight: '700' }}>
                    {reps} rep{reps > 1 ? 's' : ''}
                  </Text>
                  <View style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: C.panel2, marginHorizontal: 8 }}>
                    <View style={{ width: `${p}%`, height: 6, borderRadius: 3, backgroundColor: tint }} />
                  </View>
                  <Text style={{ width: 40, textAlign: 'right', color: C.dim, fontSize: 11.5, fontVariant: ['tabular-nums'] }}>{Math.round(p)}%</Text>
                  <Text style={{ width: 82, textAlign: 'right', fontWeight: '700', color: C.text, fontSize: 13, fontVariant: ['tabular-nums'] }}>
                    {roundLoad(weightForReps(e1, reps), unit)} {unit}
                  </Text>
                </View>
              );
            })}
          </Card>
        </>
      )}

      <Card>
        <Text style={{ fontSize: 14, color: C.mut, fontWeight: '700' }}>
          Best accuracy: 12 reps or fewer.
        </Text>
      </Card>
    </View>
  );
}

// Rough inverse of the Epley percentage curve — "how many reps at this %".
function repsAtPct(pct) {
  if (pct >= 100) return 1;
  const reps = Math.round((100 / pct - 1) * 30);
  return Math.max(1, Math.min(30, reps));
}

function collapsePlates(list) {
  const map = {};
  list.forEach((p) => {
    if (!map[p.w]) map[p.w] = { w: p.w, color: p.color, n: 0 };
    map[p.w].n += 1;
  });
  return Object.values(map).sort((a, b) => b.w - a.w);
}

function Stepper({ label, onPress }) {
  return (
    <Pressable onPress={onPress} hitSlop={8}
      style={{
        width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center',
        backgroundColor: C.panel2, borderWidth: 1, borderColor: C.line,
      }}>
      <Text style={{ fontSize: 22, fontWeight: '700', color: C.gold, marginTop: -2 }}>{label}</Text>
    </Pressable>
  );
}

/* ------------------------------- Train hub ------------------------------- */
export default function TrainTab({ data, dv, onLift, onLiftBatch, onCardio, onSaveDay, onDeleteDay, onEditEntry, onDeleteEntry, onOpenAnalytics }) {
  const [seg, setSeg] = useState('lift');
  // Kept at this level so it survives Log Lift → Calculator → Log Lift.
  const [sel, setSel] = useState(null);
  const [w, setW] = useState('');
  const [r, setR] = useState('');
  const [rpe, setRpe] = useState(8);
  const [dayMode, setDayMode] = useState(null);   // { day, idx } while running a saved day
  const session = { sel, setSel, w, setW, r, setR, rpe, setRpe, dayMode, setDayMode };
  const now = Date.now();
  const xpToday = [...data.lifts, ...data.cardio]
    .filter((e) => dayKeyOf(e.t) === dayKeyOf(now))
    .reduce((sum, e) => sum + (e.xp || 0), 0);
  const capPct = Math.min(100, (xpToday / INTEGRITY.DAILY_XP_CAP) * 100);
  const near = capPct >= 80;
  const SEGS = [['lift', 'Log Lift'], ['cardio', 'Cardio']];

  return (
    <View>
      <Card style={[s.hero, { padding: 12 }]}>
        <Segmented options={SEGS} value={seg} onChange={setSeg} />
        <View style={[s.row, { marginTop: 10 }]}>
          <Text style={{ fontSize: 10, color: near ? C.gold : C.dim, fontWeight: '700', fontVariant: ['tabular-nums'], marginRight: 8 }}>
            {Math.round(xpToday)}/{INTEGRITY.DAILY_XP_CAP} XP today
          </Text>
          <View style={{ flex: 1 }}><PBar pct={capPct} color={near ? C.gold : C.green} height={5} /></View>
        </View>
        {near && (
          <Text style={{ fontSize: 13, color: C.gold, marginTop: 7, fontWeight: '700' }}>
            XP cap nearly reached. Your sets still save.
          </Text>
        )}
      </Card>

      {seg === 'lift' && (
        <LogView
          data={data} dv={dv} onLog={onLift} onLogBatch={onLiftBatch}
          workoutDays={data.workoutDays} onSaveDay={onSaveDay} onDeleteDay={onDeleteDay}
          session={session} onEditEntry={onEditEntry} onDeleteEntry={onDeleteEntry}
        />
      )}
      {seg === 'cardio' && (
        <CardioView data={data} onLog={onCardio} onEditEntry={onEditEntry} onDeleteEntry={onDeleteEntry} />
      )}

      {/* ---- today, and the way through to the numbers -------------------
       * Train answers three questions: what am I training, what do I do next,
       * and how am I progressing. The first two are above. This is the third —
       * a one-line answer here, with the full analytics (strength curves,
       * volume, history, calculators) one tap away rather than occupying a
       * whole bottom tab of its own. */}
      <TodayStrip data={data} onOpenAnalytics={onOpenAnalytics} />
    </View>
  );
}

function TodayStrip({ data, onOpenAnalytics }) {
  const sessions = todaysSessions(data);
  const totals = sessions.reduce(
    (acc, sn) => ({
      sets: acc.sets + sn.sets,
      volumeKg: acc.volumeKg + sn.volumeKg,
      xp: acc.xp + sn.xp,
      prs: acc.prs + sn.prs,
    }),
    { sets: 0, volumeKg: 0, xp: 0, prs: 0 },
  );
  const volume = formatVolume(totals.volumeKg, data.unit);
  const title = sessions.length === 1 ? sessions[0].title : sessions.length > 1 ? `${sessions.length} sessions` : null;

  return (
    <Card style={{ marginTop: 4 }}>
      <View style={s.between}>
        <Lbl style={{ marginBottom: 0 }}>Today</Lbl>
        {title ? (
          <Text style={{ fontSize: 12, fontWeight: '700', color: C.gold }}>{title}</Text>
        ) : null}
      </View>

      {sessions.length ? (
        <Text style={{ fontSize: 14, color: C.mut, marginTop: 8, fontVariant: ['tabular-nums'] }}>
          {[
            `${totals.sets} sets`,
            volume,
            totals.prs > 0 ? `${totals.prs} PR${totals.prs === 1 ? '' : 's'}` : null,
            `+${totals.xp} XP`,
          ].filter(Boolean).join(' · ')}
        </Text>
      ) : (
        <Text style={{ fontSize: 14, color: C.dim, marginTop: 8 }}>
          Nothing logged yet today.
        </Text>
      )}

      {onOpenAnalytics ? (
        <Pressable
          onPress={onOpenAnalytics}
          accessibilityRole="button"
          accessibilityLabel="Open training analytics"
          style={{
            flexDirection: 'row', alignItems: 'center', marginTop: 12,
            minHeight: 44, paddingHorizontal: 13, borderRadius: 12,
            backgroundColor: C.panel2, borderWidth: 1, borderColor: C.line,
          }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: C.text }}>Progress &amp; analytics</Text>
            <Text style={{ fontSize: 11.5, color: C.dim, marginTop: 1 }}>
              Strength curves, volume, history, calculators
            </Text>
          </View>
          <Text style={{ fontSize: 18, fontWeight: '700', color: C.dim }}>›</Text>
        </Pressable>
      ) : null}
    </Card>
  );
}

/* ----------------------- Workout Day builder sheet -----------------------
 * Name a day, tap exercises from the library to add them, save. The visible
 * Edit control opens this builder again with a delete option.
 */
function DayBuilder({ initial, onClose, onSave, onDelete }) {
  const { height } = useWindowDimensions();
  const isEdit = !!(initial && initial.id);
  const [name, setName] = useState(initial ? initial.name : '');
  // Normalised on load for the same reason the runner does it: a legacy day of
  // bare exercise names would otherwise produce chips with no label and a
  // "SELECTED" set full of undefined.
  const [chosen, setChosen] = useState(() => dayExercises(initial));
  const [query, setQuery] = useState('');
  const [cat, setCat] = useState('All');

  const chosenSet = useMemo(() => new Set(chosen.map((e) => e.n)), [chosen]);
  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return EXERCISES.filter((e) => (cat === 'All' || e.c === cat) && (!q || e.n.toLowerCase().includes(q))).slice(0, 40);
  }, [query, cat]);

  const toggle = (e) => setChosen((c) =>
    chosenSet.has(e.n) ? c.filter((x) => x.n !== e.n) : [...c, { n: e.n, c: e.c, p: e.p, s: e.s }]);

  const save = () => {
    if (!name.trim() || !chosen.length) return;
    // Stored lean — just what the runner needs. Keeping the full library record
    // would bloat every save and go stale the moment an exercise is retuned.
    const exercises = chosen.map((e) => ({ n: e.n, c: e.c, p: e.p, s: e.s || null }));
    onSave({ id: initial && initial.id, name: name.trim(), exercises });
    onClose();
  };

  return (
    <Sheet visible title={isEdit ? 'Edit Workout Day' : 'Build a Workout Day'} onClose={onClose}>
      {/* 0.52, not 0.68: the sheet is capped at 82% of the screen, so the
          scroll area has to be short enough to leave room for the sticky save
          footer below it. */}
      <ScrollView
        style={{ maxHeight: Math.max(260, height * 0.52) }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <Text style={{ fontSize: 15, fontWeight: '800', color: C.text, marginBottom: 7 }}>1. Name your workout</Text>
        <TextInput value={name} onChangeText={setName} placeholder="Push, Pull, Legs…"
          placeholderTextColor={C.dim} style={[s.input, { marginBottom: 10 }]} />
        <Text style={{ fontSize: 15, fontWeight: '800', color: C.text, marginTop: 4, marginBottom: 7 }}>2. Add exercises</Text>
        {chosen.length > 0 && (
          <View style={{ marginBottom: 8 }}>
            <Text style={{ fontSize: 11, fontWeight: '800', color: C.cyan, marginBottom: 7 }}>{chosen.length} SELECTED</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {chosen.map((e) => (
                <Pressable key={e.n} onPress={() => setChosen((c) => c.filter((x) => x.n !== e.n))}
                  style={{ backgroundColor: C.gold, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, marginRight: 6, marginBottom: 6 }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: C.ink }}>{e.n}  ✕</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}
        <TextInput value={query} onChangeText={setQuery} placeholder="Search to add exercises…"
          placeholderTextColor={C.dim} style={[s.input, { marginBottom: 10 }]} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
          {CATEGORIES.map((c) => <Chip key={c} active={cat === c} onPress={() => setCat(c)}>{c}</Chip>)}
        </ScrollView>
        <View style={{ marginTop: 4 }}>
          {list.map((e) => {
            const on = chosenSet.has(e.n);
            return (
              <Pressable key={e.n} onPress={() => toggle(e)}
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line }}>
                <Text style={{ fontSize: 15, color: on ? C.gold : C.text, fontWeight: on ? '800' : '500' }}>{e.n}</Text>
                <Text style={{ fontSize: 16, color: on ? C.gold : C.dim }}>{on ? '✓' : '+'}</Text>
              </Pressable>
            );
          })}
        </View>
        {isEdit && (
          <Pressable onPress={() => { onDelete(initial.id); onClose(); }} hitSlop={8}
            style={{ alignItems: 'center', marginTop: 16 }}>
            <Text style={{ fontSize: 12, color: C.red, fontWeight: '700' }}>Delete day</Text>
          </Pressable>
        )}
      </ScrollView>

      {/* ---- save: a STICKY footer, outside the scroll view --------------
       * This used to live at the bottom of the list above, which put it below
       * forty exercise rows — so the only button anyone could actually see was
       * "Done" in the sheet header, and Done closes WITHOUT saving. People
       * filled the whole form in, tapped the one visible button, and lost it.
       *
       * Now it is always on screen, and it states what is missing rather than
       * just sitting there greyed out with no explanation. */}
      <View style={{
        paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16,
        borderTopWidth: 1, borderTopColor: C.lineSoft, backgroundColor: C.bgElev,
      }}>
        <Text style={{ fontSize: 12, color: C.dim, marginBottom: 8 }}>
          {!name.trim() && !chosen.length
            ? 'Name it, then tap exercises to add them.'
            : !name.trim()
              ? `${chosen.length} exercise${chosen.length === 1 ? '' : 's'} added — now give it a name.`
              : !chosen.length
                ? 'Now tap the exercises you want in this day.'
                : `${name.trim()} · ${chosen.length} exercise${chosen.length === 1 ? '' : 's'}`}
        </Text>
        <GoldBtn onPress={save} disabled={!name.trim() || !chosen.length}>
          {isEdit ? 'SAVE CHANGES' : 'SAVE WORKOUT DAY'}
        </GoldBtn>
      </View>
    </Sheet>
  );
}

/* --------------------------- exercise how-to -----------------------------
 * What the movement trains and how to perform it, so nobody has to leave the
 * app to look up a lift. Cues come from the shared exerciseInfo table: the
 * major lifts are hand-written, everything else is matched on its movement
 * pattern rather than padded out with generic advice.
 */
function ExerciseInfoSheet({ ex, meta, onClose }) {
  const info = exerciseInfo(ex.n, ex.c);
  return (
    <Sheet visible title={ex.n} onClose={onClose}>
      <View style={{ padding: 16 }}>
        {/* which body region, drawn */}
        <View style={[s.row, { alignItems: 'center', marginBottom: 14 }]}>
          <View style={{
            width: 62, height: 62, borderRadius: 14, marginRight: 14,
            backgroundColor: meta.color + '1e', borderWidth: 1, borderColor: meta.color + '55',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <MuscleIcon group={meta.glyph} color={meta.color} size={34} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 12, fontWeight: '800', color: meta.color, letterSpacing: 0.6 }}>
              {meta.title.toUpperCase()}
            </Text>
            {info && info.trains ? (
              <Text style={{ fontSize: 13.5, color: C.mut, marginTop: 3, lineHeight: 19 }}>
                Trains {info.trains}.
              </Text>
            ) : null}
            <View style={{ flexDirection: 'row', marginTop: 7 }}>
              <View style={{
                paddingVertical: 3, paddingHorizontal: 8, borderRadius: 6,
                backgroundColor: STAT_META[ex.p].color + '1e',
              }}>
                <Text style={{ fontSize: 10.5, fontWeight: '800', color: STAT_META[ex.p].color }}>
                  {STAT_META[ex.p].name}
                </Text>
              </View>
              {ex.s ? (
                <View style={{
                  paddingVertical: 3, paddingHorizontal: 8, borderRadius: 6, marginLeft: 6,
                  backgroundColor: STAT_META[ex.s].color + '1e',
                }}>
                  <Text style={{ fontSize: 10.5, fontWeight: '800', color: STAT_META[ex.s].color }}>
                    {STAT_META[ex.s].name}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>

        {ex.v ? (
          <View style={{
            padding: 11, borderRadius: 10, marginBottom: 14,
            backgroundColor: C.panel2, borderWidth: 1, borderColor: C.line,
          }}>
            <Text style={{ fontSize: 10, fontWeight: '800', color: C.dim, letterSpacing: 1 }}>VARIATIONS</Text>
            <Text style={{ fontSize: 13, color: C.text, marginTop: 3 }}>{ex.v}</Text>
          </View>
        ) : null}

        {info && info.cues ? (
          <View>
            <Text style={{ fontSize: 10, fontWeight: '800', color: C.dim, letterSpacing: 1, marginBottom: 9 }}>
              HOW TO DO IT
            </Text>
            {info.cues.map((cue, i) => (
              <View key={i} style={{ flexDirection: 'row', marginBottom: 11 }}>
                <View style={{
                  width: 21, height: 21, borderRadius: 11, marginRight: 11, marginTop: 1,
                  backgroundColor: meta.color + '22', borderWidth: 1, borderColor: meta.color + '55',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Text style={{ fontSize: 10.5, fontWeight: '900', color: meta.color, fontVariant: ['tabular-nums'] }}>{i + 1}</Text>
                </View>
                <Text style={{ flex: 1, fontSize: 13.5, color: C.text, lineHeight: 19 }}>{cue}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {loadNote(ex.n) ? (
          <View style={{
            marginTop: 4, padding: 10, borderRadius: 10,
            backgroundColor: C.goldSoft, borderWidth: 1, borderColor: C.gold,
          }}>
            <Text style={{ fontSize: 12.5, color: C.gold, fontWeight: '800', lineHeight: 17 }}>{loadNote(ex.n)}</Text>
          </View>
        ) : null}
      </View>
    </Sheet>
  );
}

/* ========================= edit a logged entry ============================
 * People get sets wrong: 100 instead of 10, reps typed into the weight box, an
 * intensity picked in a hurry. Until now the only repair was to DELETE and
 * re-log — which stamped the set with the current time, so a mistake spotted
 * the next morning moved the set to the wrong day, the wrong session and out of
 * whatever duel window it belonged to.
 *
 * One sheet serves both kinds of entry, because the decision is the same shape:
 * fix the numbers, or remove it.
 *
 * Two things it deliberately does NOT change:
 *   · the exercise — swapping that makes it a different set, not a correction
 *   · the timestamp — it is what anchors the entry to its session, its day, its
 *     streak and any duel it falls inside
 *
 * It lives here rather than in ProgressTab so it can share the EFFORT scale
 * above, and so the Train screen can offer the same editor on the set you have
 * just this second logged.
 * ====================================================================== */
export function EntryEditor({ entry, unit, onSave, onDelete, onClose }) {
  const isCardio = !!entry && entry.kind === 'cardio';
  const [w, setW] = useState(entry && entry.w != null ? String(entry.w) : '');
  const [r, setR] = useState(entry && entry.r != null ? String(entry.r) : '');
  const [rpe, setRpe] = useState((entry && entry.rpe) || 8);
  const [mins, setMins] = useState(entry && entry.mins != null ? String(entry.mins) : '');
  const [dist, setDist] = useState(entry && entry.dist ? String(entry.dist) : '');
  const [inten, setInten] = useState(intensityKeyOf(entry && entry.intensity));
  // Deleting takes two taps. This sheet is reached BY tapping, so a single
  // destructive tap is exactly the mistap that needs designing out.
  const [armed, setArmed] = useState(false);

  if (!entry) return null;

  const valid = isCardio ? (parseFloat(mins) || 0) > 0 : (parseInt(r, 10) || 0) >= 1;

  const save = () => {
    if (!valid) return;
    onSave(isCardio
      ? { mins: parseFloat(mins) || 0, dist: parseFloat(dist) || 0, intensity: inten }
      : { w: parseFloat(w) || 0, r: parseInt(r, 10) || 1, rpe });
  };

  return (
    <Sheet visible title={entry.ex || 'Edit entry'} onClose={onClose}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 18 }}
        keyboardShouldPersistTaps="handled">
        <Text style={{ fontSize: 12, color: C.dim, marginBottom: 14, fontVariant: ['tabular-nums'] }}>
          Logged {fmtShort(entry.t)} · was worth {entry.xp || 0} XP
        </Text>

        {isCardio ? (
          <View>
            <View style={s.row}>
              <NumField label="Minutes" value={mins} onChange={setMins} suffix="min" />
              <View style={{ width: 10 }} />
              <NumField label="Distance" value={dist} onChange={setDist} suffix="km" />
            </View>
            <View style={{ marginTop: 14 }}>
              <Lbl>Intensity</Lbl>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                {INTENSITIES.map((i) => (
                  <Chip key={i.k} active={inten === i.k} onPress={() => setInten(i.k)}>{i.label}</Chip>
                ))}
              </View>
            </View>
          </View>
        ) : (
          <View>
            <View style={s.row}>
              <NumField label="Weight" value={w} onChange={setW} suffix={unit} />
              <View style={{ width: 10 }} />
              <NumField label="Reps" value={r} onChange={setR} suffix="reps" />
            </View>
            <View style={{ marginTop: 14 }}>
              <Lbl>How hard was that set?</Lbl>
              <View style={s.row}>
                {EFFORT.map((e, i) => (
                  <Pressable key={e.v} onPress={() => setRpe(e.v)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: rpe === e.v }}
                    accessibilityLabel={e.label + ', effort ' + e.v + ' of 10'}
                    style={{
                      flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: 'center',
                      marginRight: i < EFFORT.length - 1 ? 5 : 0,
                      backgroundColor: rpe === e.v ? C.goldSoft : C.panel2,
                      borderWidth: 1, borderColor: rpe === e.v ? C.gold : C.line,
                    }}>
                    <Text style={{ fontWeight: '800', fontSize: 11, color: rpe === e.v ? C.gold : C.mut }}>{e.label}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>
        )}

        <Text style={{ fontSize: 11.5, color: C.dim, marginTop: 14, lineHeight: 16 }}>
          Saving re-scores this entry at its original time — XP and stats are
          recalculated, never stacked on top of the old values.
        </Text>

        <GoldBtn onPress={save} disabled={!valid} style={{ marginTop: 14 }}>
          Save changes
        </GoldBtn>

        <Pressable
          onPress={() => { if (armed) onDelete(); else setArmed(true); }}
          accessibilityRole="button"
          accessibilityLabel={armed ? 'Confirm delete entry' : 'Delete entry'}
          style={{
            minHeight: 46, marginTop: 10, borderRadius: 12,
            alignItems: 'center', justifyContent: 'center',
            backgroundColor: armed ? alpha(C.red, 0.14) : 'transparent',
            borderWidth: 1, borderColor: armed ? C.red : C.line,
          }}>
          <Text style={{ fontSize: 13, fontWeight: '800', color: armed ? C.red : C.mut }}>
            {armed ? 'Tap again to delete' : 'Delete this entry'}
          </Text>
        </Pressable>
        {armed ? (
          <Text style={{ fontSize: 11.5, color: C.dim, marginTop: 8, textAlign: 'center' }}>
            Its XP and stat gains are refunded.
          </Text>
        ) : null}
      </ScrollView>
    </Sheet>
  );
}
