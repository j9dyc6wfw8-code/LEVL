// LEVL React Native — shared UI atoms, overlays, and SVG charts
import React, { useEffect, useRef, useState } from 'react';
import { View, Pressable, Animated, Easing, Modal, StyleSheet, AccessibilityInfo, Platform } from 'react-native';
import { Text, TextInput } from './Text';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Polygon, Polyline, Line, Circle, Rect, Path, G, Text as SvgText } from 'react-native-svg';
import { C, s, GRAD, T, RADIUS, MOTION, alpha } from '../theme';
import haptics from '../services/haptics';

/* expo-blur is already a dependency AND already linked in ios/Podfile.lock, so
 * this costs no new native module and no extra rebuild. It is still required
 * defensively: if the module is ever unlinked, Glass must degrade to an opaque
 * panel rather than take the navigation layer down with it. */
let BlurView = null;
try { BlurView = require('expo-blur').BlurView || null; } catch (e) { BlurView = null; }
import { STAT_META } from '../engine/engine';

/* ------------------------------- atoms ---------------------------------- */
export const Card = ({ children, style }) => <View style={[s.card, style]}>{children}</View>;
export const Lbl = ({ children, style }) => <Text style={[s.label, style]}>{children}</Text>;

// Gradient hero card — used for the top card on each screen for depth.
export const HeroCard = ({ children, style, colors }) => (
  <View style={[s.card, { padding: 0, overflow: 'hidden', borderColor: C.line }, style]}>
    <LinearGradient colors={colors || GRAD.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ padding: 16 }}>
      {children}
    </LinearGradient>
  </View>
);

export const Chip = ({ active, onPress, children }) => {
  const sc = useRef(new Animated.Value(1)).current;
  return (
    <Pressable
      onPressIn={() => Animated.spring(sc, { toValue: 0.94, useNativeDriver: true, speed: 40 }).start()}
      onPressOut={() => Animated.spring(sc, { toValue: 1, useNativeDriver: true, speed: 40 }).start()}
      onPress={onPress}>
      <Animated.View style={[s.chip, active && s.chipOn, { transform: [{ scale: sc }] }]}>
        <Text style={[s.chipTxt, active && s.chipTxtOn]}>{children}</Text>
      </Animated.View>
    </Pressable>
  );
};

// Progress bar with inner gloss — reads as a physical gauge filling, not a div.
export const PBar = ({ pct, color, height }) => {
  const w = useRef(new Animated.Value(0)).current;
  const target = Math.max(0, Math.min(100, pct || 0));
  const H = height || 10;
  useEffect(() => {
    Animated.spring(w, { toValue: target, ...MOTION.gauge }).start();
  }, [target, w]);
  const width = w.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] });
  const fill = color || C.gold;
  return (
    <View style={{ height: H, backgroundColor: C.sunken, borderRadius: H / 2, overflow: 'hidden' }}>
      <Animated.View style={{ width, height: '100%', borderRadius: H / 2, backgroundColor: fill, overflow: 'hidden' }}>
        <View style={{
          position: 'absolute', top: 1.5, left: 3, right: 3, height: Math.max(2, H * 0.3),
          backgroundColor: 'rgba(255,255,255,0.28)', borderRadius: H,
        }} />
      </Animated.View>
    </View>
  );
};

