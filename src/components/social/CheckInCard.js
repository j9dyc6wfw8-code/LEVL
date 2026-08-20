// ============================================================================
// LEVL — CheckInCard
//
// One Check In in the feed.
//
// LAYOUT PRIORITY, top to bottom: who, the photograph, what they trained, how
// people responded. The photograph occupies far more area than everything else
// combined, which is the whole point of the feature — the metadata supports the
// image rather than competing with it.
//
// Progressive disclosure keeps the card short: the workout collapses to one
// line and expands on tap; comments live in a sheet, not inline.
// ============================================================================

import React, { memo, useCallback } from 'react';
import { View, Pressable } from 'react-native';
import { Text } from '../Text';
import { C, RADIUS, SPACING, T } from '../../theme';
import DualPhoto from './DualPhoto';
import ReactionBar from './ReactionBar';
import WorkoutAttachment from './WorkoutAttachment';
import { relativeTime, formatLateness } from '../../engine/session';
import { HunterAvatar } from '../HunterAvatar';

function CheckInCard({
  item,
  photos,
  unit,
  isMine,
  onReact,
  onComments,
  onProfile,
  onMenu,
}) {
  const lateness = formatLateness(item.lateSeconds);
  const posted = relativeTime(item.postedAtMs);

  const react = useCallback((key) => onReact(item.id, key), [onReact, item.id]);
  const comments = useCallback(() => onComments(item), [onComments, item]);

  return (
    <View style={{ marginBottom: SPACING.xxl }}>

      {/* ---- who ------------------------------------------------------- */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
        <Pressable
          onPress={() => onProfile(item.author)}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={`${item.author.displayName}, level ${item.author.level}. Open profile.`}
          style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>

          <HunterAvatar
            avatar={item.author.avatar}
            character={item.author.character}
            size={36}
          />

          <View style={{ marginLeft: 10, flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ ...T.headline, color: C.text }} numberOfLines={1}>
                {item.author.displayName}
              </Text>
              <Text style={{ ...T.footnote, ...T.numeric, color: C.gold, marginLeft: 7, fontWeight: '600' }}>
                LV {item.author.level}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 1 }}>
              <Text style={{ ...T.caption, ...T.numeric, color: C.dim }}>{posted}</Text>
              {/* Lateness is stated, never scolded. Missing the window is fine;
                  the feed just shows the truth of when it happened. */}
              {lateness ? (
                <>
                  <Text style={{ ...T.caption, color: C.faint, marginHorizontal: 5 }}>·</Text>
                  <Text style={{ ...T.caption, ...T.numeric, color: C.faint }}>{lateness}</Text>
                </>
              ) : null}
              {item.visibility === 'public' ? (
                <>
                  <Text style={{ ...T.caption, color: C.faint, marginHorizontal: 5 }}>·</Text>
                  <Text style={{ ...T.caption, color: C.faint }}>Public</Text>
                </>
              ) : null}
            </View>
          </View>
        </Pressable>

        <Pressable
          onPress={() => onMenu(item)}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={isMine ? 'Check In options' : 'Report or block'}
          style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: C.dim, fontSize: 18, fontWeight: '700', marginTop: -6 }}>···</Text>
        </Pressable>
      </View>

      {/* ---- the photograph -------------------------------------------- */}
      <DualPhoto
        frontUrl={photos[item.frontPath]}
        rearUrl={photos[item.rearPath]}
        primary={item.primaryPhoto}
        altText={item.altText}
        radius={RADIUS.xl}
      />

      {/* ---- what they trained ------------------------------------------ */}
      <View style={{ marginTop: 12 }}>
        {item.verified && item.workout ? (
          <WorkoutAttachment
            workout={item.workout}
            title={item.workoutTitle}
            unit={unit}
          />
        ) : (
          <Text style={{ ...T.headline, color: C.mut }}>Check In</Text>
        )}

        {item.caption ? (
          <Text style={{ ...T.subheadline, color: C.mut, marginTop: 6 }}>{item.caption}</Text>
        ) : null}
      </View>

      {/* ---- responses --------------------------------------------------- */}
      <View style={{ marginTop: 12 }}>
        <ReactionBar
          reactionTypes={item.reactionTypes}
          myReaction={item.myReaction}
          commentCount={item.commentCount}
          onReact={react}
          onComments={comments}
        />
      </View>
    </View>
  );
}

// A feed re-renders on every reaction anywhere. Without this, reacting to one
// card re-renders forty, and expo-image's decode work makes that visible.
export default memo(CheckInCard, (prev, next) => (
  prev.item === next.item
  && prev.photos[prev.item.frontPath] === next.photos[next.item.frontPath]
  && prev.photos[prev.item.rearPath] === next.photos[next.item.rearPath]
  && prev.unit === next.unit
));
