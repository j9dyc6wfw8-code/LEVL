// ============================================================================
// LEVL — useGameSave
//
// The save, and every action that changes it.
//
// This is a straight extraction from App.js, which had grown to hold the save,
// the sync, the auth transitions, twenty-odd game handlers AND the whole
// navigation and render tree in one file. Build 28 adds a social feature on top
// of that, so the data layer moved here and App.js became composition.
//
// NOTHING ABOUT THE BEHAVIOUR CHANGED IN THE MOVE. The same debounce, the same
// account-switch guards, the same daily-cap validation, the same pack and
// level-up rules. Every comment explaining a hard-won fix came with it, because
// those are the bits most likely to be broken by a well-meaning refactor.
// ============================================================================

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import {
  DEFAULT_DATA, computeDerived, buildDemoData, applyLift, applyCardio,
  removeEntryPure, editEntryPure, validateLift, validateCardio, levelFromXP,
  coinBalance, xpBalance, RARITY, createDuel, duelYouTotal, duelBotFullTotal,
  applyPassReward, FORGE_PASS, passKey, passClaimable, PASS_PREMIUM_COST,
  AUTH_KEY, SAVE_PREFIX, emailKeyOf, openPack, applyPackReward, convertUnits,
  attemptForge, materialById, INTEGRITY, packsEarnedFromXP, COSMETICS,
  updateFrPeak,
} from '../engine/engine';
import { stGet, stSet, stDel, b64encode, b64decode } from '../services/platform';
import { primarySessionToday } from '../engine/session';
import telemetry from '../services/telemetry';
import workoutSession from '../services/workoutSession';
import {
  pullAndResolve, pushInBackground, syncWorkouts, removeSyncedWorkout,
} from '../services/supabase/syncService';
import { pushMyDuelScores } from '../services/supabase/duelService';
import { isConfigured } from '../services/supabase/client';
import {
  signOut as supabaseSignOut,
  currentUserEmail,
} from '../services/supabase/authService';

const LAST_USER_KEY = 'ascend-last-user';

const itemById = (id) => COSMETICS.find((c) => c.id === id);
const slotOf = (id) => { const it = itemById(id); return it ? it.slot : 'helm'; };
const nameOf = (id) => { const it = itemById(id); return it ? it.name : 'item'; };
const rarityKeyOf = (id) => { const it = itemById(id); return it ? it.rarity : 'common'; };

const recentWorkoutEntries = (snapshot) => {
  const recentSince = Date.now() - 30 * 86400000;
  return [...((snapshot && snapshot.lifts) || []), ...((snapshot && snapshot.cardio) || [])]
    .filter((e) => e && e.t >= recentSince)
    .sort((a, b) => (a.t || 0) - (b.t || 0))
    .slice(-500);
};

async function syncPublicWorkoutActivity(snapshot) {
  const entries = recentWorkoutEntries(snapshot);
  const result = await syncWorkouts(entries, snapshot && snapshot.unit);
  if (!result || result.error) return result;
  await pushMyDuelScores();
  return result;
}

export const loadAuth = async () => {
  try {
    const raw = await stGet(AUTH_KEY);
    return raw ? JSON.parse(raw) : { users: {}, lastUser: null };
  } catch (e) {
    return { users: {}, lastUser: null };
  }
};
export const saveAuth = (a) => stSet(AUTH_KEY, JSON.stringify(a));

// Merge a stored save over defaults so new fields always exist (schema upgrades).
export function mergeSave(p) {
  const d = JSON.parse(JSON.stringify(DEFAULT_DATA));
  if (!p) return d;
  // Training Goal was retired. Old saves may still contain the field; drop it
  // during hydration so it does not keep circulating through cloud backups.
  const cleanSave = { ...p };
  delete cleanSave.goal;
  return {
    ...d, ...cleanSave,
    stats: { ...d.stats, ...(cleanSave.stats || {}) },
    avatar: { ...d.avatar, ...(cleanSave.avatar || {}) },
    equipped: { ...d.equipped, ...(cleanSave.equipped || {}) },
    owned: Array.from(new Set([...(d.owned || []), ...((cleanSave.owned) || [])])),
    spentCoins: cleanSave.spentCoins || 0, spentXP: cleanSave.spentXP || 0,
    bonusCoins: cleanSave.bonusCoins || 0, duels: cleanSave.duels || [],
    passPremium: !!cleanSave.passPremium, passClaimed: cleanSave.passClaimed || [],
    packs: { ...d.packs, ...(cleanSave.packs || {}) },
    titles: cleanSave.titles || [], decorations: cleanSave.decorations || [],
    equippedTitle: cleanSave.equippedTitle || null,
    equippedDecoration: cleanSave.equippedDecoration || 'deco_none',
    packsOpened: cleanSave.packsOpened || 0,
    recentPulls: cleanSave.recentPulls || [],
    _packsFromXP: cleanSave._packsFromXP,
    bodyweight: cleanSave.bodyweight || 0, heightCm: cleanSave.heightCm || 0,
    age: cleanSave.age || 0,
    sex: cleanSave.sex || '', activity: cleanSave.activity || '',
    experience: cleanSave.experience || '',
    profileComplete: !!cleanSave.profileComplete,
    workoutDays: cleanSave.workoutDays || [],
    // 0 is a legitimate value (timer off), so only fall back when truly absent.
    restSeconds: cleanSave.restSeconds == null ? d.restSeconds : cleanSave.restSeconds,
    lifts: cleanSave.lifts || [], cardio: cleanSave.cardio || [],
  };
}