// Number that counts up to its value — for XP, coins, ratings.
export function CountUp({ value, style, prefix, suffix, duration }) {
  const [display, setDisplay] = useState(0);
  const av = useRef(new Animated.Value(0)).current;
  const prev = useRef(0);
  useEffect(() => {
    const from = prev.current;
    av.setValue(0);
    const id = av.addListener(({ value: v }) => setDisplay(Math.round(from + (value - from) * v)));
    Animated.timing(av, { toValue: 1, duration: duration || 800, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start(() => { prev.current = value; });
    return () => av.removeListener(id);
  }, [value, av, duration]);
  return <Text style={style}>{(prefix || '') + display.toLocaleString() + (suffix || '')}</Text>;
}

// Badge pill with a rarity/semantic color.
export const Badge = ({ color, children, filled }) => (
  <View style={[s.badge, { borderColor: color, backgroundColor: filled ? color : 'transparent' }]}>
    <Text style={[s.badgeTxt, { color: filled ? C.ink : color }]}>{children}</Text>
  </View>
);

/* ========================= game-feel components ========================== */
// The signature: a button with a solid bevel edge beneath it. On press the face
// drops onto the edge, so it physically compresses. This is what makes game UI
// feel tactile rather than flat.
export function ChunkyBtn({ onPress, children, disabled, tone, style, small }) {
  const T = {
    gold:  { face: '#f5c542', edge: '#a8760c', text: C.panel },
    green: { face: '#3ddc97', edge: '#1d8f5e', text: '#0a1f16' },
    red:   { face: '#f2596a', edge: '#a32b3a', text: '#2a0d11' },
    slate: { face: '#242c3c', edge: '#151a25', text: '#e8ebf2' },
  }[tone || 'gold'];
  const DEPTH = small ? 3 : 5;
  const press = useRef(new Animated.Value(0)).current;
  const down = () => Animated.timing(press, { toValue: 1, duration: 60, useNativeDriver: true }).start();
  const up = () => Animated.spring(press, { toValue: 0, ...MOTION.snappy }).start();
  const drop = press.interpolate({ inputRange: [0, 1], outputRange: [0, DEPTH] });

  return (
    <Pressable
      onPressIn={() => !disabled && down()}
      onPressOut={up}
      onPress={disabled ? undefined : onPress}
      style={[{ height: (small ? 40 : 52) + DEPTH }, style]}>
      {/* the solid edge that sits beneath the face */}
      <View style={{
        position: 'absolute', left: 0, right: 0, top: DEPTH, height: small ? 40 : 52,
        backgroundColor: disabled ? C.panel2 : T.edge, borderRadius: small ? 10 : 14,
      }} />
      {/* the face — drops onto the edge when pressed */}
      <Animated.View style={{
        position: 'absolute', left: 0, right: 0, top: 0, height: small ? 40 : 52,
        backgroundColor: disabled ? '#222836' : T.face, borderRadius: small ? 10 : 14,
        alignItems: 'center', justifyContent: 'center',
        transform: [{ translateY: drop }],
      }}>
        {/* top gloss — a subtle sheen across the upper half */}
        <View style={{
          position: 'absolute', top: 2, left: 4, right: 4, height: (small ? 40 : 52) * 0.42,
          backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: small ? 8 : 11,
        }} />
        <Text style={{
          color: disabled ? C.dim : T.text, fontWeight: '800',
          fontSize: small ? 12.5 : 14.5, letterSpacing: 0.6,
        }}>{children}</Text>
      </Animated.View>
    </Pressable>
  );
}

// A weighted progress bar with inner gloss — reads as a physical gauge filling.
export function StatBar({ pct, color, height, glow }) {
  const w = useRef(new Animated.Value(0)).current;
  const target = Math.max(0, Math.min(100, pct || 0));
  const H = height || 14;
  useEffect(() => {
    Animated.spring(w, { toValue: target, ...MOTION.gauge }).start();
  }, [target, w]);
  const width = w.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] });
  const fill = color || C.gold;
  return (
    <View style={{
      height: H, backgroundColor: C.sunken, borderRadius: H / 2,
      overflow: 'hidden', borderWidth: 1, borderColor: '#000',
    }}>
      <Animated.View style={{ width, height: '100%', borderRadius: H / 2, backgroundColor: fill, overflow: 'hidden' }}>
        {/* gloss along the top of the fill */}
        <View style={{
          position: 'absolute', top: 1.5, left: 3, right: 3, height: H * 0.32,
          backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: H,
        }} />
      </Animated.View>
      {glow ? (
        <View pointerEvents="none" style={{
          position: 'absolute', top: 0, bottom: 0, left: 0, right: 0,
          borderRadius: H / 2, borderWidth: 1, borderColor: fill + '55',
        }} />
      ) : null}
    </View>
  );
}

// A hero stat — the big trophy number. Treats progression as a prize, not data.
export function HeroStat({ label, value, color, suffix, size }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={{
        fontSize: 10, fontWeight: '700', letterSpacing: 1.4, color: C.dim,
        textTransform: 'uppercase', marginBottom: 3,
      }}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
        <Text style={{
          fontSize: size || 30, fontWeight: '800', color: color || C.text,
          letterSpacing: -1, textShadowColor: (color || C.gold) + '66',
          textShadowRadius: 12, textShadowOffset: { width: 0, height: 0 },
        }}>{typeof value === 'number' ? value.toLocaleString() : value}</Text>
        {suffix ? <Text style={{ fontSize: 12, fontWeight: '700', color: C.dim, marginLeft: 3 }}>{suffix}</Text> : null}
      </View>
    </View>
  );
}

/* ============================ glass surface =============================
 * Real iOS material, not a painted imitation.
 *
 * WHAT THIS USED TO SAY, AND WHY IT CHANGED
 * This component used to fake glass with a flat translucent fill, on the
 * reasoning that expo-blur is a native module and native modules cost a
 * rebuild. That reasoning has expired: expo-blur is in package.json AND in
 * ios/Podfile.lock, so the binary already carries it. Using it now costs
 * nothing that has not already been paid, and Expo Go bundles it too.
 *
 * WHY IT IS WORTH USING
 * Blur only reads as glass when live content moves behind it. Both surfaces
 * this is used on qualify: the tab bar is absolutely positioned over a
 * ScrollView with 110pt of bottom padding, so cards genuinely travel underneath
 * it, and a sheet sits over the whole screen. Both were previously 94% opaque,
 * which is a solid panel with extra steps.
 *
 * THE RULES, WHICH HAVE NOT CHANGED
 *   · Navigation and control layer ONLY — the tab bar and sheets.
 *   · Never on content, never on primary buttons. Blurred content is unreadable
 *     content, and Apple themselves walked back default transparency after
 *     legibility complaints.
 *   · Always pair the blur with a scrim and a rim light. The blur supplies
 *     depth; the scrim is what keeps text legible over a bright photo.
 *   · Honour Reduce Transparency. Someone who has asked the OS for less
 *     translucency gets a solid panel — this is an accessibility setting, not a
 *     preference to override.
 */

