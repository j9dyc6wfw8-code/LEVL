// LEVL — The Forge.
//
// Three bays behind one door:
//   FORGE — upgrade owned gear through six grades using materials earned by
//           training. Real costs, a real success chance, and a pity system
//           (temper) so bad luck never dead-ends you.
//   SHOP  — acquire new cosmetics.
//   PASS  — the seasonal reward track.
//
// The Forge is cosmetic only. It is never scored, never touches Fitness
// Rating, and cannot buy rank. Glory only — the ladder stays honest.
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { View, Text, Pressable, ScrollView, Animated, Easing, TextInput } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Polygon } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { C, alpha, s, RADIUS, T, MOTION } from '../theme';
import { Card, Lbl, Chip, PBar, StatBar, ChunkyBtn, Sheet, EmptyState, ScreenHeader, Segmented } from '../components/ui';
import { ItemGlyph, ItemTile, PackGlyph, RewardGlyph } from '../components/ItemGlyph';
import {
  COSMETICS, SLOTS, RARITY, TIERS, coinBalance, xpBalance, rankStyleFor,
  MATERIALS, materialById, materialBalance,
  FORGE_MAX, FORGE_TIERS, forgeLevelOf, forgeTemperOf, forgeCost, forgeChance, canForge,
  // rewardLabel is deliberately not imported: it returns emoji-laden strings
  // ('40 🪙', '🧥 Shadow Hood'). The pass draws real glyphs instead.
  FORGE_PASS, PASS_PREMIUM_COST, PASS_SEASON_TIERS, passTierUnlocked, passClaimable, passKey,
} from '../engine/engine';

const rarOf = (item) => RARITY[item.rarity] || RARITY.common;
const tierIndexByName = (n) => Math.max(0, TIERS.findIndex((t) => t.name === n));
const hap = (f) => { try { f(); } catch (e) {} };
/* ============================ small primitives =========================== */

// Forge grade as five clean segments — compact, but easier to scan than dots.
function Pips({ level, color }) {
  return (
    <View style={{ flexDirection: 'row' }}>
      {[...Array(FORGE_MAX)].map((_, i) => (
        <View key={i} style={{
          width: 15, height: 4, borderRadius: 2, marginRight: 4,
          backgroundColor: i < level ? color : C.line,
          opacity: i < level ? 1 : 0.55,
        }} />
      ))}
    </View>
  );
}

function ForgeMark({ color }) {
  return (
    <View style={{
      width: 82, height: 82, borderRadius: 26, alignItems: 'center', justifyContent: 'center',
      backgroundColor: color + '12', borderWidth: 1, borderColor: color + '55',
    }}>
      <Svg width={64} height={64} viewBox="0 0 64 64">
        <Polygon points="32,3 55,16 55,45 32,59 9,45 9,16" fill={color + '12'} stroke={color} strokeWidth="1.6" />
        <Path d="M31.8 13c6 7.1 9.2 12.8 9.2 18.2 0 5.5-4 10-9 10s-9-4.3-9-9.7c0-4.1 2.1-8.2 6.1-12.6-.2 4.6 1.2 7.1 3.9 8.9 1.7-4.3 1.3-9.3-1.2-14.8z" fill={color} opacity="0.92" />
        <Path d="M21 44h22M25 48h14" stroke={color} strokeWidth="2.4" strokeLinecap="round" />
      </Svg>
    </View>
  );
}

function ForgeMetric({ value, label, color }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={{ ...T.title2, color: color || C.text, fontVariant: ['tabular-nums'] }}>{value}</Text>
      <Text style={{ ...T.micro, color: C.dim, marginTop: 2 }}>{label}</Text>
    </View>
  );
}

/* MaterialTile (a 2-across 48.5%-wide grid) was replaced by MaterialPill when
   the four-card preamble collapsed into one header. Deleted rather than left
   behind: the Forge already carried two dead locals (upgradedCount,
   masteredCount) that survived because nothing flagged them. */
function MaterialPill({ mat, count, need }) {
  const short = need != null && count < need;
  // The name is worth showing now that these carry the whole materials story.
  const label = mat.id === 'mat_ore' ? 'ORE'
    : mat.id === 'mat_steel' ? 'STEEL'
    : mat.id === 'mat_ember' ? 'EMBER' : 'RELIC';
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: C.sunken, borderRadius: RADIUS.pill,
      borderWidth: 1, borderColor: short ? C.red : alpha(mat.color, 0.45),
      paddingLeft: 5, paddingRight: 11, paddingVertical: 4, marginRight: 6, marginBottom: 6,
    }}>
      <View style={{
        width: 16, height: 16, borderRadius: 5, marginRight: 7,
        backgroundColor: alpha(mat.color, 0.9), transform: [{ rotate: '45deg' }],
      }} />
      <Text style={{ ...T.caption2, color: C.dim, marginRight: 5, letterSpacing: 0.6 }}>{label}</Text>
      <Text style={{ ...T.caption, fontWeight: '700', color: short ? C.red : C.text, ...T.numeric }}>
        {need != null ? count + '/' + need : count}
      </Text>
    </View>
  );
}

