// LEVL React Native — shared UI atoms, overlays, and SVG charts
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, Animated, Easing, Modal, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Polygon, Polyline, Line, Circle, Rect, Text as SvgText } from 'react-native-svg';
import { C, s, MONO, GRAD, RADIUS, TYPE, MOTION } from '../theme';
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
 * "Liquid glass" WITHOUT a native blur module.
 *
 * Real backdrop blur needs expo-blur (a native module). We deliberately don't
 * use it: native modules are what crashed this app twice, and a rebuild costs
 * 30 minutes vs a 60-second OTA update. On a dark charcoal app the visual gap
 * is small, because the convincing part of glass isn't the blur — it's the
 * LAYERING: a translucent fill, a rim light on the top edge, and a scrim.
 *
 * Per Apple's own retreat in iOS 27 (they reduced default transparency after
 * readability complaints), this is used ONLY on the navigation/control layer —
 * sheets and the tab bar. Never on content, never on primary buttons.
 */
export function Glass({ children, style, tint, radius, rim }) {
  const R = radius != null ? radius : RADIUS.lg;
  return (
    <View style={[{ borderRadius: R, overflow: 'hidden' }, style]}>
      {/* base translucent fill */}
      <View style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: tint || 'rgba(30,36,50,0.82)',
      }} />
      {/* scrim — keeps text legible whatever sits behind */}
      <LinearGradient
        colors={['rgba(255,255,255,0.06)', 'rgba(0,0,0,0.10)']}
        start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />
      {/* rim light — the single detail that sells "glass edge" */}
      {rim !== false && (
        <View style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 1,
          backgroundColor: 'rgba(255,255,255,0.16)',
        }} />
      )}
      <View style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        borderRadius: R, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
      }} />
      {children}
    </View>
  );
}

/* ---------------------- dropdown / sheet picker ------------------------- */
// A tap target that reads like an iOS form row, opening a proper bottom sheet.
// Replaces nested scroll lists — the page scrolls, the sheet scrolls, never both.
export function SelectRow({ label, value, placeholder, onPress }) {
  return (
    <Pressable onPress={onPress} style={{
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
        {/* glass: nav/control layer only */}
        <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(31,36,49,0.94)' }} />
        <LinearGradient
          colors={['rgba(255,255,255,0.07)', 'rgba(0,0,0,0.12)']}
          start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
          pointerEvents="none"
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        />
        <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.18)' }} />
        <View style={{ alignItems: 'center', paddingTop: 10, paddingBottom: 4 }}>
          <View style={{ width: 38, height: 4, borderRadius: 2, backgroundColor: C.line }} />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 10 }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: C.text, letterSpacing: -0.2 }}>{title}</Text>
          <Pressable onPress={onClose} hitSlop={10}>
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
      <Pressable onPress={toggle} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
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

export const NumField = ({ label, value, onChange, suffix, flex }) => (
  <View style={{ flex: flex || 1 }}>
    <Lbl>{label}</Lbl>
    <View style={[s.row, { backgroundColor: C.panel2, borderWidth: 1, borderColor: C.line, borderRadius: 10 }]}>
      <TextInput
        value={String(value)} onChangeText={onChange} keyboardType="decimal-pad"
        placeholder="0" placeholderTextColor={C.dim}
        style={{ flex: 1, paddingHorizontal: 12, paddingVertical: 12, color: C.text, fontSize: 18, fontVariant: ['tabular-nums'] }}
      />
      {suffix ? <Text style={{ paddingHorizontal: 12, color: C.dim, fontSize: 12, fontWeight: '700' }}>{suffix}</Text> : null}
    </View>
  </View>
);

// Press-scale wrapper — used by ghost/secondary buttons.
function Pressable3D({ onPress, disabled, style, children }) {
  const sc = useRef(new Animated.Value(1)).current;
  return (
    <Pressable
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
      <Text style={{ ...TYPE.heading, color: C.text, marginBottom: 6, textAlign: 'center' }}>{title}</Text>
      <Text style={{ ...TYPE.caption, color: C.mut, textAlign: 'center', lineHeight: 18, maxWidth: 280 }}>{body}</Text>
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
    <Pressable onPress={onClose} style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(5,6,10,0.88)', zIndex: 70, alignItems: 'center', justifyContent: 'center' }}>
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
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginTop: 2, marginBottom: 14 }}>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 27, fontWeight: '800', color: C.text, letterSpacing: -0.8 }}>{title}</Text>
        {hint ? (
          <Text style={{ fontSize: 13.5, color: C.mut, fontWeight: '600', marginTop: 3 }}>{hint}</Text>
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
export function LevlMark({ size, showWord }) {
  const S = size || 30;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <View style={{
        width: S, height: S, borderRadius: S * 0.3, backgroundColor: C.gold,
        alignItems: 'center', justifyContent: 'center',
        shadowColor: C.gold, shadowOpacity: 0.45, shadowRadius: 8, shadowOffset: { width: 0, height: 0 },
      }}>
        <Text style={{
          fontSize: S * 0.56, fontWeight: '900', color: '#4a3405',
          letterSpacing: -0.5, marginTop: -1,
        }}>L</Text>
      </View>
      {showWord ? (
        <Text style={{
          fontSize: S * 0.52, fontWeight: '900', color: C.text,
          letterSpacing: S * 0.1, marginLeft: 8,
        }}>LEVL</Text>
      ) : null}
    </View>
  );
}
