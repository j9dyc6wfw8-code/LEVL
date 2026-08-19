const ROOT = require('path').resolve(__dirname, '..');
const babel = require(ROOT + '/node_modules/@babel/core');
const fs = require('fs');
const path = ROOT + '/src/engine/engine.js';
const { code } = babel.transformSync(fs.readFileSync(path, 'utf8'), {
  filename: path,
  plugins: [ROOT + '/node_modules/@babel/plugin-transform-modules-commonjs'],
  babelrc: false, configFile: false,
});
const Module = require('module');
const m = new Module(path);
m._compile(code, path);
const E = m.exports;

let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if (cond) { pass++; console.log('  PASS ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra ? '  → ' + extra : '')); }
};
// Stats must always equal the sum of surviving entries' allocations, PLUS the
// day-bonus grants (which are never refunded). We track the bonus separately.
const allocSum = (d) => {
  const tot = {};
  [...d.lifts, ...d.cardio].forEach((e) => {
    Object.keys(e.alloc || {}).forEach((k) => { tot[k] = (tot[k] || 0) + e.alloc[k]; });
  });
  return tot;
};
const fresh = () => JSON.parse(JSON.stringify(E.DEFAULT_DATA));

console.log('\n1. edit a lift: XP tracks the new value, timestamp is preserved');
{
  let d = fresh();
  const t0 = Date.now() - 3 * 86400000;      // 3 days ago, so "firstToday" is clean
  let r = E.applyLift(d, t0, 'Bench Press', 60, 8, 8);
  d = r.nd;
  const id = r.meta.id;
  const xpAfterLog = d.xp;
  const entry = d.lifts[0];
  ok('meta carries the entry id', !!id);
  ok('one lift stored', d.lifts.length === 1);

  const e = E.editEntryPure(d, id, { w: 100 });
  d = e.nd;
  ok('still exactly one lift', d.lifts.length === 1, 'got ' + d.lifts.length);
  ok('timestamp preserved', d.lifts[0].t === t0, d.lifts[0].t + ' vs ' + t0);
  ok('weight updated', d.lifts[0].w === 100, String(d.lifts[0].w));
  ok('reps untouched', d.lifts[0].r === 8, String(d.lifts[0].r));
  ok('e1rm recomputed', d.lifts[0].e1rm > entry.e1rm);
  ok('xp rose with the load', d.xp > xpAfterLog, d.xp + ' vs ' + xpAfterLog);
  ok('xp == entry xp + first-day bonus', d.xp === d.lifts[0].xp + r.meta.bonus,
     d.xp + ' vs ' + (d.lifts[0].xp + r.meta.bonus));
}

console.log('\n2. edit does not mint XP, materials or stats when repeated');
{
  let d = fresh();
  const t0 = Date.now() - 3 * 86400000;
  d = E.applyLift(d, t0, 'Squat', 80, 5, 8).nd;
  const id = d.lifts[0].id;
  const matsBefore = JSON.stringify(d.materials || {});
  // Flip the weight back and forth 20 times — the classic farming attempt.
  for (let i = 0; i < 20; i++) {
    d = E.editEntryPure(d, d.lifts[0].id, { w: i % 2 ? 200 : 80 }).nd;
  }
  d = E.editEntryPure(d, d.lifts[0].id, { w: 80 }).nd;
  const clean = fresh();
  const ref = E.applyLift(clean, t0, 'Squat', 80, 5, 8).nd;
  ok('xp identical to a single clean log', d.xp === ref.xp, d.xp + ' vs ' + ref.xp);
  ok('stats identical to a single clean log',
     JSON.stringify(d.stats) === JSON.stringify(ref.stats),
     JSON.stringify(d.stats) + ' vs ' + JSON.stringify(ref.stats));
  ok('no materials farmed', JSON.stringify(d.materials || {}) === matsBefore,
     JSON.stringify(d.materials || {}) + ' vs ' + matsBefore);
  ok('one entry only', d.lifts.length === 1);
}

console.log('\n3. edit a cardio session, including its intensity label round-trip');
{
  let d = fresh();
  const t0 = Date.now() - 3 * 86400000;
  const r = E.applyCardio(d, t0, 'Cycling', 30, 10, 'moderate');
  d = r.nd;
  ok('stored as a label', d.cardio[0].intensity === 'Moderate', String(d.cardio[0].intensity));
  const e = E.editEntryPure(d, r.meta.id, { mins: 60, intensity: 'hard' });
  d = e.nd;
  ok('one cardio entry', d.cardio.length === 1);
  ok('minutes updated', d.cardio[0].mins === 60, String(d.cardio[0].mins));
  ok('intensity updated', d.cardio[0].intensity === 'Hard', String(d.cardio[0].intensity));
  ok('timestamp preserved', d.cardio[0].t === t0);
  ok('distance preserved when not patched', d.cardio[0].dist === 10, String(d.cardio[0].dist));
  ok('xp = 60 * 2.4', d.cardio[0].xp === Math.max(5, Math.round(60 * 2.4)), String(d.cardio[0].xp));
  // Editing only the intensity must keep the label mapping stable across rounds.
  d = E.editEntryPure(d, d.cardio[0].id, { intensity: 'Hard' }).nd;
  ok('label→key→label survives a round trip', d.cardio[0].intensity === 'Hard', String(d.cardio[0].intensity));
}

console.log('\n4. delete refunds exactly what the entry granted');
{
  let d = fresh();
  const t0 = Date.now() - 3 * 86400000;
  d = E.applyLift(d, t0, 'Deadlift', 100, 5, 9).nd;      // pays the day bonus
  const before = { xp: d.xp, stats: JSON.stringify(d.stats) };
  const r2 = E.applyLift(d, t0 + 60000, 'Deadlift', 110, 5, 9);
  d = r2.nd;
  d = E.removeEntryPure(d, r2.meta.id).nd;
  ok('xp back to pre-second-set', d.xp === before.xp, d.xp + ' vs ' + before.xp);
  ok('stats back to pre-second-set', JSON.stringify(d.stats) === before.stats);
  ok('entry gone', d.lifts.length === 1);
}

console.log('\n5. stats never drift from the surviving entries');
{
  let d = fresh();
  const base = Date.now() - 10 * 86400000;
  const ids = [];
  for (let i = 0; i < 6; i++) {
    const r = E.applyLift(d, base + i * 3600000, 'Bench Press', 50 + i * 5, 6, 8);
    d = r.nd; ids.push(r.meta.id);
  }
  const rc = E.applyCardio(d, base + 7 * 3600000, 'Swimming', 25, 1, 'light');
  d = rc.nd; ids.push(rc.meta.id);
  d = E.editEntryPure(d, ids[2], { w: 70, r: 3 }).nd;
  d = E.removeEntryPure(d, ids[4]).nd;
  d = E.editEntryPure(d, ids[6], { mins: 40 }).nd;
  d = E.removeEntryPure(d, ids[0]).nd;

  const sums = allocSum(d);
  // Every stat total must be >= the entry allocations (the excess is the
  // unrefunded day bonus) and must never be negative.
  let consistent = true, detail = '';
  Object.keys(d.stats).forEach((k) => {
    if (d.stats[k] < 0) { consistent = false; detail += k + ' negative; '; }
    if (d.stats[k] < (sums[k] || 0) - 0.001) {
      consistent = false;
      detail += k + ' ' + d.stats[k] + ' < alloc ' + (sums[k] || 0) + '; ';
    }
  });
  ok('no stat is negative or below its entry allocations', consistent, detail);
  ok('entry count is right', d.lifts.length + d.cardio.length === 5,
     String(d.lifts.length + d.cardio.length));
  ok('xp is non-negative', d.xp >= 0, String(d.xp));
  ok('computeDerived still runs', !!E.computeDerived(d, Date.now()).title);
}

console.log('\n6. editing a missing id is a no-op');
{
  let d = fresh();
  d = E.applyLift(d, Date.now() - 4 * 86400000, 'Squat', 90, 5, 8).nd;
  const snapshot = JSON.stringify(d);
  const e = E.editEntryPure(d, 'does-not-exist', { w: 500 });
  ok('data unchanged', JSON.stringify(e.nd) === snapshot);
  ok('meta is null', e.meta === null);
  const r = E.removeEntryPure(d, 'nope');
  ok('delete of missing id unchanged', JSON.stringify(r.nd) === snapshot);
}

console.log('\n7. normal logging is untouched by the new opts parameter');
{
  const t0 = Date.now() - 5 * 86400000;
  const a = E.applyLift(fresh(), t0, 'Bench Press', 80, 5, 9);
  ok('first-session bonus still paid', a.meta.bonus > 0, String(a.meta.bonus));
  const c = E.applyCardio(fresh(), t0, 'Run (Zone 2)', 30, 5, 'moderate');
  ok('cardio bonus still paid', c.meta.bonus > 0, String(c.meta.bonus));
  ok('cardio xp unchanged formula', c.meta.xp === Math.max(5, Math.round(30 * 1.6)), String(c.meta.xp));
}

console.log('\n8. rank protection — a layoff costs you rank slowly, not instantly');
{
  const DAY = 86400000;
  const now = Date.now();

  ok('floor of a Grandmaster peak is the Champion minimum', E.frFloorOf(3700) === 3000, String(E.frFloorOf(3700)));
  ok('floor of a Bronze peak is zero', E.frFloorOf(100) === 0, String(E.frFloorOf(100)));

  ok('full protection during grace', E.frProtection(now - 14 * DAY, now) === 1);
  ok('half protection mid-decay', Math.abs(E.frProtection(now - 21 * DAY, now) - 0.5) < 1e-9);
  ok('no protection after decay', E.frProtection(now - 28 * DAY, now) === 0);
  ok('no protection without a peak', E.frProtection(0, now) === 0);

  // A Champion who stops training entirely: raw FR is zero in all three cases,
  // so any difference is the floor doing its job.
  const lapsed = (daysAgo) => {
    const d = fresh();
    d.frPeak = 3700; d.frPeakAt = now - daysAgo * DAY;
    return E.computeDerived(d, now);
  };
  const at3 = lapsed(3), at21 = lapsed(21), at40 = lapsed(40);
  ok('raw rating really is zero', at3.frRaw === 0, String(at3.frRaw));
  ok('held at Champion during grace', at3.tier.name === 'Champion', at3.tier.name);
  ok('flagged as protected, with a countdown', at3.frProtected && at3.frProtectionDaysLeft > 0);
  ok('slid partway down mid-decay', at21.fr === 1500 && at21.tier.name === 'Gold', at21.tier.name);
  ok('fully decayed after the window', at40.fr === 0 && at40.frProtected === false, at40.tier.name);

  // An existing save that predates the feature must behave exactly as before.
  const old = fresh();
  delete old.frPeak; delete old.frPeakAt;
  const dOld = E.computeDerived(old, now);
  ok('old saves unaffected', dOld.fr === dOld.frRaw && dOld.frProtected === false);

  // The peak is a high-water mark: it rises, never falls.
  const kept = fresh();
  kept.frPeak = 3000; kept.frPeakAt = now - 5 * DAY;
  ok('peak is never lowered', E.updateFrPeak(kept, now).frPeak === 3000);

  // Protection must never touch anything that pays out.
  ok('protection does not grant XP', at3.level === E.computeDerived(fresh(), now).level);
}

console.log('\n9. barbell detection — decides whether a plate hint is meaningful');
{
  ok('barbell lifts detected', E.usesBarbell('Barbell Bench Press') && E.usesBarbell('Back Squat')
     && E.usesBarbell('Deadlift') && E.usesBarbell('Rack Pull'));
  ok('dumbbell excluded', !E.usesBarbell('Dumbbell Curl'));
  // The one that makes a naive substring check wrong: this contains
  // 'romanian deadlift' but there is no bar in sight.
  ok('dumbbell variant of a barbell lift excluded', !E.usesBarbell('Dumbbell Romanian Deadlift'));
  ok('cable and machine excluded', !E.usesBarbell('Cable Fly') && !E.usesBarbell('Machine Press'));
  ok('non-barbell accessories excluded', !E.usesBarbell('Lateral Raise') && !E.usesBarbell('Plank'));
  ok('empty and null are safe', !E.usesBarbell('') && !E.usesBarbell(null) && !E.usesBarbell(undefined));
  ok('case insensitive', E.usesBarbell('BARBELL CURL') && E.usesBarbell('barbell curl'));
}

console.log('\n' + (fail ? 'FAILED ' + fail + ' / ' + (pass + fail) : 'ALL ' + pass + ' CHECKS PASSED'));
process.exit(fail ? 1 : 0);
