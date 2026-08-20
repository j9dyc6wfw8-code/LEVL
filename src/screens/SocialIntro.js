// ============================================================================
// LEVL — SocialIntro
//
// Three cards, then set the training window. That is the whole onboarding.
//
// It has to explain a mechanic people have not seen in a fitness app, in less
// time than it takes to get bored. So: one idea per card, no paragraphs, and
// the last step is an actual choice rather than another wall of text — the
// window is the only thing LEVL genuinely needs from the user to make Check In
// work properly.
// ============================================================================

import React, { useState } from 'react';
import { View, Pressable, ScrollView } from 'react-native';
import { Text } from '../components/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, RADIUS, SPACING, T, TOUCH } from '../theme';
import { WINDOW_PRESETS } from '../hooks/useCheckInPreferences';
import { SOCIAL_XP } from '../engine/engine';
import haptics from '../services/haptics';

const CARDS = [
  {
    key: 'what',
    label: 'CHECK IN',
    title: 'One moment from today’s training',
    body: 'Front and rear camera together. LEVL prompts you once a day, at an unpredictable time inside your usual training window.',
  },
  {
    key: 'late',
    label: 'NO PRESSURE',
    title: 'Miss the prompt? Post anyway',
    body: 'Check In whenever you actually train. Your post simply shows that you were late — nothing is lost and nothing is taken away.',
  },
  {
    key: 'verified',
    label: 'VERIFIED SESSION',
    title: 'Attach the workout you logged',
    body: `Adding today’s LEVL workout turns a Check In into a Verified Session, worth an extra ${SOCIAL_XP.VERIFIED_BONUS} XP. Friends see what you trained — never your notes or effort ratings.`,
  },
];

export default function SocialIntro({ onDone, onSetWindow, initialWindow }) {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0);
  const [picked, setPicked] = useState(() => {
    if (!initialWindow) return 'evening';
    const match = WINDOW_PRESETS.find(
      (p) => p.start === initialWindow.window_start_minute && p.end === initialWindow.window_end_minute,
    );
    return match ? match.key : 'evening';
  });

  const isWindowStep = step >= CARDS.length;
  const card = CARDS[Math.min(step, CARDS.length - 1)];

  const next = () => {
    haptics.selection();
    setStep((s) => s + 1);
  };

  const finish = () => {
    const preset = WINDOW_PRESETS.find((p) => p.key === picked) || WINDOW_PRESETS[3];
    haptics.success();
    onSetWindow({ window_start_minute: preset.start, window_end_minute: preset.end });
    onDone();
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1, justifyContent: 'center',
          padding: SPACING.xxl, paddingTop: insets.top + SPACING.xxl,
        }}>

        {isWindowStep ? (
          <>
            <Text style={{ ...T.label, color: C.gold }}>YOUR TRAINING WINDOW</Text>
            <Text style={{ ...T.title1, color: C.text, marginTop: 8 }}>
              When do you usually train?
            </Text>
            <Text style={{ ...T.callout, color: C.mut, marginTop: 8, lineHeight: 22 }}>
              LEVL will prompt you once inside this window, at a different time
              each day. You can change it any time in your profile.
            </Text>

            <View style={{ marginTop: SPACING.xxl }}>
              {WINDOW_PRESETS.map((p) => {
                const on = picked === p.key;
                return (
                  <Pressable
                    key={p.key}
                    onPress={() => { haptics.selection(); setPicked(p.key); }}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={`${p.label}, ${p.sub}`}
                    style={{
                      flexDirection: 'row', alignItems: 'center',
                      minHeight: 58, paddingHorizontal: 16, marginBottom: 10,
                      borderRadius: RADIUS.lg,
                      backgroundColor: on ? C.goldSoft : C.panel,
                      borderWidth: 1, borderColor: on ? C.gold : C.lineSoft,
                    }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ ...T.headline, color: on ? C.gold : C.text }}>{p.label}</Text>
                      <Text style={{ ...T.footnote, ...T.numeric, color: on ? C.gold + 'cc' : C.dim, marginTop: 1 }}>
                        {p.sub}
                      </Text>
                    </View>
                    <View style={{
                      width: 22, height: 22, borderRadius: 11,
                      borderWidth: 2, borderColor: on ? C.gold : C.line,
                      alignItems: 'center', justifyContent: 'center',
                    }}>
                      {on ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: C.gold }} /> : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </>
        ) : (
          <>
            <Text style={{ ...T.label, color: C.gold }}>{card.label}</Text>
            <Text style={{ ...T.title1, color: C.text, marginTop: 8 }}>{card.title}</Text>
            <Text style={{ ...T.callout, color: C.mut, marginTop: 12, lineHeight: 23 }}>
              {card.body}
            </Text>
          </>
        )}
      </ScrollView>

      <View style={{
        paddingHorizontal: SPACING.xxl,
        paddingBottom: Math.max(insets.bottom, 16) + 8,
      }}>
        {/* progress dots */}
        <View style={{ flexDirection: 'row', justifyContent: 'center', marginBottom: 18 }}>
          {[...CARDS, { key: 'window' }].map((c, i) => (
            <View
              key={c.key}
              style={{
                width: i === Math.min(step, CARDS.length) ? 20 : 6,
                height: 6, borderRadius: 3, marginHorizontal: 3,
                backgroundColor: i === Math.min(step, CARDS.length) ? C.gold : C.line,
              }}
            />
          ))}
        </View>

        <Pressable
          onPress={isWindowStep ? finish : next}
          accessibilityRole="button"
          accessibilityLabel={isWindowStep ? 'Set my training window and continue' : 'Continue'}
          style={{
            minHeight: 52, borderRadius: RADIUS.md, backgroundColor: C.gold,
            alignItems: 'center', justifyContent: 'center',
          }}>
          <Text style={{ ...T.callout, fontWeight: '700', color: C.ink, letterSpacing: 0.4 }}>
            {isWindowStep ? 'SET MY TRAINING WINDOW' : 'CONTINUE'}
          </Text>
        </Pressable>

        <Pressable
          onPress={onDone}
          accessibilityRole="button"
          style={{ minHeight: TOUCH, alignItems: 'center', justifyContent: 'center', marginTop: 6 }}>
          <Text style={{ ...T.footnote, color: C.dim }}>
            {isWindowStep ? 'Decide later' : 'Skip'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
