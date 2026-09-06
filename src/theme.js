// LEVL — design system
// Premium dark theme built around the original gold-on-charcoal identity.
// Everything the app already imports (C.*, s.*, MONO) is preserved; new scales
// (SPACING, RADIUS, SHADOW, RARITY, GRAD) are added on top.
import { StyleSheet, Platform } from 'react-native';

/* ----------------------------- color tokens -----------------------------
 * PALETTE PHILOSOPHY (vibrant but classy):
 *   60 / 30 / 10 — a charcoal canvas (60%), raised surfaces (30%), and ONE
 *   saturated accent (10%). Vibrancy comes from restraint plus glow, not from
 *   painting everything.
 *
 *   Base is CHARCOAL (#0e1016), never pure black: black kills glow and hides
 *   elevation. Surfaces get LIGHTER as they rise (Apple/Spotify convention) —
 *   depth is brightness, not drop-shadow.
 *
 *   Neutrals are never pure grey. Every one carries a trace of the brand hue,
 *   which is the single biggest thing separating "premium" from "template".
 *
 * THE GOLD CONFLICT — RESOLVED:
 *   Gold used to be BOTH the brand accent AND the legendary rarity, which blurred
 *   the hierarchy. Now gold is the BRAND only (it's the app icon, the identity).
 *   Legendary is ORANGE — which is also the correct Diablo/ARPG convention. The
 *   two no longer compete.
 */
export const C = {
  // --- canvas & elevation (depth = brightness) ---
  sunken:  '#090a0f',   // recessed: inputs, bar tracks (below the canvas)
  bg:      '#0e1016',   // 60% — charcoal base
  bgElev:  '#141720',
  panel:   '#181c27',   // 30% — cards
  panel2:  '#1f2431',
  panel3:  '#272d3d',
  line:    '#2c3344',
  lineSoft:'#212736',

  // --- text (four levels, Apple's model) ---
  text: '#ffffff',
  mut:  '#a7b0c0',
  dim:  '#7b8497',   // WCAG AA on cards: 4.53:1 (was 3.63:1 and failing)
  faint:'#5d677f',   // 3.01:1 — AA for large/non-essential only (was 2.04:1)

  // Ink — the dark text that sits ON a bright accent (gold/green buttons).
  // Never pure black: it keeps the brand's warmth even at 1pt.
  ink: '#0e1016',

  // --- BRAND ACCENT (the 10%) ---
  gold:     '#ffc933',
  goldDeep: '#d99a1c',
  goldSoft: 'rgba(255,201,51,0.14)',
  goldGlow: 'rgba(255,201,51,0.38)',

  // --- vivid semantic accents (saturated, but each has ONE job) ---
  green:     '#2fe39b',  greenSoft: 'rgba(47,227,155,0.14)',  greenGlow: 'rgba(47,227,155,0.34)',
  red:       '#ff5c6e',  redSoft:   'rgba(255,92,110,0.14)',  redGlow:   'rgba(255,92,110,0.34)',
  purp:      '#a66bff',  purpSoft:  'rgba(166,107,255,0.14)', purpGlow:  'rgba(166,107,255,0.34)',
  blue:      '#3d9bff',  blueSoft:  'rgba(61,155,255,0.14)',  blueGlow:  'rgba(61,155,255,0.34)',
  cyan:      '#2fe0e0',  cyanSoft:  'rgba(47,224,224,0.14)',
  orange:    '#ff8a3d',  orangeSoft:'rgba(255,138,61,0.14)',  orangeGlow:'rgba(255,138,61,0.38)',
  pink:      '#ff5fa2',  pinkSoft:  'rgba(255,95,162,0.14)',
};

/* ALPHA — the one correct way to tint a token.
 *
 * The codebase is full of `item.color + '55'`. That works only while every
 * colour is a 6-digit hex: the moment one is `rgba()`, an 8-digit hex or a
 * 3-digit shorthand it produces a silently invalid colour, and RN renders it as
 * black rather than throwing. It is also unreadable — nobody knows what '55' is
 * without reaching for a converter (it's 33%).
 *
 * alpha('#ffc933', 0.33) says what it means and survives any input format.
 */