/* ========================= the anvil animation =========================== */
// The item rises into the heat, the hammer falls, sparks fly, and the result
// lands. Failure smoulders — you never lose the piece, only the materials.
function ForgeAnvil({ item, rarity, result, newLevel, onDone }) {
  const [phase, setPhase] = useState('heat'); // heat | strike | result
  const heat = useRef(new Animated.Value(0)).current;
  const rise = useRef(new Animated.Value(0)).current;
  const hammer = useRef(new Animated.Value(0)).current;
  const flash = useRef(new Animated.Value(0)).current;
  const spark = useRef(new Animated.Value(0)).current;
  const land = useRef(new Animated.Value(0)).current;
  const shake = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    hap(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
    Animated.parallel([
      Animated.spring(rise, { toValue: 1, friction: 6, useNativeDriver: true }),
      Animated.timing(heat, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]).start(() => {
      setPhase('strike');
      hap(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy));
      Animated.sequence([
        Animated.timing(hammer, { toValue: 1, duration: 170, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
        Animated.parallel([
          Animated.timing(flash, { toValue: 1, duration: 70, useNativeDriver: true }),
          Animated.timing(shake, { toValue: 1, duration: 260, useNativeDriver: true }),
          Animated.timing(spark, { toValue: 1, duration: 700, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        ]),
        Animated.timing(flash, { toValue: 0, duration: 260, useNativeDriver: true }),
      ]).start(() => {
        setPhase('result');
        hap(() => Haptics.notificationAsync(
          result === 'success'
            ? Haptics.NotificationFeedbackType.Success
            : Haptics.NotificationFeedbackType.Warning));
        Animated.spring(land, { toValue: 1, friction: 6, useNativeDriver: true }).start();
      });
    });
  }, []);

  const win = result === 'success';
  const glowColor = win ? rarity.color : '#7a4a2a';

  const riseY = rise.interpolate({ inputRange: [0, 1], outputRange: [50, 0] });
  const hammerY = hammer.interpolate({ inputRange: [0, 1], outputRange: [-90, 6] });
  const hammerRot = hammer.interpolate({ inputRange: [0, 1], outputRange: ['-42deg', '6deg'] });
  const shakeX = shake.interpolate({ inputRange: [0, 0.3, 0.6, 1], outputRange: [0, -7, 6, 0] });
  const heatOp = heat.interpolate({ inputRange: [0, 1], outputRange: [0.15, 0.7] });
  const landScale = land.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] });

  return (
    <View style={{
      position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, zIndex: 100,
      backgroundColor: 'rgba(4,5,9,0.96)', alignItems: 'center', justifyContent: 'center',
    }}>
      {/* forge heat */}
      <Animated.View pointerEvents="none" style={{
        position: 'absolute', width: 260, height: 260, borderRadius: 999,
        backgroundColor: phase === 'result' ? glowColor : '#ff7a2a',
        opacity: phase === 'result' ? 0.32 : heatOp,
      }} />

      {/* Sparks as STREAKS, not dots.
          These were 4x4 circles fanned evenly around a full circle, which reads
          as confetti. A spark is a motion trail: it is elongated along its
          travel vector, it fans UPWARD off the strike rather than in a ring, and
          it falls. Rotating each one to its own angle and stretching it costs
          nothing extra and is the whole difference. */}
      {[...Array(22)].map((_, i) => {
        // deterministic spread, biased upward (-150deg..-30deg)
        const t = i / 21;
        const ang = (-150 + t * 120 + ((i * 37) % 17) - 8) * (Math.PI / 180);
        const dist = 96 + ((i * 53) % 90);
        const len = 14 + ((i * 29) % 22);
        const tx = spark.interpolate({ inputRange: [0, 1], outputRange: [0, Math.cos(ang) * dist] });
        // + gravity on the way out
        const ty = spark.interpolate({
          inputRange: [0, 0.6, 1],
          outputRange: [0, Math.sin(ang) * dist * 0.75, Math.sin(ang) * dist + 58],
        });
        const op = spark.interpolate({ inputRange: [0, 0.12, 0.6, 1], outputRange: [0, 1, 0.7, 0] });
        const sy = spark.interpolate({ inputRange: [0, 0.25, 1], outputRange: [0.4, 1.6, 0.5] });
        return (
          <Animated.View key={i} pointerEvents="none" style={{
            position: 'absolute', width: 3, height: len, borderRadius: 2,
            backgroundColor: i % 4 === 0 ? '#ffffff' : '#ffb648',
            opacity: op,
            transform: [
              { translateX: tx }, { translateY: ty },
              { rotate: (ang + Math.PI / 2) + 'rad' },
              { scaleY: sy },
            ],
          }} />
        );
      })}

      <Animated.View style={{ alignItems: 'center', transform: [{ translateX: shakeX }] }}>
        {phase !== 'result' && (
          <Animated.View style={{ transform: [{ translateY: hammerY }, { rotate: hammerRot }], marginBottom: 4 }}>
            <Svg width={64} height={64} viewBox="0 0 64 64">
              <Path d="M14 12 H40 V26 H14 Z" fill="#9aa4b6" stroke="#5c657a" strokeWidth={2} />
              <Path d="M24 26 H30 V56 H24 Z" fill="#7a5a3a" stroke="#4a3624" strokeWidth={2} />
            </Svg>
          </Animated.View>
        )}

        <Animated.View style={{
          transform: [{ translateY: riseY }, { scale: phase === 'result' ? landScale : 1 }],
        }}>
          <LinearGradient
            colors={phase === 'result' && win ? [rarity.color, C.panel2] : ['#3a2a1a', C.panel]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={{
              width: 128, height: 128, borderRadius: RADIUS.lg,
              alignItems: 'center', justifyContent: 'center',
              borderWidth: 2, borderColor: phase === 'result' ? glowColor : '#ff8c3a',
            }}>
            <ItemGlyph
              item={item}
              size={72}
              color={phase === 'result' ? (win ? rarity.color : C.mut) : '#ffd9a8'}
              strokeWidth={1.5}
            />
          </LinearGradient>
        </Animated.View>

        {/* anvil */}
        <View style={{
          width: 150, height: 16, borderRadius: 4, marginTop: 8,
          backgroundColor: '#2a3040', borderWidth: 1, borderColor: C.panel2,
        }} />

        {phase === 'result' && (
          <View style={{ alignItems: 'center', marginTop: 22 }}>
            <Text style={{
              ...T.title2, color: win ? rarity.color : C.mut,
              textShadowColor: win ? rarity.color + '77' : 'transparent',
              textShadowRadius: 14, textShadowOffset: { width: 0, height: 0 },
            }}>
              {win ? 'FORGE SUCCESS' : 'THE STEEL HELD'}
            </Text>
            <Text style={{
              ...T.caption, color: C.mut, marginTop: 8,
              textAlign: 'center', maxWidth: 270, lineHeight: 18,
            }}>
              {win
                ? item.name + ' is now ' + FORGE_TIERS[Math.min(FORGE_MAX, newLevel)] + '.'
                : 'Failed. Item is safe — next attempt is likelier.'}
            </Text>
            <View style={{ marginTop: 20, width: 200 }}>
              <ChunkyBtn onPress={onDone} tone={win ? 'gold' : 'slate'}>CONTINUE</ChunkyBtn>
            </View>
          </View>
        )}
      </Animated.View>

      <Animated.View pointerEvents="none" style={{
        position: 'absolute', top: 0, bottom: 0, left: 0, right: 0,
        backgroundColor: '#ffffff', opacity: flash,
      }} />
    </View>
  );
}

/* =============================== forge bay ============================== */
function ForgeBay({ data, onForge }) {
  const [slot, setSlot] = useState('all');
  const [query, setQuery] = useState('');
  const [sel, setSel] = useState(null);      // item open in the upgrade sheet
  const [anvil, setAnvil] = useState(null);  // { item, rarity, result, newLevel }

  const owned = useMemo(
    () => COSMETICS.filter((c) => (data.owned || []).includes(c.id) || c.free),
    [data.owned],
  );

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    const order = { mythic: 5, legendary: 4, epic: 3, rare: 2, common: 1 };
    return owned
      .filter((c) => (slot === 'all' ? true : c.slot === slot))
      .filter((c) => (q ? c.name.toLowerCase().includes(q) : true))
      .sort((a, b) => {
        // your best work leads: highest grade first, then rarity
        const dl = forgeLevelOf(data, b.id) - forgeLevelOf(data, a.id);
        if (dl) return dl;
        return (order[b.rarity] || 0) - (order[a.rarity] || 0);
      });
  }, [owned, slot, query, data.forgeLevels]);
  const upgradedCount = owned.filter((item) => forgeLevelOf(data, item.id) > 0).length;
  const masteredCount = owned.filter((item) => forgeLevelOf(data, item.id) >= FORGE_MAX).length;

  const doForge = () => {
    if (!sel) return;
    const res = onForge(sel.id);           // App applies it and hands back the result
    if (!res || res.result === 'blocked') return;
    setAnvil({ item: sel, rarity: rarOf(sel), result: res.result, newLevel: res.newLevel });
    setSel(null);
  };

  const check = sel ? canForge(data, sel.id) : null;
  const lvl = sel ? forgeLevelOf(data, sel.id) : 0;
  const temper = sel ? forgeTemperOf(data, sel.id) : 0;
  const maxed = lvl >= FORGE_MAX;
  const rar = sel ? rarOf(sel) : null;
  const cost = sel && !maxed ? forgeCost(sel, lvl) : null;

  return (
    <View>
      {/* ONE header instead of three cards.
          The Forge used to spend four full cards — an explainer, a materials
          grid, a green integrity callout and a "Choose your gear" title — before
          a single item appeared. Useful on first run, noise on the hundredth.
          Everything below is the same information at a quarter of the height,
          plus the collection progress this screen was already computing and
          throwing away (upgradedCount / masteredCount were dead locals). */}
      <Card>
        <View style={[s.between, { marginBottom: 8 }]}>
          <Lbl style={{ marginBottom: 0 }}>Collection</Lbl>
          <Text style={{ ...T.caption, color: C.mut, ...T.numeric }}>
            <Text style={{ color: C.text, fontWeight: '700' }}>{upgradedCount}</Text>
            <Text>/{owned.length} worked</Text>
            {masteredCount > 0 ? (
              <Text style={{ color: C.gold, fontWeight: '700' }}>{'  ·  ' + masteredCount + ' mastered'}</Text>
            ) : null}
          </Text>
        </View>

        <View style={{ height: 7, borderRadius: 7, backgroundColor: C.sunken, overflow: 'hidden' }}>
          <View style={{
            width: Math.max(1.5, owned.length ? (upgradedCount / owned.length) * 100 : 0) + '%',
            height: 7, borderRadius: 7, backgroundColor: C.gold,
          }} />
        </View>

        {/* materials inline — four tiles became four pills */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 12 }}>
          {MATERIALS.map((m) => (
            <MaterialPill key={m.id} mat={m} count={materialBalance(data, m.id)} />
          ))}
        </View>

        <Text style={{ ...T.caption2, color: C.faint, marginTop: 2 }}>
          Grades cost coins and materials.{' '}
          <Text style={{ color: C.green, fontWeight: '700' }}>Looks only — never rank or stats.</Text>
        </Text>
      </Card>

      {/* search + category filter */}
      <Card>
        <TextInput
          value={query} onChangeText={setQuery}
          placeholder="Search your gear…" placeholderTextColor={C.dim}
          style={[s.input, { marginBottom: 10 }]}
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <Chip active={slot === 'all'} onPress={() => setSlot('all')}>All</Chip>
          {SLOTS.map((sl) => (
            <Chip key={sl.key} active={slot === sl.key} onPress={() => setSlot(sl.key)}>{sl.label}</Chip>
          ))}
        </ScrollView>
      </Card>

      {list.length === 0 ? (
        <EmptyState
          title="Nothing to forge yet"
          body="Get gear from Packs or the Shop."
        />
      ) : (
        list.map((it) => {
          const r = rarOf(it);
          const L = forgeLevelOf(data, it.id);
          const can = canForge(data, it.id);
          const isMax = L >= FORGE_MAX;
          return (
            <Pressable key={it.id} onPress={() => setSel(it)}>
              <Card style={{ borderWidth: 1, borderColor: L > 0 ? r.color + '66' : C.lineSoft }}>
                <View style={s.row}>
                  <ItemTile item={it} size={54} rarity={r} forgeLevel={L} />

                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={{ ...T.callout, fontWeight: '600', color: C.text }} numberOfLines={1}>{it.name}</Text>
                    <Text style={{ ...T.micro, color: r.color, marginTop: 2 }}>
                      {r.name.toUpperCase()} · {FORGE_TIERS[L]}
                    </Text>
                    <View style={{ marginTop: 6 }}><Pips level={L} color={r.color} /></View>
                  </View>

                    <Text style={{ ...T.micro, color: isMax ? C.gold : can.ok ? C.green : C.dim, fontWeight: '800' }}>
                      {isMax ? 'MAX' : can.ok ? 'READY' : 'LOCKED'}
                  </Text>
                </View>
              </Card>
            </Pressable>
          );
        })
      )}

      {/* ---- upgrade sheet ---- */}
      <Sheet visible={!!sel} title={sel ? sel.name : ''} onClose={() => setSel(null)}>
        {sel && (
          <ScrollView style={{ maxHeight: 430 }} contentContainerStyle={{ padding: 18 }}>
            {/* now -> next */}
            <View style={[s.between, { marginBottom: 18 }]}>
              <View style={{ alignItems: 'center', flex: 1 }}>
                <Text style={[s.label, { marginBottom: 6 }]}>Now</Text>
                <View style={{
                  width: 66, height: 66, borderRadius: RADIUS.md, backgroundColor: C.panel2,
                  alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.line,
                }}>
                  <ItemGlyph item={sel} size={38} color={C.mut} />
                </View>
                <Text style={{ ...T.caption, color: C.mut, marginTop: 6 }}>{FORGE_TIERS[lvl]}</Text>
              </View>

              <Text style={{ ...T.title2, color: C.dim, marginHorizontal: 6 }}>→</Text>

              <View style={{ alignItems: 'center', flex: 1 }}>
                <Text style={[s.label, { marginBottom: 6, color: rar.color }]}>Next</Text>
                <LinearGradient
                  colors={[rar.color + '66', C.panel]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={{
                    width: 66, height: 66, borderRadius: RADIUS.md,
                    alignItems: 'center', justifyContent: 'center',
                    borderWidth: 1, borderColor: rar.color,
                  }}>
                  <ItemGlyph item={sel} size={38} color={rar.color} />
                </LinearGradient>
                <Text style={{ ...T.caption, color: rar.color, marginTop: 6, fontWeight: '700' }}>
                  {maxed ? 'Mastered' : FORGE_TIERS[lvl + 1]}
                </Text>
              </View>
            </View>

            {maxed ? (
              <View style={{ alignItems: 'center', paddingVertical: 10 }}>
                <Text style={{ ...T.callout, fontWeight: '600', color: C.gold }}>Fully Mastered</Text>
                <Text style={{ ...T.caption, color: C.mut, marginTop: 6, textAlign: 'center', lineHeight: 18 }}>
                  Highest grade reached.
                </Text>
              </View>
            ) : (
              <View>
                {/* success chance */}
                <View style={[s.between, { marginBottom: 6 }]}>
                  <Text style={[s.label, { marginBottom: 0 }]}>Success chance</Text>
                  <Text style={{ ...T.footnote, fontWeight: '700', fontVariant: ['tabular-nums'], color: C.text }}>
                    {Math.round(forgeChance(lvl, temper) * 100)}%
                  </Text>
                </View>
                <PBar pct={forgeChance(lvl, temper) * 100} color={C.green} height={8} />
                {temper > 0 ? (
                  <Text style={{ ...T.micro, color: C.purp, marginTop: 6, fontWeight: '600' }}>
                    Temper +{temper} — next strike is likelier.
                  </Text>
                ) : null}

                {/* cost */}
                <View style={{ marginTop: 18 }}>
                  <Lbl>Cost</Lbl>
                  <View style={[s.between, { marginBottom: 10 }]}>
                    <Text style={{ ...T.footnote, color: C.mut }}>Forge Coins</Text>
                    <Text style={{
                      ...T.footnote, fontWeight: '700', fontVariant: ['tabular-nums'],
                      color: coinBalance(data) >= cost.coins ? C.text : C.red,
                    }}>
                      {cost.coins.toLocaleString()} / {coinBalance(data).toLocaleString()}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                    {Object.keys(cost.mats).map((mid) => {
                      const m = materialById(mid);
                      if (!m) return null;
                      return (
                        <MaterialPill
                          key={mid} mat={m}
                          count={materialBalance(data, mid)}
                          need={cost.mats[mid]}
                        />
                      );
                    })}
                  </View>
                </View>

                {/* reward preview */}
                <View style={{
                  marginTop: 14, backgroundColor: C.panel2, borderRadius: RADIUS.md,
                  padding: 12, borderWidth: 1, borderColor: C.lineSoft,
                }}>
                  <Text style={{ ...T.micro, color: C.dim, marginBottom: 4 }}>ON SUCCESS</Text>
                  <Text style={{ ...T.footnote, color: C.text }}>
                    Grade rises to <Text style={{ color: rar.color, fontWeight: '700' }}>{FORGE_TIERS[lvl + 1]}</Text>
                  </Text>
                  <Text style={{ ...T.caption, color: C.dim, marginTop: 6, lineHeight: 16 }}>
                    Your item is always safe.
                  </Text>
                </View>

                <View style={{ marginTop: 18 }}>
                  <ChunkyBtn onPress={doForge} disabled={!check || !check.ok} tone="gold">
                    {check && check.ok ? 'STRIKE THE ANVIL' : (check ? check.reason.toUpperCase() : 'CANNOT FORGE')}
                  </ChunkyBtn>
                </View>
              </View>
            )}
          </ScrollView>
        )}
      </Sheet>

      {anvil ? (
        <ForgeAnvil
          item={anvil.item} rarity={anvil.rarity} result={anvil.result} newLevel={anvil.newLevel}
          onDone={() => setAnvil(null)}
        />
      ) : null}
    </View>
  );
}

