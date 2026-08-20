// ============================================================================
// LEVL — HunterTab
//
// "This is who my training is building."
//
// Player is one of the five destinations now, and it answers a different
// question from Train. Train is about the work; Player is about what the work
// has produced — the character, the level, the rank, the six stats, the titles,
// the consistency.
//
// The tab is LABELLED "Player" but the file, the route key and the components
// are still named Hunter. That is deliberate: the key travels inside every
// levl:// deep link, widget payload and stored notification, so renaming it
// would break links already out in the world for no user-visible gain.
//
// It is assembled from what used to live in the "You" tab, minus everything
// that was really settings (units, account, data management), which moved to
// the profile sheet reachable from the header. Nothing was dropped: the split
// is by PURPOSE — your character here, your preferences there.
//
// It deliberately does not become a spreadsheet. The visual character stays the
// centre of the screen, deep training analytics live behind one tap from Train,
// and Apple Health appears as quiet context rather than another scoreboard.
// ============================================================================

import React, { useState } from 'react';
import { View, Pressable } from 'react-native';
import { Text } from '../components/Text';
import Svg, { Polygon, Text as SvgText } from 'react-native-svg';
import { C, s, T, RADIUS, SPACING, TOUCH } from '../theme';
import { Card, Lbl, PBar, StatBar, GoldBtn, CountUp, RadarChart, ScreenHeader } from '../components/ui';
import { AvatarCustomizer } from '../components/Hunter';
import HunterStage from '../components/HunterStage';
import SFIcon from '../components/SFIcon';
import {
  TIERS, STAT_META, DEFAULT_DATA, PART_LABEL, rankStyleFor,
  coinBalance, titleById, decorationById,
} from '../engine/engine';
import haptics from '../services/haptics';

function RankBadge({ color, divText, size }) {
  const S = size || 74;
  return (
    <Svg width={S} height={S} viewBox="0 0 100 100">
      <Polygon points="50,2 93,26 93,74 50,98 7,74 7,26" fill={color} opacity="0.9" />
      <Polygon points="50,8 87,29 87,71 50,92 13,71 13,29" fill={C.bgElev} />
      <SvgText x="50" y="52" fill={color} fontSize="30" fontWeight="900" textAnchor="middle">▲</SvgText>
      <SvgText x="50" y="74" fill={color} fontSize="15" fontWeight="800" textAnchor="middle">{divText}</SvgText>
    </Svg>
  );
}

