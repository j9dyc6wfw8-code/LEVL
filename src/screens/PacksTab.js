// LEVL React Native — Packs: earn packs, open them with a premium reveal.
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, Text, Pressable, Animated, Easing, ScrollView, AccessibilityInfo } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Polygon } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { C, alpha, s, T, RADIUS, RARITY as RARITY_THEME } from '../theme';
import { Card, Lbl, GoldBtn, GhostBtn, CountUp, ChunkyBtn, Stagger, Segmented, Unavailable } from '../components/ui';
import { PackGlyph, RewardGlyph, LockGlyph } from '../components/ItemGlyph';
import { PACK_TYPES, packTypeByKey, packMeter, COSMETICS, PACK_TITLES, DECORATIONS } from '../engine/engine';
import { Sheet } from '../components/ui';


const rarityTheme = (key) => RARITY_THEME[key] || RARITY_THEME.common;
const haptic = (type) => { try { Haptics.notificationAsync(type); } catch (e) {} };
const hapticImpact = (style) => { try { Haptics.impactAsync(style); } catch (e) {} };

/* ============================ THE PACK OPENING ============================
 *
 * WHAT WAS WRONG WITH THE OLD ONE
 *
 * 1. It spoiled its own ending. The light rays and the radial glow were drawn in
 *    the REWARD's rarity colour from the very first frame — so an orange screen
 *    announced "legendary" a second and a half before the card turned over. The
 *    entire point of a reveal is that you do not know yet.
 * 2. The anticipation was a translate jitter: the pack slid left-right 8pt in a
 *    straight line. Jitter reads as a bug. Anticipation is built by things
 *    moving INWARD — energy gathering — not by shaking a box.
 * 3. It could not be skipped, and it ran the same 2 seconds on the fiftieth pack
 *    as on the first.
 * 4. Its three `Animated.loop`s were never stopped, so they kept running after
 *    the overlay closed.
 *
 * HOW THIS ONE IS BUILT
 *
 * Four beats, each with one job:
 *
 *   ENTER   the pack falls in and settles          — brand gold only, no tell
 *   CHARGE  motes converge, rings collapse inward,
 *           the pack breathes and strains          — still no tell
 *   BURST   white bloom, the pack splits apart     — the moment colour arrives
 *   REVEAL  rays, card flip, specular sheen, name  — rarity, finally
 *
 * Every animation is transform/opacity on the native driver, so none of it
 * touches the JS thread once started. Rarity scales the reveal rather than
 * changing it: a legendary gets more rays, a brighter bloom, a second sheen pass
 * and heavier haptics — the choreography stays identical, which is what keeps it
 * feeling like one considered thing rather than four different animations.
 *
 * Tapping during the build-up skips to the reveal, and Reduce Motion skips the
 * theatre entirely.
 * ====================================================================== */

const CARD_W = 208, CARD_H = 264;
const PACK_W = 152, PACK_H = 194;

// How many rays, and how hard the bloom hits, per rarity.
const REVEAL_WEIGHT = {
  common:    { rays: 10, bloom: 0.34, sheens: 1 },
  rare:      { rays: 14, bloom: 0.46, sheens: 1 },
  epic:      { rays: 18, bloom: 0.58, sheens: 2 },
  legendary: { rays: 24, bloom: 0.72, sheens: 2 },
  mythic:    { rays: 24, bloom: 0.78, sheens: 2 },
};

/* Rays as ONE spinning SVG. Twenty-four separate Animated views would each need
 * their own transform; a single rotating parent costs one. */
function LightRays({ color, spin, count, opacity }) {
  const rot = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  return (
    <Animated.View pointerEvents="none" style={{ position: 'absolute', opacity, transform: [{ rotate: rot }] }}>
      <Svg width={340} height={340} viewBox="0 0 340 340">
        {[...Array(count)].map((_, i) => {
          const a = (i / count) * Math.PI * 2;
          // Alternating widths so the fan reads as light rather than as a pie.
          const w = i % 2 ? 0.035 : 0.011;
          return (
            <Polygon
              key={i}
              points={`170,170 ${170 + Math.cos(a - w) * 230},${170 + Math.sin(a - w) * 230} ${170 + Math.cos(a + w) * 230},${170 + Math.sin(a + w) * 230}`}
              fill={color}
              opacity={i % 2 ? 0.075 : 0.13}
            />
          );
        })}
      </Svg>
    </Animated.View>
  );
}

/* Motes. `dir` is 'in' during the charge (they fall toward the pack, which is
 * what makes the pack feel like it is about to give) and 'out' at the burst. */
