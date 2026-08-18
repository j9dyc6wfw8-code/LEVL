#!/usr/bin/env node
/* ============================================================================
 * LEVL — the whole test suite, in one command.
 *
 * There is no jest here on purpose: this project is Expo + React Native, and a
 * full RN testing stack is a large dependency tree for what these checks
 * actually need. Each suite is plain Node with a hand-rolled micro-renderer, so
 * `npm test` runs in seconds with nothing installed beyond what the app already
 * uses.
 *
 * What each one is for:
 *   engine   pure scoring maths — XP, edit/delete refunds, anti-farming
 *   sweep    every screen renders, in empty and populated states
 *   render   deeper interactive states — a workout day mid-run, sheets open
 *   hooks    rules-of-hooks violations, which only crash on a TRANSITION and so
 *            never show up in a render test
 *   undef    identifiers that resolve to nothing at runtime
 * ========================================================================= */
const { execFileSync } = require('child_process');
const path = require('path');

const SUITES = [
  ['engine maths', 'engine.test.js'],
  ['whole-app render sweep', 'sweep.test.js'],
  ['interactive states', 'render.test.js'],
  ['rules of hooks', 'hooks.audit.js'],
  ['undefined identifiers', 'undef.audit.js'],
];

let failed = 0;
for (const [label, file] of SUITES) {
  process.stdout.write('\n── ' + label + ' ' + '─'.repeat(Math.max(0, 44 - label.length)) + '\n');
  try {
    const out = execFileSync(process.execPath, [path.join(__dirname, file)], {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
    });
    const tail = out.trim().split('\n').slice(-2).join('\n');
    process.stdout.write(tail + '\n');
    // The audits exit 0 even when they report, so read their tally.
    const m = out.match(/(\d+) finding\(s\)/);
    if (m && Number(m[1]) > 0) {
      // ErrorUtils is a React Native global the audit cannot know about.
      const onlyKnown = out.split('\n')
        .filter((l) => /undefined identifier|—/.test(l))
        .every((l) => l.includes('ErrorUtils'));
      if (!onlyKnown) { failed++; process.stdout.write('   ^ unexpected findings\n'); }
      else process.stdout.write('   (only the known ErrorUtils false positive)\n');
    }
  } catch (e) {
    failed++;
    process.stdout.write((e.stdout || '') + (e.stderr || '') + '\n');
  }
}

process.stdout.write('\n' + (failed ? failed + ' SUITE(S) FAILED\n' : 'ALL SUITES PASSED\n'));
process.exit(failed ? 1 : 0);
