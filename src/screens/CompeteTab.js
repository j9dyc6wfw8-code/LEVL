// ============================================================================
// LEVL — CompeteTab
//
// Everything competitive behind ONE control: DUELS · FRIENDS · LADDER · BOARDS.
//
// WHAT WAS WRONG
// Build 28 collapsed two bottom tabs into one segmented control and the header
// comment here claimed the nesting problem was solved. It was solved for Ranks
// only. Duels still carried its own identical gold pill control, so the Duels
// view showed two stacked segmented controls, and Boards showed three (this
// control, then Global/Friends, then Strongest/Consistent). Four taps of
// understanding before any content.
//
// Friends was the giveaway: it was a segment inside Duels AND a modal route
// (levl://friends). One destination, two doorways, neither obviously primary.
//
// WHAT THIS DOES
//   - One flat control. Friends is promoted to a peer, so nothing nests.
//   - The standing panel renders above the segment on EVERY view, which is what
//     the old comment promised and never delivered. On Duels in particular you
//     now pick a fight while looking at your own rank.
//   - The ladder field is computed once here and handed down, instead of
//     RanksTab and the standing card each deriving it.
//
// Route keys are unchanged ('duels' | 'friends' | 'ranks' | 'leaderboard') so
// every existing levl:// deep link still lands. Only the labels changed:
// "Ranks" and "Leaderboard" both read as leaderboards, which is why nobody
// could tell that one was practice bots and the other real players.
// ============================================================================

import React, { useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';
import { SPACING } from '../theme';
import { ScreenHeader, Segmented } from '../components/ui';
import StandingPanel from '../components/StandingPanel';
import DuelTab from './DuelTab';
import RanksTab from './RanksTab';
import FriendsScreen from './FriendsScreen';
import { isConfigured } from '../services/supabase/client';
import { BOTS, DEFAULT_DATA, tierForFR, divisionForFR } from '../engine/engine';
import haptics from '../services/haptics';

const HINTS = {
  duels:       'Duel a friend, or a challenger',
  friends:     'Your roster and open challenges',
  ranks:       'Practice ladder — seeded challengers',
  leaderboard: 'Real LEVL players',
};

export default function CompeteTab({
  data,
  dv,
  view,
  setView,
  userEmail,
  leaderboard,
  friends,
  friendDuels,
  startDuel,
  claimDuel,
  forfeitDuel,
  onChallengeFriend,
  onCreateInvite,
  onJoinByCode,
  duelsEnabled = true,
}) {
  // Breakdown state lives here so it survives switching segments — a player
  // who opened it to understand their rating should not have it snap shut.
  const [detail, setDetail] = useState(false);

  const segments = useMemo(() => {
    const base = [
      ['duels', 'Duels'],
      ['friends', 'Friends'],
      ['ranks', 'Ladder'],
    ];
    // The live board only exists with a backend, so the segment is hidden
    // rather than shown-and-empty when Supabase isn't configured.
    if (isConfigured) base.push(['leaderboard', 'Boards']);
    return base;
  }, []);

  const active = segments.some((sgm) => sgm[0] === view) ? view : 'duels';

  // NOTE: DuelTab carried a `focusFriendsSignal` prop that jumped to the Friends
  // segment when a friend-request notification was tapped. App.js never passed
  // it, so that effect had never once fired — dead since it was written. It is
  // not reproduced here. Friend-request notifications currently route through
  // levl://friends, which parseRoute sends to the Social tab's Friends modal.
  // If you want them landing on Compete > Friends instead, that is a one-line
  // change in routes.js, not a prop.

  const pick = useCallback((next) => {
    // No haptic here — Segmented fires the selection tick itself.
    setView(next);
    // Standings are fetched on demand: switching segments alone would not
    // remount the hook, so nothing would refresh without this.
    if (next === 'leaderboard' && leaderboard && leaderboard.reload) leaderboard.reload();
  }, [setView, leaderboard]);

  /* ---- the practice field, derived once for both the panel and the ladder --- */
  // Shaped exactly like a BOTS entry — tier and division included — so ladder
  // rows never need to special-case "is this the player or a challenger".
  const youEntry = useMemo(() => {
    const tier = tierForFR(dv.fr);
    return {
      name: data.name,
      avatar: data.avatar || DEFAULT_DATA.avatar,
      fr: dv.fr,
      tier,
      division: divisionForFR(dv.fr, tier),
      level: dv.level,
      title: dv.title,
      statLevels: (dv.statLevels || []).reduce((m, x) => { m[x.stat] = x.level; return m; }, {}),
      isYou: true,
    };
  }, [data.name, data.avatar, dv.fr, dv.level, dv.title, dv.statLevels]);

  const field = useMemo(() => {
    const arr = BOTS.slice();
    if (dv.placed) arr.push(youEntry);
    return arr.sort((a, b) => b.fr - a.fr);
  }, [dv.placed, youEntry]);

  const yourRank = dv.placed ? field.findIndex((e) => e.isYou) + 1 : null;

  return (
    <View>
      <ScreenHeader title="Compete" hint={HINTS[active]} />

      {/* Always visible. Your rank should never be more than zero taps away. */}
      <StandingPanel
        dv={dv}
        rank={yourRank}
        fieldSize={field.length}
        detail={detail}
        onToggleDetail={() => { haptics.selection(); setDetail((v) => !v); }}
      />

      <Segmented options={segments} value={active} onChange={pick} style={{ marginBottom: SPACING.md }} />

      {active === 'duels' ? (
        <DuelTab
          enabled={duelsEnabled}
          data={data}
          dv={dv}
          startDuel={startDuel}
          claimDuel={claimDuel}
          forfeitDuel={forfeitDuel}
          friendDuels={friendDuels}
          onCreateInvite={onCreateInvite}
          onJoinByCode={onJoinByCode}
        />
      ) : null}

      {active === 'friends' ? (
        <FriendsScreen
          fr={friends}
          duels={friendDuels}
          onChallenge={onChallengeFriend}
          onOpenDuel={() => pick('duels')}
        />
      ) : null}

      {active === 'ranks' || active === 'leaderboard' ? (
        <RanksTab
          data={data}
          dv={dv}
          userEmail={userEmail}
          leaderboard={leaderboard}
          view={active === 'leaderboard' ? 'global' : 'ladder'}
          field={field}
          yourRank={yourRank}
          youEntry={youEntry}
        />
      ) : null}
    </View>
  );
}
