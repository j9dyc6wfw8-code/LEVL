// LEVL — FriendsScreen (Phase 6): the complete social hub.
//
// Sections, top to bottom:
//   1. Search + add players by username
//   2. Incoming friend requests (accept / decline)
//   3. Your friends, each showing level, rank, streak, weekly XP, last-active
//   4. Tap a friend -> profile sheet with their recent activity
//
// The whole screen degrades cleanly: if the backend isn't configured or you're
// playing as a guest, it shows a friendly "sign in to add friends" state rather
// than erroring.

import React, { useState, useMemo } from 'react';
// summarizeWorkouts / byExercise are no longer imported: the hook returns them
// already memoised, so calling them here would reintroduce the per-render walk
// over 100 rows that made this sheet lag.
import useFriendProfile from '../hooks/useFriendProfile';
import { View, Pressable, ScrollView } from 'react-native';
import { Text, TextInput } from '../components/Text';
import { C, s, T, RADIUS, TOUCH, MONO } from '../theme';
import { MiniHunter } from '../components/Hunter';
import { HunterShowcase } from '../components/LoadoutCard';
import { DEFAULT_DATA } from '../engine/engine';
import { Card, ChunkyBtn, EmptyState, Sheet } from '../components/ui';
import { isConfigured } from '../services/supabase/client';

// "2h ago" style relative time from an ISO string.
function ago(iso) {
  if (!iso) return '';
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'now';
  if (s < 3600) return Math.floor(s / 60) + 'm';
  if (s < 86400) return Math.floor(s / 3600) + 'h';
  return Math.floor(s / 86400) + 'd';
}

// Online = active in the last 5 minutes.
const isOnline = (iso) => iso && (Date.now() - new Date(iso).getTime()) < 5 * 60 * 1000;

/* Presence as one phrase. ago() returns '' when there is no timestamp, which
   rendered — and announced — as "Active  ago". */
const presence = (iso) => {
  if (!iso) return 'Never active';
  if (isOnline(iso)) return 'Online';
  const a = ago(iso);
  return a ? 'Active ' + a + ' ago' : 'Never active';
};

// Everyone's actual character, not a letter in a circle. The duel screen has
// always drawn the real model; the rest of the app fell back to an initial even
// though the avatar was being synced the whole time. Falls back to the letter
// only when a profile genuinely has no avatar (old rows, or a failed sync).
function Avatar({ profile, size = 40 }) {
  const av = profile && profile.avatar;
  const hasAvatar = av && typeof av === 'object' && Object.keys(av).length > 0;

  if (hasAvatar) {
    return (
      <View style={{
        width: size, height: size, borderRadius: size / 2, backgroundColor: C.panel3,
        alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.line,
        overflow: 'hidden',
      }}>
        <MiniHunter avatar={{ ...DEFAULT_DATA.avatar, ...av }} tierColor={C.gold} size={size * 0.86} />
      </View>
    );
  }

  const initial = ((profile && (profile.display_name || profile.username)) || '?').charAt(0).toUpperCase();
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2, backgroundColor: C.panel3,
      alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.line,
    }}>
      <Text style={{ color: C.gold, fontWeight: '800', fontSize: size * 0.42 }}>{initial}</Text>
    </View>
  );
}

/* Every actionable control in this screen acts ON A PERSON, so every label has
 * to name them. "Accept" repeated down a list of five requests is unusable with
 * VoiceOver — you cannot tell which row you are on. */
const nameOf = (p) => (p && (p.display_name || p.username)) || 'this player';

function StatPill({ label, value, tint }) {
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <Text style={{ ...T.caption, color: tint || C.text, fontWeight: '700' }}>{value}</Text>
      <Text style={{ ...T.micro, color: C.dim, marginTop: 1 }}>{label}</Text>
    </View>
  );
}