// iOS exposes Reduce Transparency; Android does not, so it resolves false there.
function useReduceTransparency() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let alive = true;
    try {
      if (AccessibilityInfo.isReduceTransparencyEnabled) {
        AccessibilityInfo.isReduceTransparencyEnabled()
          .then((v) => { if (alive) setReduce(!!v); })
          .catch(() => {});
      }
    } catch (e) { /* older RN, or a platform without the API */ }
    let sub = null;
    try {
      sub = AccessibilityInfo.addEventListener('reduceTransparencyChanged', (v) => setReduce(!!v));
    } catch (e) { sub = null; }
    return () => { alive = false; try { if (sub) sub.remove(); } catch (e) {} };
  }, []);
  return reduce;
}

export function Glass({
  children, style, tint, radius, rim, border, intensity, pointerEvents, solid,
}) {
  const reduce = useReduceTransparency();
  const R = radius != null ? radius : RADIUS.lg;
  /* Any one of these paints an opaque panel instead.
   *
   * ANDROID IS DELIBERATELY EXCLUDED. Android has no free backdrop blur; the
   * only route is expo-blur's `experimentalBlurMethod`, which renders the view
   * hierarchy into a bitmap every frame. It is experimental by name, it fights
   * with elevation and z-ordering, and it is a frame-rate risk on exactly the
   * surface that is on screen 100% of the time. A clean opaque bar beats a
   * janky translucent one, so real glass is iOS-only and Android keeps the
   * solid treatment it already had. */
  const flat = !!solid || reduce || !BlurView || Platform.OS !== 'ios';

  return (
    <View pointerEvents={pointerEvents} style={[{ borderRadius: R, overflow: 'hidden' }, style]}>
      {flat ? (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: tint || 'rgba(20,23,32,0.97)' }]} />
      ) : (
        <>
          <BlurView
            // A SYSTEM material rather than a plain dark blur: it is the same
            // effect UIKit gives its own chrome, so the bar reads as part of iOS
            // rather than as a dark rectangle that happens to be blurry.
            tint="systemChromeMaterialDark"
            intensity={intensity != null ? intensity : 60}
            style={StyleSheet.absoluteFill}
          />
          {/* Tint on TOP of the blur, at low alpha. The old 0.94 fill is what
              made the previous surface look flat — nothing could show through. */}
          <View style={[StyleSheet.absoluteFill, { backgroundColor: tint || 'rgba(20,23,32,0.52)' }]} />
        </>
      )}

      {/* scrim — keeps text legible whatever sits behind */}
      <LinearGradient
        colors={['rgba(255,255,255,0.06)', 'rgba(0,0,0,0.10)']}
        start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
        pointerEvents="none"
        style={StyleSheet.absoluteFill}
      />
      {/* rim light — the single detail that sells "glass edge" */}
      {rim !== false && (
        <View pointerEvents="none" style={{
          position: 'absolute', top: 0, left: 0, right: 0,
          height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.16)',
        }} />
      )}
      {border !== false && (
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, {
          borderRadius: R, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
        }]} />
      )}
      {children}
    </View>
  );
}

/* ============================ segmented control ==========================
 * ONE segmented control for the whole app.
 *
 * There were eight hand-rolled versions of this: four on a sunken track and
 * four on a raised C.panel2 one, with radii of 9 / 12 / RADIUS.md, track
 * padding of 3 or 4, and heights set by paddingVertical rather than a minimum —
 * so several landed under Apple's 44pt touch floor once track padding was
 * counted. The same control looked like a different control on every screen.
 *
 * The kept behaviour is CompeteTab's, the best of the eight: a SUNKEN track
 * with a raised pill, so the active segment reads as physically ON rather than
 * merely tinted. 38pt items inside 3pt of track padding come to exactly 44pt.
 *
 * options: ['key', 'Label'] tuples, or { key, label, sub, badge, tint, a11y }.
 *   sub   — a second, smaller line (Cardio uses it for the count per discipline)
 *   badge — a count pill (the Forge uses it for unclaimed pass rewards)
 *   tint  — overrides the active colour for that one segment
 */
