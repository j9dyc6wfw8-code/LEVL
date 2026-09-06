// LEVL — first-run intro.
//
// Four screens, skippable, benefit-first. Research is unambiguous here: users
// read ~20-28% of on-screen words, so every slide is ONE idea, one big symbol,
// one line. No paragraphs. No feature tours.
//
// The job is not to explain every system — it's to make the loop obvious:
//   lift -> earn -> rank up -> prove it.
// Everything else (Forge, Packs, Duels) reveals itself in play.
//
// The last slide is deliberately the differentiator rather than the rewards:
// loot is the least distinctive thing here, and Verified Sessions are the only
// mechanic a competitor cannot copy.
import React, { useRef, useState } from 'react';
import { View, Pressable, Animated, Dimensions, ScrollView } from 'react-native';
import { Text } from '../components/Text';
import Svg, { Polygon, Circle, Path, Rect } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import { C, TOUCH, T } from '../theme';
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

// A shield with a tick inside it. The one idea no competitor can copy gets the
// one piece of artwork that is not about loot or ladders.
const ArtVerified = () => (
  <Svg width={132} height={132} viewBox="0 0 100 100">
    <Path
      d="M50 12 L82 24 V52 C82 70 68 82 50 89 C32 82 18 70 18 52 V24 Z"
      fill="none" stroke={C.green} strokeWidth={3} strokeLinejoin="round"
    />
    <Path
      d="M50 20 L74 29 V52 C74 65 63 75 50 81 C37 75 26 65 26 52 V29 Z"
      fill={C.green} opacity={0.13}
    />
    <Path
      d="M35 51 L45 62 L67 38"
      stroke={C.green} strokeWidth={5} fill="none"
      strokeLinecap="round" strokeLinejoin="round"
    />
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
  // THE DIFFERENTIATOR GOES LAST, where it is the thing they carry into the app.
  //
  // This slot used to be "Claim the spoils — gear and cosmetics", which is the
  // least distinctive thing LEVL does: every game has loot, and nobody installs
  // a training app for it. Verified Sessions are the one mechanic no competitor
  // can copy — Strava can verify a run because GPS exists, and nothing verifies
  // a gym session except a log the app itself owns. It was a small green badge
  // on a feed card and nothing else. Now it is the promise.
  {
    art: ArtVerified,
    kicker: 'THE DIFFERENCE',
    title: 'Proof, not claims.',
    body: 'Attach the session you logged and LEVL checks it. Nobody fakes a lift here.',
    tint: C.green,
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
        <Pressable accessibilityRole="button" onPress={onDone} hitSlop={12} style={{ minHeight: TOUCH, justifyContent: 'center', paddingHorizontal: 8 }}>
          <Text style={{ ...T.footnote, color: C.dim, fontWeight: '600' }}>Skip</Text>
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