function Motes({ color, values, dir, size }) {
  // The wrapper fills the overlay and centres, so a mote's translate is measured
  // from the middle of the screen rather than from a zero-sized corner.
  return (
    <View pointerEvents="none" style={{
      position: 'absolute', top: 0, bottom: 0, left: 0, right: 0,
      alignItems: 'center', justifyContent: 'center',
    }}>
      {values.map((v, i) => {
        const ang = (i / values.length) * Math.PI * 2 + (i % 3) * 0.31;
        const far = 130 + (i % 4) * 34;
        const from = dir === 'in' ? far : 0;
        const to = dir === 'in' ? 14 : far + 40;
        const tx = v.interpolate({ inputRange: [0, 1], outputRange: [Math.cos(ang) * from, Math.cos(ang) * to] });
        const ty = v.interpolate({ inputRange: [0, 1], outputRange: [Math.sin(ang) * from, Math.sin(ang) * to] });
        const op = dir === 'in'
          ? v.interpolate({ inputRange: [0, 0.25, 0.85, 1], outputRange: [0, 0.9, 0.75, 0] })
          : v.interpolate({ inputRange: [0, 0.6, 1], outputRange: [1, 0.8, 0] });
        const sc = dir === 'in'
          ? v.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1.15] })
          : v.interpolate({ inputRange: [0, 1], outputRange: [1.15, 0.3] });
        const d = size || 5;
        return (
          <Animated.View key={i} pointerEvents="none" style={{
            position: 'absolute', width: d, height: d, borderRadius: d / 2,
            backgroundColor: color, opacity: op,
            transform: [{ translateX: tx }, { translateY: ty }, { scale: sc }],
          }} />
        );
      })}
    </View>
  );
}

/* The pack face. Rendered by the two clipped halves at the burst, so it has to
 * be one stable subtree that can be drawn twice identically. */
function PackFace({ packKey, pack }) {
  return (
    <LinearGradient
      colors={[alpha(pack.color, 0.95), C.bgElev]}
      start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }}
      style={{
        width: PACK_W, height: PACK_H, borderRadius: 18,
        alignItems: 'center', justifyContent: 'center',
        borderWidth: 1.5, borderColor: alpha(pack.color, 0.9),
      }}>
      {/* rim light along the top edge — the detail that stops it reading flat */}
      <View pointerEvents="none" style={{
        position: 'absolute', top: 1, left: 12, right: 12, height: 1,
        backgroundColor: 'rgba(255,255,255,0.35)',
      }} />
      <PackGlyph packKey={packKey} size={82} color="#ffffff" strokeWidth={1.3} />
      <Text style={{ color: '#fff', fontWeight: '800', fontSize: 13, marginTop: 10, letterSpacing: 1.4 }}>
        {pack.name.toUpperCase()}
      </Text>
    </LinearGradient>
  );
}