export function Segmented({ options, value, onChange, style, tint, dense }) {
  const items = (options || []).filter(Boolean).map((o) => (
    Array.isArray(o) ? { key: o[0], label: o[1] } : o
  ));
  const H = dense ? 34 : 38;
  return (
    <View style={[{
      flexDirection: 'row', backgroundColor: C.sunken, borderRadius: RADIUS.md,
      padding: 3, borderWidth: 1, borderColor: C.lineSoft,
    }, style]}>
      {items.map((it) => {
        const on = value === it.key;
        const active = it.tint || tint || C.gold;
        return (
          <Pressable
            key={it.key}
            onPress={() => { haptics.selection(); onChange(it.key); }}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={it.a11y || it.label}
            style={{
              flex: 1, minHeight: H, borderRadius: RADIUS.sm,
              alignItems: 'center', justifyContent: 'center',
              paddingHorizontal: 4,
              backgroundColor: on ? active : 'transparent',
            }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              {/* Progress carries FIVE segments, which on an SE leaves ~69pt
                  each. Shrinking beats truncating: "Overview" must never render
                  as "Overvie…". */}
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.82}
                style={{
                  fontSize: dense ? 12 : 12.5, fontWeight: on ? '800' : '600',
                  color: on ? C.ink : C.mut,
                }}>
                {it.label}
              </Text>
              {it.badge ? (
                <View style={{
                  minWidth: 16, height: 16, borderRadius: 8, paddingHorizontal: 4, marginLeft: 5,
                  alignItems: 'center', justifyContent: 'center',
                  backgroundColor: on ? alpha(C.ink, 0.22) : C.green,
                }}>
                  <Text style={{ fontSize: 10, fontWeight: '800', color: C.ink }}>{it.badge}</Text>
                </View>
              ) : null}
            </View>
            {it.sub != null ? (
              <Text style={{
                fontSize: 9.5, fontWeight: '700', marginTop: 1,
                color: on ? alpha(C.ink, 0.6) : C.faint,
                fontVariant: ['tabular-nums'],
              }}>
                {it.sub}
              </Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

/* A subsystem switched off from app_config.
 *
 * The point of a kill switch is that the affected screen says something HONEST
 * rather than appearing broken. "Temporarily unavailable" with a reason reads as
 * a company in control; an empty feed that silently fails reads as a dead app.
 */
export function Unavailable({ title, body }) {
  return (
    <View style={[s.card, { alignItems: 'center', paddingVertical: 30 }]}>
      <View style={{
        width: 40, height: 40, borderRadius: 20, marginBottom: 12,
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: alpha(C.orange, 0.14),
        borderWidth: 1, borderColor: alpha(C.orange, 0.4),
      }}>
        <Text style={{ fontSize: 19, fontWeight: '800', color: C.orange }}>!</Text>
      </View>
      <Text style={{ ...T.callout, fontWeight: '600', color: C.text, textAlign: 'center' }}>
        {title || 'Temporarily unavailable'}
      </Text>
      <Text style={{
        ...T.caption, color: C.mut, textAlign: 'center',
        marginTop: 6, lineHeight: 18, maxWidth: 300,
      }}>
        {body || 'We have switched this off for a moment while we fix something. Everything else still works, and nothing you have logged is affected.'}
      </Text>
    </View>
  );
}

/* ---------------------- dropdown / sheet picker ------------------------- */
// A tap target that reads like an iOS form row, opening a proper bottom sheet.
// Replaces nested scroll lists — the page scrolls, the sheet scrolls, never both.
export function SelectRow({ label, value, placeholder, onPress }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={{
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      backgroundColor: C.sunken, borderWidth: 1, borderColor: C.lineSoft,
      borderRadius: RADIUS.md, paddingHorizontal: 14, paddingVertical: 13,
    }}>
      <View style={{ flex: 1 }}>
        {label ? <Text style={{ fontSize: 10, color: C.dim, fontWeight: '700', letterSpacing: 1, marginBottom: 3 }}>{label.toUpperCase()}</Text> : null}
        <Text style={{ fontSize: 16, fontWeight: value ? '600' : '400', color: value ? C.text : C.dim }} numberOfLines={1}>
          {value || placeholder}
        </Text>
      </View>
      <Svg width={12} height={12} viewBox="0 0 12 12" style={{ marginLeft: 10 }}>
        <Polyline points="2,4 6,8.5 10,4" stroke={C.dim} strokeWidth={1.7} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </Pressable>
  );
}

// Bottom sheet: slides up, dims the page, scrolls internally. Feels native.
export function Sheet({ visible, title, onClose, children }) {
  const y = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.timing(y, {
      toValue: visible ? 0 : 1, duration: visible ? 260 : 200,
      easing: visible ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic), useNativeDriver: true,
    }).start();
  }, [visible, y]);
  if (!visible) return null;
  const translate = y.interpolate({ inputRange: [0, 1], outputRange: [0, 600] });
  const fade = y.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={{ flex: 1, backgroundColor: 'rgba(4,5,9,0.6)', opacity: fade }}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
      </Animated.View>
      <Animated.View style={{
        position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '82%',
        borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden',
        transform: [{ translateY: translate }],
      }}>
        {/* Real material. The parent already clips to the sheet's rounded top,
            so this fills it squarely and lets the corners do the shaping. */}
        <Glass
          pointerEvents="none"
          style={StyleSheet.absoluteFill}
          radius={0}
          border={false}
          tint="rgba(26,30,42,0.55)"
          intensity={70}
        />
        <View style={{ alignItems: 'center', paddingTop: 10, paddingBottom: 4 }}>
          <View style={{ width: 38, height: 4, borderRadius: 2, backgroundColor: C.line }} />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 10 }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: C.text, letterSpacing: -0.2 }}>{title}</Text>
          <Pressable accessibilityRole="button" onPress={onClose} hitSlop={10}>
            <Text style={{ fontSize: 14, color: C.gold, fontWeight: '600' }}>Done</Text>
          </Pressable>
        </View>
        <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: C.line }} />
        <View style={{ paddingBottom: 34, flexShrink: 1 }}>{children}</View>
      </Animated.View>
    </Modal>
  );
}

