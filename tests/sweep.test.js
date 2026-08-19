/* Whole-app render sweep.
 * Reuses the micro-renderer from render.test.js, but points it at EVERY screen
 * in both an empty/loading state and a populated one, and adds the second React
 * Native hard-crash to the assertions: a bare string sitting outside a <Text>. */
const ROOT = require('path').resolve(__dirname, '..');
const fs = require('fs');
const Module = require('module');
const babel = require(ROOT + '/node_modules/@babel/core');

const jsLoader = Module._extensions['.js'];
Module._extensions['.js'] = function (m, filename) {
  if (filename.indexOf('/node_modules/') !== -1) return jsLoader(m, filename);
  const out = babel.transformSync(fs.readFileSync(filename, 'utf8'), {
    filename, presets: [[ROOT + '/node_modules/babel-preset-expo', { jsxRuntime: 'classic' }]],
    babelrc: false, configFile: false,
  });
  return m._compile(out.code, filename);
};

global.__DEV__ = false;
const TEXT = 'Text';
const React = {
  createElement: (type, props, ...children) => ({
    __el: true, type,
    props: { ...(props || {}), children: children.length <= 1 ? children[0] : children },
  }),
  Fragment: 'Fragment', memo: (f) => f, forwardRef: (f) => f,
  Children: { toArray: (c) => (Array.isArray(c) ? c.flat(9).filter((x) => x != null && x !== false) : c == null ? [] : [c]) },
  useState: (init) => {
    const i = React.__hookIndex++;
    const ov = React.__overrides;
    const has = ov && Object.prototype.hasOwnProperty.call(ov, i);
    return [has ? ov[i] : (typeof init === 'function' ? init() : init), () => {}];
  },
  useRef: (v) => ({ current: v }),
  useMemo: (f) => f(), useCallback: (f) => f,
  useEffect: () => {}, useLayoutEffect: () => {}, useContext: () => ({}),
  useReducer: (r, i) => [i, () => {}],
  __hookIndex: 0, __overrides: null, __stateFor: {},
};
React.default = React;
const comp = (n) => n;
const AV = function (v) { this._v = v; };
AV.prototype.interpolate = function () { return new AV(0); };
AV.prototype.setValue = function () {}; AV.prototype.addListener = () => 1;
AV.prototype.removeListener = function () {}; AV.prototype.stopAnimation = function () {};
const anim = () => ({ start: (cb) => cb && cb({ finished: true }), stop: () => {}, reset: () => {} });
const Animated = {
  Value: AV, View: comp('Animated.View'), Text: comp(TEXT), ScrollView: comp('ScrollView'),
  Image: comp('Image'), FlatList: comp('FlatList'),
  timing: anim, spring: anim, decay: anim, loop: anim, sequence: anim, parallel: anim,
  stagger: anim, delay: anim, multiply: () => new AV(1), add: () => new AV(1),
  createAnimatedComponent: (c) => c, event: () => () => {},
};
const RN = {
  View: comp('View'), Text: comp(TEXT), Pressable: comp('Pressable'),
  TouchableOpacity: comp('Pressable'), TouchableWithoutFeedback: comp('Pressable'),
  TextInput: comp('TextInput'), ScrollView: comp('ScrollView'), FlatList: comp('FlatList'),
  SectionList: comp('SectionList'), Image: comp('Image'), Modal: comp('Modal'),
  SafeAreaView: comp('View'), KeyboardAvoidingView: comp('View'), RefreshControl: comp('RefreshControl'),
  ActivityIndicator: comp('ActivityIndicator'), Switch: comp('Switch'), Share: { share: () => {} },
  StyleSheet: { create: (o) => o, hairlineWidth: 0.5, absoluteFill: {}, absoluteFillObject: {}, flatten: (o) => o },
  Platform: { OS: 'ios', select: (o) => (o.ios !== undefined ? o.ios : o.default), Version: 17 },
  Dimensions: { get: () => ({ width: 393, height: 852 }) },
  useWindowDimensions: () => ({ width: 393, height: 852, scale: 3, fontScale: 1 }),
  Animated, Easing: new Proxy({}, { get: () => (x) => x }),
  AccessibilityInfo: { isReduceMotionEnabled: () => Promise.resolve(false), addEventListener: () => ({ remove() {} }) },
  AppState: { addEventListener: () => ({ remove() {} }), currentState: 'active' },
  Alert: { alert: () => {} }, Linking: { openURL: () => Promise.resolve(), openSettings: () => {}, addEventListener: () => ({ remove() {} }) },
  InteractionManager: { runAfterInteractions: (f) => f && f() },
  LayoutAnimation: { configureNext: () => {}, create: () => ({}), Presets: { easeInEaseOut: {} }, Types: {}, Properties: {} },
  UIManager: { setLayoutAnimationEnabledExperimental: () => {} },
  NativeModules: {}, PixelRatio: { get: () => 3, roundToNearestPixel: (n) => n },
  Keyboard: { dismiss: () => {}, addListener: () => ({ remove() {} }) },
  PanResponder: { create: () => ({ panHandlers: {} }) },
};
RN.default = RN;
const svgProxy = new Proxy({ default: comp('Svg'), __esModule: true }, { get: (t, k) => (k in t ? t[k] : comp('Svg.' + String(k))) });
const STUBS = {
  react: React, 'react-native': RN, 'react-native-svg': svgProxy,
  'expo-linear-gradient': { LinearGradient: comp('LinearGradient'), default: comp('LinearGradient') },
  'expo-haptics': { notificationAsync: () => {}, impactAsync: () => {}, selectionAsync: () => {},
    NotificationFeedbackType: { Success: 1, Warning: 2, Error: 3 }, ImpactFeedbackStyle: { Light: 1, Medium: 2, Heavy: 3 } },
  'expo-blur': { BlurView: comp('BlurView') },
  'expo-image': { Image: comp('Image') },
  'expo-symbols': { SymbolView: comp('SymbolView') },
  'expo-camera': { CameraView: comp('CameraView'), useCameraPermissions: () => [{ granted: true }, () => {}] },
  'expo-clipboard': { setStringAsync: () => {}, getStringAsync: () => Promise.resolve('') },
  'expo-image-manipulator': { manipulateAsync: () => {}, SaveFormat: { JPEG: 'jpeg' } },
  'expo-apple-authentication': { AppleAuthenticationButton: comp('AppleBtn'), AppleAuthenticationButtonType: {}, AppleAuthenticationButtonStyle: {}, isAvailableAsync: () => Promise.resolve(false) },
  '@react-native-async-storage/async-storage': { __esModule: true, default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve(), removeItem: () => Promise.resolve(), multiGet: () => Promise.resolve([]) } },
  'expo-crypto': { digestStringAsync: () => Promise.resolve('x'), CryptoDigestAlgorithm: { SHA256: 'sha256' }, randomUUID: () => 'uuid' },
  'expo-constants': { __esModule: true, default: { expoConfig: { extra: { supabaseUrl: 'https://stub.supabase.co', supabaseAnonKey: 'stub-anon-key', eas: { projectId: 'p' } } }, easConfig: null } },
  'expo-device': { isDevice: true, modelName: 'iPhone' },
  'expo-file-system': { documentDirectory: '/tmp/', getInfoAsync: () => Promise.resolve({ exists: false }), makeDirectoryAsync: () => Promise.resolve(), copyAsync: () => Promise.resolve(), deleteAsync: () => Promise.resolve(), readAsStringAsync: () => Promise.resolve(''), writeAsStringAsync: () => Promise.resolve(), File: class {}, Directory: class {}, Paths: { document: '/tmp/' } },
  'expo-localization': { getCalendars: () => [{ timeZone: 'Europe/London' }], getLocales: () => [{ languageTag: 'en-GB' }] },
  'expo-notifications': { setNotificationHandler: () => {}, getPermissionsAsync: () => Promise.resolve({ status: 'granted', canAskAgain: true }), requestPermissionsAsync: () => Promise.resolve({ status: 'granted' }), getExpoPushTokenAsync: () => Promise.resolve({ data: 't' }), scheduleNotificationAsync: () => Promise.resolve('id'), cancelScheduledNotificationAsync: () => Promise.resolve(), getAllScheduledNotificationsAsync: () => Promise.resolve([]), addNotificationResponseReceivedListener: () => ({ remove() {} }), addNotificationReceivedListener: () => ({ remove() {} }), setBadgeCountAsync: () => Promise.resolve(), SchedulableTriggerInputTypes: { DATE: 'date' } },
  '@supabase/supabase-js': { createClient: () => ({ auth: { getSession: () => Promise.resolve({ data: { session: null } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }), signOut: () => Promise.resolve({}) }, from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null }) }), order: () => ({ limit: () => Promise.resolve({ data: [] }) }), in: () => ({ order: () => ({ limit: () => Promise.resolve({ data: [] }) }) }) }), insert: () => Promise.resolve({}), upsert: () => Promise.resolve({}) }), channel: () => ({ on: function () { return this; }, subscribe: function () { return this; }, unsubscribe() {} }), removeChannel: () => {} }) },
  'react-native-url-polyfill/auto': {},
  'react-native-safe-area-context': { SafeAreaView: comp('View'), useSafeAreaInsets: () => ({ top: 59, bottom: 34, left: 0, right: 0 }), SafeAreaProvider: comp('View') },
};
const origRequire = Module.prototype.require;
Module.prototype.require = function (id) { return STUBS[id] || origRequire.apply(this, arguments); };

