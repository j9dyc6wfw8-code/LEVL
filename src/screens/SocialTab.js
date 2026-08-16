// ============================================================================
// LEVL — SocialTab
//
// The feed. Structure, top to bottom:
//
//   Social            + friends (badge) + activity
//   [ today's Check In status ]
//   Friends | Discover
//   [ feed ]
//
// It is a FlatList rather than a ScrollView because the cards carry
// photographs: virtualisation is what keeps memory flat as the feed grows, and
// `removeClippedSubviews` lets expo-image release decoded bitmaps for cards
// that scroll away. A forty-card ScrollView of 4:5 images is how a feed starts
// dropping frames on real phones.
//
// Friends is the default and stays the default. Discover exists, but it is the
// second tab and it never takes over — LEVL is a friends-first product.
// ============================================================================

import React, { useCallback, useMemo, useState } from 'react';
import {
  View, Text, Pressable, FlatList, RefreshControl,
  ActivityIndicator, Alert, ActionSheetIOS, Platform,
} from 'react-native';
import { C, RADIUS, SPACING, T, TOUCH } from '../theme';
import CheckInCard from '../components/social/CheckInCard';
import CheckInPrompt from '../components/social/CheckInPrompt';
import FeedSkeleton from '../components/social/FeedSkeleton';
import CommentSheet from '../components/social/CommentSheet';
import SFIcon from '../components/SFIcon';
import { useCheckInComments } from '../hooks/useCheckInComments';
import { REPORT_REASONS, reportContent, blockUser } from '../services/supabase/checkInService';
import haptics from '../services/haptics';

const SCOPES = [
  { key: 'friends', label: 'Friends' },
  { key: 'public', label: 'Discover' },
];