// Collapsible section — keeps screens calm, opens with a smooth chevron turn.
export function Collapsible({ title, subtitle, children, defaultOpen }) {
  const [open, setOpen] = useState(!!defaultOpen);
  const rot = useRef(new Animated.Value(defaultOpen ? 1 : 0)).current;
  const toggle = () => {
    const next = !open;
    setOpen(next);
    Animated.timing(rot, { toValue: next ? 1 : 0, duration: 200, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  };
  const spin = rot.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });
  return (
    <View style={s.card}>
      <Pressable accessibilityRole="button" onPress={toggle} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: C.text, letterSpacing: -0.2 }}>{title}</Text>
          {subtitle ? <Text style={{ fontSize: 12, color: C.dim, marginTop: 2 }}>{subtitle}</Text> : null}
        </View>
        <Animated.View style={{ transform: [{ rotate: spin }], marginLeft: 10 }}>
          <Svg width={13} height={13} viewBox="0 0 12 12">
            <Polyline points="2,4 6,8.5 10,4" stroke={C.mut} strokeWidth={1.7} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </Animated.View>
      </Pressable>
      {open && (
        <FadeIn style={{ marginTop: 14 }}>
          {children}
        </FadeIn>
      )}
    </View>
  );
}

/* The most-repeated interaction in LEVL. A four-set session touches this eight
 * times; a year of training, thousands. Two changes, both about the tap count:
 *
 * selectTextOnFocus — the field arrives PRE-FILLED with the previous set's
 *   value, which is the right default. But without this, tapping it put a caret
 *   after "80" and the only way to enter 85 was to backspace twice first. Now
 *   the value is selected on focus, so typing replaces it. That is two taps
 *   removed from every corrected entry.
 *
 * ref forwarding — weight and reps are two fields the user always crosses in
 *   the same direction, and nothing could move the focus because the component
 *   swallowed the ref. Now a caller can hold a ref to reps and jump straight
 *   there. Worth naming the constraint: keyboardType="decimal-pad" has NO
 *   return key on iOS, so there is no "Next" to press — the jump has to be
 *   driven by the caller, and a proper InputAccessoryView toolbar is the
 *   native answer if this needs to go further.
 *
 * The same gap is the top logging complaint about Hevy, and 2026 retention
 * research puts logging friction as the strongest single predictor of whether
 * somebody is still tracking at 30 days. This is not cosmetic. */
export const NumField = React.forwardRef(
  ({ label, value, onChange, suffix, flex, onSubmitEditing, returnKeyType }, ref) => (
    <View style={{ flex: flex || 1 }}>
      <Lbl>{label}</Lbl>
      <View style={[s.row, { backgroundColor: C.panel2, borderWidth: 1, borderColor: C.line, borderRadius: 10 }]}>
        <TextInput
          ref={ref}
          value={String(value)} onChangeText={onChange} keyboardType="decimal-pad"
          selectTextOnFocus
          onSubmitEditing={onSubmitEditing}
          returnKeyType={returnKeyType}
          placeholder="0" placeholderTextColor={C.dim}
          style={{ flex: 1, paddingHorizontal: 12, paddingVertical: 12, color: C.text, fontSize: 18, fontVariant: ['tabular-nums'] }}
        />
        {suffix ? <Text style={{ paddingHorizontal: 12, color: C.dim, fontSize: 12, fontWeight: '700' }}>{suffix}</Text> : null}
      </View>
    </View>
  ),
);
NumField.displayName = 'NumField';

// Press-scale wrapper — used by ghost/secondary buttons.
function Pressable3D({ onPress, disabled, style, children }) {
  const sc = useRef(new Animated.Value(1)).current;
  return (
    <Pressable accessibilityRole="button"
      onPressIn={() => !disabled && Animated.spring(sc, { toValue: 0.96, useNativeDriver: true, speed: 50 }).start()}
      onPressOut={() => Animated.spring(sc, { toValue: 1, useNativeDriver: true, speed: 50 }).start()}
      onPress={disabled ? undefined : onPress}>
      <Animated.View style={[style, { transform: [{ scale: sc }] }]}>{children}</Animated.View>
    </Pressable>
  );
}

// Primary buttons now ride on the chunky tactile base — the whole app inherits
// the game-feel press without touching every screen.
export const GoldBtn = ({ onPress, children, disabled, style }) => (
  <ChunkyBtn onPress={onPress} disabled={disabled} tone="gold" style={style}>{children}</ChunkyBtn>
);
export const GreenBtn = ({ onPress, children, style }) => (
  <ChunkyBtn onPress={onPress} tone="green" style={style}>{children}</ChunkyBtn>
);
export const GhostBtn = ({ onPress, children, style, txtStyle }) => (
  <Pressable3D onPress={onPress} style={[s.ghostBtn, style]}>
    <Text style={[s.ghostTxt, txtStyle]}>{children}</Text>
  </Pressable3D>
);

