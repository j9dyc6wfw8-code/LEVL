// ============================================================================
// LEVL — CommentSheet
//
// Flat, plain-text comments. No threads, no replies, no mentions, no rich text.
// The brief asked for fast and simple, and a gym feed genuinely does not need
// a conversation system — it needs "huge session" to arrive quickly.
//
// Comment bodies render inside <Text>. React Native does not interpret markup,
// so there is no HTML injection surface, and the service strips control
// characters and caps the length before anything is sent.
// ============================================================================

import React, { useCallback, useRef, useState } from 'react';
import { View, Pressable, ScrollView, Modal, KeyboardAvoidingView, Platform, ActivityIndicator, Alert } from 'react-native';
import { Text, TextInput } from '../Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, RADIUS, SPACING, T, TOUCH } from '../../theme';
import { HunterAvatar } from '../HunterAvatar';
import { relativeTime } from '../../engine/session';
import { COMMENT_MAX, REPORT_REASONS } from '../../services/supabase/checkInService';
import haptics from '../../services/haptics';

export default function CommentSheet({
  visible,
  onClose,
  comments,
  loading,
  sending,
  me,
  postOwnerId,
  onAdd,
  onDelete,
  onReport,
}) {
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState('');
  const scrollRef = useRef(null);

  const submit = useCallback(async () => {
    const body = draft.trim();
    if (!body || sending) return;
    setDraft('');
    haptics.commit();
    const res = await onAdd(body);
    if (res && res.error) {
      haptics.error();
      setDraft(body);   // give it back rather than losing what they wrote
      Alert.alert('Could not post', res.error.message || 'Try again in a moment.');
      return;
    }
    setTimeout(() => {
      try { scrollRef.current && scrollRef.current.scrollToEnd({ animated: true }); } catch (e) {}
    }, 120);
  }, [draft, sending, onAdd]);

  const longPress = useCallback((comment) => {
    const mine = comment.userId === me;
    const canRemove = mine || postOwnerId === me;

    const options = [];
    if (canRemove) {
      options.push({
        text: mine ? 'Delete comment' : 'Remove from my Check In',
        style: 'destructive',
        onPress: () => onDelete(comment.id),
      });
    }
    if (!mine) {
      options.push({
        text: 'Report',
        onPress: () => {
          Alert.alert(
            'Report this comment',
            'Reports are reviewed by the LEVL team.',
            [
              ...REPORT_REASONS.map((r) => ({
                text: r.label,
                onPress: async () => {
                  await onReport(comment, r.key);
                  Alert.alert('Reported', 'Thanks — we will take a look.');
                },
              })),
              { text: 'Cancel', style: 'cancel' },
            ],
          );
        },
      });
    }
    if (!options.length) return;
    haptics.selection();
    Alert.alert('Comment', null, [...options, { text: 'Cancel', style: 'cancel' }]);
  }, [me, postOwnerId, onDelete, onReport]);

  const remaining = COMMENT_MAX - draft.length;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        accessibilityLabel="Close comments"
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' }}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{
          maxHeight: '78%',
          backgroundColor: C.bgElev,
          borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl,
          borderTopWidth: 1, borderColor: C.line,
        }}>

        {/* grabber */}
        <View style={{ alignItems: 'center', paddingTop: 8, paddingBottom: 4 }}>
          <View style={{ width: 38, height: 4, borderRadius: 2, backgroundColor: C.line }} />
        </View>

        <View style={{
          flexDirection: 'row', alignItems: 'center',
          paddingHorizontal: SPACING.lg, paddingBottom: 10,
        }}>
          <Text style={{ ...T.headline, color: C.text, flex: 1 }}>Comments</Text>
          <Pressable
            onPress={onClose}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Close"
            style={{ minWidth: TOUCH, minHeight: 32, alignItems: 'flex-end', justifyContent: 'center' }}>
            <Text style={{ ...T.subheadline, color: C.mut }}>Done</Text>
          </Pressable>
        </View>

        <ScrollView
          ref={scrollRef}
          style={{ maxHeight: 380 }}
          contentContainerStyle={{ paddingHorizontal: SPACING.lg, paddingBottom: 12 }}
          keyboardShouldPersistTaps="handled">

          {loading && !comments.length ? (
            <View style={{ paddingVertical: 30, alignItems: 'center' }}>
              <ActivityIndicator color={C.dim} />
            </View>
          ) : null}

          {!loading && !comments.length ? (
            <View style={{ paddingVertical: 26, alignItems: 'center' }}>
              <Text style={{ ...T.subheadline, color: C.dim }}>No comments yet.</Text>
              <Text style={{ ...T.footnote, color: C.faint, marginTop: 3 }}>Be the first.</Text>
            </View>
          ) : null}

          {comments.map((c) => (
            <Pressable
              key={c.id}
              onLongPress={() => longPress(c)}
              delayLongPress={320}
              accessibilityRole="text"
              accessibilityHint="Long press for options"
              style={{ flexDirection: 'row', marginBottom: 14, opacity: c.pending ? 0.55 : 1 }}>
              <HunterAvatar
                avatar={c.author && c.author.avatar}
                character={c.author && c.author.character}
                size={30}
              />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                  <Text style={{ ...T.footnote, fontWeight: '600', color: C.text }} numberOfLines={1}>
                    {(c.author && (c.author.display_name || c.author.username)) || 'Player'}
                  </Text>
                  <Text style={{ ...T.caption, ...T.numeric, color: C.faint, marginLeft: 7 }}>
                    {c.pending ? 'Sending…' : relativeTime(c.createdAtMs)}
                  </Text>
                </View>
                <Text style={{ ...T.subheadline, color: C.mut, marginTop: 2 }}>{c.body}</Text>
              </View>
            </Pressable>
          ))}
        </ScrollView>

        <View style={{
          flexDirection: 'row', alignItems: 'flex-end',
          paddingHorizontal: SPACING.lg,
          paddingTop: 10,
          paddingBottom: Math.max(insets.bottom, 12),
          borderTopWidth: 1, borderTopColor: C.lineSoft,
        }}>
          <TextInput
            value={draft}
            onChangeText={(t) => setDraft(t.slice(0, COMMENT_MAX))}
            placeholder="Add a comment"
            placeholderTextColor={C.faint}
            multiline
            maxLength={COMMENT_MAX}
            accessibilityLabel="Comment"
            style={{
              flex: 1, maxHeight: 96, minHeight: TOUCH,
              backgroundColor: C.sunken,
              borderWidth: 1, borderColor: C.lineSoft, borderRadius: RADIUS.lg,
              paddingHorizontal: 14, paddingTop: 12, paddingBottom: 12,
              color: C.text, ...T.subheadline,
            }}
          />
          <Pressable
            onPress={submit}
            disabled={!draft.trim() || sending}
            accessibilityRole="button"
            accessibilityLabel="Post comment"
            style={{
              marginLeft: 8, minHeight: TOUCH, paddingHorizontal: 16,
              alignItems: 'center', justifyContent: 'center',
              borderRadius: RADIUS.lg,
              backgroundColor: draft.trim() ? C.gold : C.panel2,
            }}>
            {sending
              ? <ActivityIndicator size="small" color={C.ink} />
              : <Text style={{ ...T.footnote, fontWeight: '700', color: draft.trim() ? C.ink : C.dim }}>Post</Text>}
          </Pressable>
        </View>

        {remaining < 40 ? (
          <Text style={{
            ...T.caption, ...T.numeric, color: remaining < 0 ? C.red : C.faint,
            textAlign: 'right', paddingHorizontal: SPACING.lg, paddingBottom: 6,
          }}>
            {remaining}
          </Text>
        ) : null}
      </KeyboardAvoidingView>
    </Modal>
  );
}