function PackOpening({ packKey, reward, onDone }) {
  const pack = packTypeByKey(packKey);
  const rar = rarityTheme(reward.rarity);
  const weight = REVEAL_WEIGHT[reward.rarity] || REVEAL_WEIGHT.common;
  const [phase, setPhase] = useState('enter');    // enter | charge | burst | reveal

  /* ---- drivers ---- */
  const scrim = useRef(new Animated.Value(0)).current;      // backdrop fade
  const drop = useRef(new Animated.Value(0)).current;       // pack entrance
  const breathe = useRef(new Animated.Value(0)).current;    // idle pulse
  const strain = useRef(new Animated.Value(0)).current;     // build-up tension
  const ringA = useRef(new Animated.Value(0)).current;      // collapsing rings
  const ringB = useRef(new Animated.Value(0)).current;
  const bloom = useRef(new Animated.Value(0)).current;      // white flash
  const halo = useRef(new Animated.Value(0)).current;       // rarity glow behind card
  const split = useRef(new Animated.Value(0)).current;      // pack halves parting
  const rise = useRef(new Animated.Value(0)).current;       // card rise + flip
  const sheen = useRef(new Animated.Value(0)).current;      // specular sweep
  const raysSpin = useRef(new Animated.Value(0)).current;
  const raysIn = useRef(new Animated.Value(0)).current;
  const outro = useRef(new Animated.Value(0)).current;      // label + button
  const inMotes = useRef([...Array(14)].map(() => new Animated.Value(0))).current;
  const outMotes = useRef([...Array(18)].map(() => new Animated.Value(0))).current;

  // Everything started gets registered here and stopped on unmount. The old
  // version leaked three infinite loops per pack opened.
  const running = useRef([]);
  // The build-up loops are tracked separately so the reveal can stop them. They
  // are infinite by design, and a skipped build-up must not leave fourteen mote
  // loops spinning behind the card for as long as the overlay is open.
  const charging = useRef([]);
  const timers = useRef([]);
  const done = useRef(false);
  const track = (a) => { running.current.push(a); return a; };
  const trackCharge = (a) => { charging.current.push(a); running.current.push(a); return a; };
  const later = (fn, ms) => { timers.current.push(setTimeout(fn, ms)); };
  const stopCharge = () => {
    charging.current.forEach((a) => { try { a.stop(); } catch (e) {} });
    charging.current = [];
  };

  /* ---- the reveal, as its own function so a skip can jump straight to it --- */
  const revealNow = useCallback((instant) => {
    if (done.current) return;
    done.current = true;
    stopCharge();
    setPhase('reveal');
    haptic(reward.rarity === 'legendary' || reward.rarity === 'epic'
      ? Haptics.NotificationFeedbackType.Success
      : Haptics.NotificationFeedbackType.Warning);

    if (instant) {
      // Reduce Motion, or an impatient tap: land on the finished frame.
      bloom.setValue(0);
      split.setValue(1);
      rise.setValue(1);
      raysIn.setValue(1);
      halo.setValue(1);
      outro.setValue(1);
      return;
    }

    track(Animated.loop(Animated.timing(raysSpin, {
      toValue: 1, duration: 26000, easing: Easing.linear, useNativeDriver: true,
    }))).start();

    track(Animated.parallel([
      // the pack tears open
      Animated.timing(split, { toValue: 1, duration: 520, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      // white bloom in, then straight out
      Animated.sequence([
        Animated.timing(bloom, { toValue: 1, duration: 90, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(bloom, { toValue: 0, duration: 460, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      ]),
      // rarity colour arrives HERE and not one frame earlier
      Animated.timing(halo, { toValue: 1, duration: 620, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(raysIn, { toValue: 1, delay: 120, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      // the card, on a spring so it settles rather than stopping dead
      Animated.sequence([
        Animated.delay(150),
        Animated.spring(rise, { toValue: 1, friction: 8, tension: 62, useNativeDriver: true }),
      ]),
      // outward burst of motes
      Animated.sequence([
        Animated.delay(60),
        Animated.stagger(16, outMotes.map((m) => Animated.timing(m, {
          toValue: 1, duration: 820, easing: Easing.out(Easing.quad), useNativeDriver: true,
        }))),
      ]),
      // label and Collect last, so the card is read first
      Animated.timing(outro, { toValue: 1, delay: 480, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ])).start();

    // Specular sweep across the card face, once it is facing us.
    later(() => {
      const pass = () => Animated.sequence([
        Animated.timing(sheen, { toValue: 1, duration: 780, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(sheen, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]);
      const passes = [pass()];
      if (weight.sheens > 1) passes.push(Animated.delay(420), pass());
      track(Animated.sequence(passes)).start();
    }, 480);

    if (reward.rarity === 'legendary' || reward.rarity === 'epic') {
      later(() => hapticImpact(Haptics.ImpactFeedbackStyle.Heavy), 160);
    }
  }, [reward.rarity, weight.sheens, bloom, split, rise, raysIn, raysSpin, halo, outro, sheen, outMotes]);

  /* ---- the timeline ---- */
  useEffect(() => {
    let alive = true;

    (async () => {
      // Somebody who has asked the OS for less motion should not be handed a
      // 2-second cinematic every time they open a pack.
      let reduced = false;
      try { reduced = await AccessibilityInfo.isReduceMotionEnabled(); } catch (e) {}
      if (!alive) return;

      if (reduced) { scrim.setValue(1); revealNow(true); return; }

      hapticImpact(Haptics.ImpactFeedbackStyle.Light);

      // ENTER — scrim up, pack drops in and settles.
      track(Animated.timing(scrim, { toValue: 1, duration: 220, useNativeDriver: true })).start();
      track(Animated.spring(drop, { toValue: 1, friction: 7, tension: 70, useNativeDriver: true })).start();

      later(() => {
        if (!alive || done.current) return;
        setPhase('charge');

        // CHARGE — the pack breathes, strain builds, motes and rings converge.
        trackCharge(Animated.loop(Animated.sequence([
          Animated.timing(breathe, { toValue: 1, duration: 520, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.timing(breathe, { toValue: 0, duration: 520, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        ]))).start();

        track(Animated.timing(strain, {
          toValue: 1, duration: 1150, easing: Easing.in(Easing.quad), useNativeDriver: true,
        })).start();

        trackCharge(Animated.stagger(70, inMotes.map((m) => Animated.loop(
          Animated.timing(m, { toValue: 1, duration: 900, easing: Easing.in(Easing.quad), useNativeDriver: true }),
        )))).start();

        const ring = (v, delay) => Animated.loop(Animated.sequence([
          Animated.delay(delay),
          Animated.timing(v, { toValue: 1, duration: 900, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(v, { toValue: 0, duration: 0, useNativeDriver: true }),
        ]));
        trackCharge(ring(ringA, 0)).start();
        trackCharge(ring(ringB, 450)).start();

        // Three ticks, accelerating — the audible-feeling part of anticipation.
        later(() => hapticImpact(Haptics.ImpactFeedbackStyle.Light), 260);
        later(() => hapticImpact(Haptics.ImpactFeedbackStyle.Medium), 700);
        later(() => hapticImpact(Haptics.ImpactFeedbackStyle.Medium), 980);

        // BURST
        later(() => {
          if (!alive || done.current) return;
          setPhase('burst');
          hapticImpact(Haptics.ImpactFeedbackStyle.Heavy);
          revealNow(false);
        }, 1180);
      }, 360);
    })();

    return () => {
      alive = false;
      running.current.forEach((a) => { try { a.stop(); } catch (e) {} });
      running.current = [];
      timers.current.forEach((t) => clearTimeout(t));
      timers.current = [];
    };
    // The timeline is fixed at mount by design — it must not restart because a
    // parent re-rendered mid-reveal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---- derived transforms ---- */
  const dropY = drop.interpolate({ inputRange: [0, 1], outputRange: [-120, 0] });
  const dropScale = drop.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] });
  const breatheScale = breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.035] });
  // Strain is a ROTATION wobble, not a slide: it looks like something inside is
  // trying to get out, where a translate just looks like a dropped frame.
  const strainRot = strain.interpolate({
    inputRange: [0, 0.35, 0.55, 0.72, 0.85, 0.94, 1],
    outputRange: ['0deg', '-0.7deg', '1deg', '-1.6deg', '2deg', '-2.6deg', '2.6deg'],
  });
  const strainScale = strain.interpolate({ inputRange: [0, 0.8, 1], outputRange: [1, 1.04, 1.09] });

  const topHalfY = split.interpolate({ inputRange: [0, 1], outputRange: [0, -190] });
  const botHalfY = split.interpolate({ inputRange: [0, 1], outputRange: [0, 190] });
  const halfFade = split.interpolate({ inputRange: [0, 0.45, 1], outputRange: [1, 0.55, 0] });
  const topHalfRot = split.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-13deg'] });
  const botHalfRot = split.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '11deg'] });

  const cardY = rise.interpolate({ inputRange: [0, 1], outputRange: [54, 0] });
  const cardFlip = rise.interpolate({ inputRange: [0, 1], outputRange: ['74deg', '0deg'] });
  const cardScale = rise.interpolate({ inputRange: [0, 1], outputRange: [0.86, 1] });
  const sheenX = sheen.interpolate({ inputRange: [0, 1], outputRange: [-CARD_W * 1.1, CARD_W * 1.25] });

  const bloomScale = bloom.interpolate({ inputRange: [0, 1], outputRange: [0.25, 3.2] });
  const haloScale = halo.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] });
  const haloOpacity = halo.interpolate({ inputRange: [0, 1], outputRange: [0, weight.bloom] });

  const isReveal = phase === 'reveal';
  const isCoinLike = reward.kind === 'coins' || reward.kind === 'xp';
  const kindLabel = isCoinLike
    ? (reward.kind === 'xp' ? 'Experience' : 'Coins')
    : reward.kind === 'material' ? 'Forge Material'
    : reward.kind === 'cosmetic' ? 'Cosmetic'
    : reward.kind === 'title' ? 'Title' : 'Profile Border';

  return (
    <Animated.View style={{
      position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, zIndex: 100,
      backgroundColor: 'rgba(4,5,9,0.975)', opacity: scrim,
      alignItems: 'center', justifyContent: 'center',
    }}>
      {/* Tapping the backdrop skips the build-up. After the reveal it does
          nothing — collecting is an explicit button, because it changes data. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={isReveal ? 'Reward revealed' : 'Skip the opening animation'}
        onPress={() => { if (!isReveal) revealNow(true); }}
        style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }}
      />

      {/* ---------- rarity layers: nothing here is visible before the burst -- */}
      {isReveal ? (
        <>
          <LightRays color={rar.color} spin={raysSpin} count={weight.rays} opacity={raysIn} />
          <Animated.View pointerEvents="none" style={{
            position: 'absolute', width: 330, height: 330, borderRadius: 165,
            backgroundColor: rar.color, opacity: haloOpacity,
            transform: [{ scale: haloScale }],
          }} />
          <Motes color={rar.color} values={outMotes} dir="out" size={6} />
        </>
      ) : null}

      {/* ---------- build-up: brand gold only, so the ending stays secret ---- */}
      {!isReveal ? (
        <>
          <Animated.View pointerEvents="none" style={{
            position: 'absolute', width: 260, height: 260, borderRadius: 130,
            backgroundColor: C.gold,
            opacity: breathe.interpolate({ inputRange: [0, 1], outputRange: [0.07, 0.15] }),
            transform: [{ scale: breatheScale }],
          }} />
          {phase === 'charge' ? (
            <>
              <Motes color={C.gold} values={inMotes} dir="in" size={5} />
              {[ringA, ringB].map((v, i) => (
                <Animated.View key={i} pointerEvents="none" style={{
                  position: 'absolute', width: 250, height: 250, borderRadius: 125,
                  borderWidth: 1.5, borderColor: alpha(C.gold, 0.5),
                  opacity: v.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.55, 0] }),
                  transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1.5, 0.62] }) }],
                }} />
              ))}
            </>
          ) : null}
        </>
      ) : null}

      {/* ---------- the pack ------------------------------------------------ */}
      {!isReveal ? (
        <Animated.View style={{
          transform: [{ translateY: dropY }, { scale: Animated.multiply(dropScale, Animated.multiply(breatheScale, strainScale)) }, { rotate: strainRot }],
        }}>
          <PackFace packKey={packKey} pack={pack} />
        </Animated.View>
      ) : (
        /* At the burst the same pack is drawn as two clipped halves that part.
           Clipping is what sells a tear: each half shows only its own slice of
           the identical face. */
        <View pointerEvents="none" style={{ position: 'absolute', width: PACK_W, height: PACK_H }}>
          <Animated.View style={{
            height: PACK_H / 2, overflow: 'hidden', opacity: halfFade,
            transform: [{ translateY: topHalfY }, { rotate: topHalfRot }],
          }}>
            <PackFace packKey={packKey} pack={pack} />
          </Animated.View>
          <Animated.View style={{
            height: PACK_H / 2, overflow: 'hidden', opacity: halfFade,
            transform: [{ translateY: botHalfY }, { rotate: botHalfRot }],
          }}>
            <View style={{ marginTop: -PACK_H / 2 }}>
              <PackFace packKey={packKey} pack={pack} />
            </View>
          </Animated.View>
        </View>
      )}

      {/* ---------- the white bloom, over everything ------------------------ */}
      <Animated.View pointerEvents="none" style={{
        position: 'absolute', width: 200, height: 200, borderRadius: 100,
        backgroundColor: '#fff',
        opacity: bloom.interpolate({ inputRange: [0, 1], outputRange: [0, 0.92] }),
        transform: [{ scale: bloomScale }],
      }} />

      {/* ---------- the reward ---------------------------------------------- */}
      {isReveal ? (
        <View style={{ alignItems: 'center' }}>
          <Animated.Text style={{
            color: rar.color, fontWeight: '800', fontSize: 13, letterSpacing: 4,
            textTransform: 'uppercase', marginBottom: 14, opacity: outro,
            transform: [{ translateY: outro.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
          }}>
            {rar.name}
          </Animated.Text>

          <Animated.View style={{
            opacity: rise,
            transform: [{ perspective: 900 }, { translateY: cardY }, { rotateY: cardFlip }, { scale: cardScale }],
          }}>
            <LinearGradient
              colors={rar.grad} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }}
              style={{
                width: CARD_W, height: CARD_H, borderRadius: 22,
                alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                borderWidth: 1.5, borderColor: rar.color,
                shadowColor: rar.color, shadowOpacity: 0.75, shadowRadius: 26, shadowOffset: { width: 0, height: 0 },
              }}>
              {/* inner frame — a hairline inset reads as a printed card */}
              <View pointerEvents="none" style={{
                position: 'absolute', top: 7, left: 7, right: 7, bottom: 7,
                borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)',
              }} />
              <RewardGlyph reward={reward} size={100} color="#ffffff" strokeWidth={1.25} />
              {isCoinLike ? (
                <CountUp
                  value={reward.amount}
                  suffix={reward.kind === 'xp' ? ' XP' : ' COINS'}
                  style={{ color: '#fff', fontWeight: '800', fontSize: 26, marginTop: 10, fontVariant: ['tabular-nums'] }}
                />
              ) : (
                <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16, marginTop: 10, textAlign: 'center', paddingHorizontal: 14 }}>
                  {reward.name}
                </Text>
              )}
              <Text style={{
                color: 'rgba(255,255,255,0.72)', fontSize: 11, marginTop: 7,
                fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.4,
              }}>
                {kindLabel}
              </Text>

              {/* specular sweep — one bright band travelling across the face */}
              <Animated.View pointerEvents="none" style={{
                position: 'absolute', top: -CARD_H * 0.3, bottom: -CARD_H * 0.3, width: 78,
                transform: [{ translateX: sheenX }, { rotate: '18deg' }],
              }}>
                <LinearGradient
                  colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.42)', 'rgba(255,255,255,0)']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={{ flex: 1 }}
                />
              </Animated.View>
            </LinearGradient>
          </Animated.View>

          <Animated.View style={{
            marginTop: 26, width: CARD_W, opacity: outro,
            transform: [{ translateY: outro.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
          }}>
            <GoldBtn onPress={onDone}>Collect</GoldBtn>
          </Animated.View>
        </View>
      ) : null}
    </Animated.View>
  );
}

/* -------------------------------- screen -------------------------------- */
export default function PacksTab({ data, dv, openPackH, grantTestPack, goBack, enabled = true }) {
  const [opening, setOpening] = useState(null); // { packKey, reward }
  const [catalogueOpen, setCatalogueOpen] = useState(false);
  const meter = packMeter(data);
  const pulls = data.recentPulls || [];
  const packs = data.packs || { standard: 0, prime: 0, elite: 0 };
  const totalPacks = (packs.standard || 0) + (packs.prime || 0) + (packs.elite || 0);

  if (!enabled) {
    return <Unavailable title="Packs are paused" body="Pack opening is switched off for a moment. Your unopened packs are safe and will be waiting." />;
  }

  const doOpen = (packKey) => {
    if ((packs[packKey] || 0) <= 0) return;
    const reward = openPackH(packKey); // App applies + returns the reward
    if (reward) setOpening({ packKey, reward });
  };

  return (
    <View>
      {goBack && (
        <Pressable onPress={goBack} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
          <Text style={{ fontSize: 18, color: C.gold, fontWeight: '800', marginRight: 4 }}>‹</Text>
          <Text style={{ fontSize: 13, color: C.gold, fontWeight: '700' }}>Forge</Text>
        </Pressable>
      )}
      <Card style={s.hero}>
        <Lbl>Reward Packs</Lbl>
        <Text style={{ fontSize: 15, color: C.mut, fontWeight: '700', lineHeight: 21 }}>
          One pack, one reward. Rarer packs, better odds.
        </Text>
        <View style={[s.row, { marginTop: 12 }]}>
          <View style={{ flex: 1, backgroundColor: C.panel2, borderWidth: 1, borderColor: C.line, borderRadius: RADIUS.md, padding: 12, alignItems: 'center' }}>
            <Text style={[s.label, { marginBottom: 2 }]}>Packs Owned</Text>
            <Text style={{ fontSize: 22, fontWeight: '800', color: C.gold, fontVariant: ['tabular-nums'] }}>{totalPacks}</Text>
          </View>
          <View style={{ width: 10 }} />
          <View style={{ flex: 1, backgroundColor: C.panel2, borderWidth: 1, borderColor: C.line, borderRadius: RADIUS.md, padding: 12, alignItems: 'center' }}>
            <Text style={[s.label, { marginBottom: 2 }]}>Opened</Text>
            <Text style={{ fontSize: 22, fontWeight: '800', color: C.text, fontVariant: ['tabular-nums'] }}>{data.packsOpened || 0}</Text>
          </View>
        </View>
      </Card>

      {/* progress to the next pack earned purely by training */}
      <Card>
        <View style={s.between}>
          <Lbl style={{ marginBottom: 0 }}>Next Training Pack</Lbl>
          <Text style={{ fontSize: 11, color: C.gold, fontVariant: ['tabular-nums'], fontWeight: '800' }}>
            {Math.round(meter.into)} / {meter.need} XP
          </Text>
        </View>
        <View style={{ height: 10, borderRadius: 5, backgroundColor: C.panel2, marginTop: 10, overflow: 'hidden' }}>
          <View style={{ width: Math.max(2, meter.pct) + '%', height: 10, backgroundColor: C.gold }} />
        </View>
        <Text style={{ fontSize: 12.5, color: C.dim, marginTop: 8, lineHeight: 18 }}>
          Every {meter.need} XP of training earns a pack — on top of level-up packs.
        </Text>
      </Card>

      <Stagger step={70}>
      {Object.values(PACK_TYPES).map((pack) => {
        const count = packs[pack.key] || 0;
        const has = count > 0;
        return (
          <Card key={pack.key} style={has ? { borderWidth: 1, borderColor: pack.color } : null}>
            <View style={s.row}>
              <LinearGradient colors={[pack.color, C.bgElev]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={{ width: 64, height: 78, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: pack.color }}>
                <PackGlyph packKey={pack.key} size={40} color="#ffffff" strokeWidth={1.5} />
              </LinearGradient>
              <View style={{ flex: 1, marginLeft: 14 }}>
                <Text style={{ fontSize: 16, fontWeight: '800', color: C.text }}>{pack.name}</Text>
                {/* odds as a single segmented bar — reads at a glance, no wrapping text */}
                <View style={{ flexDirection: 'row', height: 6, borderRadius: 3, overflow: 'hidden', marginTop: 8, backgroundColor: C.panel2 }}>
                  {['common', 'rare', 'epic', 'legendary'].map((rk) => {
                    const pct = (pack.odds[rk] || 0) * 100;
                    if (pct <= 0) return null;
                    return <View key={rk} style={{ width: pct + '%', backgroundColor: rarityTheme(rk).color }} />;
                  })}
                </View>
                {/* compact legend: coloured dot + percent, evenly spaced */}
                <View style={[s.row, { marginTop: 8, flexWrap: 'wrap' }]}>
                  {['common', 'rare', 'epic', 'legendary'].map((rk) => (
                    <View key={rk} style={{ flexDirection: 'row', alignItems: 'center', marginRight: 12, marginBottom: 2 }}>
                      <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: rarityTheme(rk).color, marginRight: 4 }} />
                      <Text style={{ fontSize: 11, color: C.mut, fontWeight: '700', fontVariant: ['tabular-nums'] }}>
                        {Math.round((pack.odds[rk] || 0) * 100)}%
                      </Text>
                    </View>
                  ))}
                </View>
                <Text style={{ fontSize: 12, color: C.dim, marginTop: 6, fontVariant: ['tabular-nums'] }}>Own: {count}</Text>
              </View>
            </View>
            <View style={{ marginTop: 14 }}>
              {has ? (
                <ChunkyBtn onPress={() => doOpen(pack.key)} tone="gold">
                  OPEN {pack.name.toUpperCase()}
                </ChunkyBtn>
              ) : (
                <View style={[s.ghostBtn]}>
                  <Text style={s.ghostTxt}>None yet — earn by playing</Text>
                </View>
              )}
            </View>
          </Card>
        );
      })}
      </Stagger>

      {pulls.length > 0 && (
        <Card>
          <Lbl>Recent Pulls</Lbl>
          {pulls.slice(0, 8).map((p) => {
            const rt = rarityTheme(p.rarity);
            return (
              <View key={p.id} style={[s.between, { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.line, alignItems: 'center' }]}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: rt.color, marginRight: 10 }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, color: C.text, fontWeight: '700' }} numberOfLines={1}>{p.name}</Text>
                  <Text style={{ fontSize: 10.5, color: C.dim, fontVariant: ['tabular-nums'], marginTop: 1 }}>
                    {String(p.rarity || '').toUpperCase()} · {packTypeByKey(p.pack).name}
                  </Text>
                </View>
              </View>
            );
          })}
        </Card>
      )}

      {/* Collections summary */}
      <Card>
        <Lbl>Your Collection</Lbl>
        <View style={s.row}>
          {[['Titles', (data.titles || []).length], ['Borders', (data.decorations || []).length], ['Cosmetics', (data.owned || []).length]].map((c, i) => (
            <View key={c[0]} style={{ flex: 1, alignItems: 'center', paddingVertical: 6, borderLeftWidth: i > 0 ? 1 : 0, borderLeftColor: C.line }}>
              <Text style={{ fontSize: 20, fontWeight: '800', color: C.text, fontVariant: ['tabular-nums'] }}>{c[1]}</Text>
              <Text style={{ fontSize: 10, color: C.dim, marginTop: 2, fontWeight: '700' }}>{c[0]}</Text>
            </View>
          ))}
        </View>
        <Text style={{ fontSize: 14, color: C.mut, marginTop: 11, fontWeight: '700' }}>
          Equip titles and borders in Player. Packs are cosmetic only.
        </Text>
        <ChunkyBtn onPress={() => setCatalogueOpen(true)} tone="slate" style={{ marginTop: 12 }}>
          BROWSE CATALOGUE
        </ChunkyBtn>
        {grantTestPack && totalPacks === 0 && (
          <GhostBtn onPress={grantTestPack} style={{ marginTop: 12, borderColor: C.gold }} txtStyle={{ color: C.gold }}>
            Grant test packs (try the reveal)
          </GhostBtn>
        )}
      </Card>

      {catalogueOpen && <Catalogue data={data} onClose={() => setCatalogueOpen(false)} />}

      {opening && (
        <PackOpening packKey={opening.packKey} reward={opening.reward} onDone={() => setOpening(null)} />
      )}
    </View>
  );
}