let pass = 0; const fails = [];
const ok = (name, cond, extra) => {
  if (cond) { pass++; } else { fails.push(name + (extra ? '  →  ' + extra : '')); }
};

const HOSTS_NO_TEXT = { View: 1, Pressable: 1, ScrollView: 1, 'Animated.View': 1, Modal: 1, LinearGradient: 1 };
function analyse(node, out, depth) {
  if (depth > 70 || node == null || node === false || node === true) return;
  if (Array.isArray(node)) { node.forEach((n) => analyse(n, out, depth + 1)); return; }
  if (typeof node !== 'object' || !node.__el) return;

  // An undefined element type is React's "Element type is invalid ... got:
  // undefined" — a deleted or mis-imported component. The walker used to step
  // straight past it, which is how a component removed by a bad refactor
  // reached the simulator with every check still green.
  if (node.type == null || (typeof node.type !== 'string' && typeof node.type !== 'function')) {
    out.badType.push('renders <' + String(node.type) + '> (undefined component)');
    return;
  }

  if (node.type === TEXT) {
    const scan = (c) => {
      if (c == null || c === false || c === true) return;
      if (Array.isArray(c)) return c.forEach(scan);
      const t = typeof c;
      if (t === 'string' || t === 'number') return;
      if (t === 'object' && c.__el) {
        if (c.type === TEXT || typeof c.type === 'function') return scan(c.props && c.props.children);
        out.badInText.push('<Text> holds <' + String(c.type) + '>');
        return;
      }
      out.badInText.push('<Text> holds ' + t);
    };
    scan(node.props.children);
  }
  // A bare string inside a View is the other RN hard crash.
  if (HOSTS_NO_TEXT[node.type]) {
    const kids = node.props && node.props.children;
    const scan = (c) => {
      if (Array.isArray(c)) return c.forEach(scan);
      if (typeof c === 'string' && c.trim() !== '') out.strayText.push('<' + node.type + '> holds bare string "' + c.slice(0, 30) + '"');
      if (typeof c === 'number') out.strayText.push('<' + node.type + '> holds bare number ' + c);
    };
    scan(kids);
  }
  if (typeof node.type === 'function') {
    const nm = node.type.name || '';
    React.__overrides = React.__stateFor[nm] || null;
    React.__hookIndex = 0;
    let r;
    try { r = node.type(node.props); }
    catch (e) { throw new Error((nm || 'anon') + ': ' + e.message); }
    return analyse(r, out, depth + 1);
  }
  analyse(node.props && node.props.children, out, depth + 1);
}

