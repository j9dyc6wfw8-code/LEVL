// ============================================================================
// LEVL — root
//
// BUILD 28: FIVE DESTINATIONS
//
//     TRAIN · COMPETE · SOCIAL · HUNTER · FORGE
//
// Stats and You are gone as tabs, but nothing they held was deleted:
//   • the character, rank, six stats, titles and PRs are now the HUNTER tab
//   • strength curves, volume and history are one tap from TRAIN
//   • settings, account, units and data live in the profile sheet behind the
//     avatar in the header, which is where iOS users look for them
//   • ranks and the leaderboard folded into COMPETE beside duels
//   • packs stayed inside the Forge rather than becoming a sixth tab
//
// This file used to hold the save, the sync, twenty game handlers, navigation
// AND the render tree. The data layer moved to useGameSave and navigation to
// useRouter; what remains is composition. The five tabs stay MOUNTED —
// switching to Social and back must not lose a half-entered set on Train —
// which is exactly why they render as siblings rather than through a stack.
// ============================================================================

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, Pressable, ScrollView, StatusBar, StyleSheet,
  KeyboardAvoidingView, Platform, Modal, AppState, Alert,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { C, alpha, s, T, MONO, RADIUS } from './src/theme';
import { Toasts, LevelUpOverlay, FadeIn, CountUp, LevlRing, CoinGlyph, Glass } from './src/components/ui';
import { coinBalance } from './src/engine/engine';
import { todaysSessions, primarySessionToday } from './src/engine/session';
import { stGet, stSet } from './src/services/platform';

import { AuthScreen, PhysicalProfileForm } from './src/screens/AuthScreens';
import SetNewPasswordScreen from './src/screens/SetNewPasswordScreen';
import Intro from './src/screens/Intro';
import BootScreen from './src/screens/BootScreen';

import TrainTab from './src/screens/TrainTab';
import CompeteTab from './src/screens/CompeteTab';
import SocialTab from './src/screens/SocialTab';
import HunterTab from './src/screens/HunterTab';
import ShopTab from './src/screens/ShopTab';
import PacksTab from './src/screens/PacksTab';
import ProgressTab from './src/screens/ProgressTab';
import FriendsScreen from './src/screens/FriendsScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import SocialIntro from './src/screens/SocialIntro';
import CheckInCameraScreen from './src/screens/CheckInCameraScreen';
import CheckInDetailScreen from './src/screens/CheckInDetailScreen';
import CheckInArchiveScreen from './src/screens/CheckInArchiveScreen';

import { TabIcon } from './src/components/TabIcon';
import { HunterAvatar } from './src/components/HunterAvatar';
import ActiveWorkoutBar from './src/components/ActiveWorkoutBar';
import WorkoutShareSheet from './src/components/social/WorkoutShareSheet';
import NotificationCenter, { NoticeGlyph } from './src/components/NotificationCenter';
import NoticeBanner from './src/components/NoticeBanner';

import { useGameSave, loadAuth, saveAuth } from './src/hooks/useGameSave';
import { useRouter } from './src/hooks/useRouter';
import { useCheckInPreferences, windowLabel } from './src/hooks/useCheckInPreferences';
import { useCheckIn } from './src/hooks/useCheckIn';
import { useCheckInFeed } from './src/hooks/useCheckInFeed';
import { useHealth } from './src/hooks/useHealth';
import { useFriends } from './src/hooks/useFriends';
import { useFriendDuels } from './src/hooks/useFriendDuels';
import { useLeaderboard } from './src/hooks/useLeaderboard';
import { useNotifications } from './src/hooks/useNotifications';
import { useAppConfig } from './src/hooks/useAppConfig';
import telemetry from './src/services/telemetry';

import { TABS, MODALS } from './src/navigation/routes';
import { isConfigured } from './src/services/supabase/client';
import {
  isRecoveryUrl, completeRecoveryFromUrl, currentUserId as getUid, getSession,
} from './src/services/supabase/authService';
import { challenge as challengeFriendSvc } from './src/services/supabase/duelService';
import {
  createInvite as createDuelInviteSvc,
  claimInvite as claimDuelInviteSvc,
  parseDuelCode,
} from './src/services/supabase/duelInviteService';
import { touchPresence } from './src/services/supabase/realtimeService';
import { sha256Hex } from './src/services/platform';
import { makeSalt } from './src/engine/engine';

import notifications from './src/services/notifications';
import workoutSession from './src/services/workoutSession';
import LiveActivity from './modules/levl-live-activity';
import haptics from './src/services/haptics';

const SPLASH_MS = 3500;
const INTRO_KEY = 'ascend.introSeen.v1';
const SOCIAL_INTRO_KEY = 'levl.socialIntroSeen.v1';
const GUEST_PROMPT_KEY = 'levl.guestBackupPrompt.v1';
const LAST_USER_KEY = 'ascend-last-user';

// Toast colours, resolved here so the data layer can name a tone rather than
// import the theme.
const TONE = {
  gold: C.gold, green: C.green, error: C.red, warn: C.orange,
  mut: C.mut, purp: C.purp,
};

