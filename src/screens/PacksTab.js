// LEVL React Native — Packs: earn packs, open them with a premium reveal.
import React, { useState, useRef, useEffect } from 'react';
import { View, Text, Pressable, Animated, Easing, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Polygon } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { C, s, MONO, RADIUS, RARITY as RARITY_THEME } from '../theme';
import { Card, Lbl, GoldBtn, GhostBtn, CountUp, ChunkyBtn, Stagger } from '../components/ui';
import { PACK_TYPES, packTypeByKey, packMeter, COSMETICS, PACK_TITLES, DECORATIONS } from '../engine/engine';
import { Sheet } from '../components/ui';


const rarityTheme = (key) => RARITY_THEME[key] || RARITY_THEME.common;
const haptic = (type) => { try { Haptics.notificationAsync(type); } catch (e) {} };
const hapticImpact = (style) => { try { Haptics.impactAsync(style); } catch (e) {} };

/* --------------------------- particle burst ----------------------------- */
function Particles({ color, run }) {
  const parts = useRef([...Array(14)].map(() => new Animated.Value(0))).current;
  useEffect(() => {
    if (!run) return;
    Animated.stagger(18, parts.map((p) => Animated.timing(p, {
      toValue: 1, duration: 900, easing: Easing.out(Easing.quad), useNativeDriver: true,
    }))).start();
  }, [run, parts]);
  if (!run) return null;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center' }}>
      {parts.map((p, i) => {
        const ang = (i / parts.length) * Math.PI * 2;
        const dist = 120 + (i % 3) * 40;
        const tx = p.interpolate({ inputRange: [0, 1], outputRange: [0, Math.cos(ang) * dist] });
        const ty = p.interpolate({ inputRange: [0, 1], outputRange: [0, Math.sin(ang) * dist] });
        const op = p.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 1, 0] });
        const sc = p.interpolate({ inputRange: [0, 1], outputRange: [1, 0.3] });
        return (
          <Animated.View key={i} style={{ position: 'absolute', opacity: op, transform: [{ translateX: tx }, { translateY: ty }, { scale: sc }] }}>
            <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: color }} />
          </Animated.View>
        );
      })}
    </View>
  );
}

/* ----------------------------- light rays ------------------------------- */
function LightRays({ color, spin }) {
  const rot = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  return (
    <Animated.View pointerEvents="none" style={{ position: 'absolute', transform: [{ rotate: rot }] }}>
      <Svg width={320} height={320} viewBox="0 0 320 320">
        {[...Array(12)].map((_, i) => {
          const a = (i / 12) * Math.PI * 2;
          return <Polygon key={i} points={`160,160 ${160 + Math.cos(a - 0.05) * 200},${160 + Math.sin(a - 0.05) * 200} ${160 + Math.cos(a + 0.05) * 200},${160 + Math.sin(a + 0.05) * 200}`} fill={color} opacity={0.08} />;
        })}
      </Svg>
    </Animated.View>
  );
}

