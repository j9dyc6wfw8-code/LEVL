// LEVL — first-run intro.
//
// Four screens, skippable, benefit-first. Research is unambiguous here: users
// read ~20-28% of on-screen words, so every slide is ONE idea, one big symbol,
// one line. No paragraphs. No feature tours.
//
// The job is not to explain every system — it's to make the loop obvious:
//   lift -> earn -> rank up -> claim.
// Everything else (Forge, Packs, Duels) reveals itself in play.
import React, { useRef, useState } from 'react';
import { View, Text, Pressable, Animated, Dimensions, ScrollView } from 'react-native';
import Svg, { Polygon, Circle, Path, Rect, Line } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import { C, TYPE, TOUCH } from '../theme';
import { ChunkyBtn } from '../components/ui';

const { width: SW } = Dimensions.get('window');

/* ------------------------------- artwork -------------------------------- */
// Original vector marks — one bold symbol per slide. No stock art, no emoji.

const ArtPeak = () => (
  <Svg width={132} height={132} viewBox="0 0 100 100">
    <Polygon points="50,12 88,84 12,84" fill="none" stroke={C.gold} strokeWidth={3} strokeLinejoin="round" />
    <Polygon points="50,34 72,78 28,78" fill={C.gold} opacity={0.9} />
    <Polygon points="50,55 62,78 38,78" fill={C.bg} />
  </Svg>
);

const ArtBar = () => (
  <Svg width={132} height={132} viewBox="0 0 100 100">
    <Rect x={8} y={44} width={84} height={12} rx={6} fill={C.panel2} />
    <Rect x={8} y={44} width={58} height={12} rx={6} fill={C.green} />
    <Circle cx={22} cy={50} r={13} fill={C.panel3} stroke={C.green} strokeWidth={2.5} />
    <Circle cx={78} cy={50} r={13} fill={C.panel3} stroke={C.line} strokeWidth={2.5} />
    <Path d="M18 50 L21 54 L27 46" stroke={C.green} strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const ArtLadder = () => (
  <Svg width={132} height={132} viewBox="0 0 100 100">
    {[
      { y: 74, w: 60, c: C.blue },
      { y: 56, w: 46, c: C.purp },
      { y: 38, w: 32, c: C.orange },
    ].map((r, i) => (
      <Rect key={i} x={(100 - r.w) / 2} y={r.y} width={r.w} height={13} rx={4} fill={r.c} opacity={0.9} />
    ))}
    <Polygon points="50,14 58,30 42,30" fill={C.gold} />
  </Svg>
);

const ArtChest = () => (
  <Svg width={132} height={132} viewBox="0 0 100 100">
    <Rect x={20} y={44} width={60} height={38} rx={6} fill={C.panel3} stroke={C.gold} strokeWidth={2.5} />
    <Path d="M20 56 Q50 34 80 56" fill={C.panel2} stroke={C.gold} strokeWidth={2.5} />
    <Rect x={44} y={54} width={12} height={16} rx={3} fill={C.gold} />
    <Line x1={50} y1={22} x2={50} y2={32} stroke={C.gold} strokeWidth={3} strokeLinecap="round" />
    <Line x1={30} y1={28} x2={35} y2={36} stroke={C.gold} strokeWidth={3} strokeLinecap="round" opacity={0.6} />
    <Line x1={70} y1={28} x2={65} y2={36} stroke={C.gold} strokeWidth={3} strokeLinecap="round" opacity={0.6} />
  </Svg>
);

/* -------------------------------- slides -------------------------------- */
// One idea each. Title is a hammer. Body is a single line.
const SLIDES = [
  {
    art: ArtPeak,
    kicker: 'WELCOME',
    title: 'Your gym, ranked.',
    body: 'Every set moves a real number. No guesswork.',
    tint: C.gold,
  },
  {
    art: ArtBar,
    kicker: 'HOW IT WORKS',
    title: 'Lift. Level up.',
    body: 'Heavier, harder sets pay more. Six stats, all earned.',
    tint: C.green,
  },
  {
    art: ArtLadder,
    kicker: 'THE LADDER',
    title: 'Climb the ranks.',
    body: 'Bronze to Grandmaster. Earned, never bought.',
    tint: C.blue,
  },
  {
    art: ArtChest,
    kicker: 'REWARDS',
    title: 'Claim the spoils.',
    body: 'Gear and cosmetics. Your rank stays honest.',
    tint: C.orange,
  },
];

/* -------------------------------- screen -------------------------------- */
export default function Intro({ onDone }) {
  const [i, setI] = useState(0);
  const scroller = useRef(null);
  const fade = useRef(new Animated.Value(1)).current;

  const goTo = (n) => {
    if (n >= SLIDES.length) { onDone(); return; }
    setI(n);
    if (scroller.current) scroller.current.scrollTo({ x: n * SW, animated: true });
  };

  const onScrollEnd = (e) => {
    const n = Math.round(e.nativeEvent.contentOffset.x / SW);
    if (n !== i) setI(n);
  };

  const last = i === SLIDES.length - 1;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={['top', 'bottom']}>
      {/* skip — always available, per HIG. Never trap the user. */}
      <View style={{ alignItems: 'flex-end', paddingHorizontal: 16, height: TOUCH, justifyContent: 'center' }}>
        <Pressable onPress={onDone} hitSlop={12} style={{ minHeight: TOUCH, justifyContent: 'center', paddingHorizontal: 8 }}>
          <Text style={{ ...TYPE.body, color: C.dim, fontWeight: '600' }}>Skip</Text>
        </Pressable>
      </View>

      <Animated.View style={{ flex: 1, opacity: fade }}>
        <ScrollView
          ref={scroller}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onScrollEnd}
          style={{ flex: 1 }}>
          {SLIDES.map((sl, n) => {
            const Art = sl.art;
            return (
              <View key={n} style={{ width: SW, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
                {/* soft glow behind the mark — vibrancy without noise */}
                <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                  <View style={{
                    position: 'absolute', width: 210, height: 210, borderRadius: 999,
                    backgroundColor: sl.tint, opacity: 0.13,
                  }} />
                  <Art />
                </View>

                <Text style={{ fontSize: 11, fontWeight: '700', color: sl.tint, letterSpacing: 2.2, marginTop: 44 }}>
                  {sl.kicker}
                </Text>
                <Text style={{ fontSize: 32, fontWeight: '800', letterSpacing: -0.8, color: C.text, marginTop: 12, textAlign: 'center' }}>
                  {sl.title}
                </Text>
                <Text style={{ fontSize: 17, fontWeight: '500', color: C.mut, marginTop: 14, textAlign: 'center', lineHeight: 25, maxWidth: 300 }}>
                  {sl.body}
                </Text>
              </View>
            );
          })}
        </ScrollView>
      </Animated.View>

      {/* progress dots */}
      <View style={{ flexDirection: 'row', justifyContent: 'center', marginBottom: 20 }}>
        {SLIDES.map((_, n) => (
          <View
            key={n}
            style={{
              width: n === i ? 22 : 7, height: 7, borderRadius: 999, marginHorizontal: 3,
              backgroundColor: n === i ? SLIDES[i].tint : C.line,
            }}
          />
        ))}
      </View>

      <View style={{ paddingHorizontal: 24, paddingBottom: 12 }}>
        <ChunkyBtn tone="gold" onPress={() => goTo(i + 1)}>
          {last ? 'START' : 'NEXT'}
        </ChunkyBtn>
      </View>
    </SafeAreaView>
  );
}
