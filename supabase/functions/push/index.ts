// ============================================================================
// LEVL — push
//
// Turns a row in `public.notifications` into a real Apple/Android push.
//
// The client already had everything except a sender: expo_push_token is stored
// on check_in_preferences, the in-app inbox is live over Realtime, and the tap
// handler routes levl:// URLs. What was missing is this — something that runs
// when the app is CLOSED, which by definition cannot be the app.
//
// Called by a Postgres trigger (or a Supabase Database Webhook) on insert into
// public.notifications. Accepts either shape:
//
//   { type: 'INSERT', table: 'notifications', record: { ... } }   <- webhook
//   { record: { ... } }  |  { records: [ { ... } ] }              <- trigger
//
// DESIGN RULES
//   1. Never fail loudly. A notification must never roll back the action that
//      caused it, and a dead token must never 500 a trigger. Everything returns
//      200 with a JSON summary; problems are reported in the body, not the code.
//   2. Respect the user's switches. check_in_preferences has notify_social /
//      notify_duels / notify_rewards / notify_check_in. Sending anyway would be
//      the fastest possible way to get the app's notifications turned off.
//   3. Self-clean. Expo replies DeviceNotRegistered for uninstalled apps; that
//      token is nulled so we stop paying to talk to nobody.
// ============================================================================

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

/* Which preference column gates each notification kind. A kind that is not in
   this map is treated as ungated — better a stray push than a silent drop of a
   kind somebody adds later and forgets to register here. */
const PREF_FOR_KIND: Record<string, string> = {
  friend_request: 'notify_social',
  check_in_comment: 'notify_social',
  check_in_reaction: 'notify_social',
  duel_challenge: 'notify_duels',
  duel_result: 'notify_duels',
  reward: 'notify_rewards',
};

type Payload = Record<string, unknown> | null;

/* Copy + deep link per kind. The URLs are the ones src/navigation/routes.js
   already parses, so a tap lands on the right screen instead of the home tab. */
function present(kind: string, payload: Payload): { title: string; body: string; url: string } | null {
  const p = (payload || {}) as Record<string, any>;
  const who = typeof p.from_name === 'string' && p.from_name ? p.from_name : 'Someone';

  switch (kind) {
    case 'friend_request':
      return {
        title: 'New friend request',
        body: `${who} wants to train with you.`,
        url: 'levl://requests',
      };

    case 'check_in_comment':
      return {
        title: 'New comment',
        body: p.body ? `${who}: ${String(p.body).slice(0, 90)}` : `${who} commented on your Check In.`,
        url: p.check_in_id ? `levl://comments/${p.check_in_id}` : 'levl://social',
      };

    case 'check_in_reaction':
      return {
        title: 'New reaction',
        body: `${who} reacted to your Check In.`,
        url: p.check_in_id ? `levl://check-in/${p.check_in_id}` : 'levl://social',
      };

    case 'duel_challenge':
      return p.started
        ? { title: 'Duel started', body: `You're live against ${who}. Log a set.`, url: 'levl://compete/duels' }
        : { title: 'Duel challenge', body: `${who} has challenged you.`, url: 'levl://compete/duels' };

    case 'duel_result': {
      const r = String(p.result || '');
      if (r === 'win') return { title: 'Duel won', body: 'Claim your XP and coins.', url: 'levl://compete/duels' };
      if (r === 'loss') return { title: 'Duel lost', body: 'Rematch when you\'re ready.', url: 'levl://compete/duels' };
      return { title: 'Duel complete', body: 'It ended level. See the breakdown.', url: 'levl://compete/duels' };
    }

    case 'reward':
      return { title: 'Reward ready', body: 'Something is waiting in the Forge.', url: 'levl://forge' };

    default:
      // An unknown kind still reaches the inbox; it just gets generic copy
      // rather than being dropped.
      return { title: 'LEVL', body: 'You have a new notification.', url: 'levl://train' };
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

/* Minimal REST helpers. The full supabase-js client is not worth the cold-start
   cost here — this function does two queries and one PATCH. */
function db(path: string, init: RequestInit = {}) {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  return fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key!,
      authorization: `Bearer ${key}`,
      'content-type': 'application/json',
      ...(init.headers || {}),
    },
  });
}

