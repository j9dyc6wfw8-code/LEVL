// LEVL — replayable control guide.
// The guide focuses on location and action, not feature lore: one screen,
// one switch, one sentence at a time.

import React, { useEffect, useState } from 'react';
import { View, Pressable } from 'react-native';
import { Text } from './Text';
import { C, RADIUS, T } from '../theme';
import { Sheet, ChunkyBtn } from './ui';
import { TabIcon } from './TabIcon';

const STEPS = [
  {
    icon: 'train', color: C.green, place: 'STEP 1 · TRAIN',
    title: 'Log a set. That is the app.',
    text: 'Pick a muscle, pick an exercise, enter the weight and reps you did. Everything else in LEVL is built from those numbers.',
    toggles: [['Log Lift', 'Cardio']],
  },
  {
    icon: 'progress', color: C.blue, place: 'STEP 2 · STATS',
    title: 'Watch the numbers move.',
    text: 'Every set feeds six stats and your XP. Stats shows what you have done and where it is heading.',
    toggles: [['Overview', 'Strength'], ['Volume', 'History']],
  },
  {
    icon: 'profile', color: C.purp, place: 'THE SIX STATS',
    title: 'What the letters mean.',
    text: 'STR strength · PWR power · END endurance · VIT vitality · MOB mobility · DIS discipline. Each exercise feeds one or two of them automatically.',
    toggles: [['STR', 'PWR', 'END'], ['VIT', 'MOB', 'DIS']],
  },
  {
    icon: 'duel', color: C.orange, place: 'STEP 3 · COMPETE',
    title: 'Duels and the ladder.',
    text: 'Duels are head-to-head against a bot or a friend. Ladder is where you rank against everyone. Five training days unlocks your rank.',
    toggles: [['Duels', 'Ladder']],
  },
  {
    icon: 'shop', color: C.gold, place: 'STEP 4 · REWARDS',
    title: 'Packs, gear and the Forge.',
    text: 'Training earns packs and coins. Everything here is cosmetic — it can never change your rank or your stats.',
    toggles: [['Forge', 'Shop', 'Pass']],
  },
  {
    icon: 'profile', color: C.cyan, place: 'STEP 5 · YOU',
    title: 'Your character and settings.',
    text: 'Customise your character, then scroll to Settings for units, this guide, account tools and bug reports.',
    toggles: [['Guide', 'Units', 'Account']],
  },
];

function TogglePreview({ labels, color }) {
  return (
    <View style={{
      flexDirection: 'row', padding: 3, marginTop: 8, borderRadius: RADIUS.md,
      backgroundColor: C.sunken, borderWidth: 1, borderColor: C.line,
    }}>
      {labels.map((label, i) => (
        <View key={label} style={{
          flex: 1, minHeight: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center',
          backgroundColor: i === 0 ? color + '20' : 'transparent',
          borderWidth: 1, borderColor: i === 0 ? color + '66' : 'transparent',
          paddingHorizontal: 3,
        }}>
          <Text numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: 10.5, fontWeight: '700', color: i === 0 ? color : C.dim }}>
            {label}
          </Text>
        </View>
      ))}
    </View>
  );
}

export default function AppGuide({ visible, onClose }) {
  const [index, setIndex] = useState(0);
  useEffect(() => { if (visible) setIndex(0); }, [visible]);
  const step = STEPS[index];
  const last = index === STEPS.length - 1;

  return (
    <Sheet visible={visible} title="App Guide" onClose={onClose}>
      <View style={{ paddingHorizontal: 18, paddingTop: 10, paddingBottom: 6 }}>
        <View style={{ flexDirection: 'row', marginBottom: 18 }}>
          {STEPS.map((_, i) => (
            <View key={i} style={{
              flex: 1, height: 4, borderRadius: 2, marginRight: i < STEPS.length - 1 ? 5 : 0,
              backgroundColor: i <= index ? step.color : C.line,
            }} />
          ))}
        </View>

        <View style={{
          width: 64, height: 64, borderRadius: 22, backgroundColor: step.color + '18',
          borderWidth: 1, borderColor: step.color + '55', alignItems: 'center', justifyContent: 'center',
        }}>
          <TabIcon name={step.icon} color={step.color} active />
        </View>
        <Text style={{ ...T.label, color: step.color, marginTop: 16, marginBottom: 7 }}>{step.place}</Text>
        <Text style={{ fontSize: 27, fontWeight: '800', color: C.text, letterSpacing: -0.7 }}>{step.title}</Text>
        <Text style={{ fontSize: 15, fontWeight: '700', color: C.mut, lineHeight: 22, marginTop: 9 }}>
          {step.text}
        </Text>

        <View style={{ marginTop: 14 }}>
          {step.toggles.map((labels, i) => <TogglePreview key={i} labels={labels} color={step.color} />)}
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 22 }}>
          {index > 0 ? (
            <Pressable accessibilityRole="button" onPress={() => setIndex((i) => i - 1)} style={{ minWidth: 70, minHeight: 48, alignItems: 'flex-start', justifyContent: 'center' }}>
              <Text style={{ ...T.footnote, color: C.mut, fontWeight: '700' }}>‹ BACK</Text>
            </Pressable>
          ) : <View style={{ minWidth: 70 }} />}
          <View style={{ flex: 1 }} />
          <View style={{ width: 178 }}>
            <ChunkyBtn tone={last ? 'green' : 'gold'} onPress={() => last ? onClose() : setIndex((i) => i + 1)}>
              {last ? 'GOT IT' : 'NEXT  ›'}
            </ChunkyBtn>
          </View>
        </View>
      </View>
    </Sheet>
  );
}