/* --------------------------- animated overlays --------------------------- */
export function FadeIn({ children, style, delay }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(a, {
      toValue: 1, duration: 260, delay: delay || 0,
      easing: Easing.out(Easing.cubic), useNativeDriver: true,
    }).start();
  }, [a, delay]);
  return (
    <Animated.View style={[{ opacity: a, transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }, style]}>
      {children}
    </Animated.View>
  );
}

// Cascades its children in one after another — screens feel composed, not dumped.
// Cards land in sequence, which reads as intentional design rather than a dump.
export function Stagger({ children, step }) {
  const items = React.Children.toArray(children);
  return (
    <>
      {items.map((child, i) => (
        <FadeIn key={i} delay={i * (step || 55)}>{child}</FadeIn>
      ))}
    </>
  );
}

// A consistent empty state — the brief calls these out, and they're everywhere
// a screen can have no data yet.
export function EmptyState({ title, body, action }) {
  return (
    <View style={[s.card, { alignItems: 'center', paddingVertical: 28 }]}>
      <Text style={{ ...T.callout, fontWeight: '600', color: C.text, marginBottom: 6, textAlign: 'center' }}>{title}</Text>
      <Text style={{ ...T.caption, color: C.mut, textAlign: 'center', lineHeight: 18, maxWidth: 280 }}>{body}</Text>
      {action ? <View style={{ marginTop: 16, alignSelf: 'stretch' }}>{action}</View> : null}
    </View>
  );
}

export function Toasts({ items }) {
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 54, left: 0, right: 0, alignItems: 'center', zIndex: 60 }}>
      {items.map((t) => (
        <FadeIn key={t.id} style={{ marginBottom: 6 }}>
          <View style={{ backgroundColor: '#171d2a', borderWidth: 1, borderColor: t.color || C.gold, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 16 }}>
            <Text style={{ color: t.color || C.gold, fontSize: 14, fontWeight: '700' }}>{t.text}</Text>
          </View>
        </FadeIn>
      ))}
    </View>
  );
}

export function LevelUpOverlay({ info, onClose }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (info) {
      a.setValue(0);
      Animated.spring(a, { toValue: 1, friction: 6, useNativeDriver: true }).start();
    }
  }, [info, a]);
  if (!info) return null;
  return (
    <Pressable accessibilityRole="button" onPress={onClose} style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(5,6,10,0.88)', zIndex: 70, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={{ alignItems: 'center', transform: [{ scale: a }] }}>
        <Text style={{ fontSize: 12, color: C.gold, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase' }}>Level Up</Text>
        <Text style={{ fontSize: 84, fontWeight: '800', color: C.text, fontVariant: ['tabular-nums'] }}>{info.to}</Text>
        <Text style={{ fontSize: 14, color: C.mut, marginTop: 6 }}>
          Title: <Text style={{ color: C.gold, fontWeight: '700' }}>{info.title}</Text>
        </Text>
        <Text style={{ fontSize: 12, color: C.dim, marginTop: 18, letterSpacing: 1.5, textTransform: 'uppercase' }}>Tap to continue</Text>
      </Animated.View>
    </Pressable>
  );
}

/* -------------------------------- charts -------------------------------- */
export function RadarChart({ statLevels, size }) {
  const W = size || 200, cx = W / 2, cy = W / 2 + 4, R = W * 0.34;
  if (!Array.isArray(statLevels) || statLevels.length < 3) return null;
  let maxL = 10;
  statLevels.forEach((x) => { if (x.level > maxL) maxL = x.level; });
  maxL += 2;
  const pt = (i, r) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 3;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  };
  const ring = (f) => [...Array(6)].map((_, i) => pt(i, R * f).join(',')).join(' ');
  const dp = statLevels.map((x, i) => pt(i, R * Math.min(1, x.level / maxL)).join(',')).join(' ');
  return (
    <Svg width="100%" height={W} viewBox={'0 0 ' + W + ' ' + W}>
      {[0.25, 0.5, 0.75, 1].map((f) => <Polygon key={f} points={ring(f)} fill="none" stroke={C.line} />)}
      {statLevels.map((x, i) => {
        const [ax, ay] = pt(i, R);
        const [lx, ly] = pt(i, R + 16);
        return (
          <React.Fragment key={x.stat}>
            <Line x1={cx} y1={cy} x2={ax} y2={ay} stroke={C.line} />
            <SvgText x={lx} y={ly + 4} fill={STAT_META[x.stat].color} fontSize="11" fontWeight="700" textAnchor="middle">{x.stat}</SvgText>
          </React.Fragment>
        );
      })}
      <Polygon points={dp} fill="rgba(240,180,41,0.28)" stroke={C.gold} strokeWidth="2" />
    </Svg>
  );
}