Deno.serve(async (req) => {
  // ---- auth: a shared secret, so only our trigger can spend our push quota --
  const expected = Deno.env.get('PUSH_HOOK_SECRET');
  if (expected) {
    const got = req.headers.get('x-levl-secret');
    if (got !== expected) return json({ ok: false, error: 'unauthorised' }, 401);
  }

  let incoming: any;
  try {
    incoming = await req.json();
  } catch {
    return json({ ok: false, error: 'bad-json' });
  }

  // Accept a webhook envelope, a single record, or a batch.
  const rows: any[] = incoming?.records
    ? incoming.records
    : incoming?.record
      ? [incoming.record]
      : Array.isArray(incoming) ? incoming : [incoming];

  const results: any[] = [];

  for (const row of rows) {
    const userId = row?.user_id;
    const kind = String(row?.kind || '');
    if (!userId || !kind) { results.push({ skipped: 'missing-user-or-kind' }); continue; }

    // ---- 1. token + preferences in one read ------------------------------
    let prefs: any = null;
    try {
      const res = await db(
        `check_in_preferences?user_id=eq.${userId}` +
        `&select=expo_push_token,notify_social,notify_duels,notify_rewards,notify_check_in`,
      );
      const arr = await res.json();
      prefs = Array.isArray(arr) ? arr[0] : null;
    } catch {
      results.push({ kind, skipped: 'prefs-read-failed' });
      continue;
    }

    const token = prefs?.expo_push_token;
    if (!token) { results.push({ kind, skipped: 'no-token' }); continue; }

    const gate = PREF_FOR_KIND[kind];
    if (gate && prefs[gate] === false) { results.push({ kind, skipped: 'muted' }); continue; }

    // ---- 2. resolve who it's from -----------------------------------------
    // The existing DB triggers store payload.from as a bare UUID (see
    // sql/2802_check_ins.sql), so without this every push would read
    // "Someone commented on your Check In." A name is the whole difference
    // between a notification you open and one you swipe away.
    let payload: Payload = row?.payload ?? null;
    const fromId = (payload as any)?.from;
    if (fromId && !(payload as any)?.from_name) {
      try {
        const res = await db(`profiles?id=eq.${fromId}&select=display_name,username`);
        const arr = await res.json();
        const who = Array.isArray(arr) ? arr[0] : null;
        const name = who?.display_name || who?.username;
        if (name) payload = { ...(payload as object), from_name: name };
      } catch { /* fall back to "Someone" */ }
    }

    // ---- 3. build and send ------------------------------------------------
    const content = present(kind, payload);
    if (!content) { results.push({ kind, skipped: 'no-copy' }); continue; }

    // Real unread count for the app icon. APNs cannot increment a badge on its
    // own — whatever number we send IS the badge — so a hardcoded 1 would read
    // "1" while five things sat unread. Cheap: a HEAD with an exact count.
    let badge = 1;
    try {
      const res = await db(
        `notifications?user_id=eq.${userId}&read=eq.false&select=id`,
        { method: 'HEAD', headers: { prefer: 'count=exact' } },
      );
      // content-range comes back as "*/12"
      const range = res.headers.get('content-range');
      const total = range ? parseInt(range.split('/')[1], 10) : NaN;
      if (Number.isFinite(total) && total > 0) badge = total;
    } catch { /* keep 1 */ }

    const message = {
      to: token,
      title: content.title,
      body: content.body,
      sound: 'default',
      // `url` is what src/services/notifications.js onNotificationTap() reads,
      // so the deep link survives a cold start from the lock screen.
      data: { url: content.url, kind, notificationId: row?.id ?? null },
      badge,
      priority: 'high',
      channelId: 'default',
    };

    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json',
          // Set EXPO_ACCESS_TOKEN if you enable "Enhanced Security" for push
          // in expo.dev; without it Expo accepts unauthenticated sends.
          ...(Deno.env.get('EXPO_ACCESS_TOKEN')
            ? { authorization: `Bearer ${Deno.env.get('EXPO_ACCESS_TOKEN')}` }
            : {}),
        },
        body: JSON.stringify(message),
      });

      const out = await res.json();
      const ticket = out?.data;
      const err = ticket?.details?.error || out?.errors?.[0]?.code;

      // ---- 4. self-clean: stop sending to uninstalled apps ---------------
      if (err === 'DeviceNotRegistered') {
        await db(`check_in_preferences?user_id=eq.${userId}`, {
          method: 'PATCH',
          headers: { prefer: 'return=minimal' },
          body: JSON.stringify({ expo_push_token: null }),
        }).catch(() => {});
        results.push({ kind, cleared: 'device-not-registered' });
        continue;
      }

      results.push({ kind, sent: ticket?.status === 'ok', error: err ?? null });
    } catch (e) {
      results.push({ kind, skipped: 'expo-request-failed', detail: String(e) });
    }
  }

  // Always 200. A trigger that sees a 500 will retry or log noise, and a failed
  // push is never worth disturbing the write that produced it.
  return json({ ok: true, handled: results.length, results });
});
