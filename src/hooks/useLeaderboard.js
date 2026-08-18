// LEVL — useLeaderboard: live global / friends rankings.
//
// Reads straight from the profiles table (which already holds weekly_xp, xp,
// level, streak). No separate leaderboard table needed — indexes on those
// columns keep it fast. Returns rows sorted by the chosen metric, with a flag
// marking which row is the current user so the UI can highlight it.

import { useState, useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { isConfigured } from '../services/supabase/client';
import { currentUserId } from '../services/supabase/authService';
import { globalTop, friendsTop } from '../services/supabase/leaderboardService';
import { listFriends } from '../services/supabase/friendService';

export function useLeaderboard(accountKey) {
  // Opens on FRIENDS when you have any, GLOBAL otherwise.
  //
  // Neither is right on its own. A global top-100 is where a new player finds
  // out they are 94th, which is not the feeling to open on; a friends board is
  // the one people actually care about — but it is just your own name until you
  // have added somebody. So the default adapts once, on first load, rather than
  // being a fixed guess that is wrong for half the users.
  const [scope, setScope] = useState('global');   // 'global' | 'friends'
  const pickedScope = useRef(false);
    // Opens on the Strength board — the heaviest-lift list is the one people
  // actually want to see first.
  const [metric, setMetric] = useState('best_e1rm');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [meId, setMeId] = useState(null);
  const accountRef = useRef(accountKey);
  accountRef.current = accountKey;

  const load = useCallback(async () => {
    const requestAccount = accountKey;
    if (!isConfigured || !requestAccount) { setRows([]); setMeId(null); setLoading(false); return; }
    setLoading(true);
    try {
      const uid = await currentUserId();
      if (accountRef.current !== requestAccount) return;
      setMeId(uid);

      let res;
      if (scope === 'friends') {
        const { data: fr } = await listFriends();
        const ids = (fr || []).map((f) => f.id);
        res = await friendsTop(ids, metric, 100);
      } else {
        res = await globalTop(metric, 100);
      }
      if (accountRef.current !== requestAccount) return;
      if (res.error || !res.data) { setRows([]); return; }

      // annotate rank position + isMe
      const ranked = res.data.map((r, i) => ({ ...r, position: i + 1, isMe: r.id === uid }));
      setRows(ranked);
    } finally {
      if (accountRef.current === requestAccount) setLoading(false);
    }
  }, [accountKey, scope, metric]);

  useEffect(() => {
    setRows([]); setMeId(null); setLoading(false);
    load();
  }, [accountKey, load]);

  // Choose the opening scope once per account, from whether they actually have
  // friends. Runs before the user has touched anything, so switching scope
  // afterwards is never overridden.
  useEffect(() => {
    if (!isConfigured || !accountKey) return undefined;
    let alive = true;
    pickedScope.current = false;
    (async () => {
      const { data } = await listFriends();
      if (!alive || pickedScope.current) return;
      pickedScope.current = true;
      if (data && data.length) setScope('friends');
    })();
    return () => { alive = false; };
  }, [accountKey]);

  // The ladder had no refresh path at all: it loaded once and then went stale
  // for as long as the app stayed open, so someone could pass you and you would
  // never see it. A global top-100 can't be expressed as a Realtime filter
  // (Postgres changes can't say "the highest hundred"), so instead of a
  // firehose subscription on every profile row we re-pull on foreground —
  // cheap, bounded, and correct for a board that only needs to be current when
  // someone is actually looking at it.
  useEffect(() => {
    if (!isConfigured) return undefined;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') load();
    });
    return () => { try { sub.remove(); } catch (e) {} };
  }, [load]);

  return { scope, setScope, metric, setMetric, rows, loading, meId, reload: load };
}