export default function FriendsScreen({ fr, duels, onChallenge, onOpenDuel, initialUserId, onOpenArchive }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  // Build 28: tapping a name in the Social feed opens this screen straight onto
  // that person's profile sheet, rather than dropping you on a friend list to
  // go looking for them.
  const [viewingId, setViewingId] = useState(initialUserId || null);
  const [added, setAdded] = useState({});               // userId -> true after request sent

  // Not configured / guest: friendly gate, no error.
  if (!isConfigured || !fr || !fr.available) {
    return (
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <EmptyState
          title="Friends need an account"
          body="Sign in to add friends and challenge them to duels."
        />
      </ScrollView>
    );
  }

  const runSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    const r = await fr.search(query.trim());
    setResults(r);
    setSearching(false);
  };

  const doAdd = async (id) => {
    const okAdd = await fr.add(id);
    if (okAdd) setAdded((m) => ({ ...m, [id]: true }));
  };

  /* Is this request's answer in flight? Tolerates a caller that does not supply
   * isPending rather than throwing — this screen takes `fr` as a prop, so a
   * missing helper is a caller's omission and must not blank the whole screen.
   * The render sweep caught precisely that, which is what it is for. */
  const answering = (id) => !!(fr.isPending && fr.isPending(id));

  // Opens the live profile sheet. The sheet subscribes to Realtime itself, so
  // their stats and sessions keep updating while it's open.
  const openProfile = (id) => setViewingId(id);

  // Duel countdown -> "3d left" / "5h left"
  const dLeft = (end) => {
    if (!end) return '';
    const ms = new Date(end).getTime() - Date.now();
    if (ms <= 0) return 'ending';
    const d = Math.floor(ms / 86400000);
    if (d >= 1) return d + 'd left';
    return Math.floor(ms / 3600000) + 'h left';
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
      {/* visible error banner — the friend-request bug was invisible because a
          failed query just showed a blank list. Now a failure says so. */}
      {fr.error ? (
        <View style={{ backgroundColor: C.redSoft, borderWidth: 1, borderColor: C.red, borderRadius: RADIUS.md, padding: 12, marginBottom: 12 }}>
          <Text style={{ ...T.caption, color: C.red, fontWeight: '700' }}>Couldn't load friends</Text>
          <Text style={{ ...T.micro, color: C.mut, marginTop: 4 }}>{String(fr.error)}</Text>
          <Pressable onPress={fr.refresh} hitSlop={6} style={{ marginTop: 8 }}
            accessibilityRole="button" accessibilityLabel="Retry loading friends">
            <Text style={{ ...T.caption, color: C.gold, fontWeight: '700' }}>Tap to retry</Text>
          </Pressable>
        </View>
      ) : null}

      {duels && duels.error ? (
        <View style={{ backgroundColor: C.redSoft, borderWidth: 1, borderColor: C.red, borderRadius: RADIUS.md, padding: 12, marginBottom: 12 }}>
          <Text style={{ ...T.footnote, color: C.red, fontWeight: '700' }}>Duel needs attention.</Text>
          <Text style={{ ...T.caption, color: C.mut, marginTop: 4 }}>{String(duels.error)}</Text>
          <Pressable onPress={duels.refresh} hitSlop={6} style={{ marginTop: 8 }}
            accessibilityRole="button" accessibilityLabel="Retry loading duels">
            <Text style={{ ...T.caption, color: C.gold, fontWeight: '700' }}>Try again</Text>
          </Pressable>
        </View>
      ) : null}

      {duels && duels.active && duels.active[0] ? (() => {
        const active = duels.active[0];
        return (
          <Pressable onPress={onOpenDuel} accessibilityRole="button" accessibilityLabel="Open active duel">
            <Card style={{ borderWidth: 1, borderColor: C.green }}>
              <View style={s.between}>
                <Text style={[s.label, { color: duels.live ? C.green : C.gold }]}>ACTIVE DUEL</Text>
                <Text style={{ ...T.micro, color: duels.live ? C.green : C.mut }}>{duels.live ? 'LIVE' : 'SYNCING'}</Text>
              </View>
              <View style={[s.row, { alignItems: 'center', marginTop: 8 }]}>
                <Avatar profile={active.opponent} />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text numberOfLines={1} style={{ ...T.callout, fontWeight: '600', color: C.text }}>{active.opponent.display_name || active.opponent.username || 'Rival'}</Text>
                  <Text style={{ ...T.caption, color: C.mut, marginTop: 2 }}>Tap for workouts and weights.</Text>
                </View>
                <Text style={{ ...T.callout, fontWeight: '600', color: active.myScore >= active.theirScore ? C.green : C.red, fontVariant: ['tabular-nums'] }}>
                  {active.myScore || 0}–{active.theirScore || 0}
                </Text>
                <Text style={{ ...T.title2, color: C.gold, marginLeft: 8 }}>›</Text>
              </View>
            </Card>
          </Pressable>
        );
      })() : null}

      {/* incoming duel challenges — highest priority, top of screen */}
      {duels && duels.incoming.length > 0 && (
        <Card style={{ borderWidth: 1, borderColor: C.gold }}>
          <Text style={[s.label, { color: C.gold }]}>Duel challenges ({duels.incoming.length})</Text>
          {duels.busy && (
            <Text style={{ ...T.footnote, color: C.orange, marginTop: 7, fontWeight: '700' }}>
              Finish your current duel first.
            </Text>
          )}
          {duels.incoming.map((d) => (
            <View key={d.id} style={[s.row, { marginTop: 12, alignItems: 'center' }]}>
              <Avatar profile={d.opponent} />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text numberOfLines={1} style={{ ...T.footnote, color: C.text, fontWeight: '700' }}>
                  {d.opponent.display_name || d.opponent.username}
                </Text>
                <Text style={{ ...T.caption, color: C.dim }}>challenges you · {d.reward} coins</Text>
              </View>
              <Pressable disabled={duels.busy} onPress={() => duels.accept(d.id)} hitSlop={6}
                accessibilityRole="button"
                accessibilityState={{ disabled: !!duels.busy }}
                accessibilityLabel={'Accept duel from ' + nameOf(d.opponent)}
                accessibilityHint={duels.busy ? 'Unavailable while another duel is active' : undefined}
                style={{ minHeight: 36, paddingHorizontal: 14, borderRadius: RADIUS.pill, backgroundColor: duels.busy ? C.panel2 : C.goldSoft, borderWidth: 1, borderColor: duels.busy ? C.line : C.gold, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ ...T.caption, fontWeight: '700', color: duels.busy ? C.dim : C.gold }}>Accept</Text>
              </Pressable>
              {/* The label is spelled out because the glyph is a ✕: VoiceOver
                  reads that as "multiplication sign", or skips it entirely. */}
              <Pressable onPress={() => duels.decline(d.id)} hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel={'Decline duel from ' + nameOf(d.opponent)}
                style={{ minHeight: 36, paddingHorizontal: 12, marginLeft: 6, borderRadius: RADIUS.pill, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ ...T.caption, fontWeight: '700', color: C.dim }}>✕</Text>
              </Pressable>
            </View>
          ))}
        </Card>
      )}

      {duels && duels.past && duels.past.length > 0 ? (
        <Card>
          <View style={s.between}>
            <Text style={s.label}>DUEL RECORD</Text>
            <Text style={{ ...T.callout, fontWeight: '600', color: C.text, fontVariant: ['tabular-nums'] }}>
              <Text style={{ color: C.green }}>{duels.wins}W</Text>
              {'  '}
              <Text style={{ color: C.red }}>{duels.losses}L</Text>
              {'  '}
              <Text style={{ color: C.gold }}>{duels.past.filter((d) => !d.winner).length}D</Text>
            </Text>
          </View>
          {duels.past.slice(0, 3).map((d, index) => {
            const result = !d.winner ? 'DRAW' : d.winner === (d.iAmOne ? d.player_one : d.player_two) ? 'WIN' : 'LOSS';
            const color = result === 'WIN' ? C.green : result === 'LOSS' ? C.red : C.gold;
            return (
              <View key={d.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 9, borderTopWidth: index === 0 ? 0 : 1, borderTopColor: C.line }}>
                <Text style={{ ...T.micro, color, fontWeight: '800', width: 42 }}>{result}</Text>
                <Text numberOfLines={1} style={{ ...T.footnote, color: C.text, fontWeight: '700', flex: 1 }}>
                  {d.opponent.display_name || d.opponent.username || 'Rival'}
                </Text>
                <Text style={{ ...T.caption, color: C.mut, fontVariant: ['tabular-nums'] }}>{d.myScore || 0}–{d.theirScore || 0}</Text>
              </View>
            );
          })}
        </Card>
      ) : null}

      {/* search + add */}
      <Card>
        <Text style={s.label}>Add friends</Text>
        <View style={[s.row, { marginTop: 8 }]}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={runSearch}
            placeholder="Search username"
            placeholderTextColor={C.dim}
            autoCapitalize="none"
            style={[s.input, { flex: 1, marginBottom: 0 }]}
          />
          <Pressable onPress={runSearch} hitSlop={6}
            accessibilityRole="button" accessibilityLabel="Search for this username"
            style={{ marginLeft: 8, minHeight: TOUCH, paddingHorizontal: 16, borderRadius: RADIUS.md, backgroundColor: C.goldSoft, borderWidth: 1, borderColor: C.gold, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: C.gold, fontWeight: '700' }}>Find</Text>
          </Pressable>
        </View>

        {searching ? <Text style={{ ...T.caption, color: C.dim, marginTop: 12 }}>Searching…</Text> : null}

        {results.map((p) => (
          <View key={p.id} style={[s.row, { marginTop: 12, alignItems: 'center' }]}>
            <Avatar profile={p} />
            <Pressable onPress={() => openProfile(p.id)} style={{ flex: 1, marginLeft: 10 }}
              accessibilityRole="button"
              accessibilityLabel={'Open ' + nameOf(p) + "'s profile"}>
              <Text numberOfLines={1} style={{ ...T.footnote, color: C.text, fontWeight: '700' }}>{p.display_name || p.username}</Text>
              <Text numberOfLines={1} style={{ ...T.caption, color: C.dim }}>@{p.username} · Lv {p.level} · {p.rank}</Text>
            </Pressable>
            <Pressable
              disabled={!!added[p.id]}
              onPress={() => doAdd(p.id)}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityState={{ disabled: !!added[p.id] }}
              accessibilityLabel={added[p.id]
                ? 'Friend request already sent to ' + nameOf(p)
                : 'Send a friend request to ' + nameOf(p)}
              style={{ minHeight: 36, paddingHorizontal: 14, borderRadius: RADIUS.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: added[p.id] ? C.panel2 : C.greenSoft, borderWidth: 1, borderColor: added[p.id] ? C.line : C.green }}>
              <Text style={{ ...T.caption, fontWeight: '700', color: added[p.id] ? C.dim : C.green }}>
                {added[p.id] ? 'Sent' : 'Add'}
              </Text>
            </Pressable>
          </View>
        ))}
      </Card>

      {/* incoming requests */}
      {fr.requests.length > 0 && (
        <Card>
          <Text style={s.label}>Requests ({fr.requests.length})</Text>
          {fr.requests.map((req) => (
            <View key={req.senderId} style={[s.row, { marginTop: 12, alignItems: 'center' }]}>
              <Avatar profile={req.profile} />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text numberOfLines={1} style={{ ...T.footnote, color: C.text, fontWeight: '700' }}>
                  {(req.profile && (req.profile.display_name || req.profile.username)) || 'Player'}
                </Text>
                <Text style={{ ...T.caption, color: C.dim }}>
                  {req.profile ? `Lv ${req.profile.level} · ${req.profile.rank}` : 'wants to be friends'}
                </Text>
              </View>
              {/* Disabled while the answer is in flight. Without this a second
                  tap hits accept_friend_request() again, finds nothing pending
                  because the first call already accepted it, and shows an error
                  for something that worked. */}
              <Pressable onPress={() => fr.accept(req.senderId)} hitSlop={6}
                disabled={answering(req.senderId)}
                accessibilityRole="button"
                accessibilityLabel={'Accept friend request from ' + nameOf(req.profile)}
                accessibilityState={{ disabled: answering(req.senderId), busy: answering(req.senderId) }}
                style={{ minHeight: 36, paddingHorizontal: 14, borderRadius: RADIUS.pill, backgroundColor: C.greenSoft, borderWidth: 1, borderColor: C.green, alignItems: 'center', justifyContent: 'center', opacity: answering(req.senderId) ? 0.5 : 1 }}>
                <Text style={{ ...T.caption, fontWeight: '700', color: C.green }}>
                  {answering(req.senderId) ? 'Adding…' : 'Accept'}
                </Text>
              </Pressable>
              <Pressable onPress={() => fr.decline(req.senderId)} hitSlop={6}
                disabled={answering(req.senderId)}
                accessibilityRole="button"
                accessibilityLabel={'Decline friend request from ' + nameOf(req.profile)}
                accessibilityState={{ disabled: answering(req.senderId) }}
                style={{ minHeight: 36, paddingHorizontal: 12, marginLeft: 6, borderRadius: RADIUS.pill, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center', opacity: answering(req.senderId) ? 0.5 : 1 }}>
                <Text style={{ ...T.caption, fontWeight: '700', color: C.dim }}>✕</Text>
              </Pressable>
            </View>
          ))}
        </Card>
      )}

      {/* friend list */}
      <Card>
        <Text style={s.label}>Friends ({fr.friends.length})</Text>
        {fr.friends.length === 0 ? (
          <Text style={{ ...T.caption, color: C.dim, marginTop: 10 }}>
            No friends yet. Search a username above to add your first.
          </Text>
        ) : fr.friends.map((f) => (
          /* The row opens a profile and CONTAINS a Duel button. Without an
             explicit label the row swallows its children and VoiceOver reads the
             whole card as one long string; with one, the row and the button are
             two clear targets. */
          <Pressable key={f.id} onPress={() => openProfile(f.id)} style={{ marginTop: 14 }}
            accessibilityRole="button"
            accessibilityLabel={nameOf(f) + "'s profile"}
            accessibilityValue={{ text: 'Level ' + (f.level || 1) + ', ' + (f.rank || 'unranked')
              + ', ' + presence(f.last_active).toLowerCase() }}>
            <View style={[s.row, { alignItems: 'center' }]}>
              <View>
                <Avatar profile={f} />
                {isOnline(f.last_active) && (
                  <View style={{ position: 'absolute', right: -1, bottom: -1, width: 12, height: 12, borderRadius: 6, backgroundColor: C.green, borderWidth: 2, borderColor: C.panel }} />
                )}
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text numberOfLines={1} style={{ ...T.footnote, color: C.text, fontWeight: '700' }}>{f.display_name || f.username}</Text>
                <Text style={{ ...T.caption, color: isOnline(f.last_active) ? C.green : C.dim }}>
                  {presence(f.last_active)}
                </Text>
              </View>
              {onChallenge && (
                <Pressable disabled={duels && duels.busy} onPress={() => onChallenge(f)} hitSlop={6}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: !!(duels && duels.busy) }}
                  accessibilityLabel={duels && duels.busy
                    ? 'Cannot challenge ' + nameOf(f) + ' — you already have an active duel'
                    : 'Challenge ' + nameOf(f) + ' to a duel'}
                  style={{ minHeight: 36, paddingHorizontal: 14, borderRadius: RADIUS.pill, backgroundColor: duels && duels.busy ? C.panel2 : C.goldSoft, borderWidth: 1, borderColor: duels && duels.busy ? C.line : C.gold, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ ...T.caption, fontWeight: '700', color: duels && duels.busy ? C.dim : C.gold }}>{duels && duels.busy ? 'Active' : 'Duel'}</Text>
                </Pressable>
              )}
            </View>
            <View style={[s.row, { marginTop: 10, backgroundColor: C.panel2, borderRadius: RADIUS.md, paddingVertical: 10 }]}>
              <StatPill label="LEVEL" value={f.level} />
              <StatPill label="RANK" value={f.rank} tint={C.gold} />
              <StatPill label="STREAK" value={f.streak || 0} tint={C.orange} />
              <StatPill label="WK XP" value={f.weekly_xp || 0} tint={C.green} />
            </View>
          </Pressable>
        ))}
      </Card>

      {/* activity feed — what friends have been doing lately */}
      {fr.feed && fr.feed.length > 0 && (
        <Card>
          <Text style={s.label}>Activity</Text>
          {fr.feed.slice(0, 20).map((ev) => {
            const who = (ev.actor && (ev.actor.display_name || ev.actor.username)) || 'A friend';
            const line = ev.is_pr
              ? `hit a ${ev.exercise} PR`
              : ev.duration
                ? `did ${ev.duration} min of ${ev.exercise || 'cardio'}`
                : `trained ${ev.exercise || 'a lift'}`;
            return (
              <View key={ev.id} style={[s.row, { marginTop: 12, alignItems: 'center' }]}>
                <Avatar profile={ev.actor} size={32} />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={{ ...T.caption, color: C.text }}>
                    <Text style={{ fontWeight: '700' }}>{who}</Text>
                    <Text style={{ color: C.mut }}> {line}</Text>
                    {ev.is_pr ? <Text style={{ color: C.gold, fontWeight: '700' }}> · PR</Text> : null}
                  </Text>
                  <Text style={{ ...T.micro, color: C.dim }}>{ago(ev.date)} ago · +{ev.xp_earned} XP</Text>
                </View>
              </View>
            );
          })}
        </Card>
      )}

      {/* profile viewer — live via useFriendProfile */}
      <Sheet visible={!!viewingId} onClose={() => setViewingId(null)}>
        <FriendProfileBody userId={viewingId} onClose={() => setViewingId(null)} />
      </Sheet>
    </ScrollView>
  );
}

