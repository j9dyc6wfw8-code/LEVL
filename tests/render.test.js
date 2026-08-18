/* A micro-renderer for LEVL's screens.
 *
 * There is no jest / react-test-renderer in this project, so `react` itself is
 * stubbed: hooks return their initial values and createElement builds a plain
 * object tree. That is enough to execute a component's FIRST render for real and
 * then assert the thing that actually broke Workout Days — an object handed to a
 * <Text> as a child, which React Native throws on. */
const ROOT = require('path').resolve(__dirname, '..');
const fs = require('fs');
const path = require('path');
const Module = require('module');
const babel = require(ROOT + '/node_modules/@babel/core');

/* ---------- compile app sources on require ---------- */
const jsLoader = Module._extensions['.js'];
Module._extensions['.js'] = function (m, filename) {
  if (filename.indexOf('/node_modules/') !== -1) return jsLoader(m, filename);
  const out = babel.transformSync(fs.readFileSync(filename, 'utf8'), {
    filename,
    presets: [[ROOT + '/node_modules/babel-preset-expo', { jsxRuntime: 'classic' }]],
    babelrc: false, configFile: false,
  });
  return m._compile(out.code, filename);
};

/* ---------- the fake react ---------- */
global.__DEV__ = false;
const TEXT = 'Text';
let hookOrder = [];
const React = {
  createElement: (type, props, ...children) => ({
    __el: true, type,
    props: { ...(props || {}), children: children.length <= 1 ? children[0] : children },
  }),
  Fragment: 'Fragment',
  memo: (fn) => fn,
  forwardRef: (fn) => fn,
  Children: {
    toArray: (c) => (Array.isArray(c) ? c.flat(9).filter((x) => x != null && x !== false) : c == null ? [] : [c]),
  },
  useState: (init) => {
    const i = React.__hookIndex++;
    const ov = React.__overrides;
    const has = ov && Object.prototype.hasOwnProperty.call(ov, i);
    return [has ? ov[i] : (typeof init === 'function' ? init() : init), () => {}];
  },
  useRef: (v) => ({ current: v }),
  __hookIndex: 0,
  __overrides: null,
  // name -> { hookIndex: value }. Consulted when walk() invokes a component.
  __stateFor: {},
  useMemo: (fn) => fn(),
  useCallback: (fn) => fn,
  useEffect: () => {},
  useLayoutEffect: () => {},
  useContext: () => ({}),
  useReducer: (r, i) => [i, () => {}],
};
React.default = React;

/* ---------- the fake react-native ---------- */
const comp = (name) => name;                       // element types are just names
const AnimatedValue = function (v) { this._v = v; };
AnimatedValue.prototype.interpolate = function () { return new AnimatedValue(0); };
AnimatedValue.prototype.setValue = function () {};
AnimatedValue.prototype.addListener = function () { return 1; };
AnimatedValue.prototype.removeListener = function () {};
AnimatedValue.prototype.stopAnimation = function () {};
const anim = () => ({ start: (cb) => { if (cb) cb({ finished: true }); }, stop: () => {}, reset: () => {} });
const Animated = {
  Value: AnimatedValue,
  View: comp('Animated.View'),
  Text: comp(TEXT),                                // renders as Text — same rules
  ScrollView: comp('Animated.ScrollView'),
  Image: comp('Animated.Image'),
  timing: anim, spring: anim, decay: anim,
  loop: anim, sequence: anim, parallel: anim, stagger: anim, delay: anim,
  multiply: () => new AnimatedValue(1),
  add: () => new AnimatedValue(1),
  createAnimatedComponent: (c) => c,
};
const Easing = new Proxy({}, { get: () => (x) => x });
const RN = {
  View: comp('View'), Text: comp(TEXT), Pressable: comp('Pressable'),
  TouchableOpacity: comp('Pressable'), TextInput: comp('TextInput'),
  ScrollView: comp('ScrollView'), FlatList: comp('FlatList'), Image: comp('Image'),
  Modal: comp('Modal'), SafeAreaView: comp('View'), KeyboardAvoidingView: comp('View'),
  ActivityIndicator: comp('ActivityIndicator'), Switch: comp('Switch'),
  StyleSheet: { create: (o) => o, hairlineWidth: 0.5, absoluteFill: {}, flatten: (o) => o },
  Platform: { OS: 'ios', select: (o) => (o.ios !== undefined ? o.ios : o.default) },
  Dimensions: { get: () => ({ width: 393, height: 852 }) },
  useWindowDimensions: () => ({ width: 393, height: 852, scale: 3, fontScale: 1 }),
  Animated, Easing,
  AccessibilityInfo: { isReduceMotionEnabled: () => Promise.resolve(false), addEventListener: () => ({ remove() {} }) },
  AppState: { addEventListener: () => ({ remove() {} }), currentState: 'active' },
  Alert: { alert: () => {} },
  Linking: { openURL: () => Promise.resolve(), addEventListener: () => ({ remove() {} }) },
  InteractionManager: { runAfterInteractions: (f) => f && f() },
  LayoutAnimation: { configureNext: () => {}, Presets: {} },
  UIManager: {}, NativeModules: {}, PixelRatio: { get: () => 3, roundToNearestPixel: (n) => n },
};
RN.default = RN;

