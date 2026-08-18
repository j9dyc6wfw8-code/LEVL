# tests

`npm test` runs everything. Seconds, no jest, no extra dependencies.

| Suite | Catches |
|---|---|
| `engine.test.js` | Scoring maths: XP, edit/delete refunds, the anti-farming guards |
| `sweep.test.js` | Every screen renders, empty and populated, plus disabled states |
| `render.test.js` | Deeper interactive states — a Workout Day mid-run, sheets open, the pack reveal |
| `hooks.audit.js` | Rules-of-hooks violations |
| `undef.audit.js` | Identifiers that resolve to nothing at runtime |

## Why there is no jest

This is Expo + React Native. A full RN testing stack is a large dependency tree
for what these checks need, and it would need maintaining alongside the app.
Instead `sweep` and `render` use a small hand-rolled renderer: `react` is
stubbed so hooks return their initial values and `createElement` builds a plain
object tree, which is enough to execute a component's real first render and walk
the result.

`React.__stateFor` drives a component into a state it would normally only reach
after a tap — a Workout Day mid-run, the delete sheet armed, the pack reveal
mid-flight. Hook ORDER is the contract there: the indices are positional, so if
you reorder `useState` calls in a component the tests keep passing while
silently testing the wrong thing. Where that risk is real the suite reads the
component source and resolves the index by name instead.

## What these suites are known to miss

Worth stating plainly so nobody trusts them further than they deserve:

- **Layout and appearance.** Nothing here measures a pixel. A screen can pass
  every check and still be unreadable.
- **Anything after the first render.** Effects do not run and state does not
  update, so animations, timers and data loading are not exercised.
- **Native behaviour.** Blur, haptics, HealthKit, Live Activities and the camera
  are all stubbed.
- **The database.** RLS policies and SQL functions are verified against the real
  project, not here.

Three of the bugs found while writing these suites were only caught by running
the app on a simulator. Keep doing that.
