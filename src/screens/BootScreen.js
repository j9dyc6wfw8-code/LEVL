// LEVL — animated boot / splash screen.
//
// A calm, classy startup moment: a breathing glow behind the mark, a slowly
// rotating accent ring, a diamond frame, drifting embers, and a rotating
// motivational quote credited to its author. Pure React Native Animated with
// the native driver — no new dependencies, no image assets, GPU-cheap.

import React, { useEffect, useRef, useMemo } from 'react';
import { View, Text, Animated, Easing, Dimensions } from 'react-native';
import { C } from '../theme';

/* Twelve short, well-attributed lines on training and self-improvement.
 * One is picked at random each launch, so the app rarely opens the same way
 * twice. Kept brief on purpose — a splash screen is read in a glance. */
export const QUOTES = [
  { text: 'We are what we repeatedly do. Excellence, then, is a habit.', by: 'Will Durant' },
  { text: 'It is not the mountain we conquer, but ourselves.', by: 'Edmund Hillary' },
  { text: "Take care of your body. It's the only place you have to live.", by: 'Jim Rohn' },
  { text: 'Strength does not come from winning. Your struggles develop your strengths.', by: 'Arnold Schwarzenegger' },
  { text: 'The successful warrior is the average man, with laser-like focus.', by: 'Bruce Lee' },
  { text: 'Champions keep playing until they get it right.', by: 'Billie Jean King' },
  { text: "Don't count the days. Make the days count.", by: 'Muhammad Ali' },
  { text: 'Difficulties strengthen the mind, as labour does the body.', by: 'Seneca' },
  { text: 'You have power over your mind — not outside events.', by: 'Marcus Aurelius' },
  { text: 'The only place success comes before work is the dictionary.', by: 'Vince Lombardi' },
  { text: 'It always seems impossible until it is done.', by: 'Nelson Mandela' },
  { text: 'Continuous effort — not strength or intelligence — unlocks our potential.', by: 'Winston Churchill' },
];

const { width: SCREEN_W } = Dimensions.get('window');