/* =============================== shop bay =============================== */
function ShopBay({ data, dv, buy, equip }) {
  const [slot, setSlot] = useState('helm');
  const coins = coinBalance(data);
  const xpBal = xpBalance(data);
  const owned = data.owned || [];
  const equipped = data.equipped || {};
  const playerTierIdx = dv.placed ? tierIndexByName(dv.tier.name) : -1;
  const items = COSMETICS.filter((c) => c.slot === slot);

  return (
    <View>
      <Card>
        <Lbl>Category</Lbl>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {SLOTS.map((sl) => (
            <Chip key={sl.key} active={slot === sl.key} onPress={() => setSlot(sl.key)}>{sl.label}</Chip>
          ))}
        </ScrollView>
      </Card>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
        {items.map((it) => {
          const rar = rarOf(it);
          const isOwned = owned.includes(it.id) || it.free;
          const isOn = equipped[it.slot] === it.id;
          const gated = rar.reqTier ? playerTierIdx < tierIndexByName(rar.reqTier) : false;
          const canCoins = coins >= rar.coins;
          const canXP = xpBal >= rar.xp;
          const L = forgeLevelOf(data, it.id);
          return (
            <View key={it.id} style={{
              width: '48%', backgroundColor: C.panel, borderRadius: RADIUS.lg,
              padding: 12, marginBottom: 12,
              borderWidth: 1, borderColor: isOn ? C.gold : rar.color + '44',
            }}>
              <View style={s.between}>
                <ItemTile item={it} size={40} rarity={rar} forgeLevel={L} />
                <Text style={{ ...T.micro, color: rar.color }}>{rar.name.toUpperCase()}</Text>
              </View>
              <Text style={{ ...T.footnote, fontWeight: '700', color: C.text, marginTop: 8 }} numberOfLines={1}>
                {it.name}
              </Text>
              {L > 0 ? <View style={{ marginTop: 5 }}><Pips level={L} color={rar.color} /></View> : null}

              <View style={{ marginTop: 10 }}>
                {isOwned ? (
                  <ChunkyBtn small tone={isOn ? 'slate' : 'green'} onPress={() => equip(it.slot, it.id)}>
                    {isOn ? 'EQUIPPED' : 'EQUIP'}
                  </ChunkyBtn>
                ) : gated ? (
                  <View style={[s.ghostBtn, { paddingVertical: 10 }]}>
                    <Text style={{ ...T.micro, color: C.dim }}>{rar.reqTier}+ ONLY</Text>
                  </View>
                ) : (
                  <View>
                    <ChunkyBtn small tone="gold" disabled={!canCoins} onPress={() => buy(it.id, 'coins')}>
                      {rar.coins.toLocaleString()} COINS
                    </ChunkyBtn>
                    <Pressable
                      onPress={() => canXP && buy(it.id, 'xp')}
                      style={[s.ghostBtn, { paddingVertical: 8, marginTop: 6 }, !canXP && { opacity: 0.45 }]}>
                      <Text style={{ ...T.micro, color: canXP ? C.text : C.dim }}>
                        {rar.xp.toLocaleString()} XP
                      </Text>
                    </Pressable>
                  </View>
                )}
              </View>
            </View>
          );
        })}
      </View>

      <Card>
        <Text style={{ ...T.footnote, color: C.mut, fontWeight: '700' }}>
          Your rank unlocks{' '}
          <Text style={{ color: rankStyleFor(dv.tier).trim, fontWeight: '700' }}>
            {rankStyleFor(dv.tier).label}
          </Text>{' '}gear styles.
        </Text>
      </Card>
    </View>
  );
}