export function LineChart({ rows, height }) {
  const W = 340, H = height || 200, padL = 34, padR = 8, padT = 10, padB = 22;
  const safeRows = Array.isArray(rows) ? rows : [];
  const vals = [];
  safeRows.forEach((r) => {
    if (r.hist != null && isFinite(r.hist)) vals.push(r.hist);
    if (r.proj != null && isFinite(r.proj)) vals.push(r.proj);
  });
  if (vals.length < 2) return null; // need at least two real points to draw a line
  let mn = Math.min(...vals), mx = Math.max(...vals);
  if (!isFinite(mn) || !isFinite(mx)) return null;
  if (mx - mn < 2) { mx += 1; mn -= 1; }
  const pad = (mx - mn) * 0.1; mn -= pad; mx += pad;
  const span = mx - mn || 1;            // never zero
  const denom = Math.max(safeRows.length - 1, 1); // never zero
  const xs = (i) => padL + (i * (W - padL - padR)) / denom;
  const ys = (v) => padT + (1 - (v - mn) / span) * (H - padT - padB);
  const fin = (n) => (isFinite(n) ? n : 0);
  const hp = [], pp = [], dots = [];
  safeRows.forEach((r, i) => {
    if (r.hist != null && isFinite(r.hist)) {
      const x = fin(xs(i)), y = fin(ys(r.hist));
      hp.push(x + ',' + y); dots.push([x, y]);
    }
    if (r.proj != null && isFinite(r.proj)) pp.push(fin(xs(i)) + ',' + fin(ys(r.proj)));
  });
  if (hp.length < 2 && pp.length < 2) return null;
  const step = Math.max(1, Math.ceil(safeRows.length / 6));
  return (
    <Svg width="100%" height={H} viewBox={'0 0 ' + W + ' ' + H}>
      {[0, 1, 2, 3].map((g) => {
        const v = mn + (span * g) / 3, y = fin(ys(v));
        return (
          <React.Fragment key={g}>
            <Line x1={padL} x2={W - padR} y1={y} y2={y} stroke={C.line} strokeDasharray="3 3" />
            <SvgText x={padL - 5} y={y + 3} fill={C.dim} fontSize="8" textAnchor="end">{Math.round(v)}</SvgText>
          </React.Fragment>
        );
      })}
      {hp.length >= 2 && <Polyline points={hp.join(' ')} fill="none" stroke={C.gold} strokeWidth="2" />}
      {pp.length >= 2 && <Polyline points={pp.join(' ')} fill="none" stroke="#7c7cf5" strokeWidth="2" strokeDasharray="6 5" />}
      {dots.map((d, i) => <Circle key={i} cx={d[0]} cy={d[1]} r="2.6" fill={C.gold} />)}
      {safeRows.map((r, i) => (i % step === 0 || i === safeRows.length - 1)
        ? <SvgText key={'x' + i} x={fin(xs(i))} y={H - 6} fill={C.dim} fontSize="8" textAnchor="middle">{r.label}</SvgText>
        : null)}
    </Svg>
  );
}

export function BarChart({ data, height }) {
  const W = 340, H = height || 150, padL = 34, padR = 6, padT = 8, padB = 20;
  const safe = Array.isArray(data) ? data.filter((d) => d && isFinite(d.vol)) : [];
  if (safe.length === 0) return null;
  let mx = 1;
  safe.forEach((d) => { if (d.vol > mx) mx = d.vol; });
  const bw = (W - padL - padR) / safe.length;
  return (
    <Svg width="100%" height={H} viewBox={'0 0 ' + W + ' ' + H}>
      {[0, 1, 2, 3].map((g) => {
        const v = (mx * g) / 3, y = padT + (1 - v / mx) * (H - padT - padB);
        return (
          <React.Fragment key={g}>
            <Line x1={padL} x2={W - padR} y1={y} y2={y} stroke={C.line} strokeDasharray="3 3" />
            <SvgText x={padL - 5} y={y + 3} fill={C.dim} fontSize="8" textAnchor="end">{v >= 1000 ? Math.round(v / 1000) + 'k' : Math.round(v)}</SvgText>
          </React.Fragment>
        );
      })}
      {safe.map((d, i) => {
        const bh = (d.vol / mx) * (H - padT - padB);
        return <Rect key={i} x={padL + i * bw + bw * 0.15} y={H - padB - bh} width={bw * 0.7} height={Math.max(bh, 0)} rx="3" fill={C.gold} />;
      })}
      {safe.map((d, i) => (
        <SvgText key={'l' + i} x={padL + i * bw + bw / 2} y={H - 6} fill={C.dim} fontSize="7.5" textAnchor="middle">{d.w}</SvgText>
      ))}
    </Svg>
  );
}

/* ------------------------------ screen header -----------------------------
 * One heading component for every tab, so the top of each page reads the same
 * way: what this screen is, then one line telling you what to do. Previously
 * each screen invented its own size (28pt on Train, 22pt on Workout Days,
 * nothing at all on Stats), which made the app feel like five apps.
 *
 * Rule: title is 3 words or fewer, subtitle is ONE short instruction. If a
 * screen needs more explanation than that, the screen is too complicated.
 */