export default function HunterTab({
  data,
  dv,
  setAvatar,
  equipTitle,
  equipDecoration,
  goForge,
  goAnalytics,
  goArchive,
  health,
  socialStats,
}) {
  const [part, setPart] = useState(null);
  const empty = data.lifts.length + data.cardio.length === 0;
  const tIdx = TIERS.findIndex((t) => t.name === dv.tier.name);
  const nextTier = TIERS[tIdx + 1];
  const rankPct = nextTier ? ((dv.fr - dv.tier.min) / (nextTier.min - dv.tier.min)) * 100 : 100;
  const nextLabel = nextTier ? `${nextTier.min - dv.fr} FR to ${nextTier.name}` : 'Top of the ladder';
  const rs = rankStyleFor(dv.tier);

  return (
    <View>
      <ScreenHeader title="Player" hint="What your training has built" />

      {empty ? (
        <Card style={{ backgroundColor: C.goldSoft, borderWidth: 1, borderColor: C.gold }}>
          <Text style={{ ...T.title3, color: C.gold }}>Earn your first rank.</Text>
          <Text style={{ ...T.subheadline, color: C.text, marginTop: 5 }}>
            Train on 5 days to complete placement.
          </Text>
        </Card>
      ) : null}

      {/* ---- identity ----------------------------------------------------- */}
      <Card style={s.hero}>
        <View style={s.row}>
          <View style={{
            padding: 3, borderRadius: 16, borderWidth: 2,
            borderColor: decorationById(data.equippedDecoration).color,
          }}>
            <RankBadge
              color={dv.placed ? dv.tier.color : C.dim}
              divText={dv.placed ? (dv.division ? dv.division.trim() : 'GM') : '?'}
            />
          </View>

          <View style={{ flex: 1, marginLeft: 14 }}>
            <Text style={{ ...T.title3, color: C.text }} numberOfLines={1}>{data.name}</Text>
            {data.equippedTitle && titleById(data.equippedTitle) ? (
              <Text style={{ ...T.caption, color: C.purp, fontWeight: '600', marginTop: 2, fontStyle: 'italic' }}>
                “{titleById(data.equippedTitle).name}”
              </Text>
            ) : null}
            <Text style={{ ...T.caption, color: C.gold, fontWeight: '600', marginTop: 2 }}>{dv.title}</Text>
            <Text style={{ ...T.caption, ...T.numeric, color: C.mut, marginTop: 2 }}>
              {dv.streak}-session streak
            </Text>
          </View>

          <View style={{ alignItems: 'center', marginLeft: 8 }}>
            <Text style={{ ...T.label, color: C.dim }}>Level</Text>
            <Text style={{
              ...T.display, ...T.numeric, color: C.gold, lineHeight: 42,
              textShadowColor: C.goldGlow, textShadowRadius: 14, textShadowOffset: { width: 0, height: 0 },
            }}>
              {dv.level}
            </Text>
          </View>
        </View>

        <View style={{ marginTop: 14 }}>
          <View style={[s.between, { marginBottom: 6 }]}>
            <Text style={{ ...T.label, color: C.dim }}>Next level</Text>
            <Text style={{ ...T.caption, ...T.numeric, color: C.mut, fontWeight: '600' }}>
              {data.xp - dv.curBase} / {dv.nextNeed - dv.curBase} XP
            </Text>
          </View>
          <StatBar pct={dv.levelPct} height={14} glow />
        </View>
      </Card>

      {/* ---- rank --------------------------------------------------------- */}
      <Card>
        <Lbl>Ranked Ladder</Lbl>
        {dv.placed ? (
          <View>
            <View style={s.between}>
              <Text style={{
                ...T.title2, color: dv.tier.color,
                textShadowColor: dv.tier.color + '55', textShadowRadius: 12, textShadowOffset: { width: 0, height: 0 },
              }}>
                {dv.tier.name}{dv.division}
              </Text>
              <Text style={{ ...T.subheadline, ...T.numeric, color: C.mut, fontWeight: '600' }}>FR {dv.fr}</Text>
            </View>
            <View style={{ marginTop: 12 }}>
              <StatBar pct={rankPct} color={dv.tier.color} height={12} glow />
            </View>
            <Text style={{ ...T.footnote, color: C.mut, marginTop: 7 }}>{nextLabel} · Last 28 days</Text>
          </View>
        ) : (
          <View>
            <Text style={{ ...T.title3, color: C.text }}>5 Training Days</Text>
            <Text style={{ ...T.subheadline, color: C.mut, marginVertical: 8 }}>
              {5 - dv.placementCount} training day{5 - dv.placementCount === 1 ? '' : 's'} left.
            </Text>
            <PBar pct={(dv.placementCount / 5) * 100} />
            <Text style={{ ...T.caption, ...T.numeric, color: C.dim, marginTop: 6 }}>
              {dv.placementCount} / 5 days
            </Text>
          </View>
        )}
      </Card>

      {/* ---- consistency: training AND social, kept separate --------------- */}
      {socialStats ? (
        <Card>
          <Lbl>Consistency</Lbl>
          <View style={{ flexDirection: 'row' }}>
            <Stat label="Check Ins" value={socialStats.checkIns} />
            <Stat label="Verified" value={socialStats.verified} tint={C.green} />
            <Stat label="Check In streak" value={socialStats.streak} tint={C.gold} suffix="d" />
          </View>
          {/* Stated explicitly, because conflating them would be dishonest: a
              photo streak is showing up socially, not training. */}
          <Text style={{ ...T.caption, color: C.faint, marginTop: 10, lineHeight: 16 }}>
            Your Check In streak is social consistency. Your {dv.streak}-session
            training streak is the one that builds this player.
          </Text>
          {goArchive ? (
            <Pressable
              onPress={goArchive}
              accessibilityRole="button"
              accessibilityLabel="Open your Check In archive"
              style={{
                flexDirection: 'row', alignItems: 'center', marginTop: 12,
                minHeight: TOUCH, paddingHorizontal: 14, borderRadius: RADIUS.md,
                backgroundColor: C.panel2, borderWidth: 1, borderColor: C.line,
              }}>
              <Text style={{ ...T.subheadline, color: C.mut, flex: 1 }}>Check In archive</Text>
              <SFIcon name="chevron.right" size={14} color={C.dim} />
            </Pressable>
          ) : null}
        </Card>
      ) : null}

      {/* ---- Apple Health, as context only --------------------------------- */}
      {health && health.available ? <HealthCard health={health} /> : null}

      {/* ---- the character ------------------------------------------------- */}
      <Card>
        <Lbl>Your Character</Lbl>
        <HunterStage
          statLevels={dv.statLevels}
          avatar={data.avatar || DEFAULT_DATA.avatar}
          equipped={data.equipped || DEFAULT_DATA.equipped}
          rankStyle={rs}
          onPart={setPart}
          height={250}
        />

        <View style={{ marginTop: 16, alignItems: 'center' }}>
          <RadarChart statLevels={dv.statLevels} size={200} />
        </View>
        <Text style={{
          ...T.caption, marginTop: 4, textAlign: 'center',
          color: part ? STAT_META[part].color : C.dim,
          fontWeight: part ? '600' : '400',
        }}>
          {part
            ? `${PART_LABEL[part]} → ${part} · ${STAT_META[part].name} · Lv ${(dv.statLevels.find((x) => x.stat === part) || { level: 1 }).level}`
            : 'Train to build all six stats.'}
        </Text>

        <AvatarCustomizer avatar={data.avatar || DEFAULT_DATA.avatar} onChange={setAvatar} />

        <View style={[s.between, {
          marginTop: 10, padding: 12, backgroundColor: C.panel2,
          borderWidth: 1, borderColor: C.line, borderRadius: RADIUS.md,
        }]}>
          <View>
            <Lbl style={{ marginBottom: 2 }}>Rank Style</Lbl>
            <Text style={{ ...T.subheadline, fontWeight: '600', color: rs.trim }}>
              {rs.label} · {dv.placed ? dv.tier.name : 'Unranked'}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Lbl style={{ marginBottom: 2, color: C.gold }}>Coins</Lbl>
            <CountUp
              value={coinBalance(data)}
              style={{ ...T.headline, ...T.numeric, color: C.text }}
            />
          </View>
        </View>

        {goForge ? <GoldBtn onPress={goForge} style={{ marginTop: 10 }}>Open the Forge</GoldBtn> : null}

        <View style={{ marginTop: 8 }}>
          {dv.statLevels.map((x) => {
            const meta = STAT_META[x.stat];
            const bandPct = ((x.level % 5) / 5) * 100 || (x.level > 0 ? 100 : 0);
            return (
              <View key={x.stat} style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.line }}>
                <View style={[s.row, { alignItems: 'center' }]}>
                  <View style={{
                    width: 48, height: 48, borderRadius: 12, marginRight: 12,
                    backgroundColor: meta.color + '1e', borderWidth: 1, borderColor: meta.color + '44',
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Text style={{ ...T.headline, ...T.numeric, fontWeight: '700', color: meta.color }}>
                      {x.stat}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={s.between}>
                      <Text style={{ ...T.title3, color: C.text }}>{meta.name}</Text>
                      <Text style={{ ...T.title2, ...T.numeric, color: meta.color }}>{x.level}</Text>
                    </View>
                    <Text style={{ ...T.caption, color: C.dim, marginTop: 2 }}>{meta.desc}</Text>
                    <View style={{ height: 4, borderRadius: 2, backgroundColor: C.panel2, marginTop: 5, overflow: 'hidden' }}>
                      <View style={{ height: 4, width: `${bandPct}%`, backgroundColor: meta.color, borderRadius: 2 }} />
                    </View>
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      </Card>

      {/* ---- recent PRs ---------------------------------------------------- */}
      {dv.recentPRs.length > 0 ? (
        <Card>
          <Lbl>Recent PRs</Lbl>
          {dv.recentPRs.map((l) => (
            <View key={l.id} style={[s.between, { paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: C.line }]}>
              <Text style={{ ...T.subheadline, fontWeight: '600', color: C.text }}>{l.ex}</Text>
              <Text style={{ ...T.subheadline, ...T.numeric, color: C.gold }}>
                {l.e1rm} {data.unit} e1RM
              </Text>
            </View>
          ))}
        </Card>
      ) : null}

      {/* ---- titles & borders ---------------------------------------------- */}
      {((data.titles || []).length > 0 || (data.decorations || []).length > 0) ? (
        <Card>
          <Lbl>Titles &amp; Borders · from Packs</Lbl>

          {(data.titles || []).length > 0 ? (
            <View style={{ marginBottom: 12 }}>
              <Text style={{ ...T.caption, color: C.dim, marginBottom: 6, fontWeight: '600' }}>TITLES</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                <Pressable
                  onPress={() => { haptics.selection(); equipTitle(null); }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: !data.equippedTitle }}
                  style={[s.chip, !data.equippedTitle && s.chipOn]}>
                  <Text style={[s.chipTxt, !data.equippedTitle && s.chipTxtOn]}>None</Text>
                </Pressable>
                {(data.titles || []).map((tid) => {
                  const t = titleById(tid);
                  if (!t) return null;
                  const on = data.equippedTitle === tid;
                  return (
                    <Pressable
                      key={tid}
                      onPress={() => { haptics.selection(); equipTitle(tid); }}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: on }}
                      style={[s.chip, on && s.chipOn]}>
                      <Text style={[s.chipTxt, on && s.chipTxtOn]}>{t.name}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}

          {(data.decorations || []).length > 0 ? (
            <View>
              <Text style={{ ...T.caption, color: C.dim, marginBottom: 6, fontWeight: '600' }}>PROFILE BORDERS</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                <Pressable
                  onPress={() => { haptics.selection(); equipDecoration('deco_none'); }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: data.equippedDecoration === 'deco_none' }}
                  style={[s.chip, data.equippedDecoration === 'deco_none' && s.chipOn]}>
                  <Text style={[s.chipTxt, data.equippedDecoration === 'deco_none' && s.chipTxtOn]}>None</Text>
                </Pressable>
                {(data.decorations || []).map((did) => {
                  const d = decorationById(did);
                  if (!d) return null;
                  const on = data.equippedDecoration === did;
                  return (
                    <Pressable
                      key={did}
                      onPress={() => { haptics.selection(); equipDecoration(did); }}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: on }}
                      style={[s.chip, { borderColor: on ? d.color : C.line }, on && { backgroundColor: 'rgba(255,255,255,0.04)' }]}>
                      <View style={{
                        width: 10, height: 10, borderRadius: 4, backgroundColor: d.color,
                        marginRight: 6, borderWidth: 1, borderColor: '#00000030',
                      }} />
                      <Text style={[s.chipTxt, on && { color: d.color }]}>{d.name}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}
        </Card>
      ) : null}

      {/* ---- deep analytics live one tap away, not on this screen ---------- */}
      {goAnalytics ? (
        <Pressable
          onPress={goAnalytics}
          accessibilityRole="button"
          accessibilityLabel="Open training analytics"
          style={{
            flexDirection: 'row', alignItems: 'center',
            minHeight: 58, paddingHorizontal: 16, borderRadius: RADIUS.lg,
            backgroundColor: C.panel, borderWidth: 1, borderColor: C.line,
            marginBottom: SPACING.md,
          }}>
          <View style={{ flex: 1 }}>
            <Text style={{ ...T.headline, color: C.text }}>Training analytics</Text>
            <Text style={{ ...T.caption, color: C.dim, marginTop: 1 }}>
              Strength curves, volume, history
            </Text>
          </View>
          <SFIcon name="chevron.right" size={15} color={C.dim} />
        </Pressable>
      ) : null}
    </View>
  );
}

/* ------------------------------------------------------------------------- */

function Stat({ label, value, tint, suffix }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ ...T.title2, ...T.numeric, color: tint || C.text }}>
        {value || 0}{suffix || ''}
      </Text>
      <Text style={{ ...T.caption, color: C.dim, marginTop: 1 }}>{label}</Text>
    </View>
  );
}

function HealthCard({ health }) {
  if (!health.optedIn) {
    return (
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
          <SFIcon name="heart.fill" size={16} color={C.red} />
          <Text style={{ ...T.headline, color: C.text, marginLeft: 8 }}>Connect Apple Health</Text>
        </View>
        <Text style={{ ...T.footnote, color: C.mut, lineHeight: 19 }}>
          See your daily activity beside your training, and let LEVL save
          completed workouts to Health.
        </Text>
        <Text style={{ ...T.caption, color: C.faint, marginTop: 8, lineHeight: 16 }}>
          Health data is shown to you only. It never changes your XP, stats or
          rank, it is never uploaded, and it never appears on a Check In.
        </Text>
        <View style={{ flexDirection: 'row', marginTop: 14 }}>
          <Pressable
            onPress={health.connect}
            accessibilityRole="button"
            style={{
              flex: 1, minHeight: TOUCH, borderRadius: RADIUS.md, backgroundColor: C.gold,
              alignItems: 'center', justifyContent: 'center',
            }}>
            <Text style={{ ...T.footnote, fontWeight: '700', color: C.ink, letterSpacing: 0.4 }}>CONNECT</Text>
          </Pressable>
          <View style={{ width: 8 }} />
          <Pressable
            onPress={health.decline}
            accessibilityRole="button"
            style={{
              minHeight: TOUCH, paddingHorizontal: 20, borderRadius: RADIUS.md,
              borderWidth: 1, borderColor: C.line,
              alignItems: 'center', justifyContent: 'center',
            }}>
            <Text style={{ ...T.footnote, fontWeight: '600', color: C.mut }}>Not now</Text>
          </Pressable>
        </View>
      </Card>
    );
  }

  if (!health.rows.length) {
    return (
      <Card>
        <Lbl>Apple Health</Lbl>
        <Text style={{ ...T.footnote, color: C.dim, lineHeight: 18 }}>
          {health.loading
            ? 'Reading today’s activity…'
            : 'No data shared yet. You can choose what LEVL reads in Settings › Health › Data Access.'}
        </Text>
      </Card>
    );
  }

  return (
    <Card>
      <View style={[s.between, { marginBottom: 10 }]}>
        <Lbl style={{ marginBottom: 0 }}>Today</Lbl>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <SFIcon name="heart.fill" size={12} color={C.red} />
          <Text style={{ ...T.caption, color: C.dim, marginLeft: 5 }}>Apple Health</Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {health.rows.map((r) => (
          <View key={r.key} style={{ width: '50%', paddingVertical: 7 }}>
            <Text style={{ ...T.title3, ...T.numeric, color: C.text }}>{r.value}</Text>
            <Text style={{ ...T.caption, color: C.dim, marginTop: 1 }}>{r.label}</Text>
          </View>
        ))}
      </View>
      <Text style={{ ...T.caption, color: C.faint, marginTop: 8, lineHeight: 16 }}>
        Context only — Health data never affects XP, stats or rank.
      </Text>
    </Card>
  );
}