function check(name, node) {
  const out = { badInText: [], strayText: [], badType: [] };
  try { analyse(node, out, 0); }
  catch (e) { ok(name, false, 'THREW — ' + e.message); return; }
  ok(name + ' [renders]', true);
  ok(name + ' [no undefined component]', out.badType.length === 0, out.badType.slice(0, 2).join('; '));
  ok(name + ' [no object in <Text>]', out.badInText.length === 0, out.badInText.slice(0, 2).join('; '));
  ok(name + ' [no bare string outside <Text>]', out.strayText.length === 0, out.strayText.slice(0, 2).join('; '));
}

const E = require(ROOT + '/src/engine/engine.js');
const el = (C, p) => React.createElement(C, p);
const fresh = () => JSON.parse(JSON.stringify(E.DEFAULT_DATA));
function seeded() {
  let d = fresh();
  const b = Date.now() - 6 * 86400000;
  for (let i = 0; i < 6; i++) d = E.applyLift(d, b + i * 3700000, 'Bench Press', 60 + i * 5, 8, 8).nd;
  d = E.applyCardio(d, b + 2e7, 'Run (Zone 2)', 32, 6.4, 'moderate').nd;
  d = E.applyCardio(d, Date.now() - 3.6e6, 'Yoga Flow', 20, 0, 'light').nd;
  d.packs = { standard: 2, prime: 1, elite: 1 };
  d.workoutDays = [{ id: 'w1', name: 'Push', exercises: [{ n: 'Bench Press', c: 'Chest', p: 'STR', s: null }] }];
  d.duels = [];
  return d;
}
const fn = () => {};
const afn = () => Promise.resolve({});

