// ============================================================================
// LEVL — CompeteTab
//
// Everything competitive in one destination: DUELS · RANKS · LEADERBOARD.
//
// Before Build 28 this was two bottom tabs that meant the same thing ("beat
// other people"), and the ladder screen had its OWN toggle sitting under the
// tab bar, so there were two controls to understand before you could read your
// own rank. Now there is one segmented control at the top of one tab, and the
// nested toggle is suppressed.
//
// A user should be able to answer "where do I stand?" in seconds, which is why
// your standing card renders above the segment content on every view.
// ============================================================================

import React, { useCallback } from 'react';
import { View, Text, Pressable } from 'react-native';
import { C, RADIUS, T } from '../theme';
import { ScreenHeader } from '../components/ui';
import DuelTab from './DuelTab';
import RanksTab from './RanksTab';
import { isConfigured } from '../services/supabase/client';
import haptics from '../services/haptics';

const HINTS = {
  duels: 'Duel a friend, or a challenger',
  ranks: 'Where you sit this season',
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
  focusFriendsSignal,
  onCreateInvite,
  onJoinByCode,
}) {
  // The live board only exists with a backend, so the third segment is hidden
  // rather than shown-and-empty when Supabase isn't configured.
  const segments = isConfigured
    ? [['duels', 'Duels'], ['ranks', 'Ranks'], ['leaderboard', 'Leaderboard']]
    : [['duels', 'Duels'], ['ranks', 'Ranks']];

  const pick = useCallback((next) => {
    haptics.selection();
    setView(next);
    // Standings are fetched on demand: switching segments alone would not
    // remount the hook, so nothing would refresh without this.
    if (next === 'leaderboard' && leaderboard && leaderboard.reload) leaderboard.reload();
  }, [setView, leaderboard]);

  const active = segments.some((sgm) => sgm[0] === view) ? view : 'duels';

  return (
    <View>
      <ScreenHeader title="Compete" hint={HINTS[active]} />

      <View style={{
        flexDirection: 'row', backgroundColor: C.panel2, borderRadius: RADIUS.md,
        padding: 4, marginBottom: 14, borderWidth: 1, borderColor: C.line,
      }}>
        {segments.map((sgm) => {
          const on = active === sgm[0];
          return (
            <Pressable
              key={sgm[0]}
              onPress={() => pick(sgm[0])}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              accessibilityLabel={sgm[1]}
              style={{
                flex: 1, minHeight: 40, borderRadius: 9,
                alignItems: 'center', justifyContent: 'center',
                backgroundColor: on ? C.gold : 'transparent',
              }}>
              <Text style={{ ...T.footnote, fontWeight: '600', color: on ? C.ink : C.mut }}>
                {sgm[1]}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {active === 'duels' ? (
        <DuelTab
          data={data}
          dv={dv}
          startDuel={startDuel}
          claimDuel={claimDuel}
          forfeitDuel={forfeitDuel}
          friends={friends}
          friendDuels={friendDuels}
          onChallengeFriend={onChallengeFriend}
          focusFriendsSignal={focusFriendsSignal}
          onCreateInvite={onCreateInvite}
          onJoinByCode={onJoinByCode}
        />
      ) : (
        <RanksTab
          data={data}
          dv={dv}
          userEmail={userEmail}
          leaderboard={leaderboard}
          view={active === 'leaderboard' ? 'global' : 'ladder'}
        />
      )}
    </View>
  );
}