/* =============================== pass bay ===============================
 * Rebuilt around the GOAL-GRADIENT EFFECT (Kivetz et al., 2006): effort rises
 * the closer a reward feels. So the screen LEADS with the next reward and how
 * close it is — not with a 20-row table.
 *
 * Three unmistakable states, each signalled by MORE than colour (icon +
 * brightness + motion), so they survive greyscale and colour-blindness:
 *   LOCKED    — dim, recessed, lock glyph
 *   CLAIMABLE — full colour, glowing, pulsing (the emotional peak)
 *   CLAIMED   — check glyph, quiet
 */
function NextReward({ next, level, prevLevel, premium, claims, claimAll }) {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!claims.length) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [claims.length, pulse]);

  // Something to claim RIGHT NOW beats any future promise. Lead with it.
  if (claims.length) {
    const glow = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.65] });
    return (
      <Card style={{ borderWidth: 1, borderColor: C.green, backgroundColor: C.greenSoft, overflow: 'hidden' }}>
        <Animated.View pointerEvents="none" style={{
          position: 'absolute', top: -60, right: -40, width: 180, height: 180,
          borderRadius: 999, backgroundColor: C.green, opacity: glow,
        }} />
        <Text style={[s.label, { color: C.green }]}>Ready to claim</Text>
        <Text style={{ ...T.display, color: C.text, marginTop: 2 }}>{claims.length}</Text>
        <Text style={{ ...T.footnote, color: C.mut, marginTop: 2 }}>
          {claims.length === 1 ? 'reward waiting' : 'rewards waiting'}
        </Text>
        <View style={{ marginTop: 14 }}>
          <ChunkyBtn tone="green" onPress={claimAll}>CLAIM ALL</ChunkyBtn>
        </View>
      </Card>
    );
  }

  if (!next) {
    return (
      <Card style={{ alignItems: 'center', paddingVertical: 24 }}>
        <Text style={{ ...T.title2, color: C.gold }}>Season cleared</Text>
        <Text style={{ ...T.caption, color: C.mut, marginTop: 6 }}>Every tier claimed.</Text>
      </Card>
    );
  }

  // Otherwise: pin the NEXT reward and show exactly how close it is.
  const span = Math.max(1, next.level - prevLevel);
  const done = Math.max(0, level - prevLevel);
  const pct  = Math.min(100, (done / span) * 100);
  const togo = Math.max(0, next.level - level);
  const rw   = premium ? next.premium : next.free;
  const nextItem = rw && rw.cosmetic ? COSMETICS.find((c) => c.id === rw.cosmetic) : null;
  const nextLabel = nextItem
    ? nextItem.name
    : rw && rw.coins != null ? rw.coins.toLocaleString() + ' coins' : '—';

  return (
    <Card style={[s.hero, { overflow: 'hidden' }]}>
      <View pointerEvents="none" style={{
        position: 'absolute', top: -70, right: -50, width: 190, height: 190,
        borderRadius: 999, backgroundColor: C.gold, opacity: 0.10,
      }} />
      <Text style={s.label}>Next reward</Text>
      <View style={[s.row, { marginTop: 4 }]}>
        {/* The real item, not a sparkle placeholder next to an emoji label \u2014
            rewardLabel() embeds emoji, which is the last place they survived. */}
        <View style={{
          width: 52, height: 52, borderRadius: RADIUS.md, backgroundColor: C.panel2,
          borderWidth: 1, borderColor: C.gold, alignItems: 'center', justifyContent: 'center',
        }}>
          {nextItem
            ? <ItemGlyph item={nextItem} size={30} color={C.gold} />
            : <RewardGlyph reward={{ kind: 'coins' }} size={28} color={C.gold} />}
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={{ ...T.callout, fontWeight: '600', color: C.text }} numberOfLines={1}>{nextLabel}</Text>
          <Text style={{ ...T.caption, color: C.gold, marginTop: 2, fontWeight: '700' }}>
            Tier {next.tier}
          </Text>
        </View>
      </View>

      <View style={{ marginTop: 14 }}>
        <StatBar pct={pct} height={12} glow />
        <View style={[s.between, { marginTop: 8 }]}>
          <Text style={{ ...T.caption, color: C.mut }}>Level {level}</Text>
          <Text style={{ ...T.caption, color: C.gold, fontWeight: '700' }}>
            {togo} {togo === 1 ? 'level' : 'levels'} to go
          </Text>
        </View>
      </View>
    </Card>
  );
}