const emptyFeed = { items: [], photos: {}, loading: false, refreshing: false, loadingMore: false, exhausted: true, error: null, refresh: fn, loadMore: fn, react: fn, remove: fn, upsert: fn };
const loadingFeed = { ...emptyFeed, loading: true, exhausted: false };
const checkInStub = { today: null, hasCheckedIn: false, verified: false, localDate: '2026-08-18', todayKey: 'k', loading: false, posting: false, pending: null, stats: {}, reload: fn, post: afn, retry: fn };
const friendsStub = { friends: [], requests: [], feed: [], loading: false, error: null, available: true, refresh: fn, search: afn, add: afn, accept: afn, decline: afn, unfriend: afn, viewProfile: afn };
const duelsStub = { incoming: [], active: null, past: [], loading: false, live: false, error: null, wins: 0, losses: 0, refresh: fn, accept: afn, decline: afn, quit: afn, inDuel: false, busy: false };
const healthStub = { available: false, optedIn: false, connected: false, loading: false, today: null, rows: [], refresh: fn, connect: afn, decline: fn, saveWorkout: afn };
const lbStub = { scope: 'global', setScope: fn, metric: 'fr', setMetric: fn, rows: [], loading: false, meId: null, reload: fn };
const notifStub = { items: [], unread: 0, loading: false, error: null, live: false, refresh: fn, markOneRead: fn, markAllRead: fn };
const prefsStub = { enabled: true, notify_check_in: true, window_start_minute: 1020, window_end_minute: 1200, timezone: 'Europe/London', default_visibility: 'friends', public_discovery: true };

const S = (p) => require(ROOT + '/src/screens/' + p);
const Cm = (p) => require(ROOT + '/src/components/' + p);