function AppInner() {
  const insets = useSafeAreaInsets();
  const [stage, setStage] = useState('boot');        // boot | intro | auth | app
  const [toasts, setToasts] = useState([]);
  const [levelUp, setLevelUp] = useState(null);
  const [splashDone, setSplashDone] = useState(false);
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const toastId = useRef(0);
  const scrollRef = useRef(null);

  const toast = useCallback((text, tone) => {
    const id = ++toastId.current;
    setToasts((t) => [...t, { id, text, color: TONE[tone] || tone || C.gold }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2600);
  }, []);

  const game = useGameSave({ toast, onLevelUp: setLevelUp, stage });
  const { user, data, dv } = game;

  /* ------------------------------ boot ---------------------------------- */

  useEffect(() => {
    (async () => {
      // WHO IS SIGNED IN, and why this is more careful than it looks.
      //
      // Two independent records have to agree: the on-device registry
      // (auth.users) and the Supabase session. Apple Sign In used to write only
      // the second, so people were bounced to the login screen on every cold
      // start despite being perfectly authenticated. AuthScreens now writes
      // both — and the fallback below repairs anyone already in that state,
      // rather than making them sign in one last time to fix it.
      let signedInAs = null;
      try {
        const auth = await loadAuth();
        const last = auth.lastUser || (await stGet(LAST_USER_KEY));
        if (last && auth.users && auth.users[last]) signedInAs = last;

        // Registry missing but Supabase still holds a session? Trust the
        // session — it is the real credential — and rebuild the local entry.
        if (!signedInAs) {
          const { data } = await getSession();
          const email = data && data.session && data.session.user && data.session.user.email;
          if (email) {
            signedInAs = email.toLowerCase();
            const repaired = auth || { users: {}, lastUser: null };
            repaired.users = repaired.users || {};
            repaired.users[signedInAs] = {
              ...(repaired.users[signedInAs] || {}),
              email: signedInAs, name: (repaired.users[signedInAs] || {}).name || 'Player',
              cloud: true, createdAt: Date.now(),
            };
            repaired.lastUser = signedInAs;
            await saveAuth(repaired);
            await stSet(LAST_USER_KEY, signedInAs);
          }
        }
      } catch (e) { /* fall through to the sign-in screen */ }

      if (signedInAs) {
        // hydrateFor reaches the network to reconcile the cloud save. That must
        // never decide whether you are logged in: a flaky connection at launch
        // would otherwise read as "signed out" and strand you at the login
        // screen with your data sitting on the device.
        try {
          await game.hydrateFor(signedInAs, null, false);
        } catch (e) { /* keep going on whatever is stored locally */ }
        setStage('app');
        return;
      }

      try {
        const seen = await stGet(INTRO_KEY);
        setStage(seen ? 'auth' : 'intro');
      } catch (e) { setStage('auth'); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const id = setTimeout(() => setSplashDone(true), SPLASH_MS);
    return () => clearTimeout(id);
  }, []);

  // Notification presentation + an interrupted workout are both launch-time
  // concerns: restore() also clears any Live Activity a crash left running.
  useEffect(() => {
    notifications.installHandler();
    workoutSession.restore().catch(() => {});
  }, []);

  /* ------------------- local notifications with real stakes ----------------
   * Check In prompts and the rest timer already fired at OS level. The two
   * events people actually lose progress to did not: a streak about to break,
   * and a duel about to close.
   *
   * Both are LOCAL schedules, so they need no server, arrive with the app shut,
   * and ship over the air. (Genuine remote push would need a sender — the
   * expo_push_token column exists and is populated, but nothing dispatches to
   * it yet; that is an Edge Function, not a client change.)
   * --------------------------------------------------------------------- */
  const lastTrainedTs = useMemo(() => {
    let max = 0;
    for (const e of (data.lifts || [])) if ((e.t || 0) > max) max = e.t;
    for (const e of (data.cardio || [])) if ((e.t || 0) > max) max = e.t;
    return max || null;
  }, [data.lifts, data.cardio]);

  const activeDuel = useMemo(
    () => (data.duels || []).find((duel) => duel.status === 'active') || null,
    [data.duels],
  );

  useEffect(() => {
    if (stage !== 'app') return;
    notifications.scheduleStreakGuard({ streak: dv.streak, lastTrainedTs }).catch(() => {});
  }, [stage, dv.streak, lastTrainedTs]);

  useEffect(() => {
    if (stage !== 'app') return;
    if (!activeDuel) { notifications.cancelDuelEnding().catch(() => {}); return; }
    notifications.scheduleDuelEnding({
      endT: activeDuel.endT,
      opponent: activeDuel.bot && activeDuel.bot.name,
    }).catch(() => {});
  }, [stage, activeDuel]);

  /* ---------------------------- social state ----------------------------- */

  const prefsApi = useCheckInPreferences(user);
  const prefs = prefsApi.prefs;
  const checkIn = useCheckIn(user, prefs);
  /* Social opens on Friends, which for a brand new user is an empty room — and
   * an empty feed reads as a broken app, not a new one. If they have no friends
   * yet, open on Discover instead, where there is something to see. Moved once,
   * automatically, and never again after they have touched the control or added
   * anyone. */
  const [scope, setScope] = useState('friends');
  const [scopeAutoMoved, setScopeAutoMoved] = useState(false);
  useEffect(() => {
    if (scopeAutoMoved || stage !== 'app') return;
    if (!friends || friends.loading || !friends.available) return;
    setScopeAutoMoved(true);
    if ((friends.friends || []).length === 0 && prefs && prefs.public_discovery !== false) {
      setScope('public');
    }
  }, [stage, friends, prefs, scopeAutoMoved]);
  const feed = useCheckInFeed(user, scope);
  const health = useHealth(stage === 'app');

  /* ---- guests have something to lose now -----------------------------------
   * "Continue as guest / Saves to this device only" is honest but far too quiet
   * for what it means: delete the app and months of training go with it. Nobody
   * reads a 10.5pt caption before tapping the fastest-looking button on screen.
   *
   * So we say nothing at the start, when they have nothing to lose, and ask once
   * after the THIRD logged session — the point where the history is worth
   * keeping and the app has earned the right to ask. Once only, ever.
   * ---------------------------------------------------------------------- */
  const [guestPrompted, setGuestPrompted] = useState(true);
  useEffect(() => {
    stGet(GUEST_PROMPT_KEY).then((v) => setGuestPrompted(v === '1')).catch(() => {});
  }, []);
  useEffect(() => {
    if (stage !== 'app' || user || guestPrompted) return;
    const logged = (data.lifts || []).length + (data.cardio || []).length;
    if (logged < 3) return;
    setGuestPrompted(true);
    stSet(GUEST_PROMPT_KEY, '1').catch(() => {});
    Alert.alert(
      'Save your progress?',
      'You are training as a guest, so this history lives only on this phone. '
      + 'If you delete the app or lose the device, it is gone. Creating a free '
      + 'account backs it up and lets you add friends.',
      [
        { text: 'Not now', style: 'cancel' },
        { text: 'Create account', onPress: () => setStage('auth') },
      ],
    );
  }, [stage, user, guestPrompted, data.lifts, data.cardio]);

  /* The six events. Fired here rather than scattered through the screens, so the
   * whole funnel is legible in one place and nobody has to grep for what is
   * being measured. */
  useEffect(() => { telemetry.identify(myUid || null); }, [myUid]);
  useEffect(() => {
    if (stage !== 'app') return;
    telemetry.track(telemetry.EVENTS.APP_OPEN, { signedIn: !!user });
  }, [stage, user]);

  const friends = useFriends(user);
  const quickDuelActive = useMemo(
    () => (data.duels || []).some((duel) => duel.status === 'active'),
    [data.duels],
  );
  const friendDuels = useFriendDuels(user, quickDuelActive, game.receiveFriendDuelReward);
  const leaderboard = useLeaderboard(user);
  const notificationCenter = useNotifications(user);
  // Read once at launch; every flag defaults to ON and stays on if the fetch
  // fails, so a network hiccup can never take a subsystem down.
  const appConfig = useAppConfig();

  const [myUid, setMyUid] = useState(null);
  useEffect(() => {
    if (!user) { setMyUid(null); return; }
    getUid().then(setMyUid).catch(() => {});
  }, [user]);

  const sessionsToday = useMemo(() => todaysSessions(data), [data.lifts, data.cardio, data.unit]);

  /* ------------------------------ routing -------------------------------- */

  const onExternalUrl = useCallback(async (url) => {
    // Password-reset links and duel invites are not app routes.
    if (isRecoveryUrl(url)) {
      const { error } = await completeRecoveryFromUrl(url);
      if (error) { toast(error.message || 'That reset link didn’t work — request a new one.', 'error'); return; }
      setRecoveryOpen(true);
      return;
    }
    const code = parseDuelCode(url);
    if (code) pendingInviteRef.current = code;
  }, [toast]);

  const router = useRouter({ onExternalUrl, ready: stage === 'app' });
  const { tab, activeModal } = router;

  useEffect(() => { router.registerScroll('main', scrollRef); }, [router]);

  // Notification taps carry a url, so they land on the exact content.
  useEffect(() => {
    const off = notifications.onNotificationTap((url) => router.handleUrl(url));
    const offReceived = notifications.onCheckInPromptReceived();
    return () => { off(); offReceived(); };
  }, [router]);

  /* ----------------------------- duel invites ---------------------------- */

  const pendingInviteRef = useRef(null);
  const claimDuelInvite = useCallback(async (code) => {
    if (!code) return false;
    if (friendDuels.busy) { toast('Finish your current duel first.', 'warn'); return false; }
    const { error } = await claimDuelInviteSvc(code);
    if (error) { toast(error.message || 'Could not join that duel', 'error'); return false; }
    toast('Duel started.', 'green');
    if (friendDuels.refresh) friendDuels.refresh();
    router.open({ tab: 'compete', view: 'duels' });
    return true;
  }, [friendDuels.busy, friendDuels.refresh, toast, router]);

  useEffect(() => {
    if (stage === 'app' && pendingInviteRef.current) {
      const code = pendingInviteRef.current;
      pendingInviteRef.current = null;
      claimDuelInvite(code);
    }
  }, [stage, claimDuelInvite]);

  const onCreateDuelInvite = useCallback(async () => {
    if (friendDuels.busy) { toast('Finish your current duel first.', 'warn'); return null; }
    const { data: inv, error } = await createDuelInviteSvc(7, 500);
    if (error || !inv) { toast((error && error.message) || 'Could not create invite.', 'error'); return null; }
    return inv;
  }, [friendDuels.busy, toast]);

  const onChallengeFriend = useCallback(async (friend) => {
    if (friendDuels.busy) { toast('Finish your current duel first.', 'warn'); return; }
    const { error } = await challengeFriendSvc(friend.id, 7, 500);
    toast(
      error ? (error.message || 'Could not send challenge') : `Challenge sent to ${friend.display_name || friend.username}`,
      error ? 'error' : 'green',
    );
  }, [friendDuels.busy, toast]);

  /* ------------------------- presence heartbeat -------------------------- */

  useEffect(() => {
    if (!user) return undefined;
    let alive = true;
    const beat = async () => { const uid = await getUid(); if (uid && alive) touchPresence(uid); };
    beat();
    const iv = setInterval(beat, 60000);
    return () => { alive = false; clearInterval(iv); };
  }, [user]);

  /* --------------------------- activity banner --------------------------- */

  const [notifOpen, setNotifOpen] = useState(false);
  const [banner, setBanner] = useState(null);
  const seenNoticeRef = useRef(null);

  useEffect(() => {
    const list = (notificationCenter && notificationCenter.items) || [];
    const newest = list.length ? list[0] : null;
    if (!newest) { seenNoticeRef.current = null; return; }
    if (seenNoticeRef.current === null) { seenNoticeRef.current = newest.id; return; }
    if (newest.id !== seenNoticeRef.current) {
      seenNoticeRef.current = newest.id;
      if (!newest.read) setBanner(newest);
    }
  }, [notificationCenter && notificationCenter.items]);

  // One place that turns any activity row into a destination.
  const routeForNotice = useCallback((notice) => {
    const payload = (notice && notice.payload) || {};
    switch (notice && notice.kind) {
      case 'check_in_reaction':
        return { tab: 'social', modal: MODALS.CHECK_IN_DETAIL, params: { checkInId: payload.check_in_id } };
      case 'check_in_comment':
        return {
          tab: 'social',
          modal: MODALS.CHECK_IN_DETAIL,
          params: { checkInId: payload.check_in_id, focusComments: true },
        };
      case 'friend_request':
        return { tab: 'social', modal: MODALS.FRIENDS, params: { focus: 'requests' } };
      case 'duel_challenge':
      case 'duel_result':
        return { tab: 'compete', view: 'duels' };
      case 'reward':
        return { tab: 'forge' };
      default:
        return { tab: 'social' };
    }
  }, []);

  /* ------------------------- widget snapshot ----------------------------- */

  // The home screen widget reads a small snapshot from the shared App Group.
  // Display-safe fields only: never HealthKit data, never a photograph.
  useEffect(() => {
    if (stage !== 'app') return;
    const nextDay = (data.workoutDays || [])[0];
    LiveActivity.setTodaySnapshot({
      level: dv.level,
      title: dv.title,
      rank: dv.placed ? dv.tier.name + dv.division : '',
      levelPct: dv.levelPct,
      trainingStreak: dv.streak,
      checkInStreak: (checkIn.stats && checkIn.stats.streak) || 0,
      checkedInToday: checkIn.hasCheckedIn,
      nextWorkoutName: nextDay ? nextDay.name : null,
      nextWorkoutFirstExercise: nextDay && nextDay.exercises && nextDay.exercises[0]
        ? nextDay.exercises[0].n : null,
      todaysSets: sessionsToday.reduce((n, sn) => n + sn.sets, 0),
    });
  }, [stage, dv.level, dv.levelPct, dv.streak, dv.title, dv.placed, checkIn.hasCheckedIn,
    checkIn.stats, data.workoutDays, sessionsToday]);

  /* --------------------------- social actions ---------------------------- */

  const [socialIntroSeen, setSocialIntroSeen] = useState(true);
  useEffect(() => {
    stGet(SOCIAL_INTRO_KEY).then((v) => setSocialIntroSeen(v === '1')).catch(() => {});
  }, []);

  // First visit to Social explains Check In before anything else happens.
  useEffect(() => {
    if (stage !== 'app' || tab !== 'social' || socialIntroSeen || !user) return;
    router.pushModal(MODALS.SOCIAL_INTRO);
    setSocialIntroSeen(true);
    stSet(SOCIAL_INTRO_KEY, '1').catch(() => {});
  }, [stage, tab, socialIntroSeen, user, router]);

  const openCamera = useCallback(() => {
    if (!user) { toast('Create an account to Check In with friends.', 'warn'); setStage('auth'); return; }
    if (checkIn.hasCheckedIn) {
      toast('You have already checked in today.', 'mut');
      return;
    }
    router.pushModal(MODALS.CHECK_IN_CAMERA);
  }, [user, checkIn.hasCheckedIn, router, toast]);

  const onPosted = useCallback((result) => {
    router.popModal();
    if (result.queued) {
      toast('Saved — LEVL will post it as soon as you have signal.', 'warn');
      return;
    }
    // The server decided the amount; this only applies what was granted.
    game.applySocialXP(result.xp, result.verified ? 'Verified Session' : 'Check In');
    feed.refresh();
  }, [router, toast, game, feed]);

  // Attach today's session to a Check In that already exists — the "checked in
  // at 9, finished training at 10" case.
  const attachTodaysWorkout = useCallback(async () => {
    const session = primarySessionToday(data);
    if (!session) { toast('No workout logged today yet.', 'mut'); return; }
    const res = await checkIn.attachWorkout(session.id);
    if (res.error) { haptics.error(); toast(res.error.message || 'Could not attach that workout.', 'error'); return; }
    haptics.celebrate();
    game.applySocialXP(res.xp, 'Verified Session');
    feed.refresh();
  }, [data, checkIn, toast, game, feed]);

  const openProfileOf = useCallback((author) => {
    if (!author) return;
    router.pushModal(MODALS.PROFILE, { userId: author.id });
  }, [router]);

  /* ------------------------ finishing a workout -------------------------- */

  // Ending a session is the natural moment to offer the Check In — and the one
  // place where "attach the workout I just did" needs no extra thought from the
  // user. It also writes the session to Apple Health, if they connected it.
  const [shareSession, setShareSession] = useState(null);
  const [attaching, setAttaching] = useState(false);

  const onWorkoutFinished = useCallback((finished) => {
    if (!finished) return;
    const session = primarySessionToday(data);
    if (!session || session.entryCount < 1) return;

    // Best-effort, and silent: a Health write failing must never intrude on
    // finishing a workout.
    health.saveWorkout(session, session.title).catch(() => {});

    if (!user) return;
    setShareSession(session);
  }, [data, health, user]);

  const attachFromSheet = useCallback(async () => {
    if (!shareSession) return;
    setAttaching(true);
    const res = await checkIn.attachWorkout(shareSession.id);
    setAttaching(false);
    if (res.error) { haptics.error(); toast(res.error.message || 'Could not attach that workout.', 'error'); return; }
    haptics.celebrate();
    game.applySocialXP(res.xp, 'Verified Session');
    feed.refresh();
    setShareSession(null);
  }, [shareSession, checkIn, toast, game, feed]);

  /* -------------------------------- auth --------------------------------- */

  const onAuthed = useCallback(async (email, name, isNew) => {
    setNotifOpen(false);
    await game.hydrateFor(email, name, isNew);
    router.open({ tab: 'train' });
    setStage('app');
  }, [game, router]);

  const doSignOut = useCallback(async () => {
    setNotifOpen(false);
    router.closeModals();
    await game.signOut();
    setStage('auth');
  }, [game, router]);

  /* -------------------------------- gates -------------------------------- */

  if (recoveryOpen) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
        <StatusBar barStyle="light-content" />
        <Toasts items={toasts} />
        <SetNewPasswordScreen
          onDone={async () => { await doSignOut(); setRecoveryOpen(false); toast('Password updated — sign in with your new password', 'green'); }}
          onCancel={async () => { await doSignOut(); setRecoveryOpen(false); }}
        />
      </SafeAreaView>
    );
  }
  if (stage === 'boot' || !splashDone) return <BootScreen duration={SPLASH_MS} />;
  if (stage === 'intro') {
    return <Intro onDone={() => { stSet(INTRO_KEY, '1').catch(() => {}); setStage('auth'); }} />;
  }
  if (stage === 'auth') {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
        <StatusBar barStyle="light-content" />
        <Toasts items={toasts} />
        <AuthScreen onAuthed={onAuthed} loadAuth={loadAuth} saveAuth={saveAuth}
          sha256Hex={sha256Hex} makeSalt={makeSalt} />
      </SafeAreaView>
    );
  }
  if (!data.profileComplete) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
        <StatusBar barStyle="light-content" />
        <Toasts items={toasts} />
        <PhysicalProfileForm data={data}
          onSave={(p) => { game.saveProfile(p); toast('Profile saved — welcome!', 'green'); }} />
      </SafeAreaView>
    );
  }

  /* -------------------------------- app ---------------------------------- */

  const scrolledTabs = tab !== 'social';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="light-content" />
      <Toasts items={toasts} />

      <NoticeBanner
        notice={banner}
        onDismiss={() => setBanner(null)}
        onPress={(notice) => {
          setBanner(null);
          if (notificationCenter && notificationCenter.markAllRead) notificationCenter.markAllRead();
          router.open(routeForNotice(notice));
        }}
      />
      <LevelUpOverlay info={levelUp} onClose={() => setLevelUp(null)} />
      <NotificationCenter
        visible={notifOpen}
        center={notificationCenter}
        onClose={() => setNotifOpen(false)}
        onOpen={(notice) => { setNotifOpen(false); router.open(routeForNotice(notice)); }}
      />

      {/* ---- header ------------------------------------------------------
       * WHAT THIS USED TO BE
       * A 30pt mark, the word "LEVL" set beside it in letterspaced caps, the
       * level and rank at 10.5pt underneath, and a 4pt progress bar stretched
       * across the full width below the whole row.
       *
       * Three things were wrong with that. The mark and the wordmark said the
       * same thing twice, which is the layout equivalent of a raised voice —
       * and no mature app spends its most valuable row telling its own user
       * what the app is called. The level, which is the entire point of the
       * product, was the smallest text on screen. And the progress bar was a
       * generic full-width rule that could have come from anywhere.
       *
       * WHAT IT IS NOW
       * The ring around the mark IS the progress bar, so a whole row of chrome
       * disappears and the logo gains a job. The identity line belongs to the
       * PLAYER — their name, their rank in their tier's colour — because that
       * is the thing worth being proud of. Every control on the right is the
       * same 34pt circle, so the row reads as one set rather than three
       * unrelated widgets.
       * ------------------------------------------------------------------ */}
      <View style={{ paddingHorizontal: 14, paddingTop: 4, paddingBottom: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <LevlRing size={40} pct={dv.levelPct} tint={dv.placed ? dv.tier.color : C.gold} />

          <View style={{ marginLeft: 11, flex: 1 }}>
            <Text
              numberOfLines={1}
              style={{ fontSize: 17, fontWeight: '700', color: C.text, letterSpacing: -0.4 }}>
              {data.name || 'Player'}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
              <Text style={{
                fontSize: 11.5, fontWeight: '800', letterSpacing: 0.4,
                color: dv.placed ? dv.tier.color : C.dim, fontVariant: ['tabular-nums'],
              }}>
                LV {dv.level}
              </Text>
              <View style={{
                width: 3, height: 3, borderRadius: 1.5, marginHorizontal: 6,
                backgroundColor: C.faint,
              }} />
              <Text style={{
                fontSize: 11.5, fontWeight: '700', letterSpacing: 0.4,
                color: dv.placed ? dv.tier.color : C.dim,
              }}>
                {dv.placed ? (dv.tier.name + ' ' + dv.division).toUpperCase() : 'UNRANKED'}
              </Text>
            </View>
          </View>

          <Pressable
            onPress={() => router.open({ tab: 'forge' })}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel="Coins. Opens the Forge."
            style={{
              flexDirection: 'row', alignItems: 'center', height: 34,
              backgroundColor: C.panel2, borderRadius: 999,
              borderWidth: 1, borderColor: alpha(C.gold, 0.33),
              paddingLeft: 5, paddingRight: 11, marginRight: 8,
            }}>
            <CoinGlyph size={21} />
            <CountUp value={coinBalance(data)}
              style={{ fontSize: 13.5, fontWeight: '700', color: C.text, marginLeft: 6, fontVariant: ['tabular-nums'] }} />
          </Pressable>

          {isConfigured && user ? (
            <Pressable
              onPress={() => setNotifOpen(true)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={'Notifications' + (notificationCenter.unread > 0 ? ', ' + notificationCenter.unread + ' unread' : '')}
              style={{
                width: 34, height: 34, borderRadius: 17, marginRight: 8,
                alignItems: 'center', justifyContent: 'center',
                backgroundColor: C.panel2, borderWidth: 1,
                borderColor: notificationCenter.unread > 0 ? alpha(C.gold, 0.45) : C.line,
              }}>
              <NoticeGlyph color={notificationCenter.unread > 0 ? C.gold : C.mut} size={17} />
              {notificationCenter.unread > 0 ? (
                <View style={badgeDot}>
                  <Text style={{ fontSize: 9, fontWeight: '800', color: '#fff' }}>
                    {notificationCenter.unread > 9 ? '9+' : notificationCenter.unread}
                  </Text>
                </View>
              ) : null}
            </Pressable>
          ) : null}

          {/* The profile control, in the one place it lives on every screen. */}
          <Pressable
            onPress={() => router.pushModal(MODALS.SETTINGS)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Your profile and settings"
            style={{ borderRadius: 999 }}>
            <HunterAvatar
              avatar={data.avatar}
              character={{ deco: data.equippedDecoration }}
              size={34}
            />
          </Pressable>
        </View>
      </View>

      {/* A live workout is visible from every tab, and can be ended from any
          of them — which is what guarantees the Live Activity gets closed. */}
      <ActiveWorkoutBar onFinished={onWorkoutFinished} />

      {/* ---- content ---------------------------------------------------- */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 56 : 0}>

        {/* Social gets its own virtualised list: forty 4:5 photographs inside a
            shared ScrollView is how a feed starts dropping frames. */}
        <View style={{ flex: 1, display: tab === 'social' ? 'flex' : 'none' }}>
          <SocialTab
            user={user}
            me={myUid}
            feed={feed}
            scope={scope}
            setScope={setScope}
            checkIn={checkIn}
            enabled={appConfig.social_enabled}
            prefsWindowText={prefs ? windowLabel(prefs) : null}
            publicDiscovery={prefs ? prefs.public_discovery : true}
            unit={data.unit}
            sessionsToday={sessionsToday}
            unreadCount={notificationCenter.unread}
            pendingRequests={(friends && friends.requests && friends.requests.length) || 0}
            onOpenCamera={openCamera}
            onOpenFriends={() => router.pushModal(MODALS.FRIENDS)}
            onOpenActivity={() => setNotifOpen(true)}
            onOpenProfile={openProfileOf}
            onAttachWorkout={attachTodaysWorkout}
            onSignIn={() => setStage('auth')}
            onOpenIntro={() => router.pushModal(MODALS.SOCIAL_INTRO)}
          />
        </View>

        <ScrollView
          ref={scrollRef}
          style={{ flex: 1, display: scrolledTabs ? 'flex' : 'none' }}
          contentContainerStyle={{ padding: 14, paddingBottom: 110 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}>
          <FadeIn key={tab}>
            {tab === 'train' ? (
              <TrainTab
                data={data} dv={dv}
                onLift={game.addLift}
                onLiftBatch={game.addLiftBatch}
                onCardio={game.addCardio}
                onSaveDay={game.saveWorkoutDay}
                onDeleteDay={game.deleteWorkoutDay}
                onEditEntry={game.editEntry}
                onDeleteEntry={game.deleteEntry}
                onSetRestSeconds={game.setRestSeconds}
                onOpenAnalytics={() => router.pushModal(MODALS.ANALYTICS)}
              />
            ) : null}

            {tab === 'compete' ? (
              <CompeteTab
                data={data} dv={dv}
                view={router.competeView}
                setView={router.setCompeteView}
                userEmail={user}
                duelsEnabled={appConfig.duels_enabled}
                leaderboard={leaderboard}
                friends={friends}
                friendDuels={friendDuels}
                startDuel={game.startDuel}
                claimDuel={game.claimDuel}
                forfeitDuel={game.forfeitDuel}
                onChallengeFriend={onChallengeFriend}
                onCreateInvite={onCreateDuelInvite}
                onJoinByCode={claimDuelInvite}
              />
            ) : null}

            {tab === 'hunter' ? (
              <HunterTab
                data={data} dv={dv}
                setAvatar={game.setAvatar}
                equipTitle={game.equipTitle}
                equipDecoration={game.equipDecoration}
                goForge={() => router.open({ tab: 'forge' })}
                goAnalytics={() => router.pushModal(MODALS.ANALYTICS)}
                goArchive={user ? () => router.pushModal(MODALS.CHECK_IN_ARCHIVE, { userId: myUid }) : null}
                health={health}
                socialStats={user ? checkIn.stats : null}
              />
            ) : null}

            {tab === 'forge' ? (
              <ShopTab
                data={data} dv={dv}
                buy={game.buy} equip={game.equip} forge={game.forge}
                claimTier={game.claimTier} claimAll={game.claimAll} buyPremium={game.buyPremium}
                goPacks={() => router.pushModal(MODALS.PACKS)}
              />
            ) : null}
          </FadeIn>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ---- tab bar ----------------------------------------------------- */}
      <View style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row',
        paddingBottom: Math.max(insets.bottom, 8), paddingTop: 10, overflow: 'hidden',
      }}>
        {/* Real iOS material. Content genuinely travels under this bar — the
            scroll view carries 110pt of bottom padding — so the blur has
            something to work on. It was a 94%-opaque panel before, which threw
            that away. Glass falls back to opaque under Reduce Transparency. */}
        <Glass
          pointerEvents="none"
          style={StyleSheet.absoluteFill}
          radius={0}
          border={false}
          tint="rgba(20,23,32,0.55)"
          intensity={65}
        />
        {TABS.map((t) => {
          const on = tab === t.key;
          // Each destination owns an accent when active — distinct tabs are
          // recognised faster than uniform ones. Inactive stays muted.
          const TINT = {
            train: C.green, compete: C.orange, social: C.gold,
            hunter: C.cyan, forge: C.purp,
          };
          const tint = TINT[t.key] || C.gold;
          return (
            <Pressable
              key={t.key}
              onPress={() => router.goTab(t.key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              accessibilityLabel={t.label}
              style={{ flex: 1, alignItems: 'center', paddingTop: 2 }}>
              <View style={{ opacity: on ? 1 : 0.5, transform: [{ translateY: on ? -1 : 0 }] }}>
                <TabIcon name={t.icon} color={on ? tint : C.mut} active={on} />
              </View>
              <Text style={{
                fontSize: 10, marginTop: 3, fontWeight: on ? '700' : '500',
                letterSpacing: 0.2, color: on ? tint : C.dim,
              }}>
                {t.label}
              </Text>
              <View style={{
                width: 5, height: 5, borderRadius: 2.5, marginTop: 3,
                backgroundColor: on ? tint : 'transparent',
              }} />
            </Pressable>
          );
        })}
      </View>

      <WorkoutShareSheet
        visible={!!shareSession}
        session={shareSession}
        unit={data.unit}
        hasCheckedIn={checkIn.hasCheckedIn}
        alreadyVerified={checkIn.verified}
        busy={attaching}
        onAttach={attachFromSheet}
        onCheckIn={() => { setShareSession(null); openCamera(); }}
        onDismiss={() => setShareSession(null)}
      />

      {/* ---- modal stack -------------------------------------------------- */}
      <Modal
        visible={!!activeModal}
        animationType={activeModal && activeModal.key === MODALS.CHECK_IN_CAMERA ? 'slide' : 'slide'}
        presentationStyle="fullScreen"
        onRequestClose={router.popModal}>
        {activeModal ? (
          <ModalHost
            modal={activeModal}
            router={router}
            game={game}
            data={data}
            dv={dv}
            user={user}
            myUid={myUid}
            checkIn={checkIn}
            prefsApi={prefsApi}
            health={health}
            friends={friends}
            friendDuels={friendDuels}
            sessionsToday={sessionsToday}
            appConfig={appConfig}
            onPosted={onPosted}
            onSignOut={doSignOut}
            onOpenProfile={openProfileOf}
            onChallengeFriend={onChallengeFriend}
          />
        ) : null}
      </Modal>
    </SafeAreaView>
  );
}

/* ------------------------------------------------------------------------- */

function ModalHost({
  modal, router, game, data, dv, user, myUid, checkIn,
  prefsApi, health, friends, friendDuels, sessionsToday, appConfig,
  onPosted, onSignOut, onOpenProfile, onChallengeFriend,
}) {
  const close = router.popModal;
  const params = modal.params || {};

  switch (modal.key) {
    case MODALS.CHECK_IN_CAMERA:
      return (
        <CheckInCameraScreen
          onClose={close}
          onPosted={onPosted}
          sessionsToday={sessionsToday}
          defaultVisibility={prefsApi.prefs ? prefsApi.prefs.default_visibility : 'friends'}
          unit={data.unit}
          posting={checkIn.posting}
          post={checkIn.post}
        />
      );

    case MODALS.CHECK_IN_DETAIL:
      return (
        <CheckInDetailScreen
          checkInId={params.checkInId}
          focusComments={params.focusComments}
          me={myUid}
          unit={data.unit}
          onClose={close}
          onOpenProfile={onOpenProfile}
        />
      );

    case MODALS.CHECK_IN_ARCHIVE:
      return (
        <CheckInArchiveScreen
          userId={params.userId || myUid}
          isMe={!params.userId || params.userId === myUid}
          onClose={close}
          onOpenCheckIn={(id) => router.pushModal(MODALS.CHECK_IN_DETAIL, { checkInId: id })}
        />
      );

    case MODALS.SOCIAL_INTRO:
      return (
        <SocialIntro
          initialWindow={prefsApi.prefs}
          onSetWindow={(w) => prefsApi.update(w)}
          onDone={close}
        />
      );

    case MODALS.SETTINGS:
      return (
        <SettingsScreen
          data={data}
          dv={dv}
          userEmail={user}
          profile={null}
          prefs={prefsApi.prefs}
          prefsLoading={prefsApi.loading}
          updatePrefs={prefsApi.update}
          enableReminders={prefsApi.enableReminders}
          notifPermission={prefsApi.permission}
          health={health}
          rename={game.rename}
          setUnit={game.setUnit}
          saveProfile={game.saveProfile}
          makeCode={game.exportCode}
          importCode={game.importCode}
          resetAll={game.resetAll}
          loadDemo={game.loadDemo}
          signOut={onSignOut}
          onClose={close}
        />
      );

    case MODALS.FRIENDS:
    case MODALS.PROFILE:
      // Friends, requests and a friend's profile are one screen — it already
      // handles all three, so Social reaches it rather than duplicating it.
      return (
        <ModalShell title={modal.key === MODALS.PROFILE ? 'Profile' : 'Friends'} onClose={close} scroll={false}>
          <FriendsScreen
            fr={friends}
            duels={friendDuels}
            initialUserId={params.userId}
            onChallenge={onChallengeFriend}
            onOpenArchive={(uid) => router.pushModal(MODALS.CHECK_IN_ARCHIVE, { userId: uid })}
          />
        </ModalShell>
      );

    case MODALS.ANALYTICS:
      return (
        <ModalShell title="Training analytics" onClose={close}>
          <ProgressTab data={data} dv={dv} onDelete={game.deleteEntry} onEdit={game.editEntry} />
        </ModalShell>
      );

    case MODALS.PACKS:
      return (
        <ModalShell title="Packs" onClose={close}>
          <PacksTab data={data} dv={dv} openPackH={game.openPack}
            enabled={!appConfig || appConfig.packs_enabled !== false}
            grantTestPack={game.grantTestPack} goBack={close} />
        </ModalShell>
      );

    default:
      return <ModalShell title="" onClose={close}><View /></ModalShell>;
  }
}

// A plain sheet wrapper for screens that were written to live inside the tab
// ScrollView. Keeps them working untouched.
//
// `scroll={false}` for screens that bring their own ScrollView — nesting two
// vertical scrollers makes the inner one refuse to scroll at all.
function ModalShell({ title, onClose, children, scroll = true }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{
        flexDirection: 'row', alignItems: 'center',
        paddingTop: insets.top + 6, paddingHorizontal: 16, paddingBottom: 10,
        borderBottomWidth: 1, borderBottomColor: C.lineSoft,
      }}>
        <Text style={{ ...T.headline, color: C.text, flex: 1 }}>{title}</Text>
        <Pressable
          onPress={onClose}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Close"
          style={{ minHeight: 36, justifyContent: 'center', paddingLeft: 12 }}>
          <Text style={{ ...T.subheadline, color: C.gold }}>Done</Text>
        </Pressable>
      </View>
      {scroll ? (
        <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: insets.bottom + 40 }}>
          {children}
        </ScrollView>
      ) : (
        <View style={{ flex: 1 }}>{children}</View>
      )}
    </View>
  );
}