/* ------------------------- pack opening overlay ------------------------- */
function PackOpening({ packKey, reward, onDone }) {
  const [phase, setPhase] = useState('build'); // build | flash | reveal
  const pack = packTypeByKey(packKey);
  const rar = rarityTheme(reward.rarity);

  const scale = useRef(new Animated.Value(0.3)).current;
  const shake = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;
  const spin = useRef(new Animated.Value(0)).current;
  const flash = useRef(new Animated.Value(0)).current;
  const cardFlip = useRef(new Animated.Value(0)).current;
  const cardRise = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // continuous ray spin + glow pulse during build-up
    Animated.loop(Animated.timing(spin, { toValue: 1, duration: 8000, easing: Easing.linear, useNativeDriver: true })).start();
    Animated.loop(Animated.sequence([
      Animated.timing(glow, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(glow, { toValue: 0.4, duration: 700, useNativeDriver: true }),
    ])).start();

    // sequence: pack zooms in, shakes with rising intensity, flash, reveal
    hapticImpact(Haptics.ImpactFeedbackStyle.Medium);
    Animated.sequence([
      Animated.spring(scale, { toValue: 1, friction: 5, useNativeDriver: true }),
      Animated.delay(250),
      // building shake
      Animated.timing(shake, { toValue: 1, duration: 1100, easing: Easing.in(Easing.quad), useNativeDriver: true }),
    ]).start(() => {
      hapticImpact(Haptics.ImpactFeedbackStyle.Heavy);
      // flash
      setPhase('flash');
      Animated.sequence([
        Animated.timing(flash, { toValue: 1, duration: 120, useNativeDriver: true }),
        Animated.timing(flash, { toValue: 0, duration: 380, useNativeDriver: true }),
      ]).start();
      setTimeout(() => {
        setPhase('reveal');
        haptic(reward.rarity === 'legendary' ? Haptics.NotificationFeedbackType.Success
          : reward.rarity === 'epic' ? Haptics.NotificationFeedbackType.Success
          : Haptics.NotificationFeedbackType.Warning);
        Animated.parallel([
          Animated.spring(cardRise, { toValue: 1, friction: 6, useNativeDriver: true }),
          Animated.timing(cardFlip, { toValue: 1, duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        ]).start();
      }, 200);
    });
  }, []);

  const shakeX = shake.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: [0, -8, 8, -8, 8] });
  const glowOpacity = glow.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.85] });
  const flipRot = cardFlip.interpolate({ inputRange: [0, 1], outputRange: ['90deg', '0deg'] });
  const riseY = cardRise.interpolate({ inputRange: [0, 1], outputRange: [40, 0] });

  return (
    <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(4,5,9,0.97)', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
      <LightRays color={rar.color} spin={spin} />
      <Particles color={rar.color} run={phase === 'reveal'} />

      {/* radial glow */}
      <Animated.View pointerEvents="none" style={{ position: 'absolute', width: 300, height: 300, borderRadius: 150, backgroundColor: rar.color, opacity: phase === 'reveal' ? glowOpacity : glow.interpolate({ inputRange: [0, 1], outputRange: [0.08, 0.2] }) }} />

      {phase !== 'reveal' && (
        <Animated.View style={{ transform: [{ scale }, { translateX: shakeX }] }}>
          <LinearGradient colors={[pack.color, C.bgElev]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={{ width: 150, height: 190, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: pack.color }}>
            <Text style={{ fontSize: 68 }}>{pack.emoji}</Text>
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 14, marginTop: 8, letterSpacing: 1 }}>{pack.name.toUpperCase()}</Text>
          </LinearGradient>
        </Animated.View>
      )}

      {/* white flash */}
      <Animated.View pointerEvents="none" style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: '#fff', opacity: flash }} />

      {phase === 'reveal' && (
        <Animated.View style={{ alignItems: 'center', transform: [{ translateY: riseY }, { rotateY: flipRot }] }}>
          <Text style={{ color: rar.color, fontWeight: '800', fontSize: 16, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 12 }}>{rar.name}</Text>
          <LinearGradient colors={rar.grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={{ width: 200, height: 250, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: rar.color, shadowColor: rar.color, shadowOpacity: 0.8, shadowRadius: 24, shadowOffset: { width: 0, height: 0 } }}>
            <Text style={{ fontSize: 84 }}>{reward.emoji}</Text>
            {(reward.kind === 'coins' || reward.kind === 'xp') ? (
              <CountUp value={reward.amount} suffix=" COINS" style={{ color: '#fff', fontWeight: '800', fontSize: 28, marginTop: 10, fontVariant: ['tabular-nums'] }} />
            ) : (
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16, marginTop: 10, textAlign: 'center', paddingHorizontal: 12 }}>{reward.name}</Text>
            )}
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 6, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 }}>
              {(reward.kind === 'coins' || reward.kind === 'xp') ? 'Coins'
                : reward.kind === 'material' ? 'Forge Material'
                : reward.kind === 'cosmetic' ? 'Cosmetic'
                : reward.kind === 'title' ? 'Title' : 'Profile Border'}
            </Text>
          </LinearGradient>
          <View style={{ marginTop: 24, width: 200 }}>
            <GoldBtn onPress={onDone}>Collect</GoldBtn>
          </View>
        </Animated.View>
      )}
    </View>
  );
}

/* -------------------------------- screen -------------------------------- */
export default function PacksTab({ data, dv, openPackH, grantTestPack, goBack }) {
  const [opening, setOpening] = useState(null); // { packKey, reward }
  const [catalogueOpen, setCatalogueOpen] = useState(false);
  const meter = packMeter(data);
  const pulls = data.recentPulls || [];
  const packs = data.packs || { standard: 0, prime: 0, elite: 0 };
  const totalPacks = (packs.standard || 0) + (packs.prime || 0) + (packs.elite || 0);

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
                <Text style={{ fontSize: 34 }}>{pack.emoji}</Text>
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
          Equip titles and borders in Hunter. Packs are cosmetic only.
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
      return PACK_TITLES.map((t) => ({ id: t.id, name: t.name, rarity: t.rarity, emoji: '🏷️', have: titles.has(t.id) }));
    }
    if (tab === 'decoration') {
      return DECORATIONS.filter((d) => d.id !== 'deco_none')
        .map((d) => ({ id: d.id, name: d.name, rarity: d.rarity, emoji: '🖼️', have: decos.has(d.id) }));
    }
    return COSMETICS.filter((c) => !c.free)
      .map((c) => ({ id: c.id, name: c.name, rarity: c.rarity === 'mythic' ? 'legendary' : c.rarity, emoji: c.emoji || '◆', have: owned.has(c.id), slot: c.slot }));
  }, [tab, data.owned, data.titles, data.decorations]); // eslint-disable-line react-hooks/exhaustive-deps

  const shown = ownedOnly ? items.filter((i) => i.have) : items;
  const haveCount = items.filter((i) => i.have).length;
  const pct = items.length ? Math.round((haveCount / items.length) * 100) : 0;

  const TABS = [['cosmetic', 'Cosmetics'], ['title', 'Titles'], ['decoration', 'Borders']];

  return (
    <Sheet visible title="Catalogue" onClose={onClose}>
      <View style={{ paddingHorizontal: 16, paddingTop: 10 }}>
        <View style={{ flexDirection: 'row', backgroundColor: C.panel2, borderRadius: 12, padding: 4, borderWidth: 1, borderColor: C.line }}>
          {TABS.map((t) => (
            <Pressable key={t[0]} onPress={() => setTab(t[0])}
              accessibilityRole="tab" accessibilityState={{ selected: tab === t[0] }} accessibilityLabel={t[1]}
              style={{ flex: 1, minHeight: 40, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: tab === t[0] ? C.gold : 'transparent' }}>
              <Text style={{ fontSize: 12.5, fontWeight: '800', color: tab === t[0] ? C.ink : C.mut }}>{t[1]}</Text>
            </Pressable>
          ))}
        </View>

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
                    <Text style={{ fontSize: 20 }}>{it.have ? it.emoji : '🔒'}</Text>
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