export function ScreenHeader({ title, hint, right }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginTop: 4, marginBottom: 16 }}>
      <View style={{ flex: 1 }}>
        {/* 700, not 800. SF is already a confident face; the extra weight was
            reading as shouty rather than authoritative, and at 28pt the tighter
            tracking does the work that the heavier stem was trying to do. */}
        <Text style={{ fontSize: 28, fontWeight: '700', color: C.text, letterSpacing: -0.62 }}>{title}</Text>
        {hint ? (
          <Text style={{ fontSize: 13.5, color: C.mut, fontWeight: '500', marginTop: 4, letterSpacing: -0.1 }}>
            {hint}
          </Text>
        ) : null}
      </View>
      {right || null}
    </View>
  );
}

/* -------------------------------- LEVL mark -------------------------------
 * The wordmark, as a component so the top bar, the boot screen and any share
 * surface all draw the identical thing.
 */
/* THE LEVL MARK.
 *
 * One glyph, used everywhere: the App Store icon, the launch screen, the header
 * here, and the sign-in screen. It is drawn, not typed — a text "L" rendered in
 * whatever weight the OS picks would drift between surfaces and could never
 * match the exported icon exactly.
 *
 * The form is an L whose foot rises. It carries the product's whole idea — you
 * are levelling up — without spelling it out, and it survives being shrunk: the
 * angled foot stays readable at 30pt in this header, where a stepped or
 * multi-bar mark collapses into a smudge.
 *
 * `LEVL_GLYPH` is the single source of truth. The icon PNGs in assets/ were
 * generated from this exact path, so nothing can drift out of sync.
 */
export const LEVL_GLYPH = 'M30 15h19v52l38-15v19L49 85H30z';

/* THE COIN.
 *
 * The header used to draw currency as a gold circle with the letter "C" in it.
 * A letter standing in for an icon is the cheapest thing an interface can do —
 * it is what you reach for when you have not drawn the asset yet.
 *
 * This is a struck coin: a gold face, a milled inner rim, and the LEVL mark
 * itself as the device. Currency in this app is earned by training, so making
 * the brand the thing stamped on it is the honest design — and it costs one
 * shape the app already owns.
 */
export function CoinGlyph({ size, face, ink }) {
  const S = size || 20;
  const gold = face || C.gold;
  const dark = ink || C.ink;
  return (
    <Svg width={S} height={S} viewBox="0 0 100 100">
      <Circle cx="50" cy="50" r="48" fill={gold} />
      {/* milled rim — the detail that reads as "struck" rather than "circle" */}
      <Circle cx="50" cy="50" r="40" fill="none" stroke={dark} strokeOpacity="0.22" strokeWidth="3" />
      <G transform="translate(50 50) scale(0.6) translate(-58.5 -50)">
        <Path d={LEVL_GLYPH} fill={dark} />
      </G>
    </Svg>
  );
}

/* THE MARK, WEARING ITS OWN PROGRESS.
 *
 * Level progress used to be a 4pt bar stretched across the full width beneath
 * the header — a generic component that could have come from any app, taking up
 * a whole row to say one number.
 *
 * Wrapping it around the mark instead costs no vertical space at all, and it
 * gives the logo a job. The ring reads at a glance the way a watch ring does:
 * you learn its shape, not its percentage.
 */
export function LevlRing({ size, pct, tint }) {
  const S = size || 40;
  const stroke = 2.6;
  const r = (S - stroke) / 2 - 0.5;
  const circ = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(100, pct || 0));
  return (
    <View style={{ width: S, height: S, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={S} height={S} style={{ position: 'absolute' }}>
        <Circle
          cx={S / 2} cy={S / 2} r={r}
          stroke={alpha(tint || C.gold, 0.18)} strokeWidth={stroke} fill="none"
        />
        <Circle
          cx={S / 2} cy={S / 2} r={r}
          stroke={tint || C.gold} strokeWidth={stroke} fill="none"
          strokeLinecap="round"
          strokeDasharray={`${circ} ${circ}`}
          strokeDashoffset={circ * (1 - p / 100)}
          // start the arc at 12 o'clock rather than 3
          transform={`rotate(-90 ${S / 2} ${S / 2})`}
        />
      </Svg>
      <LevlMark size={S * 0.62} />
    </View>
  );
}

export function LevlMark({ size, showWord }) {
  const S = size || 30;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <View style={{
        width: S, height: S, borderRadius: S * 0.28, overflow: 'hidden',
        alignItems: 'center', justifyContent: 'center',
        shadowColor: C.gold, shadowOpacity: 0.4, shadowRadius: 8, shadowOffset: { width: 0, height: 0 },
      }}>
        <LinearGradient
          colors={['#ffdf74', '#ffc933', '#d5941a']}
          locations={[0, 0.46, 1]}
          start={{ x: 0.15, y: 0 }} end={{ x: 0.85, y: 1 }}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        />
        <Svg width={S * 0.55} height={S * 0.55} viewBox="0 0 100 100">
          <Path d={LEVL_GLYPH} fill={C.ink} />
        </Svg>
      </View>
      {showWord ? (
        <Text style={{
          fontSize: S * 0.52, fontWeight: '700', color: C.text,
          letterSpacing: S * 0.1, marginLeft: 8,
        }}>LEVL</Text>
      ) : null}
    </View>
  );
}