[['empty', fresh()], ['seeded', seeded()]].forEach(([tag, d]) => {
  const dv = E.computeDerived(d, Date.now());
  const g = { data: d, dv };
  check('TrainTab/' + tag, el(S('TrainTab.js').default, { ...g, onLift: fn, onLiftBatch: fn, onCardio: fn, onSaveDay: fn, onDeleteDay: fn, onEditEntry: fn, onDeleteEntry: fn, onSetRestSeconds: fn, onOpenAnalytics: fn }));
  check('ProgressTab/' + tag, el(S('ProgressTab.js').default, { ...g, onDelete: fn, onEdit: fn }));
  check('PacksTab/' + tag, el(S('PacksTab.js').default, { ...g, openPackH: fn, grantTestPack: fn, goBack: fn }));
  check('ShopTab/' + tag, el(S('ShopTab.js').default, { ...g, buy: fn, equip: fn, forge: fn, claimTier: fn, claimAll: fn, buyPremium: fn, goPacks: fn }));
  check('HunterTab/' + tag, el(S('HunterTab.js').default, { ...g, setAvatar: fn, equipTitle: fn, equipDecoration: fn, goForge: fn, goAnalytics: fn, goArchive: fn, health: healthStub, socialStats: { checkIns: 0, streak: 0 } }));
  check('DuelTab/' + tag, el(S('DuelTab.js').default, { ...g, startDuel: fn, claimDuel: fn, forfeitDuel: fn, friendDuels: duelsStub, onCreateInvite: fn, onJoinByCode: fn }));
  check('CompeteTab/' + tag, el(S('CompeteTab.js').default, { ...g, view: 'duels', setView: fn, userEmail: 'a@b.c', leaderboard: lbStub, friends: friendsStub, friendDuels: duelsStub, startDuel: fn, claimDuel: fn, forfeitDuel: fn, onChallengeFriend: fn, onCreateInvite: fn, onJoinByCode: fn }));
  check('RanksTab/' + tag, el(S('RanksTab.js').default, { ...g, lb: lbStub, userEmail: 'a@b.c' }));
  check('SocialTab/' + tag, el(S('SocialTab.js').default, { user: 'a@b.c', me: 'u1', feed: tag === 'empty' ? loadingFeed : emptyFeed, scope: 'friends', setScope: fn, checkIn: checkInStub, prefsWindowText: 'Evening · 5 – 8 PM', publicDiscovery: true, unit: 'kg', sessionsToday: [], onOpenCamera: fn, onOpenFriends: fn, onOpenActivity: fn, onOpenProfile: fn, onAttachWorkout: fn, onSignIn: fn, onOpenIntro: fn, unreadCount: 0, pendingRequests: 0 }));
  // SettingsScreen useState order ends: ..., confirmReset, deleteOpen, deleteWord, deleting, deleteErr
  check('SettingsScreen/' + tag, el(S('SettingsScreen.js').default, { ...g, userEmail: 'a@b.c', profile: null, prefs: tag === 'empty' ? null : prefsStub, prefsLoading: tag === 'empty', updatePrefs: fn, enableReminders: afn, notifPermission: 'granted', health: healthStub, rename: fn, setUnit: fn, saveProfile: fn, makeCode: fn, importCode: fn, resetAll: fn, loadDemo: fn, signOut: fn, onClose: fn }));
});

const d = seeded(); const dv = E.computeDerived(d, Date.now());
check('LiveLeaderboard', el(S('LiveLeaderboard.js').default, { lb: lbStub }));
check('FriendsScreen', el(S('FriendsScreen.js').default, { fr: friendsStub, duels: duelsStub, onChallenge: fn, onOpenDuel: fn, initialUserId: null, onOpenArchive: fn }));
check('Intro', el(S('Intro.js').default, { onDone: fn }));
check('BootScreen', el(S('BootScreen.js').default, { duration: 2500 }));
check('SocialIntro', el(S('SocialIntro.js').default, { onDone: fn, onSetWindow: fn, initialWindow: prefsStub }));
check('BugReportModal', el(S('BugReportModal.js').default, { visible: true, onClose: fn }));
check('SetNewPasswordScreen', el(S('SetNewPasswordScreen.js').default, { onDone: fn, onCancel: fn }));
check('AuthScreen', el(S('AuthScreens.js').AuthScreen, { onAuthed: fn, loadAuth: afn, saveAuth: fn, sha256Hex: afn, makeSalt: () => 'x' }));
check('PhysicalProfileForm', el(S('AuthScreens.js').PhysicalProfileForm, { data: d, onSave: fn, onCancel: fn, embedded: false }));
check('CheckInDetailScreen', el(S('CheckInDetailScreen.js').default, { checkInId: 'c1', focusComments: false, me: 'u1', unit: 'kg', onClose: fn, onOpenProfile: fn }));
check('CheckInArchiveScreen', el(S('CheckInArchiveScreen.js').default, { userId: 'u1', isMe: true, onClose: fn, onOpenCheckIn: fn }));