/* ------------------------- live friend profile body -------------------------
 * Their stats and full training history, updating in realtime as they log.
 * Two views: a per-exercise rollup (what they actually train) and a recent
 * session list (what they did lately).
 */
const FriendProfileBody = React.memo(function FriendProfileBody({ userId, onClose }) {
  // Memoised on userId: this sheet lives inside FriendsScreen, whose `query`
  // state changes on every keystroke in the search box. Without React.memo the
  // whole profile — HunterShowcase included — re-rendered per character typed.
  const { profile, summary, exercises, recent, workouts, loading } = useFriendProfile(userId);
  // Recent lifts lead. "What have they been lifting" is the question people
  // open a profile to answer; the per-exercise rollup is the follow-up.
  const [mode, setMode] = useState('recent');   // 'recent' | 'exercises'

  // HunterShowcase renders the full vector HunterFigure. Its `avatar` prop was
  // an inline spread, so a NEW object identity was produced on every render and
  // the whole figure re-rendered even when nothing about them had changed.
  // (The figure's own bob/shimmer loops are useNativeDriver:true, so they run on
  // the UI thread and were never the problem — this was.)
  // Declared above the early returns: rules of hooks.
  const showcaseAvatar = useMemo(
    () => ({ ...DEFAULT_DATA.avatar, ...((profile && profile.avatar) || {}) }),
    [profile && profile.avatar],
  );
  const showcaseEquipped = useMemo(
    () => (profile && profile.character && profile.character.equipped) || DEFAULT_DATA.equipped,
    [profile && profile.character && profile.character.equipped],
  );

  if (!userId) return null;
  if (loading && !profile) {
    return <Text style={{ ...T.footnote, color: C.dim, padding: 20, textAlign: 'center' }}>Loading…</Text>;
  }
  if (!profile) {
    return (
      <View style={{ padding: 20 }}>
        <Text style={{ ...T.footnote, color: C.dim, textAlign: 'center' }}>Couldn't load this profile.</Text>
        <View style={{ marginTop: 16 }}><ChunkyBtn tone="slate" onPress={onClose}>CLOSE</ChunkyBtn></View>
      </View>
    );
  }

  // summary / exercises / recent now arrive pre-computed and memoised from the
  // hook. They used to be built here in the render body on every pass.
  const sum = summary;

  return (
    <View style={{ padding: 4 }}>
      {/* Small portrait + what they're wearing + what their stats mean. Kept
          deliberately plain: the point is to read someone's build in a glance,
          not to re-stage the whole character screen. */}
      <View style={{ paddingVertical: 8 }}>
        <HunterShowcase
          avatar={showcaseAvatar}
          equipped={showcaseEquipped}
          stats={profile.character && profile.character.stats}
          rank={profile.rank}
          name={profile.display_name}
          title={profile.character && profile.character.title}
          level={profile.level}
          username={profile.username}
          height={170}
        />
      </View>

      {/* ONE stat block, not two identical strips.
          Before: six numbers in two visually identical pill rows with no
          hierarchy, one of which ("SESSIONS") was counting sets. Now the headline
          number is their best lift — the thing you actually compare yourself
          against — and the rest is a labelled supporting row. */}
      <View style={{
        marginTop: 8, backgroundColor: C.panel2, borderRadius: RADIUS.md,
        borderWidth: 1, borderColor: C.lineSoft, padding: 14,
      }}>
        <View style={[s.between, { alignItems: 'flex-end' }]}>
          <View style={{ flex: 1 }}>
            <Text style={{ ...T.label, color: C.dim }}>BEST LIFT</Text>
            <Text style={{ ...T.display, fontWeight: '800', color: C.text, fontVariant: ['tabular-nums'], letterSpacing: -0.6 }}>
              {profile.best_e1rm
                ? Math.round(profile.best_e1rm) + ' ' + (sum.unit || 'kg')
                : sum.bestLift ? Math.round(sum.bestLift) + ' ' + (sum.unit || 'kg') : '—'}
            </Text>
            {(profile.best_lift_name || sum.bestName) ? (
              <Text style={{ ...T.micro, color: C.dim, marginTop: 1 }} numberOfLines={1}>
                {profile.best_lift_name || sum.bestName}
              </Text>
            ) : null}
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ ...T.label, color: C.dim }}>STREAK</Text>
            <Text style={{ fontSize: 26, fontWeight: '800', color: C.orange, fontVariant: ['tabular-nums'] }}>
              {(profile.streak || 0)}<Text style={{ ...T.subheadline, fontWeight: '800', color: C.mut }}>d</Text>
            </Text>
          </View>
        </View>

        <View style={[s.row, {
          marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: C.lineSoft,
        }]}>
          <StatPill label="SESSIONS" value={sum.sessions} />
          <StatPill label="SETS" value={sum.sets} />
          <StatPill label="DAYS" value={sum.days} />
          <StatPill label="PRs" value={sum.prs} tint={C.gold} />
        </View>
        <Text style={{ ...T.micro, color: C.faint, marginTop: 10 }}>
          Last {Math.min(workouts.length, 100)} logged sets
        </Text>
      </View>

      {/* view switch */}
      <View style={[s.row, { marginTop: 18 }]}>
        {[['recent', 'Recent lifts'], ['exercises', 'By exercise']].map(([k, label]) => (
          <Pressable key={k} onPress={() => setMode(k)} hitSlop={6}
            accessibilityRole="tab"
            accessibilityState={{ selected: mode === k }}
            accessibilityLabel={label}
            style={{
              flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: RADIUS.pill,
              backgroundColor: mode === k ? C.goldSoft : 'transparent',
              borderWidth: 1, borderColor: mode === k ? C.gold : C.line,
              marginRight: k === 'recent' ? 8 : 0,
            }}>
            <Text style={{ ...T.caption, fontWeight: '700', color: mode === k ? C.gold : C.dim }}>{label}</Text>
          </Pressable>
        ))}
      </View>

      {workouts.length === 0 ? (
        <Text style={{ ...T.caption, color: C.dim, marginTop: 14 }}>
          Nothing shared yet — their lifts appear here as soon as they log one.
        </Text>
      ) : mode === 'exercises' ? (
        exercises.map((e) => (
          <View key={e.name} style={[s.between, {
            marginTop: 10, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: C.lineSoft,
          }]}>
            <View style={{ flex: 1, marginRight: 10 }}>
              <Text style={{ ...T.footnote, color: C.text, fontWeight: '700' }} numberOfLines={1}>
                {e.name}
              </Text>
              <Text style={{ ...T.micro, color: C.dim, marginTop: 1 }}>
                {e.sets} set{e.sets > 1 ? 's' : ''}
                {e.prs ? <Text style={{ color: C.gold }}> · {e.prs} PR{e.prs > 1 ? 's' : ''}</Text> : null}
              </Text>
            </View>
            {/* Best weight is the number worth reading here, with its unit —
                it used to print bare, so kg and lb were indistinguishable. */}
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ ...T.footnote, color: C.text, fontWeight: '800', fontVariant: ['tabular-nums'] }}>
                {e.best ? Math.round(e.best) + ' ' + (e.unit || 'kg') : '—'}
              </Text>
              <Text style={{ ...T.micro, color: C.green, fontWeight: '700', fontVariant: ['tabular-nums'] }}>
                +{e.xp.toLocaleString()} XP
              </Text>
            </View>
          </View>
        ))
      ) : (
        recent.map((w, i) => (
          <View key={w.id || i} style={[s.between, {
            marginTop: 10, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: C.lineSoft,
          }]}>
            <View style={{ flex: 1, marginRight: 10 }}>
              <Text style={{ ...T.footnote, color: C.text, fontWeight: '700' }} numberOfLines={1}>
                {w.exercise}
                {w.isPR ? <Text style={{ color: C.gold, fontWeight: '800' }}>  PR</Text> : null}
              </Text>
              <Text style={{ ...T.micro, color: C.dim, marginTop: 1 }}>
                {ago(w.date)} ago{w.rpe ? ' · RPE ' + w.rpe : ''}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              {/* The actual lift, formatted like a lifter writes it. */}
              <Text style={{ ...T.footnote, color: C.text, fontWeight: '800', fontVariant: ['tabular-nums'] }}>
                {w.isLift
                  ? Math.round(w.weight) + ' ' + w.unit + ' × ' + w.reps
                  : w.duration ? w.duration + ' min' : '—'}
              </Text>
              <Text style={{ ...T.micro, color: C.green, fontWeight: '700', fontVariant: ['tabular-nums'] }}>
                +{w.xp.toLocaleString()} XP
              </Text>
            </View>
          </View>
        ))
      )}

      <View style={{ marginTop: 20 }}>
        <ChunkyBtn tone="slate" onPress={onClose}>CLOSE</ChunkyBtn>
      </View>
    </View>
  );
});
