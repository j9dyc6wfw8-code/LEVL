// ============================================================================
// LEVL — CheckInComposer
//
// The one screen between capture and posting.
//
// It shows the pair of photographs, who will see them, and whether today's
// workout is attached — and then a single POST button. There is deliberately no
// filter, no crop tool, no sticker tray and no multi-step flow. A Check In is
// supposed to be the thing you actually did, ten seconds after you did it.
//
// Photos cannot be edited beyond choosing which one leads, because editing is
// the opposite of the point.
// ============================================================================

import React, { useCallback, useMemo, useState } from 'react';
import { View, Pressable, ScrollView, ActivityIndicator, Platform, KeyboardAvoidingView } from 'react-native';
import { Text, TextInput } from '../Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, RADIUS, SPACING, T, TOUCH } from '../../theme';
import DualPhoto from './DualPhoto';
import { formatVolume } from '../../engine/session';
import { SOCIAL_XP } from '../../engine/engine';
import haptics from '../../services/haptics';

const CAPTION_MAX = 140;
const ALT_MAX = 240;

export default function CheckInComposer({
  capture,
  primary,
  onSwapPrimary,
  sessionsToday,
  defaultVisibility,
  unit,
  posting,
  onRetake,
  onCancel,
  onPost,
}) {
  const insets = useSafeAreaInsets();
  const sessions = sessionsToday || [];

  const [visibility, setVisibility] = useState(
    defaultVisibility === 'public' ? 'public' : 'friends',
  );
  // Default to attaching the most substantial session — the common case is
  // "I just trained", so making them opt IN would add a step to every post.
  const [sessionId, setSessionId] = useState(sessions.length ? sessions[0].id : null);
  const [caption, setCaption] = useState('');
  const [altText, setAltText] = useState('');
  const [altOpen, setAltOpen] = useState(false);

  const attached = useMemo(
    () => sessions.find((s) => s.id === sessionId) || null,
    [sessions, sessionId],
  );

  const submit = useCallback(() => {
    onPost({
      visibility,
      workoutSessionId: sessionId,
      caption: caption.trim() || null,
      altText: altText.trim() || null,
    });
  }, [onPost, visibility, sessionId, caption, altText]);

  const xpPreview = SOCIAL_XP.CHECK_IN + (attached ? SOCIAL_XP.VERIFIED_BONUS : 0);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: C.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

      {/* ---- header ------------------------------------------------------ */}
      <View style={{
        flexDirection: 'row', alignItems: 'center',
        paddingTop: insets.top + 6, paddingHorizontal: SPACING.lg, paddingBottom: 10,
      }}>
        <Pressable
          onPress={onCancel}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Discard this Check In"
          style={{ minHeight: 36, justifyContent: 'center' }}>
          <Text style={{ ...T.subheadline, color: C.mut }}>Cancel</Text>
        </Pressable>
        <Text style={{ ...T.headline, color: C.text, flex: 1, textAlign: 'center' }}>Check In</Text>
        <Pressable
          onPress={onRetake}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Retake the photos"
          style={{ minHeight: 36, justifyContent: 'center' }}>
          <Text style={{ ...T.subheadline, color: C.gold }}>Retake</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: SPACING.lg, paddingBottom: 30 }}
        keyboardShouldPersistTaps="handled">

        <DualPhoto
          frontUrl={capture.front}
          rearUrl={capture.rear}
          primary={primary}
          onSwap={onSwapPrimary}
          radius={RADIUS.xl}
        />

        <Text style={{ ...T.caption, color: C.faint, marginTop: 8, textAlign: 'center' }}>
          {/* Says what actually happened. Never claims simultaneity it did not
              achieve — the hardware reports this, it is not assumed. */}
          {capture.simultaneous
            ? 'Both cameras captured together'
            : 'Rear then selfie'}
          {capture.gapMs ? ` · ${capture.gapMs} ms apart` : ''}
          {'  ·  Tap the small photo to swap'}
        </Text>

        {/* ---- today's workout ------------------------------------------- */}
        <Section label="TODAY'S WORKOUT">
          {sessions.length === 0 ? (
            <Text style={{ ...T.footnote, color: C.dim, lineHeight: 19 }}>
              No session logged yet today. Post this now — you can attach a
              workout later and it becomes a Verified Session.
            </Text>
          ) : (
            <>
              {sessions.map((s) => {
                const on = s.id === sessionId;
                const volume = formatVolume(s.volumeKg, unit);
                return (
                  <Pressable
                    key={s.id}
                    onPress={() => {
                      haptics.selection();
                      setSessionId(on ? null : s.id);
                    }}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: on }}
                    accessibilityLabel={`${s.title}, ${s.sets} sets. ${on ? 'Attached' : 'Not attached'}.`}
                    style={{
                      flexDirection: 'row', alignItems: 'center',
                      minHeight: TOUCH, paddingVertical: 10, paddingHorizontal: 12,
                      borderRadius: RADIUS.md, marginBottom: 8,
                      backgroundColor: on ? C.greenSoft : C.panel2,
                      borderWidth: 1, borderColor: on ? C.green + '66' : C.lineSoft,
                    }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ ...T.subheadline, fontWeight: '600', color: C.text }}>{s.title}</Text>
                      <Text style={{ ...T.caption, ...T.numeric, color: C.dim, marginTop: 2 }}>
                        {[
                          s.sets > 0 ? `${s.sets} sets` : null,
                          volume,
                          s.cardioMinutes > 0 ? `${s.cardioMinutes} min` : null,
                          s.prs > 0 ? `${s.prs} PR${s.prs === 1 ? '' : 's'}` : null,
                        ].filter(Boolean).join(' · ')}
                      </Text>
                    </View>
                    <Text style={{
                      ...T.caption2, fontWeight: '700', letterSpacing: 0.4,
                      color: on ? C.green : C.dim,
                    }}>
                      {on ? 'ATTACHED ✓' : 'ATTACH'}
                    </Text>
                  </Pressable>
                );
              })}
              <Text style={{ ...T.caption, color: C.faint, lineHeight: 17 }}>
                Attaching a workout makes this a Verified Session. Only the
                session summary is shared — never your notes or effort ratings.
              </Text>
            </>
          )}
        </Section>

        {/* ---- audience --------------------------------------------------- */}
        <Section label="WHO CAN SEE THIS">
          <View style={{ flexDirection: 'row' }}>
            {[
              { key: 'friends', label: 'Friends', sub: 'Your accepted friends' },
              { key: 'public', label: 'Public', sub: 'Anyone on LEVL' },
            ].map((opt) => {
              const on = visibility === opt.key;
              return (
                <Pressable
                  key={opt.key}
                  onPress={() => { haptics.selection(); setVisibility(opt.key); }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={`${opt.label}. ${opt.sub}.`}
                  style={{
                    flex: 1, minHeight: 58, borderRadius: RADIUS.md,
                    paddingHorizontal: 12, justifyContent: 'center',
                    marginRight: opt.key === 'friends' ? 8 : 0,
                    backgroundColor: on ? C.goldSoft : C.panel2,
                    borderWidth: 1, borderColor: on ? C.gold : C.lineSoft,
                  }}>
                  <Text style={{ ...T.subheadline, fontWeight: '600', color: on ? C.gold : C.mut }}>
                    {opt.label}
                  </Text>
                  <Text style={{ ...T.caption, color: on ? C.gold + 'cc' : C.dim, marginTop: 1 }}>
                    {opt.sub}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Section>

        {/* ---- optional extras -------------------------------------------- */}
        <Section label="OPTIONAL">
          <TextInput
            value={caption}
            onChangeText={(t) => setCaption(t.slice(0, CAPTION_MAX))}
            placeholder="Say something (optional)"
            placeholderTextColor={C.faint}
            maxLength={CAPTION_MAX}
            accessibilityLabel="Caption"
            style={{
              minHeight: TOUCH, backgroundColor: C.sunken,
              borderWidth: 1, borderColor: C.lineSoft, borderRadius: RADIUS.md,
              paddingHorizontal: 13, paddingVertical: 12,
              color: C.text, ...T.subheadline,
            }}
          />

          <Pressable hitSlop={{ top: 3, bottom: 3 }}
            onPress={() => setAltOpen((o) => !o)}
            accessibilityRole="button"
            accessibilityState={{ expanded: altOpen }}
            style={{ minHeight: 38, justifyContent: 'center', marginTop: 8 }}>
            <Text style={{ ...T.footnote, color: C.dim }}>
              {altOpen ? '− ' : '+ '}Describe the photo for screen readers
            </Text>
          </Pressable>

          {altOpen ? (
            <TextInput
              value={altText}
              onChangeText={(t) => setAltText(t.slice(0, ALT_MAX))}
              placeholder="e.g. Squat rack, mid set, gym at night"
              placeholderTextColor={C.faint}
              maxLength={ALT_MAX}
              multiline
              accessibilityLabel="Photo description"
              style={{
                minHeight: 62, backgroundColor: C.sunken,
                borderWidth: 1, borderColor: C.lineSoft, borderRadius: RADIUS.md,
                paddingHorizontal: 13, paddingVertical: 11,
                color: C.text, ...T.subheadline,
              }}
            />
          ) : null}
        </Section>
      </ScrollView>

      {/* ---- post -------------------------------------------------------- */}
      <View style={{
        paddingHorizontal: SPACING.lg,
        paddingTop: 12,
        paddingBottom: Math.max(insets.bottom, 12),
        borderTopWidth: 1, borderTopColor: C.lineSoft,
        backgroundColor: C.bgElev,
      }}>
        <Pressable
          onPress={submit}
          disabled={posting}
          accessibilityRole="button"
          accessibilityLabel={`Post Check In to ${visibility === 'public' ? 'everyone on LEVL' : 'your friends'}`}
          style={{
            minHeight: 52, borderRadius: RADIUS.md,
            alignItems: 'center', justifyContent: 'center',
            backgroundColor: C.gold, opacity: posting ? 0.65 : 1,
          }}>
          {posting
            ? <ActivityIndicator color={C.ink} />
            : (
              <Text style={{ ...T.callout, fontWeight: '700', color: C.ink, letterSpacing: 0.5 }}>
                POST CHECK IN
              </Text>
            )}
        </Pressable>
        <Text style={{ ...T.caption, ...T.numeric, color: C.dim, textAlign: 'center', marginTop: 8 }}>
          +{xpPreview} XP{attached ? ' · Verified Session' : ''}
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

function Section({ label, children }) {
  return (
    <View style={{ marginTop: SPACING.xxl }}>
      <Text style={{ ...T.label, color: C.dim, marginBottom: 10 }}>{label}</Text>
      {children}
    </View>
  );
}