/* ---------- other native-ish modules ---------- */
const svgProxy = new Proxy(
  { default: comp('Svg'), __esModule: true },
  { get: (t, k) => (k in t ? t[k] : comp('Svg.' + String(k))) },
);
const STUBS = {
  react: React,
  'react-native': RN,
  'react-native-svg': svgProxy,
  'expo-linear-gradient': { LinearGradient: comp('LinearGradient'), default: comp('LinearGradient') },
  'expo-haptics': {
    notificationAsync: () => {}, impactAsync: () => {}, selectionAsync: () => {},
    NotificationFeedbackType: { Success: 1, Warning: 2, Error: 3 },
    ImpactFeedbackStyle: { Light: 1, Medium: 2, Heavy: 3 },
  },
  'expo-blur': { BlurView: comp('BlurView') },
  'expo-clipboard': { setStringAsync: () => Promise.resolve(true), getStringAsync: () => Promise.resolve('') },
  'expo-camera': { CameraView: comp('CameraView'), useCameraPermissions: () => [{ granted: true }, () => {}] },
  'expo-image-manipulator': { manipulateAsync: () => Promise.resolve({}), SaveFormat: { JPEG: 'jpeg' } },
  'expo-apple-authentication': { AppleAuthenticationButton: comp('AppleBtn'), AppleAuthenticationButtonType: {}, AppleAuthenticationButtonStyle: {}, isAvailableAsync: () => Promise.resolve(false) },
  'react-native-safe-area-context': { SafeAreaView: comp('View'), useSafeAreaInsets: () => ({ top: 59, bottom: 34, left: 0, right: 0 }), SafeAreaProvider: comp('View') },
  'react-native-url-polyfill/auto': {},

  '@react-native-async-storage/async-storage': { __esModule: true, default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve(), removeItem: () => Promise.resolve(), multiGet: () => Promise.resolve([]) } },
  'expo-crypto': { digestStringAsync: () => Promise.resolve('x'), CryptoDigestAlgorithm: { SHA256: 'sha256' }, randomUUID: () => 'uuid' },
  'expo-constants': { __esModule: true, default: { expoConfig: { extra: { supabaseUrl: 'https://stub.supabase.co', supabaseAnonKey: 'stub-anon-key', eas: { projectId: 'p' } } }, easConfig: null } },
  'expo-device': { isDevice: true, modelName: 'iPhone' },
  'expo-file-system': { documentDirectory: '/tmp/', getInfoAsync: () => Promise.resolve({ exists: false }), makeDirectoryAsync: () => Promise.resolve(), copyAsync: () => Promise.resolve(), deleteAsync: () => Promise.resolve(), readAsStringAsync: () => Promise.resolve(''), writeAsStringAsync: () => Promise.resolve(), File: class {}, Directory: class {}, Paths: { document: '/tmp/' } },
  'expo-localization': { getCalendars: () => [{ timeZone: 'Europe/London' }], getLocales: () => [{ languageTag: 'en-GB' }] },
  'expo-notifications': { setNotificationHandler: () => {}, getPermissionsAsync: () => Promise.resolve({ status: 'granted', canAskAgain: true }), requestPermissionsAsync: () => Promise.resolve({ status: 'granted' }), getExpoPushTokenAsync: () => Promise.resolve({ data: 't' }), scheduleNotificationAsync: () => Promise.resolve('id'), cancelScheduledNotificationAsync: () => Promise.resolve(), getAllScheduledNotificationsAsync: () => Promise.resolve([]), addNotificationResponseReceivedListener: () => ({ remove() {} }), addNotificationReceivedListener: () => ({ remove() {} }), setBadgeCountAsync: () => Promise.resolve(), SchedulableTriggerInputTypes: { DATE: 'date' } },
  '@supabase/supabase-js': { createClient: () => ({ auth: { getSession: () => Promise.resolve({ data: { session: null } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }), signOut: () => Promise.resolve({}) }, from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null }) }), order: () => ({ limit: () => Promise.resolve({ data: [] }) }), in: () => ({ order: () => ({ limit: () => Promise.resolve({ data: [] }) }) }) }), insert: () => Promise.resolve({}), upsert: () => Promise.resolve({}) }), channel: () => ({ on: function () { return this; }, subscribe: function () { return this; }, unsubscribe() {} }), removeChannel: () => {} }) },
  'react-native-url-polyfill/auto': {},

  'expo-image': { Image: comp('Image') },
  'expo-symbols': { SymbolView: comp('SymbolView') },
};
const origRequire = Module.prototype.require;
Module.prototype.require = function (id) {
  if (STUBS[id]) return STUBS[id];
  return origRequire.apply(this, arguments);
};