/* ======================== the pass as a forged chain =======================
 * The pass used to be a 20-row spreadsheet: TIER | FREE | PREMIUM. It worked,
 * and it read like a table \u2014 three columns of text with no sense of travel, no
 * sense of how far you'd come, and nothing tying it to the bay it lives in.
 *
 * This is a CHAIN being forged, link by link, down the centre of the screen.
 *   - One continuous rail. It is lit gold up to the tier you've reached and
 *     dark steel beyond, so progress is a physical length, not a fraction.
 *   - Each tier is a link on that rail, carrying its own number.
 *   - Free rewards hang to the left of the chain, premium to the right.
 *   - The reward itself is drawn with the glyph system, so a pass cosmetic looks
 *     like the item you'll actually get instead of a text label with an emoji.
 *
 * The metaphor is the point: the Forge, the Shop and the Pass are one bay, and
 * this is the only one of the three that previously looked like a database.
 * ======================================================================== */
const PASS_ROW_H = 84;
const PASS_NODE = 40;

/* One reward, hanging off the chain. State is never colour-only: claimed shows
   a tick, locked shows the level you need, premium-gated says so in words. */
function PassReward({ rw, lane, state, level, onPress }) {
  const tone = lane === 'premium' ? C.gold : C.green;
  const can = state === 'claimable';
  const claimed = state === 'claimed';
  const item = rw && rw.cosmetic ? COSMETICS.find((c) => c.id === rw.cosmetic) : null;
  const label = item ? item.name : rw && rw.coins != null ? rw.coins.toLocaleString() : '\u2014';
  const sub = claimed ? '\u2713 Claimed'
    : can ? 'Tap to claim'
    : state === 'needsPremium' ? 'Premium'
    : 'Lv ' + level;

  // A tier with no reward in this lane (free coin slots alternate with 0) needs
  // to render as an empty link, not a claimable nothing.
  const empty = !rw || (rw.coins === 0 && !rw.cosmetic);
  if (empty) {
    return (
      <View style={{ height: PASS_NODE + 14, justifyContent: 'center' }}>
        <View style={{ width: 26, height: 2, borderRadius: 2, backgroundColor: C.lineSoft, alignSelf: lane === 'free' ? 'flex-end' : 'flex-start' }} />
      </View>
    );
  }

  return (
    <Pressable
      disabled={!can}
      onPress={onPress}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityState={{ disabled: !can }}
      accessibilityLabel={`${lane} tier reward, ${label}, ${sub}`}
      style={{
        flexDirection: lane === 'free' ? 'row' : 'row-reverse',
        alignItems: 'center',
        paddingVertical: 8, paddingHorizontal: 10, borderRadius: RADIUS.md,
        backgroundColor: can ? alpha(tone, 0.12) : claimed ? 'transparent' : C.panel,
        borderWidth: 1,
        borderColor: can ? alpha(tone, 0.8) : claimed ? C.lineSoft : C.line,
        opacity: state === 'locked' ? 0.5 : state === 'needsPremium' ? 0.55 : 1,
      }}>
      <View style={{
        width: 34, height: 34, borderRadius: 10,
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: claimed ? C.panel2 : alpha(tone, 0.14),
        borderWidth: 1, borderColor: claimed ? C.lineSoft : alpha(tone, 0.5),
      }}>
        {item
          ? <ItemGlyph item={item} size={21} color={claimed ? C.dim : tone} />
          : <RewardGlyph reward={{ kind: 'coins' }} size={20} color={claimed ? C.dim : tone} />}
      </View>
      <View style={{
        flex: 1,
        marginLeft: lane === 'free' ? 9 : 0,
        marginRight: lane === 'free' ? 0 : 9,
        alignItems: lane === 'free' ? 'flex-start' : 'flex-end',
      }}>
        <Text numberOfLines={1} style={{ ...T.caption, fontWeight: '700', color: claimed ? C.dim : C.text }}>
          {label}
        </Text>
        <Text numberOfLines={1} style={{ ...T.caption2, color: claimed ? C.green : can ? tone : C.faint }}>
          {sub}
        </Text>
      </View>
    </Pressable>
  );
}