export default function SocialTab({
  user,
  me,
  feed,
  scope,
  setScope,
  checkIn,
  prefsWindowText,
  publicDiscovery,
  unit,
  sessionsToday,
  onOpenCamera,
  onOpenFriends,
  onOpenActivity,
  onOpenProfile,
  onAttachWorkout,
  onSignIn,
  onOpenIntro,
  unreadCount,
  pendingRequests,
}) {
  const [commentsFor, setCommentsFor] = useState(null);
  const comments = useCheckInComments(commentsFor && commentsFor.id, !!commentsFor);

  /* ------------------------------ post menu ------------------------------ */

  const runReport = useCallback((item) => {
    const ask = (reason) => async () => {
      await reportContent({
        targetType: 'check_in',
        targetId: item.id,
        targetUser: item.userId,
        reason,
      });
      Alert.alert('Reported', 'Thanks — the LEVL team will take a look.');
    };
    Alert.alert('Report this Check In', 'Reports are reviewed by the LEVL team.', [
      ...REPORT_REASONS.map((r) => ({ text: r.label, onPress: ask(r.key) })),
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, []);

  const runBlock = useCallback((item) => {
    Alert.alert(
      `Block ${item.author.displayName}?`,
      "You won't see each other's Check Ins, and neither of you can react or comment. This also removes you as friends.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            const res = await blockUser(item.userId);
            if (res && res.error) {
              Alert.alert('Could not block', res.error.message || 'Try again in a moment.');
              return;
            }
            haptics.success();
            feed.hideUser(item.userId);
          },
        },
      ],
    );
  }, [feed]);

  const runDelete = useCallback((item) => {
    Alert.alert(
      'Delete this Check In?',
      'The photos are removed for everyone. Your workout is not affected, and today\'s XP stays spent — reposting will not earn it again.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const res = await feed.remove(item.id);
            if (res && res.error) {
              Alert.alert('Could not delete', res.error.message || 'Try again in a moment.');
              return;
            }
            haptics.success();
            checkIn.reload();
          },
        },
      ],
    );
  }, [feed, checkIn]);

  const openMenu = useCallback((item) => {
    const mine = item.userId === me;
    haptics.selection();

    const actions = mine
      ? [
          { label: 'Delete Check In', destructive: true, run: () => runDelete(item) },
          {
            label: item.visibility === 'public' ? 'Change to Friends only' : 'Change to Public',
            run: async () => {
              await checkIn.setVisibility(item.visibility === 'public' ? 'friends' : 'public');
              feed.refresh();
            },
          },
        ]
      : [
          { label: 'Report', run: () => runReport(item) },
          { label: `Block ${item.author.displayName}`, destructive: true, run: () => runBlock(item) },
        ];

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: [...actions.map((a) => a.label), 'Cancel'],
          cancelButtonIndex: actions.length,
          destructiveButtonIndex: actions.findIndex((a) => a.destructive),
          userInterfaceStyle: 'dark',
        },
        (index) => { if (index < actions.length) actions[index].run(); },
      );
      return;
    }
    Alert.alert('Check In', null, [
      ...actions.map((a) => ({ text: a.label, style: a.destructive ? 'destructive' : 'default', onPress: a.run })),
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, [me, runDelete, runReport, runBlock, checkIn, feed]);

  /* -------------------------------- header -------------------------------- */

  const header = useMemo(() => (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.xl }}>
        <Text style={{ ...T.title1, color: C.text, flex: 1 }}>Social</Text>

        <IconButton
          label="Friends and requests"
          badge={pendingRequests}
          onPress={onOpenFriends}
          glyph="people"
        />
        <View style={{ width: 8 }} />
        <IconButton
          label="Activity"
          badge={unreadCount}
          onPress={onOpenActivity}
          glyph="bell"
        />
      </View>

      <CheckInPrompt
        signedIn={!!user}
        hasCheckedIn={checkIn.hasCheckedIn}
        verified={checkIn.verified}
        pending={checkIn.pending}
        posting={checkIn.posting}
        windowText={prefsWindowText}
        hasWorkoutToday={(sessionsToday || []).length > 0}
        onCheckIn={onOpenCamera}
        onRetry={checkIn.retry}
        onDiscard={checkIn.discardPending}
        onAttachWorkout={onAttachWorkout}
        onSignIn={onSignIn}
      />

      {user ? (
        <View style={{
          flexDirection: 'row', backgroundColor: C.panel2, borderRadius: RADIUS.md,
          padding: 4, marginBottom: SPACING.xl, borderWidth: 1, borderColor: C.line,
        }}>
          {SCOPES.map((s) => {
            const on = scope === s.key;
            // Discover is hidden entirely for anyone who has opted out of public
            // discovery — offering a feed they have chosen not to take part in
            // would be odd.
            if (s.key === 'public' && publicDiscovery === false) return null;
            return (
              <Pressable
                key={s.key}
                onPress={() => { haptics.selection(); setScope(s.key); }}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                accessibilityLabel={s.label}
                style={{
                  flex: 1, minHeight: 38, borderRadius: 9,
                  alignItems: 'center', justifyContent: 'center',
                  backgroundColor: on ? C.gold : 'transparent',
                }}>
                <Text style={{ ...T.footnote, fontWeight: '600', color: on ? C.ink : C.mut }}>
                  {s.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  ), [
    user, checkIn, prefsWindowText, sessionsToday, scope, publicDiscovery,
    onOpenCamera, onOpenFriends, onOpenActivity, onAttachWorkout, onSignIn,
    setScope, unreadCount, pendingRequests,
  ]);

  /* ------------------------------- rendering ------------------------------ */

  const renderItem = useCallback(({ item }) => (
    <CheckInCard
      item={item}
      photos={feed.photos}
      unit={unit}
      isMine={item.userId === me}
      onReact={feed.react}
      onComments={setCommentsFor}
      onProfile={onOpenProfile}
      onMenu={openMenu}
    />
  ), [feed.photos, feed.react, unit, me, onOpenProfile, openMenu]);

  const empty = useMemo(() => {
    if (feed.loading) return <FeedSkeleton count={2} />;
    if (feed.error) {
      return (
        <ErrorState
          message={feed.error}
          onRetry={feed.refresh}
        />
      );
    }
    if (!user) return null;
    return (
      <EmptyFeed
        scope={scope}
        onCheckIn={onOpenCamera}
        onFindFriends={onOpenFriends}
        onExplore={publicDiscovery === false ? null : () => setScope('public')}
        onLearnMore={onOpenIntro}
      />
    );
  }, [feed.loading, feed.error, feed.refresh, user, scope, onOpenCamera, onOpenFriends, publicDiscovery, setScope, onOpenIntro]);

  return (
    <>
      <FlatList
        data={feed.items}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        contentContainerStyle={{ padding: SPACING.lg, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={feed.refreshing}
            onRefresh={feed.refresh}
            tintColor={C.gold}
          />
        }
        onEndReached={feed.loadMore}
        onEndReachedThreshold={0.6}
        ListFooterComponent={
          feed.loadingMore
            ? <View style={{ paddingVertical: 24 }}><ActivityIndicator color={C.dim} /></View>
            : null
        }
        // Photo-heavy list settings. These are the difference between a feed
        // that stays smooth on an iPhone 12 and one that stutters.
        removeClippedSubviews
        initialNumToRender={3}
        maxToRenderPerBatch={4}
        windowSize={7}
        updateCellsBatchingPeriod={60}
      />

      <CommentSheet
        visible={!!commentsFor}
        onClose={() => setCommentsFor(null)}
        comments={comments.comments}
        loading={comments.loading}
        sending={comments.sending}
        me={comments.me}
        postOwnerId={commentsFor && commentsFor.userId}
        onAdd={comments.add}
        onDelete={comments.remove}
        onReport={comments.report}
      />
    </>
  );
}

/* ------------------------------------------------------------------------- */

function IconButton({ label, badge, onPress, glyph }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={badge > 0 ? `${label}, ${badge} new` : label}
      style={{
        width: 38, height: 38, borderRadius: 19,
        backgroundColor: C.panel2, borderWidth: 1, borderColor: C.line,
        alignItems: 'center', justifyContent: 'center',
      }}>
      <SFIcon
        name={glyph === 'people' ? 'person.2.fill' : 'bell.fill'}
        size={17}
        color={badge > 0 ? C.gold : C.mut}
      />
      {badge > 0 ? (
        <View style={{
          position: 'absolute', top: -2, right: -2, minWidth: 17, height: 17,
          borderRadius: 9, paddingHorizontal: 4,
          backgroundColor: C.red, borderWidth: 1.5, borderColor: C.bg,
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Text style={{ ...T.caption2, ...T.numeric, fontWeight: '700', color: '#fff' }}>
            {badge > 9 ? '9+' : badge}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

function EmptyFeed({ scope, onCheckIn, onFindFriends, onExplore, onLearnMore }) {
  const isFriends = scope === 'friends';
  return (
    <View style={{ paddingTop: SPACING.xxl, alignItems: 'center' }}>
      <Text style={{ ...T.title3, color: C.text, textAlign: 'center' }}>
        {isFriends ? 'Your feed is quiet' : 'Nothing public yet'}
      </Text>
      <Text style={{
        ...T.subheadline, color: C.mut, textAlign: 'center',
        marginTop: 6, lineHeight: 21, paddingHorizontal: SPACING.lg,
      }}>
        {isFriends
          ? 'Add friends, or post today’s Check In and start it off.'
          : 'Public Check Ins from other LEVL hunters will appear here.'}
      </Text>

      <View style={{ marginTop: SPACING.xxl, alignSelf: 'stretch', paddingHorizontal: SPACING.md }}>
        <Pressable
          onPress={onCheckIn}
          accessibilityRole="button"
          style={{
            minHeight: TOUCH + 4, borderRadius: RADIUS.md, backgroundColor: C.gold,
            alignItems: 'center', justifyContent: 'center',
          }}>
          <Text style={{ ...T.footnote, fontWeight: '700', color: C.ink, letterSpacing: 0.4 }}>
            CHECK IN
          </Text>
        </Pressable>

        {isFriends ? (
          <Pressable
            onPress={onFindFriends}
            accessibilityRole="button"
            style={{
              minHeight: TOUCH + 4, borderRadius: RADIUS.md, marginTop: 10,
              backgroundColor: C.panel2, borderWidth: 1, borderColor: C.line,
              alignItems: 'center', justifyContent: 'center',
            }}>
            <Text style={{ ...T.footnote, fontWeight: '700', color: C.mut, letterSpacing: 0.4 }}>
              FIND FRIENDS
            </Text>
          </Pressable>
        ) : null}

        {isFriends && onExplore ? (
          <Pressable
            onPress={onExplore}
            accessibilityRole="button"
            style={{ minHeight: TOUCH, alignItems: 'center', justifyContent: 'center', marginTop: 6 }}>
            <Text style={{ ...T.footnote, color: C.dim }}>See what LEVL is training</Text>
          </Pressable>
        ) : null}

        <Pressable
          onPress={onLearnMore}
          accessibilityRole="button"
          style={{ minHeight: TOUCH, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ ...T.footnote, color: C.faint }}>How Check In works</Text>
        </Pressable>
      </View>
    </View>
  );
}

function ErrorState({ message, onRetry }) {
  return (
    <View style={{ paddingTop: SPACING.xxl, alignItems: 'center' }}>
      <Text style={{ ...T.headline, color: C.text }}>Could not load the feed</Text>
      <Text style={{
        ...T.footnote, color: C.mut, marginTop: 5, textAlign: 'center',
        paddingHorizontal: SPACING.lg, lineHeight: 18,
      }}>
        {message}
      </Text>
      <Pressable
        onPress={onRetry}
        accessibilityRole="button"
        style={{
          marginTop: SPACING.lg, minHeight: TOUCH, paddingHorizontal: 22,
          borderRadius: RADIUS.md, backgroundColor: C.panel2,
          borderWidth: 1, borderColor: C.line,
          alignItems: 'center', justifyContent: 'center',
        }}>
        <Text style={{ ...T.footnote, fontWeight: '600', color: C.mut }}>Try again</Text>
      </Pressable>
    </View>
  );
}
