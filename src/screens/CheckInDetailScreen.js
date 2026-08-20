// ============================================================================
// LEVL — CheckInDetailScreen
//
// One Check In on its own. This is where a notification lands — "Josh commented
// on your Check In" opens THIS, with the comment sheet already up, rather than
// dropping the user on a feed to go hunting.
//
// It fetches the post by id, which means Row Level Security decides whether the
// screen renders at all: a post that is friends-only, deleted, or from someone
// who has blocked you simply is not returned, and the screen says so plainly.
// ============================================================================

import React, { useCallback, useEffect, useState } from 'react';
import { View, Pressable, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { Text } from '../components/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, RADIUS, SPACING, T, TOUCH } from '../theme';
import SFIcon from '../components/SFIcon';
import DualPhoto from '../components/social/DualPhoto';
import ReactionBar from '../components/social/ReactionBar';
import WorkoutAttachment from '../components/social/WorkoutAttachment';
import CommentSheet from '../components/social/CommentSheet';
import { HunterAvatar } from '../components/HunterAvatar';
import { useCheckInComments } from '../hooks/useCheckInComments';
import * as checkIns from '../services/supabase/checkInService';
import { relativeTime, formatLateness } from '../engine/session';
import haptics from '../services/haptics';

export default function CheckInDetailScreen({
  checkInId,
  focusComments,
  me,
  unit,
  onClose,
  onOpenProfile,
}) {
  const insets = useSafeAreaInsets();
  const [item, setItem] = useState(null);
  const [photos, setPhotos] = useState({});
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(!!focusComments);
  const comments = useCheckInComments(checkInId, true);

  const load = useCallback(async () => {
    setLoading(true);
    // Row Level Security is the gate here: a post that is deleted, friends-only,
    // or from somebody who blocked you simply comes back empty, and the screen
    // says so rather than showing a half-rendered card.
    const { data, error } = await checkIns.getCheckInDetail(checkInId);
    if (error || !data) {
      setDenied(true);
      setLoading(false);
      return;
    }
    setItem(data);
    setDenied(false);
    setLoading(false);
    const { data: urls } = await checkIns.signPhotoUrls([data.frontPath, data.rearPath]);
    if (urls) setPhotos(urls);
  }, [checkInId]);

  useEffect(() => { load(); }, [load]);

  const react = useCallback(async (key) => {
    if (!item) return;
    const next = item.myReaction === key ? null : key;
    setItem((cur) => ({
      ...cur,
      myReaction: next,
      reactionCount: Math.max(0, cur.reactionCount + ((cur.myReaction ? 0 : 1) - (next ? 0 : 1))),
    }));
    const res = await checkIns.setReaction(item.id, next);
    if (res && res.error) load();
  }, [item, load]);

  if (loading) {
    return (
      <Shell insets={insets} onClose={onClose}>
        <ActivityIndicator color={C.dim} style={{ marginTop: 60 }} />
      </Shell>
    );
  }

  if (denied || !item) {
    return (
      <Shell insets={insets} onClose={onClose}>
        <View style={{ paddingTop: 60, alignItems: 'center' }}>
          <Text style={{ ...T.title3, color: C.text }}>This Check In isn&apos;t available</Text>
          <Text style={{
            ...T.subheadline, color: C.mut, marginTop: 8,
            textAlign: 'center', lineHeight: 21, paddingHorizontal: SPACING.lg,
          }}>
            It may have been deleted, or it isn&apos;t shared with you.
          </Text>
        </View>
      </Shell>
    );
  }

  const lateness = formatLateness(item.lateSeconds);
  const isMine = item.userId === me;

  return (
    <>
      <Shell insets={insets} onClose={onClose}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
          <Pressable
            onPress={() => onOpenProfile(item.author)}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={`${item.author.displayName}. Open profile.`}
            style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
            <HunterAvatar avatar={item.author.avatar} character={item.author.character} size={40} />
            <View style={{ marginLeft: 10, flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ ...T.headline, color: C.text }} numberOfLines={1}>
                  {item.author.displayName}
                </Text>
                <Text style={{ ...T.footnote, ...T.numeric, color: C.gold, marginLeft: 7, fontWeight: '600' }}>
                  LV {item.author.level}
                </Text>
              </View>
              <Text style={{ ...T.caption, ...T.numeric, color: C.dim, marginTop: 1 }}>
                {relativeTime(item.postedAtMs)}
                {lateness ? ` · ${lateness}` : ''}
                {item.visibility === 'public' ? ' · Public' : ''}
              </Text>
            </View>
          </Pressable>

          {isMine ? (
            <Pressable
              onPress={() => {
                haptics.selection();
                Alert.alert('Delete this Check In?', 'Your workout is not affected.', [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                      await checkIns.deleteCheckIn(item.id);
                      onClose();
                    },
                  },
                ]);
              }}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Check In options"
              style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: C.dim, fontSize: 18, fontWeight: '700', marginTop: -6 }}>···</Text>
            </Pressable>
          ) : null}
        </View>

        <DualPhoto
          frontUrl={photos[item.frontPath]}
          rearUrl={photos[item.rearPath]}
          primary={item.primaryPhoto}
          altText={item.altText}
          radius={RADIUS.xl}
        />

        <View style={{ marginTop: 14 }}>
          {item.verified && item.workout ? (
            <WorkoutAttachment workout={item.workout} title={item.workoutTitle} unit={unit} />
          ) : (
            <Text style={{ ...T.headline, color: C.mut }}>Check In</Text>
          )}
          {item.caption ? (
            <Text style={{ ...T.subheadline, color: C.mut, marginTop: 8 }}>{item.caption}</Text>
          ) : null}
        </View>

        <View style={{ marginTop: 16 }}>
          <ReactionBar
            reactionTypes={item.reactionTypes}
            myReaction={item.myReaction}
            commentCount={item.commentCount}
            onReact={react}
            onComments={() => setCommentsOpen(true)}
          />
        </View>
      </Shell>

      <CommentSheet
        visible={commentsOpen}
        onClose={() => setCommentsOpen(false)}
        comments={comments.comments}
        loading={comments.loading}
        sending={comments.sending}
        me={comments.me}
        postOwnerId={item.userId}
        onAdd={comments.add}
        onDelete={comments.remove}
        onReport={comments.report}
      />
    </>
  );
}

function Shell({ insets, onClose, children }) {
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{
        flexDirection: 'row', alignItems: 'center',
        paddingTop: insets.top + 6, paddingHorizontal: SPACING.lg, paddingBottom: 10,
      }}>
        <Pressable
          onPress={onClose}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={{ minHeight: TOUCH, justifyContent: 'center', paddingRight: 12 }}>
          <SFIcon name="chevron.left" size={17} color={C.gold} />
        </Pressable>
        <Text style={{ ...T.headline, color: C.text }}>Check In</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: SPACING.lg, paddingBottom: insets.bottom + 40 }}>
        {children}
      </ScrollView>
    </View>
  );
}