/* ------------------------------------------------------------------------- */

export function useGameSave({ toast, onLevelUp, stage }) {
  const [user, setUser] = useState(null);            // email, or null for guest
  const [data, setData] = useState(() => JSON.parse(JSON.stringify(DEFAULT_DATA)));

  const saveKeyFor = useCallback(
    (email) => (email ? emailKeyOf(email) : SAVE_PREFIX + ':guest'),
    [],
  );

  const syncTimer = useRef(null);
  const userRef = useRef(user);
  const dataRef = useRef(data);
  useEffect(() => { userRef.current = user; }, [user]);
  useEffect(() => { dataRef.current = data; }, [data]);

  const persist = useCallback((nd) => {
    stSet(saveKeyFor(user), JSON.stringify(nd));
    // Mirror to the cloud, if configured — debounced, since a Forge session or
    // a quick string of logged sets can call persist() many times a second.
    // The local write above is immediate and unaffected.
    if (syncTimer.current) clearTimeout(syncTimer.current);
    const scheduledFor = user;
    syncTimer.current = setTimeout(() => {
      // If the account changed while this was pending, DROP the push — it would
      // otherwise write the previous account's data onto the current one.
      if (userRef.current !== scheduledFor) return;
      const freshDv = computeDerived(nd, Date.now());
      pushInBackground(nd, freshDv);
      // Workout detail is the public evidence behind a duel score, so those
      // rows land before the score is recalculated.
      syncPublicWorkoutActivity(nd).catch(() => {});
    }, 1500);
  }, [user, saveKeyFor]);

  // Reconcile recent local workouts at launch and whenever the app returns to
  // the foreground — catches sets logged offline.
  useEffect(() => {
    if (stage !== 'app' || !user || !isConfigured) return undefined;
    let alive = true;
    const syncNow = () => {
      if (!alive || userRef.current !== user) return;
      syncPublicWorkoutActivity(dataRef.current).catch(() => {});
    };
    syncNow();
    // Publish the public profile row once on launch too, so a player who opens
    // the app without logging anything still refreshes what friends see.
    (async () => {
      if (!alive || userRef.current !== user) return;
      try {
        const d = dataRef.current;
        await pushInBackground(d, computeDerived(d, Date.now()));
      } catch (e) { /* best-effort mirror, never blocks the UI */ }
    })();
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') syncNow(); });
    return () => { alive = false; try { sub.remove(); } catch (e) {} };
  }, [stage, user]);

  // Central commit: apply an engine transform { nd, meta }, persist, surface
  // level-ups and pack drops.
  const commit = useCallback((fn) => {
    let outMeta = null;
    setData((d) => {
      const before = levelFromXP(d.xp);
      const { nd, meta } = fn(d);
      outMeta = meta;

      // Packs drip in from training itself, not just level-ups. Daily XP is
      // capped, so this cannot be farmed.
      const earnedPacks = packsEarnedFromXP(nd.xp);
      const claimedPacks = nd._packsFromXP || 0;
      if (earnedPacks > claimedPacks) {
        const gained = earnedPacks - claimedPacks;
        const p2 = { ...(nd.packs || { standard: 0, prime: 0, elite: 0 }) };
        p2.standard = (p2.standard || 0) + gained;
        nd.packs = p2;
        nd._packsFromXP = earnedPacks;
        setTimeout(() => toast('📦 Training pack earned — open it in the Forge'), 700);
      } else if (nd._packsFromXP == null) {
        nd._packsFromXP = earnedPacks;
      }

      // Record a new Fitness Rating high-water mark, which is what rank
      // protection decays from. Done here rather than in computeDerived because
      // computeDerived is a pure read called on every render — the peak has to
      // be written once, on a real change, and persisted with the save.
      Object.assign(nd, updateFrPeak(nd, Date.now()));

      const after = levelFromXP(nd.xp);
      if (after > before) {
        const packs = { ...(nd.packs || { standard: 0, prime: 0, elite: 0 }) };
        for (let lvl = before + 1; lvl <= after; lvl++) {
          if (lvl % 10 === 0) packs.elite = (packs.elite || 0) + 1;
          else if (lvl % 5 === 0) packs.prime = (packs.prime || 0) + 1;
          else packs.standard = (packs.standard || 0) + 1;
        }
        nd.packs = packs;
        onLevelUp({ to: after, title: computeDerived(nd, Date.now()).title });
        setTimeout(() => toast('📦 Level-up pack earned! Open it in the Forge'), 900);
      }
      persist(nd);
      return nd;
    });
    return outMeta;
  }, [persist, toast, onLevelUp]);

  const dv = useMemo(() => computeDerived(data, Date.now()), [data]);

  /* ---------------------------- training ------------------------------- */

  // Mirror a logged set into the active-workout store, which is what drives the
  // Live Activity and the Dynamic Island. The store owns the session; this just
  // tells it what happened.
  //
  // The session id comes from the engine's own clustering, so the Live Activity
  // and the Check In attachment always point at the SAME session — that is what
  // makes "tap the Dynamic Island, land on Bench Press set 4" work.
  const mirrorToSession = useCallback((nextData, meta, exercise) => {
    const current = primarySessionToday(nextData);
    if (!current) return;
    const active = workoutSession.getState();
    if (!active.active || active.sessionId !== current.id) {
      workoutSession.start({
        sessionId: current.id,
        workoutName: current.title,
        exercise,
        unit: nextData.unit,
      });
    } else if (active.exercise !== exercise) {
      workoutSession.setExercise(exercise);
    }
    /* The rest clock starts HERE, on the log, because that is the moment the
     * set actually ended. workoutSession already had startRest/restRemaining and
     * ActiveWorkoutBar already rendered them — but nothing ever passed
     * restSeconds, so the timer existed in full and never once ran. */
    workoutSession.logSet({
      weight: meta && meta.w,
      reps: meta && meta.r,
      xp: meta ? (meta.xp || 0) + (meta.bonus || 0) : 0,
      isPR: !!(meta && meta.isPR),
      exercise,
      restSeconds: Math.max(0, (nextData && nextData.restSeconds) || 0),
    });
  }, []);

  /* Activation milestones. Counted from the save rather than tracked per screen,
   * so batch logging, cardio and lifts all land on the same definition of
   * "their first set" — and there is exactly one place to look. */
  const trackMilestones = useCallback((nextData) => {
    const total = ((nextData.lifts || []).length + (nextData.cardio || []).length);
    if (total === 1) telemetry.track(telemetry.EVENTS.FIRST_SET);
    else if (total === 3) telemetry.track(telemetry.EVENTS.THIRD_SET);
  }, []);

  const addLift = useCallback((ex, w, r, rpe) => {
    const check = validateLift(data, ex, w, r, rpe, Date.now());
    if (!check.ok) { toast(check.reason, 'error'); return null; }
    const meta = commit((d) => applyLift(d, Date.now(), ex, w, r, rpe));
    if (meta) {
      if (meta.capped) toast('Daily XP cap reached — logged, 0 XP', 'mut');
      else toast((meta.isPR ? 'PR! ' : '') + '+' + (meta.xp + meta.bonus) + ' XP');
      // PRs feed the forge — tell the player what dropped.
      if (meta.matDrop) {
        const m = materialById(meta.matDrop);
        if (m) toast('Material found: ' + m.name, m.color);
      }
      // dataRef is updated by the effect above on the next tick, so read the
      // freshest snapshot rather than the closed-over `data`.
      setTimeout(() => {
        mirrorToSession(dataRef.current, { ...meta, w, r }, ex);
        trackMilestones(dataRef.current);
      }, 0);
    }
    return meta;
  }, [data, commit, toast, mirrorToSession, trackMilestones]);

  // Log N identical sets at once, for when someone trains first and logs after.
  // Timestamps are backdated ~3 min apart so history and volume windows stay
  // realistic. Every XP guard still applies.
  const addLiftBatch = useCallback((ex, w, r, rpe, sets) => {
    const n = Math.max(1, Math.min(INTEGRITY.MAX_BATCH_SETS, parseInt(sets, 10) || 1));
    if (n === 1) return addLift(ex, w, r, rpe);
    const first = validateLift(data, ex, w, r, rpe, Date.now(), { batch: true });
    if (!first.ok) { toast(first.reason, 'error'); return null; }

    const now = Date.now();
    const GAP = 3 * 60 * 1000;
    let logged = 0, totalXP = 0, prs = 0, capped = false, lastMeta = null, stopped = '';

    const meta = commit((d) => {
      let nd = d;
      for (let i = 0; i < n; i++) {
        const t = now - (n - 1 - i) * GAP;
        const v = validateLift(nd, ex, w, r, rpe, t, { batch: true });
        if (!v.ok) { stopped = v.reason; break; }
        const res = applyLift(nd, t, ex, w, r, rpe);
        nd = res.nd;
        logged += 1;
        totalXP += (res.meta.xp || 0) + (res.meta.bonus || 0);
        if (res.meta.isPR) prs += 1;
        if (res.meta.capped) capped = true;
        lastMeta = res.meta;
      }
      return { nd, meta: lastMeta };
    });

    if (!logged) { toast(stopped || 'Could not log those sets', 'error'); return null; }
    if (stopped) toast('Logged ' + logged + ' of ' + n + ' — ' + stopped, 'warn');
    else if (capped) toast('Logged ' + logged + ' sets · daily XP cap reached', 'mut');
    else toast((prs ? 'PR! ' : '') + 'Logged ' + logged + ' sets · +' + totalXP + ' XP');
    if (meta && meta.matDrop) {
      const m = materialById(meta.matDrop);
      if (m) toast('Material found: ' + m.name, m.color);
    }
    return meta ? { ...meta, batch: logged, batchXP: totalXP } : null;
  }, [data, commit, toast, addLift]);

  const addCardio = useCallback((name, mins, dist, inten) => {
    const check = validateCardio(data, mins, Date.now());
    if (!check.ok) { toast(check.reason, 'error'); return null; }
    const meta = commit((d) => applyCardio(d, Date.now(), name, mins, dist, inten));
    if (meta) {
      if (meta.capped) toast('Daily XP cap reached — logged, 0 XP', 'mut');
      else toast('+' + (meta.xp + meta.bonus) + ' XP');
      setTimeout(() => trackMilestones(dataRef.current), 0);
    }
    return meta;
  }, [data, commit, toast, trackMilestones]);

  // Deleting an entry must refund its XP and stat allocation. Filtering the
  // arrays alone left the XP behind, so a set could be logged, deleted and
  // re-logged for double XP — and the daily cap reset because it counts only
  // entries that still exist.
  const deleteEntry = useCallback((id) => {
    const removed = commit((d) => removeEntryPure(d, id));
    if (!removed) return;
    toast('Entry removed — its XP was refunded', 'mut');
    // The cloud row has to go too. Deleting locally used to be the whole story:
    // pushWorkouts only ever upserted and `workouts` had no DELETE policy, so a
    // mistyped 300 kg bench stayed in the public log permanently. Since
    // sql/2811 derives best_e1rm, weekly_xp and consistency FROM that table,
    // the typo the user had already corrected kept sitting at the top of the
    // Strength leaderboard and kept counting toward any overlapping duel.
    // The engine's entry id is the row's client_id, so this targets it exactly.
    removeSyncedWorkout(id).catch(() => {});
  }, [commit, toast]);

  /* ------------------------------ editing -------------------------------
   * A mistyped set (100 kg instead of 10) used to be repairable only by
   * deleting and re-logging, which stamped it with the current time and so
   * moved it into the wrong session — and the wrong day, if you noticed the
   * mistake the next morning.
   *
   * editEntryPure rebuilds the entry in place at its original timestamp. The
   * validation below runs against the save with the entry ALREADY removed, for
   * two reasons: the rest-gap and set-count limits must not count the set being
   * corrected against itself, and the daily XP cap has to see the room the old
   * value was occupying.
   * ------------------------------------------------------------------- */
  const editEntry = useCallback((id, patch) => {
    const all = [...(data.lifts || []), ...(data.cardio || [])];
    const entry = all.find((x) => x.id === id);
    if (!entry) { toast('That entry no longer exists', 'error'); return null; }
    const isCardio = (data.cardio || []).some((x) => x.id === id);
    const p = patch || {};
    const val = (next, fallback) => (next == null || next === '' ? fallback : next);
    const { nd: without } = removeEntryPure(data, id);

    const check = isCardio
      ? validateCardio(without, parseFloat(val(p.mins, entry.mins)) || 0, entry.t)
      : validateLift(
          without,
          val(p.ex, entry.ex),
          parseFloat(val(p.w, entry.w)) || 0,
          parseInt(val(p.r, entry.r), 10) || 0,
          parseInt(val(p.rpe, entry.rpe), 10) || 8,
          entry.t,
          // The minimum-rest guard exists to stop someone spamming the log
          // button. It has no meaning for a set that was already logged.
          { batch: true },
        );
    if (!check.ok) { toast(check.reason, 'error'); return null; }

    const meta = commit((d) => editEntryPure(d, id, p));
    if (meta) toast('Entry updated', 'green');
    return meta;
  }, [data, commit, toast]);

  /* -------------------------- social XP hook ---------------------------- */

  // The ONLY route by which Check In XP enters the save. The amount is decided
  // and metered by the server (see sql/2805_social_xp.sql) — this just applies
  // what was actually granted, which is 0 on any repeat.
  const applySocialXP = useCallback((granted, label) => {
    const amount = Math.max(0, Math.round(granted || 0));
    if (!amount) return;
    commit((d) => ({ nd: { ...d, xp: (d.xp || 0) + amount }, meta: null }));
    toast((label || 'Check In') + ' · +' + amount + ' XP', 'gold');
  }, [commit, toast]);

  /* ----------------------------- identity -------------------------------- */

  const rename = useCallback((name) => commit((d) => ({ nd: { ...d, name }, meta: null })), [commit]);

  // Rest length is a training preference, not a game value — no XP consequences,
  // so it commits without any of the integrity machinery.
  const setRestSeconds = useCallback((secs) => {
    const v = Math.max(0, Math.min(600, Math.round(secs) || 0));
    commit((d) => ({ nd: { ...d, restSeconds: v }, meta: null }));
  }, [commit]);

  const setUnit = useCallback((unit) => {
    if ((data.unit || 'kg') === unit) return;
    commit((d) => ({ nd: convertUnits(d, unit), meta: null }));
    toast('Switched to ' + unit + ' — all weights converted', 'gold');
  }, [data.unit, commit, toast]);

  const setAvatar = useCallback((key, idx) => (
    commit((d) => ({ nd: { ...d, avatar: { ...d.avatar, [key]: idx } }, meta: null }))
  ), [commit]);

  const saveProfile = useCallback((profile) => (
    commit((d) => ({ nd: { ...d, ...profile, profileComplete: true }, meta: null }))
  ), [commit]);

  const equipTitle = useCallback((id) => (
    commit((d) => ({ nd: { ...d, equippedTitle: d.equippedTitle === id ? null : id }, meta: null }))
  ), [commit]);

  const equipDecoration = useCallback((id) => (
    commit((d) => ({ nd: { ...d, equippedDecoration: id }, meta: null }))
  ), [commit]);

  /* --------------------------- workout days ------------------------------ */

  const saveWorkoutDay = useCallback((day) => {
    const name = ((day && day.name) || '').trim();
    const exercises = (day && Array.isArray(day.exercises)) ? day.exercises : [];
    if (!name || !exercises.length) return;
    commit((d) => {
      const days = d.workoutDays || [];
      let next;
      if (day.id) next = days.map((x) => (x.id === day.id ? { ...x, name, exercises } : x));
      else {
        const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
        next = [{ id, name, exercises }, ...days];
      }
      return { nd: { ...d, workoutDays: next }, meta: null };
    });
    if (!(day && day.id)) telemetry.track(telemetry.EVENTS.WORKOUT_DAY_CREATED);
    toast(day && day.id ? 'Workout Day updated' : 'Workout Day saved', 'green');
  }, [commit, toast]);

  const deleteWorkoutDay = useCallback((id) => {
    commit((d) => ({ nd: { ...d, workoutDays: (d.workoutDays || []).filter((x) => x.id !== id) }, meta: null }));
    toast('Workout Day removed', 'mut');
  }, [commit, toast]);

  /* ------------------------------- forge --------------------------------- */

  // Validation happens BEFORE commit: setData updaters must stay pure (React
  // may invoke them twice in dev), so toasts never belong inside one. The
  // in-updater ownership re-check stays as the final race guard.
  const buy = useCallback((id, currency) => {
    if ((data.owned || []).includes(id)) return;
    const rar = RARITY[rarityKeyOf(id)];
    if (!rar) return;
    const price = currency === 'coins' ? rar.coins : rar.xp;
    const balance = currency === 'coins' ? coinBalance(data) : xpBalance(data);
    if (balance < price) { toast(currency === 'coins' ? 'Not enough coins' : 'Not enough XP', 'error'); return; }
    commit((d) => {
      if ((d.owned || []).includes(id)) return { nd: d, meta: null };
      const spend = currency === 'coins'
        ? { spentCoins: (d.spentCoins || 0) + rar.coins }
        : { spentXP: (d.spentXP || 0) + rar.xp };
      const nd = { ...d, owned: [...d.owned, id], equipped: { ...d.equipped, [slotOf(id)]: id }, ...spend };
      return { nd, meta: { name: nameOf(id) } };
    });
  }, [data, commit, toast]);

  const equip = useCallback((slot, id) => (
    commit((d) => ({ nd: { ...d, equipped: { ...d.equipped, [slot]: id } }, meta: null }))
  ), [commit]);

  // attemptForge runs against the CURRENT data to decide the outcome, then that
  // exact outcome is committed — so the animation and the saved state can never
  // disagree.
  const forge = useCallback((itemId) => {
    const res = attemptForge(data, itemId);
    if (res.result === 'blocked') { toast(res.reason, 'error'); return null; }
    commit(() => ({ nd: res.nd, meta: null }));
    if (res.result === 'success') toast(res.tier + ' — forge succeeded', 'gold');
    else toast('The forge resisted — temper +' + res.temper, 'purp');
    return res;
  }, [data, commit, toast]);

  const buyPremium = useCallback(() => {
    if (data.passPremium) return;
    if (coinBalance(data) < PASS_PREMIUM_COST) { toast('Not enough coins for the Premium Pass', 'error'); return; }
    commit((d) => ({ nd: { ...d, passPremium: true, spentCoins: (d.spentCoins || 0) + PASS_PREMIUM_COST }, meta: null }));
    toast('⭐ Premium Pass unlocked — claim your rewards!', 'gold');
  }, [data, commit, toast]);

  const claimTier = useCallback((lane, tier) => {
    const row = FORGE_PASS.find((t) => t.tier === tier);
    if (!row) return;
    const key = passKey(lane, tier);
    if ((data.passClaimed || []).includes(key)) return;
    if (dv.level < row.level) { toast('Reach level ' + row.level + ' to claim tier ' + tier, 'error'); return; }
    if (lane === 'premium' && !data.passPremium) { toast('Premium Pass required', 'error'); return; }
    const rw = lane === 'premium' ? row.premium : row.free;
    commit((d) => {
      let nd = applyPassReward(d, rw);
      nd = { ...nd, passClaimed: [...(d.passClaimed || []), key] };
      return { nd, meta: null };
    });
  }, [data, dv.level, commit, toast]);

  const claimAll = useCallback(() => {
    const claims = passClaimable(data, dv.level);
    if (!claims.length) return;
    commit((d) => {
      let nd = { ...d };
      const keys = [];
      for (const c of claims) {
        const rw = c.lane === 'premium' ? c.row.premium : c.row.free;
        nd = applyPassReward(nd, rw);
        keys.push(passKey(c.lane, c.row.tier));
      }
      return { nd: { ...nd, passClaimed: [...(d.passClaimed || []), ...keys] }, meta: null };
    });
    toast('Claimed ' + claims.length + ' pass reward' + (claims.length === 1 ? '' : 's') + '!', 'green');
  }, [data, dv.level, commit, toast]);

  // Rolls one reward against the CURRENT data (so dupe-avoidance sees what you
  // own), applies it, decrements the pack, and returns the reward so the Packs
  // screen can play the reveal.
  const openPackH = useCallback((packKey) => {
    if (((data.packs || {})[packKey] || 0) <= 0) return null;
    const reward = openPack(data, packKey);
    commit((d) => {
      let nd = applyPackReward(d, reward);
      const packs = { ...(d.packs || {}) };
      packs[packKey] = Math.max(0, (packs[packKey] || 0) - 1);
      const pull = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        t: Date.now(), pack: packKey,
        rarity: reward.rarity, kind: reward.kind, name: reward.name,
      };
      const recentPulls = [pull, ...(d.recentPulls || [])].slice(0, 30);
      nd = { ...nd, packs, packsOpened: (d.packsOpened || 0) + 1, recentPulls };
      return { nd, meta: null };
    });
    return reward;
  }, [data, commit]);

  const grantTestPack = useCallback(() => {
    commit((d) => ({
      nd: {
        ...d,
        packs: {
          standard: ((d.packs || {}).standard || 0) + 1,
          prime: ((d.packs || {}).prime || 0) + 1,
          elite: ((d.packs || {}).elite || 0) + 1,
        },
      },
      meta: null,
    }));
    toast('Granted 1 of each pack for testing', 'gold');
  }, [commit, toast]);

  /* ------------------------------- duels --------------------------------- */

  const startDuel = useCallback((tierKey, seed, days) => {
    if ((data.duels || []).some((x) => x.status === 'active')) {
      toast('Finish or claim your current duel first', 'error'); return;
    }
    const n = days || 7;
    commit((d) => ({
      nd: { ...d, duels: [...(d.duels || []), createDuel(tierKey, Date.now(), seed, null, n)] },
      meta: null,
    }));
    toast('Duel started — ' + n + (n === 1 ? ' day' : ' days') + ' on the clock ⚔️');
  }, [data.duels, commit, toast]);

  const claimDuel = useCallback((id) => {
    const meta = commit((d) => {
      const duel = (d.duels || []).find((x) => x.id === id);
      if (!duel || duel.status !== 'active' || Date.now() < duel.endT) return { nd: d, meta: null };
      const you = duelYouTotal(d, duel);
      const bot = duelBotFullTotal(duel);
      const result = you > bot ? 'win' : you < bot ? 'loss' : 'draw';
      const mult = result === 'win' ? 1 : result === 'draw' ? 0.4 : 0.15;
      const coins = Math.round(duel.reward.coins * mult);
      const xpAward = Math.round(duel.reward.xp * mult);
      const duels = d.duels.map((x) => (x.id === id
        ? { ...x, status: 'finished', result, claimed: true, finalYou: you, finalBot: bot, earned: { coins, xp: xpAward } }
        : x));
      return {
        nd: { ...d, duels, xp: d.xp + xpAward, bonusCoins: (d.bonusCoins || 0) + coins },
        meta: { result, coins, xpAward },
      };
    });
    if (meta) {
      toast(
        meta.result === 'win' ? 'Victory! +' + meta.coins + '🪙 +' + meta.xpAward + ' XP'
          : meta.result === 'draw' ? 'Draw — +' + meta.coins + '🪙 +' + meta.xpAward + ' XP'
          : 'Defeat — consolation +' + meta.coins + '🪙 +' + meta.xpAward + ' XP',
        meta.result === 'win' ? 'green' : meta.result === 'draw' ? 'gold' : 'error',
      );
    }
  }, [commit, toast]);

  const forfeitDuel = useCallback((id) => {
    let wasSkip = false;
    commit((d) => {
      const duel = (d.duels || []).find((x) => x.id === id);
      if (!duel || duel.status !== 'active') return { nd: d, meta: null };
      const you = duelYouTotal(d, duel);
      // Never logged anything inside the window? Then you never really entered
      // it — leaving is a skip, not a defeat, and it stays off your record.
      wasSkip = you === 0;
      const duels = d.duels.map((x) => (x.id === id
        ? {
            ...x, status: 'finished', claimed: true,
            result: wasSkip ? 'skipped' : 'loss',
            finalYou: you, finalBot: duelBotFullTotal(duel),
            earned: { coins: 0, xp: 0 },
          }
        : x));
      return { nd: { ...d, duels }, meta: 1 };
    });
    toast(wasSkip ? 'Duel skipped — nothing added to your record' : 'Duel forfeited', 'mut');
  }, [commit, toast]);

  const receiveFriendDuelReward = useCallback((coins) => {
    if (!coins) return;
    commit((d) => ({ nd: { ...d, bonusCoins: (d.bonusCoins || 0) + coins }, meta: null }));
    toast(`Duel reward · +${coins} coins`, 'gold');
  }, [commit, toast]);

  /* --------------------------- account transfer -------------------------- */

  const exportCode = useCallback(() => {
    try {
      return b64encode(JSON.stringify({ app: 'levl', v: DEFAULT_DATA.v, exportedAt: Date.now(), data }));
    } catch (e) { return null; }
  }, [data]);

  /* Backup codes exist for ONE job: moving a save to a new device. They were
   * also the fastest way to forge a rank — paste any crafted payload and the
   * app wrote it straight to state and disk, no questions asked.
   *
   * Restricting it to accounts with nothing to lose keeps the legitimate use
   * (fresh install, fresh account, guest) and removes the abuse: you can no
   * longer overwrite an account that already has training on it. The server-side
   * xp clamp (sql/2811) is the backstop for anything that gets past this. */
  const importCode = useCallback((code) => {
    const existing = (data.lifts || []).length + (data.cardio || []).length;
    if (existing > 0) {
      toast('Import only works on an empty account — this one already has training logged', 'error');
      return false;
    }
    try {
      const payload = JSON.parse(b64decode(code.trim()));
      const knownApp = payload && (payload.app === 'levl' || payload.app === 'ascend');
      if (!payload || !knownApp || !payload.data) { toast('That code is not a valid LEVL backup', 'error'); return false; }
      const merged = mergeSave(payload.data);
      setData(merged); persist(merged);
      toast('Save restored from backup code', 'green');
      return true;
    } catch (e) { toast('Could not read that backup code', 'error'); return false; }
  }, [data.lifts, data.cardio, persist, toast]);

  /* ------------------------------- account ------------------------------- */

  const hydrateFor = useCallback(async (email, name, isNew) => {
    setUser(email);
    if (email) await stSet(LAST_USER_KEY, email);
    let nd;
    if (isNew) nd = mergeSave({ name: name || 'Player' });
    else {
      const raw = await stGet(saveKeyFor(email));
      nd = mergeSave(raw ? JSON.parse(raw) : { name: name || 'Player' });
    }
    // IDENTITY GUARD: only pull from the cloud if the live Supabase session
    // actually belongs to THIS email. On a fast account switch the previous
    // user's session can still be active, and pulling then would merge their
    // save into this account.
    const sessionEmail = await currentUserEmail();
    const identityOk = !sessionEmail || sessionEmail === String(email || '').toLowerCase();
    if (identityOk) {
      const resolved = await pullAndResolve(nd);
      nd = mergeSave(resolved.data);
    } else {
      nd = mergeSave(nd);
    }
    setData(nd);
    stSet(saveKeyFor(email), JSON.stringify(nd));
    return nd;
  }, [saveKeyFor]);

  const signOut = useCallback(async () => {
    // CRITICAL: cancel any pending debounced cloud push FIRST. Without this, a
    // sync scheduled under the old account fires ~1.5s later and writes the old
    // account's data onto whoever logs in next.
    if (syncTimer.current) { clearTimeout(syncTimer.current); syncTimer.current = null; }
    await stDel(LAST_USER_KEY);
    try { const auth = await loadAuth(); auth.lastUser = null; await saveAuth(auth); } catch (e) {}
    try { await supabaseSignOut(); } catch (e) {}
    setUser(null);
    setData(JSON.parse(JSON.stringify(DEFAULT_DATA)));
  }, []);

  const resetAll = useCallback(() => {
    const fresh = JSON.parse(JSON.stringify(DEFAULT_DATA));
    setData(fresh); persist(fresh);
    toast('All data reset', 'mut');
  }, [persist, toast]);

  const loadDemo = useCallback(() => {
    // Demo sessions are generated in kg. Convert the WHOLE save to the player's
    // unit first, then overlay identity fields.
    let demo = buildDemoData();
    if ((data.unit || 'kg') !== 'kg') demo = convertUnits(demo, data.unit);
    demo.name = data.name; demo.avatar = data.avatar; demo.owned = data.owned;
    demo.equipped = data.equipped; demo.profileComplete = true;
    demo.bodyweight = data.bodyweight || (demo.unit === 'lb' ? 176 : 80);
    demo.heightCm = data.heightCm || 178;
    demo.age = data.age || 27;
    setData(demo); persist(demo);
    toast('Demo save loaded — Champion II', 'gold');
  }, [data, persist, toast]);

  return {
    user, setUser,
    data, setData, dv,
    persist, commit, saveKeyFor,
    // training
    addLift, addLiftBatch, addCardio, deleteEntry, editEntry,
    saveWorkoutDay, deleteWorkoutDay,
    // social
    applySocialXP,
    // identity
    rename, setUnit, setRestSeconds, setAvatar, saveProfile, equipTitle, equipDecoration,
    // forge
    buy, equip, forge, buyPremium, claimTier, claimAll, openPack: openPackH, grantTestPack,
    // duels
    startDuel, claimDuel, forfeitDuel, receiveFriendDuelReward,
    // account
    hydrateFor, signOut, resetAll, loadDemo, exportCode, importCode,
  };
}

export default useGameSave;