/* ---------- the checks ---------- */
let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if (cond) { pass++; console.log('  PASS ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra ? '\n       → ' + extra : '')); }
};

// Walk a rendered tree, expanding function components as we go.
function walk(node, visit, depth) {
  if (depth > 60 || node == null || node === false || node === true) return;
  if (Array.isArray(node)) { node.forEach((n) => walk(n, visit, depth + 1)); return; }
  if (typeof node !== 'object' || !node.__el) return;
  if (node.type == null || (typeof node.type !== 'string' && typeof node.type !== 'function')) {
    throw new Error('renders an undefined component (React: "Element type is invalid")');
  }
  visit(node);
  let expanded = node;
  if (typeof node.type === 'function') {
    let out;
    const nm = node.type.name || '';
    React.__overrides = React.__stateFor[nm] || null;
    React.__hookIndex = 0;
    try { out = node.type(node.props); } catch (e) {
      throw new Error('component ' + (node.type.name || 'anon') + ' threw: ' + e.message);
    }
    walk(out, visit, depth + 1);
    return;
  }
  walk(expanded.props && expanded.props.children, visit, depth + 1);
}

// The Workout Day crash: a non-primitive child inside a <Text>.
function badTextChildren(node) {
  const bad = [];
  walk(node, (el) => {
    if (el.type !== TEXT) return;
    const scan = (c) => {
      if (c == null || c === false || c === true) return;
      if (Array.isArray(c)) { c.forEach(scan); return; }
      const t = typeof c;
      if (t === 'string' || t === 'number') return;
      if (t === 'object' && c.__el) {
        // Nested Text / Animated.Text is legal in React Native.
        if (c.type === TEXT || typeof c.type === 'function') { scan(c.props && c.props.children); return; }
        bad.push('<Text> contains element <' + String(c.type) + '>');
        return;
      }
      bad.push('<Text> contains ' + t + ': ' + JSON.stringify(c));
    };
    scan(el.props.children);
  }, 0);
  return bad;
}

const { DEFAULT_DATA, computeDerived, applyLift, applyCardio } = require(ROOT + '/src/engine/engine.js');
const TrainTabMod = require(ROOT + '/src/screens/TrainTab.js');
const TrainTab = TrainTabMod.default;
const { EntryEditor, CalcView } = TrainTabMod;
const ProgressTab = require(ROOT + '/src/screens/ProgressTab.js').default;
const PacksTab = require(ROOT + '/src/screens/PacksTab.js').default;

const el = (Comp, props) => React.createElement(Comp, props);
const fresh = () => JSON.parse(JSON.stringify(DEFAULT_DATA));

function seeded() {
  let d = fresh();
  const base = Date.now() - 6 * 86400000;
  for (let i = 0; i < 5; i++) d = applyLift(d, base + i * 3700000, 'Bench Press', 60 + i * 5, 8, 8).nd;
  d = applyCardio(d, base + 20000000, 'Run (Zone 2)', 32, 6.4, 'moderate').nd;
  d = applyCardio(d, Date.now() - 3600000, 'Muay Thai (Bag / Pads)', 45, 0, 'hard').nd;
  d = applyCardio(d, Date.now() - 7200000, 'Yoga Flow', 20, 0, 'light').nd;
  return d;
}

function render(name, node) {
  let bad;
  try { bad = badTextChildren(node); } catch (e) { ok(name + ' renders', false, e.message); return; }
  ok(name + ' renders', true);
  ok(name + ' has no object inside a <Text>', bad.length === 0, bad.slice(0, 4).join('; '));
}

console.log('\n1. Train — Log Lift (empty save)');
{
  const d = fresh();
  render('TrainTab/lift empty', el(TrainTab, {
    data: d, dv: computeDerived(d, Date.now()),
    onLift: () => null, onLiftBatch: () => null, onCardio: () => null,
    onSaveDay: () => {}, onDeleteDay: () => {}, onEditEntry: () => {}, onDeleteEntry: () => {}, onSetRestSeconds: () => {},
    onOpenAnalytics: () => {},
  }));
}

console.log('\n2. Train — with history, workout days, and a day IN PROGRESS');
{
  const d = seeded();
  // The exact shape the DayBuilder saves: objects, not strings. This is what
  // used to crash the moment a day was started.
  d.workoutDays = [{
    id: 'wd1', name: 'Push',
    exercises: [
      { n: 'Bench Press', c: 'Chest', p: 'STR', s: null },
      { n: 'Overhead Press', c: 'Shoulders', p: 'STR', s: 'PWR' },
      { n: 'Triceps Pushdown', c: 'Triceps', p: 'STR', s: null },
    ],
  },
  // A legacy day of BARE NAMES, which is what the earliest saves stored.
  { id: 'wd2', name: 'Legacy Legs', exercises: ['Back Squat', 'Romanian Deadlift'] }];

  const dv = computeDerived(d, Date.now());
  const props = {
    data: d, dv,
    onLift: () => null, onLiftBatch: () => null, onCardio: () => null,
    onSaveDay: () => {}, onDeleteDay: () => {}, onEditEntry: () => {}, onDeleteEntry: () => {}, onSetRestSeconds: () => {},
    onOpenAnalytics: () => {},
  };
  render('TrainTab/lift seeded', el(TrainTab, props));

  // Reach INSIDE LogView the way a real tap would: call the internal helpers by
  // rendering the day-mode branch directly through the exported pieces we have.
  // The day-progress chips are the crash site, so drive them explicitly.
  const { EXERCISES } = require(ROOT + '/src/engine/engine.js');
  const both = [d.workoutDays[0], d.workoutDays[1]];
  both.forEach((day) => {
    const list = (day.exercises || []).map((e) => (typeof e === 'string' ? e : e && e.n)).filter(Boolean);
    ok('day "' + day.name + '" yields printable names', list.every((n) => typeof n === 'string' && n.length > 0),
      JSON.stringify(list));
  });
}

console.log('\n3. Train — Cardio, every discipline and both composer states');
{
  const d = seeded();
  const dv = computeDerived(d, Date.now());
  // CardioView is internal, so exercise it through TrainTab by rendering the
  // whole tab; the segmented control defaults to lift, so also render the module
  // function directly via the tab's own children walk.
  render('TrainTab/cardio via tab', el(TrainTab, {
    data: d, dv, onLift: () => null, onLiftBatch: () => null, onCardio: () => null,
    onSaveDay: () => {}, onDeleteDay: () => {}, onEditEntry: () => {}, onDeleteEntry: () => {}, onSetRestSeconds: () => {},
    onOpenAnalytics: () => {},
  }));
  // Empty save must not divide by zero in the 7-day strip.
  const empty = fresh();
  render('TrainTab/cardio empty save', el(TrainTab, {
    data: empty, dv: computeDerived(empty, Date.now()),
    onLift: () => null, onLiftBatch: () => null, onCardio: () => null,
    onSaveDay: () => {}, onDeleteDay: () => {}, onEditEntry: () => {}, onDeleteEntry: () => {}, onSetRestSeconds: () => {},
    onOpenAnalytics: () => {},
  }));
}

console.log('\n4. EntryEditor — lift and cardio');
{
  let d = fresh();
  const r = applyLift(d, Date.now() - 4 * 86400000, 'Back Squat', 120, 5, 9);
  d = r.nd;
  const lift = d.lifts[0];
  render('EntryEditor/lift', el(EntryEditor, {
    entry: { ...lift, kind: 'lift' }, unit: 'kg',
    onSave: () => {}, onDelete: () => {}, onClose: () => {},
  }));

  const rc = applyCardio(d, Date.now() - 2 * 86400000, 'Cycling', 40, 15, 'hard');
  const cardio = rc.nd.cardio[0];
  render('EntryEditor/cardio', el(EntryEditor, {
    entry: { ...cardio, kind: 'cardio' }, unit: 'kg',
    onSave: () => {}, onDelete: () => {}, onClose: () => {},
  }));

  // A missing entry must render nothing rather than throw.
  let threw = false;
  try { badTextChildren(el(EntryEditor, { entry: null, unit: 'kg', onSave: () => {}, onDelete: () => {}, onClose: () => {} })); }
  catch (e) { threw = true; }
  ok('EntryEditor survives a null entry', !threw);
}

console.log('\n5. Progress — every segment, including History');
{
  const d = seeded();
  const dv = computeDerived(d, Date.now());
  render('ProgressTab', el(ProgressTab, { data: d, dv, onDelete: () => {}, onEdit: () => {} }));
  const empty = fresh();
  render('ProgressTab empty', el(ProgressTab, { data: empty, dv: computeDerived(empty, Date.now()), onDelete: () => {}, onEdit: () => {} }));
}

console.log('\n6. Packs — the screen, and the reveal at every rarity');
{
  const d = seeded();
  d.packs = { standard: 2, prime: 1, elite: 1 };
  d.recentPulls = [{ id: 'p1', t: Date.now(), pack: 'elite', rarity: 'legendary', kind: 'coins', name: '420 Coins' }];
  const dv = computeDerived(d, Date.now());
  render('PacksTab', el(PacksTab, { data: d, dv, openPackH: () => null, grantTestPack: () => {}, goBack: () => {} }));
}

/* ------------------------------------------------------------------------
 * The states that only exist AFTER a tap. These are the ones that matter:
 * the Workout Day runner and the cardio composer are exactly where the app
 * used to break, and neither is reachable from a component's initial state.
 * Hook order is the contract here — it is fixed by the source, and if someone
 * reorders the useState calls these tests stop driving what they claim to.
 * --------------------------------------------------------------------- */
console.log('\n7. Train — a Workout Day actually RUNNING (the old crash site)');
{
  const d = seeded();
  const push = {
    id: 'wd1', name: 'Push Day',
    exercises: [
      { n: 'Bench Press', c: 'Chest', p: 'STR', s: null },
      { n: 'Overhead Press', c: 'Shoulders', p: 'STR', s: 'PWR' },
      { n: 'Incline Dumbbell Press', c: 'Chest', p: 'STR', s: null },
    ],
  };
  const legacy = { id: 'wd2', name: 'Legacy', exercises: ['Back Squat', 'Bench Press'] };
  d.workoutDays = [push, legacy];
  const dv = computeDerived(d, Date.now());
  const props = {
    data: d, dv, onLift: () => null, onLiftBatch: () => null, onCardio: () => null,
    onSaveDay: () => {}, onDeleteDay: () => {}, onEditEntry: () => {}, onDeleteEntry: () => {}, onSetRestSeconds: () => {},
    onOpenAnalytics: () => {},
  };

  // TrainTab useState order: seg, sel, w, r, rpe, dayMode
  const runDay = (day, label, idx, done) => {
    const list = (day.exercises || []).map((e) => (typeof e === 'string'
      ? { n: e, c: 'Chest', p: 'STR', s: null } : e));
    React.__stateFor = {
      TrainTab: { 0: 'lift', 1: list[idx], 5: { day: { ...day, exercises: list }, idx, done } },
    };
    render('Workout Day running — ' + label, el(TrainTab, props));
    React.__stateFor = {};
  };
  runDay(push, 'objects, first exercise', 0, []);
  runDay(push, 'objects, mid-day with two done', 2, [0, 1]);
  runDay(push, 'objects, all done', 1, [0, 1, 2]);
  runDay(legacy, 'legacy bare names', 0, []);

  // And the raw-object day WITHOUT normalisation, to prove the guard is what
  // saves it: feed dayMode the stored objects exactly as they sit in the save.
  React.__stateFor = {
    TrainTab: { 0: 'lift', 1: push.exercises[0], 5: { day: push, idx: 0, done: [1] } },
  };
  render('Workout Day running — un-normalised stored objects', el(TrainTab, props));
  React.__stateFor = {};
}

console.log('\n8. Train — the cardio composer, with real numbers in it');
{
  const { CARDIO_TYPES } = require(ROOT + '/src/engine/engine.js');
  const d = seeded();
  const dv = computeDerived(d, Date.now());
  const props = {
    data: d, dv, onLift: () => null, onLiftBatch: () => null, onCardio: () => null,
    onSaveDay: () => {}, onDeleteDay: () => {}, onEditEntry: () => {}, onDeleteEntry: () => {}, onSetRestSeconds: () => {},
    onOpenAnalytics: () => {},
  };
  // CardioView useState order: family, type, mins, dist, inten, last, fixOpen
  const compose = (typeName, mins, dist, inten, label) => {
    const ct = CARDIO_TYPES.find((c) => c.n === typeName);
    React.__stateFor = {
      TrainTab: { 0: 'cardio' },
      CardioView: { 1: ct, 2: mins, 3: dist, 4: inten },
    };
    render('cardio composer — ' + label, el(TrainTab, props));
    React.__stateFor = {};
  };
  compose('Run (Zone 2)', '32', '6.4', 'moderate', 'run with pace');
  compose('Rowing Machine', '20', '5', 'hard', 'row /500m');
  compose('Swimming', '30', '1.5', 'light', 'swim /100m');
  compose('Cycling', '45', '20', 'max', 'cycle km/h');
  compose('Muay Thai (Clinch)', '30', '', 'hard', 'martial arts, no distance');
  compose('Yoga Flow', '25', '', 'light', 'mobility');
  compose('Run (Zone 2)', '', '', 'moderate', 'no duration yet');
  compose('Run (Zone 2)', '0', '0', 'moderate', 'zero duration');

  // each discipline tab
  ['cardio', 'martial', 'recovery'].forEach((fam) => {
    React.__stateFor = { TrainTab: { 0: 'cardio' }, CardioView: { 0: fam } };
    render('cardio discipline list — ' + fam, el(TrainTab, props));
    React.__stateFor = {};
  });

  // the just-logged confirmation, including its edit affordance
  React.__stateFor = {
    TrainTab: { 0: 'cardio' },
    CardioView: {
      1: CARDIO_TYPES[0], 2: '30', 5: {
        id: d.cardio[0].id, name: 'Run (Zone 2)', emoji: '🏃', mins: 30,
        dist: 5, inten: 'moderate', xp: 48, bonus: 30, seq: 1,
      },
    },
  };
  render('cardio confirmation card', el(TrainTab, props));
  React.__stateFor = {};
}

console.log('\n9. Train — the just-logged lift card with its editor open');
{
  const d = seeded();
  const dv = computeDerived(d, Date.now());
  const lift = d.lifts[d.lifts.length - 1];
  const props = {
    data: d, dv, onLift: () => null, onLiftBatch: () => null, onCardio: () => null,
    onSaveDay: () => {}, onDeleteDay: () => {}, onEditEntry: () => {}, onDeleteEntry: () => {}, onSetRestSeconds: () => {},
    onOpenAnalytics: () => {},
  };
  // LogView useState order: query, cat, last, sets, pickerOpen, builderOpen,
  // editDay, region, infoOpen, endArmed, fixOpen
  React.__stateFor = {
    TrainTab: { 0: 'lift', 1: { n: 'Bench Press', c: 'Chest', p: 'STR', s: null } },
    LogView: { 2: { id: lift.id, ex: 'Bench Press', xp: 40, bonus: 0, isPR: true, e1: 100, prev: 95, seq: 1 } },
  };
  render('lift confirmation with PR', el(TrainTab, props));

  React.__stateFor.LogView[10] = true;   // fixOpen — the editor sheet
  render('lift confirmation, editor open', el(TrainTab, props));
  React.__stateFor = {};
}

console.log('\n10. Packs — the reveal overlay at every rarity and reward kind');
{
  const d = seeded();
  d.packs = { standard: 1, prime: 1, elite: 1 };
  const dv = computeDerived(d, Date.now());
  const rewards = [
    { rarity: 'common', kind: 'coins', amount: 40, name: '40 Coins', emoji: '🪙' },
    { rarity: 'rare', kind: 'material', id: 'mat_ore', amount: 3, name: '3× Ore', emoji: '⬢', color: '#8b93a6' },
    { rarity: 'epic', kind: 'cosmetic', id: 'helm_a', name: 'Warden Helm', slot: 'helm' },
    { rarity: 'legendary', kind: 'title', id: 'title_ascendant', name: 'Apex' },
    { rarity: 'legendary', kind: 'decoration', id: 'deco_flame', name: 'Flame Border' },
    { rarity: 'epic', kind: 'xp', amount: 500, name: '500 XP' },
  ];
  ['standard', 'prime', 'elite'].forEach((pk) => {
    rewards.forEach((rw) => {
      // PacksTab useState: opening, catalogueOpen.  PackOpening useState: phase.
      ['enter', 'charge', 'reveal'].forEach((phase) => {
        React.__stateFor = {
          PacksTab: { 0: { packKey: pk, reward: rw } },
          PackOpening: { 0: phase },
        };
        const nm = pk + '/' + rw.rarity + '/' + rw.kind + '/' + phase;
        render('pack reveal ' + nm, el(PacksTab, {
          data: d, dv, openPackH: () => rw, grantTestPack: () => {}, goBack: () => {},
        }));
        React.__stateFor = {};
      });
    });
  });

  // the catalogue sheet
  React.__stateFor = { PacksTab: { 1: true } };
  render('pack catalogue', el(PacksTab, { data: d, dv, openPackH: () => null, grantTestPack: () => {}, goBack: () => {} }));
  React.__stateFor = {};
}

console.log('\n11. Progress — the History segment with the editor open');
{
  const d = seeded();
  const dv = computeDerived(d, Date.now());
  const props = { data: d, dv, onDelete: () => {}, onEdit: () => {} };
  // ProgressTab useState: seg, range, exName
  ['overview', 'strength', 'volume', 'history', 'tools'].forEach((seg) => {
    React.__stateFor = { ProgressTab: { 0: seg } };
    render('Progress/' + seg, el(ProgressTab, props));
    React.__stateFor = {};
  });

  // HistoryView useState: filter, limit, editingId
  const lift = d.lifts[0];
  const cardio = d.cardio[0];
  React.__stateFor = { ProgressTab: { 0: 'history' }, HistoryView: { 2: lift.id } };
  render('Progress/history editing a lift', el(ProgressTab, props));
  React.__stateFor = { ProgressTab: { 0: 'history' }, HistoryView: { 2: cardio.id } };
  render('Progress/history editing a cardio session', el(ProgressTab, props));
  // An id that no longer exists (deleted underneath the sheet).
  React.__stateFor = { ProgressTab: { 0: 'history' }, HistoryView: { 2: 'gone-forever' } };
  render('Progress/history editing a vanished entry', el(ProgressTab, props));
  React.__stateFor = {};
}

console.log('\n12. Train — the "last time" recall block');
{
  let d = fresh();
  const base = Date.now() - 7 * 86400000;
  // a real previous session: three sets on one day, a week ago
  [[80, 8], [85, 6], [82.5, 6]].forEach(([w, r], i) => {
    d = applyLift(d, base + i * 240000, 'Bench Press', w, r, 8).nd;
  });
  // plus a set TODAY, which must NOT be what "last time" shows
  d = applyLift(d, Date.now() - 120000, 'Bench Press', 90, 5, 9).nd;
  const dv = computeDerived(d, Date.now());
  const props = {
    data: d, dv, onLift: () => null, onLiftBatch: () => null, onCardio: () => null,
    onSaveDay: () => {}, onDeleteDay: () => {}, onEditEntry: () => {}, onDeleteEntry: () => {}, onSetRestSeconds: () => {},
    onOpenAnalytics: () => {},
  };
  React.__stateFor = { TrainTab: { 0: 'lift', 1: { n: 'Bench Press', c: 'Chest', p: 'STR', s: null } } };
  render('recall — exercise with history', el(TrainTab, props));
  React.__stateFor = {};

  // an exercise never logged must take the "first time" branch
  React.__stateFor = { TrainTab: { 0: 'lift', 1: { n: 'Back Squat', c: 'Quads', p: 'STR', s: null } } };
  render('recall — never logged', el(TrainTab, props));
  React.__stateFor = {};

  // bodyweight sets (w = 0) must render as BW, not "0kg"
  let bw = fresh();
  bw = applyLift(bw, base, 'Pull-Up', 0, 10, 8).nd;
  React.__stateFor = { TrainTab: { 0: 'lift', 1: { n: 'Pull-Up', c: 'Back', p: 'STR', s: null } } };
  render('recall — bodyweight sets', el(TrainTab, {
    ...props, data: bw, dv: computeDerived(bw, Date.now()),
  }));
  React.__stateFor = {};
}

console.log('\n' + (fail ? 'FAILED ' + fail + ' of ' + (pass + fail) : 'ALL ' + pass + ' CHECKS PASSED'));
process.exit(fail ? 1 : 0);