check('ActiveWorkoutBar', el(Cm('ActiveWorkoutBar.js').default, { onFinished: fn }));
check('AppGuide', el(Cm('AppGuide.js').default, { visible: true, onClose: fn }));
check('NotificationCenter', el(Cm('NotificationCenter.js').default, { visible: true, center: notifStub, onClose: fn, onOpen: fn }));
check('StandingPanel', el(Cm('StandingPanel.js').default, { dv, rank: 3, fieldSize: 40, detail: true, onToggleDetail: fn }));
check('NoticeBanner', el(Cm('NoticeBanner.js').default, { notice: { kind: 'bell', title: 'Hi', body: 'there' }, onPress: fn, onDismiss: fn }));
check('FeedSkeleton', el(Cm('social/FeedSkeleton.js').default, { count: 2 }));
check('ReactionBar', el(Cm('social/ReactionBar.js').default, { reactionTypes: [], myReaction: null, commentCount: 0, onReact: fn, onComments: fn }));
check('CommentSheet', el(Cm('social/CommentSheet.js').default, { visible: true, onClose: fn, comments: [], loading: false, sending: false, me: 'u1', postOwnerId: 'u1', onAdd: fn, onDelete: fn, onReport: fn }));
check('WorkoutAttachment/present', el(Cm('social/WorkoutAttachment.js').default, { workout: { sets: 5, volumeKg: 2000, cardioMinutes: 0, exercises: ['Bench Press'] }, title: 'Push', unit: 'kg' }));
check('WorkoutAttachment/absent', el(Cm('social/WorkoutAttachment.js').default, { workout: null, title: null, unit: 'kg' }));

/* FriendsScreen with every list POPULATED. The signed-out state is all a guest
 * can reach on a device, but the accessibility labels being added here are built
 * from nameOf()/ago()/isOnline() on real rows — so the populated paths are where
 * a bad label expression would actually throw. */
{
  const prof = (id, name, user) => ({
    id, display_name: name, username: user, level: 12, rank: 'Gold II',
    streak: 5, weekly_xp: 1200, last_active: new Date(Date.now() - 60000).toISOString(),
    avatar: {}, character: {},
  });
  const a = prof('u2', 'Sam Rivera', 'sam');
  const b = prof('u3', null, 'nameless');          // display_name missing
  const c = { id: 'u4' };                           // no name at all
  const fullFriends = {
    ...friendsStub,
    friends: [a, b, c],
    requests: [
      { senderId: 'u5', profile: prof('u5', 'Alex Kim', 'alex') },
      { senderId: 'u6', profile: null },            // request with no profile
    ],
    feed: [{ id: 'f1', actor: a, kind: 'lift', t: Date.now() }],
  };
  const fullDuels = {
    ...duelsStub,
    incoming: [
      { id: 'd1', opponent: a, reward: 150 },
      { id: 'd2', opponent: c, reward: 90 },
    ],
    active: [{ id: 'd0', opponent: a, myScore: 320, theirScore: 280 }],
    past: [{ id: 'd9', opponent: a, result: 'win', myScore: 500, theirScore: 400 }],
  };
  check('FriendsScreen/populated', el(S('FriendsScreen.js').default, {
    fr: fullFriends, duels: fullDuels, onChallenge: fn, onOpenDuel: fn,
    initialUserId: null, onOpenArchive: fn,
  }));
  check('FriendsScreen/busy duels', el(S('FriendsScreen.js').default, {
    fr: fullFriends, duels: { ...fullDuels, busy: true }, onChallenge: fn,
    onOpenDuel: fn, initialUserId: null, onOpenArchive: fn,
  }));
  check('FriendsScreen/errors', el(S('FriendsScreen.js').default, {
    fr: { ...fullFriends, error: 'network down' },
    duels: { ...fullDuels, error: 'duel sync failed' },
    onChallenge: fn, onOpenDuel: fn, initialUserId: null, onOpenArchive: fn,
  }));
  check('FriendsScreen/no challenge handler', el(S('FriendsScreen.js').default, {
    fr: fullFriends, duels: fullDuels, onChallenge: null, onOpenDuel: fn,
    initialUserId: null, onOpenArchive: fn,
  }));
  /* A request whose answer is in flight: the Accept button reads "Adding…" and
     is disabled, so a second tap cannot fire the RPC again. Both branches of
     isPending are exercised here — u5 answering, u6 idle. */
  check('FriendsScreen/answering a request', el(S('FriendsScreen.js').default, {
    fr: { ...fullFriends, isPending: (id) => id === 'u5' },
    duels: fullDuels, onChallenge: fn, onOpenDuel: fn,
    initialUserId: null, onOpenArchive: fn,
  }));
  /* And the case that broke the sweep when this feature landed: a caller that
     never supplies isPending at all must still render, not blank the screen. */
  check('FriendsScreen/no isPending supplied', el(S('FriendsScreen.js').default, {
    fr: { ...fullFriends, isPending: undefined },
    duels: fullDuels, onChallenge: fn, onOpenDuel: fn,
    initialUserId: null, onOpenArchive: fn,
  }));
}