/* One link of the chain: the node, plus a reward hanging either side. */
function PassLink({ row, unlocked, premium, claimedFree, claimedPrem, claimTier, isNext }) {
  const freeState = claimedFree ? 'claimed' : unlocked ? 'claimable' : 'locked';
  const premState = claimedPrem ? 'claimed'
    : !premium ? 'needsPremium'
    : unlocked ? 'claimable' : 'locked';

  return (
    <View style={{ height: PASS_ROW_H, justifyContent: 'center' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ flex: 1, paddingRight: PASS_NODE / 2 + 12, alignItems: 'flex-end' }}>
          <View style={{ width: '100%' }}>
            <PassReward
              rw={row.free} lane="free" state={freeState} level={row.level}
              onPress={() => claimTier('free', row.tier)}
            />
          </View>
        </View>
        <View style={{ flex: 1, paddingLeft: PASS_NODE / 2 + 12 }}>
          <View style={{ width: '100%' }}>
            <PassReward
              rw={row.premium} lane="premium" state={premState} level={row.level}
              onPress={() => claimTier('premium', row.tier)}
            />
          </View>
        </View>
      </View>

      {/* the link itself, sitting on the rail */}
      <View pointerEvents="none" style={{
        position: 'absolute', left: '50%', marginLeft: -PASS_NODE / 2,
        width: PASS_NODE, height: PASS_NODE, borderRadius: PASS_NODE / 2,
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: unlocked ? C.gold : C.bgElev,
        borderWidth: 2,
        borderColor: unlocked ? C.gold : isNext ? alpha(C.gold, 0.7) : C.line,
        // the next link glows: it's the thing you're training toward
        shadowColor: C.gold,
        shadowOpacity: isNext || unlocked ? 0.6 : 0,
        shadowRadius: isNext ? 12 : 6,
        shadowOffset: { width: 0, height: 0 },
        elevation: unlocked || isNext ? 5 : 0,
      }}>
        <Text style={{
          ...T.footnote, fontWeight: '800', ...T.numeric,
          color: unlocked ? C.ink : isNext ? C.gold : C.faint,
        }}>
          {row.tier}
        </Text>
      </View>
    </View>
  );
}