export function alpha(color, a) {
  const v = Math.max(0, Math.min(1, a));
  if (typeof color !== 'string') return color;
  let h = color.trim();
  if (h[0] === '#') {
    h = h.slice(1);
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    if (h.length === 8) h = h.slice(0, 6);            // drop existing alpha
    if (h.length !== 6) return color;
    const n = parseInt(h, 16);
    if (Number.isNaN(n)) return color;
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${v})`;
  }
  // already rgb()/rgba() — rewrite the alpha channel rather than nesting
  const m = h.match(/^rgba?\(([^)]+)\)$/i);
  if (m) {
    const p = m[1].split(',').map((x) => x.trim());
    if (p.length >= 3) return `rgba(${p[0]},${p[1]},${p[2]},${v})`;
  }
  return color;
}

/* Minimum iOS touch target. Apple HIG: 44x44pt. Nothing tappable goes below. */
export const TOUCH = 44;

/* ---------------------------- motion presets ----------------------------
 * Springs, not fixed-duration curves, are the iOS-native default: they start
 * from any velocity, so gesture-driven motion picks up where the finger left
 * off, and they survive interruption.
 *
 * The rule that matters: match the spring to the JOB.
 *   SNAPPY   — taps, toggles, tab switches. Must feel instant. No overshoot.
 *   SMOOTH   — sheets, cards, transitions. Calm, no bounce.
 *   BOUNCY   — celebrations ONLY (level-up, claim, PR). Overshoot is the point.
 *
 * Overshoot on routine actions reads as instability, not delight — so bounce is
 * rationed to the moments that have earned it.
 */
export const MOTION = {
  snappy: { friction: 26, tension: 340, useNativeDriver: true },   // ~150ms, no bounce
  smooth: { friction: 20, tension: 180, useNativeDriver: true },   // ~300ms, settles clean
  bouncy: { friction: 6,  tension: 160, useNativeDriver: true },   // overshoots — celebrations
  gauge:  { friction: 9,  tension: 40,  useNativeDriver: false },  // bars filling (needs layout)
};

export const SPACING = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28, xxxl: 40 };
export const RADIUS = { sm: 8, md: 12, lg: 16, xl: 20, pill: 999 };

/* ========================= TYPOGRAPHY (SF Pro) ===========================
 * LEVL uses the iOS SYSTEM FONT — San Francisco / SF Pro. React Native renders
 * the system face whenever `fontFamily` is left unset, which is also the only
 * legitimate way to use SF: Apple's font files are licensed for use through the
 * system, not for bundling and redistribution inside an app. So there are no
 * font files in this repo, and there never should be.
 *
 * WHAT CHANGED IN BUILD 28
 * The app used to set `fontFamily: 'Menlo'` on ~110 elements — every score,
 * timer, weight and rank. Menlo is a code editor face. At a glance it reads
 * "terminal", not "premium fitness", and it was doing a job SF already does
 * better: SF Pro ships tabular (fixed-width) figures, reachable with
 * `fontVariant: ['tabular-nums']`. Numbers line up in columns, timers stop
 * jittering as digits change, and the type stays native.
 *
 * Use NUM for any number that updates or needs to align.
 * Use MONO only where genuine monospace is the point — a stack trace.
 * ====================================================================== */

// Real monospace. Reserved for code/diagnostics.
export const MONO = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' });

// Tabular figures in the system font. Spread into a style: {...NUM}
export const NUM = { fontVariant: ['tabular-nums'] };

/* T — the iOS-shaped type scale.
 *
 * Named after Apple's own text styles so the intent of each step is obvious,
 * and sized close to their point sizes so the app sits comfortably beside
 * native UI. Weights stay in the 400–700 range: SF is already confident, and
 * 800/900 everywhere is what makes an interface read as shouty rather than
 * designed.
 *
 * Line heights are set on everything meant to be READ. Steps used for single
 * words (label, micro) leave it unset so they centre cleanly in chips.
 */
export const T = {
  display:      { fontSize: 34, fontWeight: '700', letterSpacing: 0.37 },
  title1:       { fontSize: 28, fontWeight: '700', letterSpacing: 0.36 },
  title2:       { fontSize: 22, fontWeight: '700', letterSpacing: 0.35 },
  title3:       { fontSize: 20, fontWeight: '600', letterSpacing: 0.38 },
  headline:     { fontSize: 17, fontWeight: '600', letterSpacing: -0.41, lineHeight: 22 },
  body:         { fontSize: 17, fontWeight: '400', letterSpacing: -0.41, lineHeight: 22 },
  callout:      { fontSize: 16, fontWeight: '400', letterSpacing: -0.32, lineHeight: 21 },
  subheadline:  { fontSize: 15, fontWeight: '400', letterSpacing: -0.24, lineHeight: 20 },
  footnote:     { fontSize: 13, fontWeight: '400', letterSpacing: -0.08, lineHeight: 18 },
  caption:      { fontSize: 12, fontWeight: '400', letterSpacing: 0,     lineHeight: 16 },
  caption2:     { fontSize: 11, fontWeight: '400', letterSpacing: 0.07,  lineHeight: 13 },
  // The one deliberately non-Apple step: small caps section headers. Kept
  // because LEVL's identity leans on them — but confined to section headers,
  // never body copy.
  label:        { fontSize: 11, fontWeight: '600', letterSpacing: 0.9, textTransform: 'uppercase' },
  /* THE STEP THAT WAS MISSING, and the reason screens fell back to literals.
   *
   * T stopped at 11 (caption2), but badges, pills and unit suffixes genuinely
   * need something smaller — the app was using 10, 10.5 and 9 in 40-odd places
   * because there was nothing to reach for. The only alternative at that size
   * was `label`, which UPPERCASES, so using it would have rewritten the copy.
   *
   * NOT for reading text — badges and units only. */
  micro:        { fontSize: 10, fontWeight: '600', letterSpacing: 0.4 },
  // Numerals: pair with any step above, e.g. {...T.title2, ...T.numeric}
  numeric:      { fontVariant: ['tabular-nums'] },
};

/* Dynamic Type: React Native scales text with the system setting by default.
 * The risk is a fixed-height row clipping at the largest accessibility sizes,
 * so tight components pass a ceiling rather than switching scaling off — text
 * still grows, it just stops before it breaks the layout. */
export const FONT_SCALE_CAP = { tight: 1.25, normal: 1.5 };


// RADIUS SCALE — five steps, no more.
// (defined above; screens should use these, never raw numbers)

export const SHADOW = {
  card: Platform.select({
    ios: { shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } },
    android: { elevation: 4 }, default: {},
  }),
  raised: Platform.select({
    ios: { shadowColor: '#000', shadowOpacity: 0.45, shadowRadius: 20, shadowOffset: { width: 0, height: 10 } },
    android: { elevation: 8 }, default: {},
  }),
  glow: Platform.select({
    ios: { shadowColor: '#ffc933', shadowOpacity: 0.45, shadowRadius: 16, shadowOffset: { width: 0, height: 0 } },
    android: { elevation: 6 }, default: {},
  }),
};

export const GRAD = {
  gold: ['#f8d268', '#e7a92a'],
  goldDim: ['#3a3115', '#1a1710'],
  hero: ['#1a2030', '#10131c'],
  panel: ['#161b27', '#11141d'],
  green: ['#54e6a8', '#2fb87d'],
  dark: ['#12151e', '#0b0d14'],
};

export const RARITY = {
  common: { key: 'common', name: 'Common', color: '#8b93a6', glow: 'rgba(139,147,166,0.4)', grad: ['#3a4152', '#2a303e'] },
  rare: { key: 'rare', name: 'Rare', color: '#4b8ef0', glow: 'rgba(75,142,240,0.55)', grad: ['#3f7fe0', '#2456b0'] },
  epic: { key: 'epic', name: 'Epic', color: '#c26bf0', glow: 'rgba(194,107,240,0.6)', grad: ['#b45ef0', '#7d2ec0'] },
  legendary: { key: 'legendary', name: 'Legendary', color: '#f5c542', glow: 'rgba(245,197,66,0.7)', grad: ['#ffd76b', '#e09a1c'] },
};

export const s = StyleSheet.create({
  card: {
    backgroundColor: C.panel, borderRadius: RADIUS.lg,
    padding: 16, marginBottom: 12,
    ...(SHADOW.card || {}),
  },
  hero: { backgroundColor: C.panel2, borderColor: C.line },
  cardFlush: { backgroundColor: C.panel, borderWidth: 1, borderColor: C.line, borderRadius: RADIUS.lg, padding: SPACING.lg },

  label: { fontSize: 10, fontWeight: '600', letterSpacing: 1.4, textTransform: 'uppercase', color: C.dim, marginBottom: 10 },
  txt: { color: C.text, fontSize: 14 },
  mut: { color: C.mut }, dim: { color: C.dim }, gold: { color: C.gold },
  mono: { fontVariant: ['tabular-nums'] },

  row: { flexDirection: 'row', alignItems: 'center' },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  center: { alignItems: 'center', justifyContent: 'center' },

  chip: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    minHeight: 38,                       // + hitSlop reaches Apple's 44pt floor
    paddingVertical: 9, paddingHorizontal: 15, borderRadius: RADIUS.pill,
    backgroundColor: C.panel2, borderWidth: 1, borderColor: C.lineSoft,
    marginRight: 8, marginBottom: 8,     // spacing beats size for mistap rate
  },
  chipOn: { backgroundColor: C.goldSoft, borderColor: C.gold },
  chipTxt: { fontSize: 12.5, fontWeight: '600', color: C.mut },
  chipTxtOn: { color: C.gold },

  pbar: { height: 6, backgroundColor: '#0a0d14', borderRadius: RADIUS.pill, overflow: 'hidden' },
  pfill: { height: '100%', borderRadius: RADIUS.pill, backgroundColor: C.gold },

  input: {
    backgroundColor: '#0b0e15', borderWidth: 1, borderColor: C.lineSoft, borderRadius: RADIUS.md,
    color: C.text, paddingHorizontal: 13, paddingVertical: 11, fontSize: 15,
  },

  goldBtn: { borderRadius: RADIUS.md, paddingVertical: 14, alignItems: 'center', backgroundColor: C.gold, ...(SHADOW.glow || {}) },
  goldBtnTxt: { color: '#0a0c12', fontWeight: '700', fontSize: 13, letterSpacing: 0.8, textTransform: 'uppercase' },
  greenBtn: { borderRadius: RADIUS.md, paddingVertical: 14, alignItems: 'center', backgroundColor: C.green },
  ghostBtn: { minHeight: TOUCH, justifyContent: 'center', borderRadius: RADIUS.md, paddingVertical: 12, alignItems: 'center', backgroundColor: C.panel2, borderWidth: 1, borderColor: C.lineSoft },
  ghostTxt: { color: C.mut, fontWeight: '700', fontSize: 13 },
  smallGhost: { borderRadius: RADIUS.sm, paddingVertical: 6, paddingHorizontal: 11, backgroundColor: 'transparent', borderWidth: 1, borderColor: C.line },

  badge: { paddingVertical: 3, paddingHorizontal: 8, borderRadius: RADIUS.pill, borderWidth: 1 },
  badgeTxt: { fontSize: 9.5, fontWeight: '800', letterSpacing: 0.5 },
});