{
  const d = seeded(); const dv = E.computeDerived(d, Date.now());
  const base = {
    data: d, dv, userEmail: 'a@b.c', profile: null, prefs: prefsStub, prefsLoading: false,
    updatePrefs: fn, enableReminders: afn, notifPermission: 'granted', health: healthStub,
    rename: fn, setUnit: fn, saveProfile: fn, makeCode: fn, importCode: fn,
    resetAll: fn, loadDemo: fn, signOut: fn, onClose: fn,
  };
  // find the deleteOpen index by name so this does not silently stop testing
  // anything if the state order changes
  const src = require('fs').readFileSync(ROOT + '/src/screens/SettingsScreen.js', 'utf8');
  const order = [...src.matchAll(/const \[(\w+),/g)].map((m) => m[1]);
  const iOpen = order.indexOf('deleteOpen');
  const iWord = order.indexOf('deleteWord');
  if (iOpen < 0 || iWord < 0) throw new Error('delete sheet state not found in SettingsScreen');

  check('Settings/delete sheet closed', el(S('SettingsScreen.js').default, base));
  React.__stateFor = { SettingsScreen: { [iOpen]: true } };
  check('Settings/delete sheet open', el(S('SettingsScreen.js').default, base));
  React.__stateFor = { SettingsScreen: { [iOpen]: true, [iWord]: 'DELETE' } };
  check('Settings/delete sheet armed', el(S('SettingsScreen.js').default, base));
  React.__stateFor = {};
  // a guest has no server account, so the control must not be offered
  check('Settings/guest has no delete control', el(S('SettingsScreen.js').default, { ...base, userEmail: null }));
}

{
  // sign-up must render the consent row, and it starts UNTICKED
  const src = require('fs').readFileSync(ROOT + '/src/screens/AuthScreens.js', 'utf8');
  if (!/const \[agreed, setAgreed\] = useState\(false\)/.test(src)) {
    throw new Error('consent checkbox must default to false');
  }
  const order = [...src.slice(src.indexOf('export function AuthScreen')).matchAll(/const \[(\w+),/g)].map((m) => m[1]);
  const iMode = order.indexOf('mode');
  const iAgreed = order.indexOf('agreed');
  if (iAgreed < 0) throw new Error('agreed state not found');
  const authProps = { onAuthed: fn, loadAuth: afn, saveAuth: fn, sha256Hex: afn, makeSalt: () => 'x' };
  if (iMode >= 0) {
    React.__stateFor = { AuthScreen: { [iMode]: 'signup' } };
    check('AuthScreen/signup consent unticked', el(S('AuthScreens.js').AuthScreen, authProps));
    React.__stateFor = { AuthScreen: { [iMode]: 'signup', [iAgreed]: true } };
    check('AuthScreen/signup consent ticked', el(S('AuthScreens.js').AuthScreen, authProps));
    React.__stateFor = {};
  }
}

{
  const d = seeded(); const dv = E.computeDerived(d, Date.now());
  check('PacksTab/disabled', el(S('PacksTab.js').default, { data: d, dv, openPackH: fn, grantTestPack: fn, goBack: fn, enabled: false }));
  check('DuelTab/disabled', el(S('DuelTab.js').default, { data: d, dv, startDuel: fn, claimDuel: fn, forfeitDuel: fn, friendDuels: duelsStub, onCreateInvite: fn, onJoinByCode: fn, enabled: false }));
  check('SocialTab/disabled', el(S('SocialTab.js').default, {
    user: 'a@b.c', me: 'u1', feed: emptyFeed, scope: 'friends', setScope: fn, checkIn: checkInStub,
    prefsWindowText: null, publicDiscovery: true, unit: 'kg', sessionsToday: [], onOpenCamera: fn,
    onOpenFriends: fn, onOpenActivity: fn, onOpenProfile: fn, onAttachWorkout: fn, onSignIn: fn,
    onOpenIntro: fn, unreadCount: 0, pendingRequests: 0, enabled: false,
  }));
}

console.log('PASSED ' + pass + ', FAILED ' + fails.length);
fails.forEach((f) => console.log('  FAIL  ' + f));
process.exit(fails.length ? 1 : 0);
