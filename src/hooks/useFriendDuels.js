// LEVL — useFriendDuels: the friend-duel state machine.
//
// Holds three buckets the UI renders directly:
//   incoming — duels where someone challenged ME and I haven't answered
//   active   — accepted duels currently running, with live scores
//   past     — completed duels (my win/loss record)
//
// Live: subscribes to the duels table via Realtime, so an opponent's score
// change or a new challenge appears instantly. Also resolves any ended duels
// whenever it refreshes, so winners get settled without a server cron.

import { useState, useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { isConfigured } from '../services/supabase/client';
import { currentUserId } from '../services/supabase/authService';
import {
  myDuels, respondToDuel, resolveEndedDuels, quitDuel,
  claimDuelRewards,
} from '../services/supabase/duelService';
import { getProfile } from '../services/supabase/profileService';
import { subscribe } from '../services/supabase/realtimeService';

export function useFriendDuels(accountKey, anotherDuelActive = false, onReward) {
  const [uid, setUid] = useState(null);
  const [incoming, setIncoming] = useState([]);
  const [active, setActive] = useState([]);
  const [past, setPast] = useState([]);
  const [loading, setLoading] = useState(false);
  const [live, setLive] = useState(false);
  const [error, setError] = useState(null);
  const accountRef = useRef(accountKey);
  accountRef.current = accountKey;

  // Attach the opponent's display name/avatar to each duel row so the UI has
  // something human to show. Cached per refresh to avoid duplicate lookups.
  const hydrate = useCallback(async (duels, meId) => {
    const cache = {};
    const out = [];
    for (const d of duels) {
      const oppId = d.player_one === meId ? d.player_two : d.player_one;
      if (!cache[oppId]) {
        const { data } = await getProfile(oppId);
        cache[oppId] = data || { id: oppId, display_name: 'Player', username: 'player' };
      }
      const iAmOne = d.player_one === meId;
      out.push({
        ...d,
        opponent: cache[oppId],
        myScore: iAmOne ? d.player_one_score : d.player_two_score,
        theirScore: iAmOne ? d.player_two_score : d.player_one_score,
        iAmOne,
      });
    }
    return out;
  }, []);

  const refresh = useCallback(async () => {
    const requestAccount = accountKey;
    if (!isConfigured || !requestAccount) {
      setUid(null); setIncoming([]); setActive([]); setPast([]); setLoading(false); setError(null); return;
    }
    setLoading(true);
    try {
      const meId = await currentUserId();
      if (accountRef.current !== requestAccount) return;
      setUid(meId);
      if (!meId) { setError('Sign in to use friend duels.'); return; }

      // settle anything that's ended before we read
      const settled = await resolveEndedDuels();
      const reward = await claimDuelRewards(meId);
      if (accountRef.current !== requestAccount) return;
      if (!reward.error && reward.data > 0 && onReward) onReward(reward.data);

      const { data, error } = await myDuels();
      if (accountRef.current !== requestAccount) return;
      if (error || !data) { setError(error ? String(error.message || error) : 'Could not load duels.'); return; }

      const hydrated = await hydrate(data, meId);
      if (accountRef.current !== requestAccount) return;
      // incoming = pending AND I'm player_two (the one who was challenged)
      setIncoming(hydrated.filter((d) => d.status === 'pending' && !d.iAmOne));
      setActive(hydrated.filter((d) => d.status === 'active'));
      setPast(hydrated.filter((d) => d.status === 'complete'));
      setError(
        settled && settled.error
          ? 'Final workout check failed. Pull to retry.'
          : reward && reward.error
            ? String(reward.error.message || reward.error)
            : null
      );
    } catch (e) {
      if (accountRef.current === requestAccount) setError(String(e && e.message || e));
    } finally {
      if (accountRef.current === requestAccount) setLoading(false);
    }
  }, [accountKey, hydrate, onReward]);

  useEffect(() => {
    setUid(null); setIncoming([]); setActive([]); setPast([]);
    setLoading(false); setLive(false); setError(null);
    refresh();
  }, [accountKey, refresh]);

  // Live: any change to a duel row re-pulls. Cheap — duel counts are small.
  useEffect(() => {
    if (!isConfigured || !accountKey) return undefined;
    let unsub = () => {};
    let alive = true;
    (async () => {
      const meId = await currentUserId();
      if (!meId || !alive) return;
      unsub = subscribe(
        'duels',
        null,
        () => refresh(),
        (status) => { if (alive) setLive(status === 'SUBSCRIBED'); },
      );
    })();
    const poll = setInterval(refresh, 20000);
    const state = AppState.addEventListener('change', (next) => { if (next === 'active') refresh(); });
    return () => {
      alive = false; setLive(false); clearInterval(poll);
      try { state.remove(); } catch (e) {}
      unsub();
    };
  }, [accountKey, refresh]);

  // You may only be in ONE friend duel at a time. Accepting while one is
  // running would silently replace the head-to-head, so we refuse and let the
  // UI explain that the current duel must be quit first.
  const accept = useCallback(async (duelId) => {
    if (anotherDuelActive || (active && active.length > 0)) return { ok: false, reason: 'busy' };
    const { error } = await respondToDuel(duelId, true);
    if (error) setError(String(error.message || error));
    else await refresh();
    return { ok: !error, error };
  }, [refresh, active, anotherDuelActive]);

  const decline = useCallback(async (duelId) => {
    const { error } = await respondToDuel(duelId, false);
    if (error) setError(String(error.message || error));
    else await refresh();
    return { ok: !error, error };
  }, [refresh]);

  // Quit an active duel (UI confirms first).
  const quit = useCallback(async (duelId) => {
    const { error } = await quitDuel(duelId);
    if (error) setError(String(error.message || error));
    else await refresh();
    return { ok: !error, error };
  }, [refresh]);

  const wins = past.filter((d) => d.winner === uid).length;
  const losses = past.filter((d) => d.winner && d.winner !== uid).length;

  const inDuel = !!(active && active.length > 0);
  return {
    incoming, active, past, loading, live, error, wins, losses,
    refresh, accept, decline, quit, inDuel, busy: inDuel || anotherDuelActive,
  };
}