const badgeDot = {
  position: 'absolute', top: -3, right: -3, minWidth: 16, height: 16,
  borderRadius: 8, backgroundColor: C.red, borderWidth: 1.5, borderColor: C.bg,
  alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3,
};

/* --------------------------- crash safety net ---------------------------
 * A black screen tells you nothing. This boundary catches any render-time
 * throw anywhere in the tree and puts the actual error ON SCREEN, so a failure
 * in a production build is diagnosable instead of silent. It also means one
 * broken screen can never take down the whole app.
 */
class RootBoundary extends React.Component {
  constructor(p) {
    super(p);
    this.state = { err: null };
  }
  static getDerivedStateFromError(err) { return { err }; }
  componentDidCatch(err, info) {
    this.setState({ err });
    // The boundary already put the error on screen for the user. This is the
    // half that was missing: telling US. Without it a crash is only ever seen by
    // the one person it happened to.
    try { telemetry.captureFatal(err, info); } catch (e) {}
  }
  render() {
    if (!this.state.err) return this.props.children;
    const msg = String(this.state.err && (this.state.err.stack || this.state.err.message || this.state.err));
    return (
      <View style={{ flex: 1, backgroundColor: '#08090f', padding: 24, paddingTop: 80 }}>
        <Text style={{ color: '#f5c542', fontSize: 20, fontWeight: '800', marginBottom: 6 }}>
          LEVL hit an error
        </Text>
        <Text style={{ color: '#9ba3b4', fontSize: 15, fontWeight: '600', marginBottom: 16, lineHeight: 21 }}>
          Screenshot this error and send it to us.
        </Text>
        <ScrollView style={{ flex: 1, backgroundColor: C.panel, borderRadius: 10, padding: 12 }}>
          {/* A stack trace is one of the few places real monospace earns its keep. */}
          <Text style={{ color: '#ffffff', fontSize: 11, fontFamily: MONO }}>{msg}</Text>
        </ScrollView>
        <Pressable
          onPress={() => this.setState({ err: null })}
          style={{ marginTop: 16, backgroundColor: '#f5c542', borderRadius: 12, paddingVertical: 14, alignItems: 'center' }}>
          <Text style={{ color: C.panel, fontWeight: '800' }}>TRY AGAIN</Text>
        </Pressable>
      </View>
    );
  }
}

// SafeAreaProvider is REQUIRED for SafeAreaView to read real device insets.
export default function App() {
  return (
    <RootBoundary>
      <SafeAreaProvider>
        <AppInner />
      </SafeAreaProvider>
    </RootBoundary>
  );
}