function PassBay({ data, dv, claimTier, claimAll, buyPremium }) {
  // Celebration beat: bouncy pop + success haptic on every claim. Rationed to
  // this moment only — bounce everywhere would read as instability.
  const pop = useRef(new Animated.Value(0)).current;
  const celebrate = () => {
    hap(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
    pop.setValue(0);
    Animated.spring(pop, { toValue: 1, ...MOTION.bouncy }).start();
  };
  const claimOne = (lane, tier) => { claimTier(lane, tier); celebrate(); };
  const claimEvery = () => { claimAll(); celebrate(); };
  const cheer = pop.interpolate({ inputRange: [0, 1], outputRange: [1, 1.04] });

  const level = dv.level;
  const unlocked = passTierUnlocked(level);
  const claimed = data.passClaimed || [];
  const premium = !!data.passPremium;
  const claims = passClaimable(data, level);
  const coins = coinBalance(data);
  const next = FORGE_PASS.find((t) => t.tier === unlocked + 1);
  const prevLevel = unlocked > 0 ? FORGE_PASS[unlocked - 1].level : 0;

  return (
    <View>
      <NextReward
        next={next} level={level} prevLevel={prevLevel}
        premium={premium} claims={claims} claimAll={claimEvery}
      />

      <Card>
        <View style={s.between}>
          <View style={{ flex: 1 }}>
            <Text style={s.label}>{dv.season}</Text>
            <Text style={{ ...T.callout, fontWeight: '600', color: premium ? C.gold : C.text }}>
              {premium ? 'Premium pass' : 'Free pass'}
            </Text>
          </View>
          <Text style={{ ...T.title2, color: C.text, fontVariant: ['tabular-nums'] }}>
            {unlocked}<Text style={{ ...T.caption, color: C.faint }}>/{PASS_SEASON_TIERS}</Text>
          </Text>
        </View>
        {/* Length of chain forged, as a bar. Mirrors the rail below. */}
        <View style={{ marginTop: 12 }}>
          <PBar pct={(unlocked / PASS_SEASON_TIERS) * 100} color={C.gold} height={7} />
        </View>
        {!premium ? (
          <View style={{ marginTop: 14 }}>
            <ChunkyBtn tone="gold" disabled={coins < PASS_PREMIUM_COST} onPress={buyPremium}>
              GO PREMIUM · {PASS_PREMIUM_COST.toLocaleString()}
            </ChunkyBtn>
            <Text style={{ ...T.caption, color: C.dim, marginTop: 8 }}>
              Unlocks the right-hand side of every link. Cosmetic only — never rank.
            </Text>
          </View>
        ) : null}
      </Card>

      <Animated.View style={{ transform: [{ scale: cheer }] }}>
      <Card>
        {/* lane headers, anchored to the sides the rewards actually hang on */}
        <View style={[s.row, { marginBottom: 6 }]}>
          <Text style={{ ...T.label, color: C.green, flex: 1 }}>FREE</Text>
          <Text style={{ ...T.label, color: premium ? C.gold : C.faint, flex: 1, textAlign: 'right' }}>
            PREMIUM{premium ? '' : ' · LOCKED'}
          </Text>
        </View>

        <View style={{ position: 'relative' }}>
          {/* the chain: dark steel for the whole season... */}
          <View pointerEvents="none" style={{
            position: 'absolute', left: '50%', marginLeft: -2, top: 0,
            height: PASS_ROW_H * FORGE_PASS.length, width: 4,
            borderRadius: 2, backgroundColor: C.line,
          }} />
          {/* ...lit gold for the part you've forged. Row height is fixed
              (PASS_ROW_H) precisely so this length can be computed rather than
              measured — no onLayout, no reflow, no flicker on mount. */}
          {unlocked > 0 ? (
            <View pointerEvents="none" style={{
              position: 'absolute', left: '50%', marginLeft: -2, top: 0,
              height: Math.min(FORGE_PASS.length, unlocked) * PASS_ROW_H - PASS_ROW_H / 2,
              width: 4, borderRadius: 2, backgroundColor: C.gold,
              shadowColor: C.gold, shadowOpacity: 0.7, shadowRadius: 8,
              shadowOffset: { width: 0, height: 0 }, elevation: 4,
            }} />
          ) : null}

          {FORGE_PASS.map((row) => (
            <PassLink
              key={row.tier}
              row={row}
              unlocked={row.tier <= unlocked}
              isNext={row.tier === unlocked + 1}
              premium={premium}
              claimedFree={claimed.includes(passKey('free', row.tier))}
              claimedPrem={claimed.includes(passKey('premium', row.tier))}
              claimTier={claimOne}
            />
          ))}
        </View>
      </Card>
      </Animated.View>
    </View>
  );
}

/* ================================ Forge ================================= */
export default function ShopTab({ data, dv, buy, equip, forge, claimTier, claimAll, buyPremium, goPacks }) {
  const packCount = (data.packs && (Object.values(data.packs).reduce((a,b)=>a+(b||0),0))) || 0;
  const [bay, setBay] = useState('forge');
  const passClaims = passClaimable(data, dv.level).length;
  const BAYS = [['forge', 'Forge'], ['shop', 'Shop'], ['pass', 'Pass']];

  return (
    <View>
      <ScreenHeader title="Forge" hint="Change how your player looks" />
      {/* Packs entry — Packs merged into Forge (research: 5 tabs, not 7). A bold
          banner keeps them one tap away and visually loud when you have some. */}
      <Pressable onPress={goPacks} style={{
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: packCount > 0 ? C.goldSoft : C.panel2,
        borderWidth: 1, borderColor: packCount > 0 ? C.gold : C.line,
        borderRadius: RADIUS.md, padding: 14, marginBottom: 12,
      }}>
        {/* PackGlyph, not 🎁. The reveal this banner leads to is drawn in the
            same vector idiom, so the entry point may as well match its
            destination — and the glyph can take the gold tint, which an emoji
            never can. */}
        <View style={{
          width: 38, height: 38, borderRadius: 11, marginRight: 12,
          alignItems: 'center', justifyContent: 'center',
          backgroundColor: alpha(packCount > 0 ? C.gold : C.mut, 0.12),
          borderWidth: 1, borderColor: alpha(packCount > 0 ? C.gold : C.mut, 0.3),
        }}>
          <PackGlyph packKey="prime" size={22} color={packCount > 0 ? C.gold : C.mut} strokeWidth={1.7} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ ...T.subheadline, fontWeight: '800', color: C.text }}>
            {packCount > 0 ? `${packCount} pack${packCount > 1 ? 's' : ''} to open` : 'Reward Packs'}
          </Text>
          <Text style={{ ...T.caption, color: C.mut, fontWeight: '600' }}>
            {packCount > 0 ? 'Tap to open now' : 'Earn packs by leveling & dueling'}
          </Text>
        </View>
        <Text style={{ fontSize: 18, color: packCount > 0 ? C.gold : C.dim, fontWeight: '800' }}>›</Text>
      </Pressable>

      <Card style={[s.hero, { padding: 12 }]}>
        {/* The pass segment carries its unclaimed-reward count, which is the
            only thing that should ever pull you into a tab you weren't heading
            for. */}
        <Segmented
          value={bay}
          onChange={setBay}
          options={BAYS.map((b) => ({
            key: b[0], label: b[1],
            badge: b[0] === 'pass' && passClaims > 0 ? passClaims : null,
          }))}
        />
      </Card>

      {bay === 'forge' ? <ForgeBay data={data} onForge={forge} /> : null}
      {bay === 'shop' ? <ShopBay data={data} dv={dv} buy={buy} equip={equip} /> : null}
      {bay === 'pass' ? <PassBay data={data} dv={dv} claimTier={claimTier} claimAll={claimAll} buyPremium={buyPremium} /> : null}
    </View>
  );
}