/* ----------------------------- item catalogue ----------------------------
 * Every collectible in the game in one place, with what you own marked and
 * what you don't shown locked. Seeing the gaps is most of the pull to open
 * another pack — and it doubles as an honest odds/collection reference.
 */
function Catalogue({ data, onClose }) {
  const [tab, setTab] = useState('cosmetic');
  const [ownedOnly, setOwnedOnly] = useState(false);

  const owned = new Set(data.owned || []);
  const titles = new Set(data.titles || []);
  const decos = new Set(data.decorations || []);

  const items = React.useMemo(() => {
    if (tab === 'title') {
      return PACK_TITLES.map((t) => ({ id: t.id, name: t.name, rarity: t.rarity, kind: 'title', have: titles.has(t.id) }));
    }
    if (tab === 'decoration') {
      return DECORATIONS.filter((d) => d.id !== 'deco_none')
        .map((d) => ({ id: d.id, name: d.name, rarity: d.rarity, kind: 'decoration', have: decos.has(d.id) }));
    }
    return COSMETICS.filter((c) => !c.free)
      .map((c) => ({ id: c.id, name: c.name, rarity: c.rarity === 'mythic' ? 'legendary' : c.rarity, kind: 'cosmetic', have: owned.has(c.id), slot: c.slot }));
  }, [tab, data.owned, data.titles, data.decorations]); // eslint-disable-line react-hooks/exhaustive-deps

  const shown = ownedOnly ? items.filter((i) => i.have) : items;
  const haveCount = items.filter((i) => i.have).length;
  const pct = items.length ? Math.round((haveCount / items.length) * 100) : 0;

  const TABS = [['cosmetic', 'Cosmetics'], ['title', 'Titles'], ['decoration', 'Borders']];

  return (
    <Sheet visible title="Catalogue" onClose={onClose}>
      <View style={{ paddingHorizontal: 16, paddingTop: 10 }}>
        <Segmented options={TABS} value={tab} onChange={setTab} />

        <View style={[s.between, { marginTop: 12, alignItems: 'center' }]}>
          <Text style={{ fontSize: 13, color: C.text, fontWeight: '800', fontVariant: ['tabular-nums'] }}>
            {haveCount} / {items.length} <Text style={{ color: C.gold }}>· {pct}%</Text>
          </Text>
          <Pressable onPress={() => setOwnedOnly((v) => !v)} hitSlop={8}
            accessibilityRole="button" accessibilityLabel={ownedOnly ? 'Show all items' : 'Show owned only'}
            style={{
              paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999,
              backgroundColor: ownedOnly ? C.goldSoft : 'transparent',
              borderWidth: 1, borderColor: ownedOnly ? C.gold : C.line,
            }}>
            <Text style={{ fontSize: 11.5, fontWeight: '800', color: ownedOnly ? C.gold : C.dim }}>Owned only</Text>
          </Pressable>
        </View>

        <View style={{ height: 6, borderRadius: 3, backgroundColor: C.panel2, marginTop: 10, overflow: 'hidden' }}>
          <View style={{ width: Math.max(2, pct) + '%', height: 6, backgroundColor: C.gold }} />
        </View>
      </View>

      <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ padding: 16, paddingTop: 12 }}>
        {shown.length === 0 ? (
          <Text style={{ fontSize: 13, color: C.dim, textAlign: 'center', paddingVertical: 24 }}>
            Nothing here yet — open a pack to start the set.
          </Text>
        ) : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
            {shown.map((it) => {
              const rt = rarityTheme(it.rarity);
              return (
                <View key={it.id} style={{
                  width: '48.5%', marginBottom: 10, padding: 11, borderRadius: 12,
                  backgroundColor: it.have ? C.panel2 : 'transparent',
                  borderWidth: 1, borderColor: it.have ? rt.color : C.line,
                  opacity: it.have ? 1 : 0.55,
                }}>
                  <View style={[s.between, { alignItems: 'center' }]}>
                    {it.have
                      ? <RewardGlyph reward={it} size={24} color={rarityTheme(it.rarity).color} />
                      : <LockGlyph size={20} color={C.faint} />}
                    <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: rt.color }} />
                  </View>
                  <Text style={{ fontSize: 12.5, fontWeight: '800', color: it.have ? C.text : C.mut, marginTop: 7 }} numberOfLines={2}>
                    {it.name}
                  </Text>
                  <Text style={{ fontSize: 9.5, fontWeight: '800', color: rt.color, marginTop: 3, fontVariant: ['tabular-nums'] }}>
                    {String(it.rarity || '').toUpperCase()}
                  </Text>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </Sheet>
  );
}