export default function BootScreen({ duration }) {
  const pulse = useRef(new Animated.Value(0)).current;   // glow breathing
  const spin = useRef(new Animated.Value(0)).current;    // ring rotation
  const rise = useRef(new Animated.Value(0)).current;    // logo + word entrance
  const quoteIn = useRef(new Animated.Value(0)).current; // quote fade, delayed
  const bar = useRef(new Animated.Value(0)).current;     // progress line

  // Pick once per mount so a re-render can't swap the quote mid-splash.
  const quote = useMemo(() => QUOTES[Math.floor(Math.random() * QUOTES.length)], []);

  // Six drifting embers with staggered starts.
  const embers = useRef(
    [...Array(6)].map(() => ({
      v: new Animated.Value(0),
      x: 30 + Math.random() * (SCREEN_W - 60),
      delay: Math.random() * 1800,
      dur: 3600 + Math.random() * 2200,
      size: 2 + Math.random() * 2.5,
    }))
  ).current;

  useEffect(() => {
    const a1 = Animated.timing(rise, {
      toValue: 1, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: true,
    });
    const a2 = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1300, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1300, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );
    const a3 = Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 9000, easing: Easing.linear, useNativeDriver: true })
    );
    const a4 = Animated.timing(quoteIn, {
      toValue: 1, delay: 480, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: true,
    });
    const a5 = Animated.timing(bar, {
      toValue: 1, duration: duration || 2500, easing: Easing.inOut(Easing.quad), useNativeDriver: false,
    });
    const emberAnims = embers.map((e) =>
      Animated.loop(
        Animated.timing(e.v, {
          toValue: 1, duration: e.dur, delay: e.delay, easing: Easing.linear, useNativeDriver: true,
        })
      )
    );

    a1.start(); a2.start(); a3.start(); a4.start(); a5.start();
    emberAnims.forEach((a) => a.start());
    return () => {
      a1.stop(); a2.stop(); a3.stop(); a4.stop(); a5.stop();
      emberAnims.forEach((a) => a.stop());
    };
  }, [pulse, spin, rise, quoteIn, bar, embers, duration]);

  const glowScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.28] });
  const glowOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.16, 0.34] });
  const ringSpin = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const riseScale = rise.interpolate({ inputRange: [0, 1], outputRange: [0.78, 1] });
  const riseY = rise.interpolate({ inputRange: [0, 1], outputRange: [14, 0] });
  const quoteY = quoteIn.interpolate({ inputRange: [0, 1], outputRange: [10, 0] });
  const barW = bar.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  return (
    <View style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30 }}>
      {/* drifting embers — sparse and slow, so it reads as atmosphere not noise */}
      {embers.map((e, i) => {
        const translateY = e.v.interpolate({ inputRange: [0, 1], outputRange: [90, -320] });
        const opacity = e.v.interpolate({ inputRange: [0, 0.15, 0.75, 1], outputRange: [0, 0.5, 0.32, 0] });
        return (
          <Animated.View key={i} pointerEvents="none" style={{
            position: 'absolute', bottom: 120, left: e.x,
            width: e.size, height: e.size, borderRadius: e.size / 2,
            backgroundColor: C.gold, opacity, transform: [{ translateY }],
          }} />
        );
      })}

      {/* ---------- mark ---------- */}
      <View style={{ width: 170, height: 170, alignItems: 'center', justifyContent: 'center' }}>
        <Animated.View style={{
          position: 'absolute', width: 118, height: 118, borderRadius: 59,
          backgroundColor: C.gold, opacity: glowOpacity, transform: [{ scale: glowScale }],
        }} />

        {/* slow outer ring */}
        <Animated.View style={{
          position: 'absolute', width: 152, height: 152, borderRadius: 76,
          borderWidth: 1, borderColor: 'transparent',
          borderTopColor: C.gold, borderRightColor: 'rgba(245,192,74,0.35)',
          transform: [{ rotate: ringSpin }],
        }} />

        {/* static diamond frame — echoes the crest motif without the intensity */}
        <Animated.View style={{
          position: 'absolute', width: 104, height: 104,
          borderWidth: 1, borderColor: 'rgba(245,192,74,0.42)',
          opacity: rise, transform: [{ rotate: '45deg' }, { scale: riseScale }],
        }} />

        <Animated.View style={{ opacity: rise, transform: [{ scale: riseScale }, { translateY: riseY }] }}>
          <Text style={{ fontSize: 44, color: C.gold, fontWeight: '800' }}>▲</Text>
        </Animated.View>
      </View>

      {/* ---------- wordmark ---------- */}
      <Animated.Text style={{
        color: C.text, marginTop: 16, letterSpacing: 9, fontWeight: '800', fontSize: 21,
        opacity: rise, transform: [{ translateY: riseY }],
      }}>
        LEVL
      </Animated.Text>

      {/* tagline — the ethos in three words */}
      <Animated.Text style={{
        color: C.dim, marginTop: 10, letterSpacing: 3.2, fontWeight: '600', fontSize: 10,
        opacity: rise, transform: [{ translateY: riseY }],
      }}>
        EARN EVERY LEVEL
      </Animated.Text>

      {/* diamond divider */}
      <Animated.View style={{
        flexDirection: 'row', alignItems: 'center', marginTop: 14, opacity: rise,
      }}>
        <View style={{ width: 40, height: 1, backgroundColor: 'rgba(245,192,74,0.35)' }} />
        <Text style={{ color: C.gold, fontSize: 8, marginHorizontal: 8 }}>◆</Text>
        <View style={{ width: 40, height: 1, backgroundColor: 'rgba(245,192,74,0.35)' }} />
      </Animated.View>

      {/* ---------- quote ---------- */}
      <Animated.View style={{
        marginTop: 30, alignItems: 'center', maxWidth: 340,
        opacity: quoteIn, transform: [{ translateY: quoteY }],
      }}>
        <Text style={{
          color: C.text, fontSize: 16.5, lineHeight: 25, textAlign: 'center',
          fontStyle: 'italic', fontWeight: '500',
        }}>
          “{quote.text}”
        </Text>
        <Text style={{
          color: C.gold, fontSize: 11, letterSpacing: 1.6, fontWeight: '700',
          marginTop: 14, textTransform: 'uppercase',
        }}>
          — {quote.by}
        </Text>
      </Animated.View>

      {/* ---------- progress line ---------- */}
      <View style={{
        position: 'absolute', bottom: 64, width: 128, height: 2,
        borderRadius: 1, backgroundColor: 'rgba(255,255,255,0.07)', overflow: 'hidden',
      }}>
        <Animated.View style={{ width: barW, height: 2, backgroundColor: C.gold, opacity: 0.85 }} />
      </View>
    </View>
  );
}
