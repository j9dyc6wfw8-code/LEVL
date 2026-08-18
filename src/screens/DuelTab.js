// LEVL React Native — Duel (1v1 weekly) screen
import React, { useState } from 'react';
import { View, Text, Pressable, TextInput } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { C, s, MONO, TYPE, RADIUS } from '../theme';
import { Card, Lbl, PBar, GoldBtn, Unavailable } from '../components/ui';
import { MiniHunter } from '../components/Hunter';
import { LoadoutCompare } from '../components/LoadoutCard';
import { shareText } from '../services/platform';
import FriendDuelDetail from './FriendDuelDetail';
import {
  DUEL_TIERS, duelTierByKey, estimateDailyOutput, recommendedDuelTier,
  duelPreviewSeed, makeDuelBotPersona, duelDayRows, duelBotFullTotal,
  fmtShort, fmtCountdown, DAY, DEFAULT_DATA, DUEL_DURATIONS } from '../engine/engine';

function ShareInvite({ data, dv, onCreateInvite, onJoinByCode }) {
  const [invite, setInvite] = useState(null);   // { code, url }
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joining, setJoining] = useState(false);

  const rankStr = dv.placed ? dv.tier.name + dv.division : 'Unranked';

  const shareInvite = async () => {
    setBusy(true);
    let inv = invite;
    if (!inv && onCreateInvite) inv = await onCreateInvite();
    setBusy(false);
    if (!inv) return;
    setInvite(inv);
    const msg = '⚔️ Duel me on LEVL! I\'m ' + data.name + ' (' + rankStr + '). '
      + '7 days — most training XP wins.\n\nTap to join: ' + inv.url
      + '\n\nNo link? Open LEVL → Duel → Friends → Join by code: ' + inv.code;
    await shareText(msg);
  };

  const copyCode = async () => {
    if (!invite) return;
    try { await Clipboard.setStringAsync(invite.code); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch (e) {}
  };

  const join = async () => {
    const c = joinCode.trim().toUpperCase();
    if (!c || !onJoinByCode) return;
    setJoining(true);
    const joined = await onJoinByCode(c);
    setJoining(false);
    if (joined) setJoinCode('');
  };

  return (
    <Card>
      <Lbl>Invite a Friend</Lbl>
      <Text style={{ fontSize: 15, color: C.text, fontWeight: '700', marginBottom: 12 }}>
        Send the link. No link? Share the code.
      </Text>
      <GoldBtn onPress={shareInvite} disabled={busy}>{busy ? 'Creating…' : invite ? 'Share again' : 'Share duel link'}</GoldBtn>
      {invite && (
        <Pressable onPress={copyCode} style={{ marginTop: 10, padding: 12, borderRadius: RADIUS.md, backgroundColor: C.panel2, borderWidth: 1, borderColor: C.line, alignItems: 'center' }}>
          <Text style={{ fontSize: 11, color: C.dim }}>{copied ? 'Copied!' : 'Invite code (tap to copy)'}</Text>
          <Text style={{ fontSize: 22, fontWeight: '800', color: C.gold, fontVariant: ['tabular-nums'], letterSpacing: 3, marginTop: 2 }}>{invite.code}</Text>
        </Pressable>
      )}

      <View style={{ height: 1, backgroundColor: C.line, marginVertical: 14 }} />

      <Lbl>Join by code</Lbl>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <TextInput
          value={joinCode} onChangeText={setJoinCode} placeholder="Enter code" placeholderTextColor={C.dim}
          autoCapitalize="characters" autoCorrect={false} maxLength={12}
          style={{ flex: 1, backgroundColor: C.panel2, borderWidth: 1, borderColor: C.line, borderRadius: RADIUS.md, color: C.text, paddingHorizontal: 12, paddingVertical: 10, fontVariant: ['tabular-nums'], letterSpacing: 2, marginRight: 8 }}
        />
        <Pressable onPress={join} disabled={joining || !joinCode.trim()}
          style={{ paddingHorizontal: 16, paddingVertical: 11, borderRadius: RADIUS.md, backgroundColor: joinCode.trim() ? C.gold : C.panel2, borderWidth: 1, borderColor: joinCode.trim() ? C.gold : C.line }}>
          <Text style={{ fontWeight: '700', fontSize: 13, color: joinCode.trim() ? C.ink : C.dim }}>{joining ? '…' : 'Join'}</Text>
        </Pressable>
      </View>
    </Card>
  );
}

function DuelHistory({ past }) {
  return (
    <Card>
      <Lbl>Duel History</Lbl>
      {past.map((x) => {
        const t = duelTierByKey(x.tierKey);
        return (
          <View key={x.id} style={[s.row, { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.line }]}>
            <View style={{ width: 8, height: 8, borderRadius: 4, marginRight: 10, backgroundColor: x.result === 'win' ? C.green : x.result === 'draw' ? C.gold : C.red }} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: C.text }}>vs {x.bot.name} <Text style={{ color: t.color, fontSize: 10 }}>({t.name})</Text></Text>
              <Text style={{ fontSize: 10, color: C.dim, fontVariant: ['tabular-nums'] }}>{fmtShort(x.startT)} – {fmtShort(x.endT - 1)}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ fontSize: 12, fontWeight: '800', fontVariant: ['tabular-nums'], color: x.result === 'win' ? C.green : x.result === 'draw' ? C.gold : C.red }}>{x.finalYou}–{x.finalBot}</Text>
              {x.earned && (x.earned.coins > 0 || x.earned.xp > 0) ? <Text style={{ fontSize: 10, color: C.gold, fontVariant: ['tabular-nums'] }}>+{x.earned.coins}c · {x.earned.xp} XP</Text> : null}
            </View>
          </View>
        );
      })}
    </Card>
  );
}

// Friends is a peer destination in CompeteTab now, not a segment inside this
// screen. That removes the second stacked segmented control — this screen used
// to render a gold pill row identical to the one directly above it — and it
// also retires a duplicate doorway, since Friends already had its own modal
// route (levl://friends). The focusFriendsSignal effect moved up with it.
export default function DuelTab({ data, dv, startDuel, claimDuel, forfeitDuel, friendDuels, onCreateInvite, onJoinByCode, enabled = true }) {
  if (!enabled) {
    return <Unavailable title="Duels are paused" body="New duels are switched off for a moment. Any duel already running is unaffected and still scoring." />;
  }

  const now = Date.now();
  const [confirmFF, setConfirmFF] = useState(false);
  const duels = data.duels || [];
  const active = duels.find((x) => x.status === 'active');
  const past = duels.filter((x) => x.status === 'finished').sort((a, b) => b.endT - a.endT).slice(0, 6);
  const est = estimateDailyOutput(data, now);
  const recKey = recommendedDuelTier(est);

  return (
    <View style={{ flex: 1 }}>
      <DuelBotView
        data={data} dv={dv} now={now} confirmFF={confirmFF} setConfirmFF={setConfirmFF}
        duels={duels} active={active} past={past} est={est} recKey={recKey}
        startDuel={startDuel} claimDuel={claimDuel} forfeitDuel={forfeitDuel}
        friendDuels={friendDuels} onCreateInvite={onCreateInvite} onJoinByCode={onJoinByCode}
      />
    </View>
  );
}

// The bot-duel screen body. Kept as its own component (rather than folded back
// into DuelTab) because the active-friend-duel takeover below reads far more
// clearly as one self-contained view.
function DuelBotView({ data, dv, now, confirmFF, setConfirmFF, duels, active, past, est, recKey, startDuel, claimDuel, forfeitDuel, friendDuels, onCreateInvite, onJoinByCode }) {
  const [duelDays, setDuelDays] = useState(7);
  const durMult = (DUEL_DURATIONS.find((d) => d.days === duelDays) || DUEL_DURATIONS[2]).mult;
  // An active friend duel takes priority over the bot duel — it occupies the
  // main slot so the player experiences one duel at a time. Bot duels are the
  // fallback when no friend duel is running.
  const friendActive = friendDuels && friendDuels.active && friendDuels.active[0];
  if (friendActive) {
    return (
      <FriendDuelDetail
        data={data} dv={dv} duel={friendActive}
        onQuit={friendDuels.quit ? (id) => friendDuels.quit(id) : null}
      />
    );
  }

  if (!active) {
    return (
      <View>
        <Card style={s.hero}>
          <Lbl>Weekly Duel · 1v1</Lbl>
          <Text style={{ fontSize: 16, color: C.text, fontWeight: '800' }}>
            7 days. Most XP wins.
          </Text>
          <View style={[s.between, { marginTop: 10 }]}>
            <Text style={{ fontSize: 12, color: C.dim }}>Your recent output</Text>
            <Text style={{ fontSize: 12, color: C.gold, fontWeight: '700', fontVariant: ['tabular-nums'] }}>~{est} XP / active day</Text>
          </View>
        </Card>

        <Card>
          <Lbl>Duel length</Lbl>
          <View style={[s.row, { marginBottom: 6 }]}>
            {DUEL_DURATIONS.map((d, i) => {
              const on = duelDays === d.days;
              return (
                <Pressable key={d.days} onPress={() => setDuelDays(d.days)}
                  accessibilityRole="button" accessibilityLabel={d.label}
                  style={{
                    flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center',
                    marginRight: i < DUEL_DURATIONS.length - 1 ? 6 : 0,
                    backgroundColor: on ? C.goldSoft : C.panel2,
                    borderWidth: 1, borderColor: on ? C.gold : C.line,
                  }}>
                  <Text style={{ fontSize: 14, fontWeight: '900', color: on ? C.gold : C.text, fontVariant: ['tabular-nums'] }}>{d.label}</Text>
                  <Text style={{ fontSize: 10, color: on ? C.gold : C.dim, marginTop: 2 }}>{d.sub}</Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={{ fontSize: 11.5, color: C.dim, marginBottom: 4, lineHeight: 16 }}>
            Longer duels pay more per day — a full week is the best value.
          </Text>
        </Card>

        <Card>
          <Lbl>Today's Challengers · matched to your strength</Lbl>
          {DUEL_TIERS.map((t, ti) => {
            const seed = duelPreviewSeed(ti, now);
            const persona = makeDuelBotPersona(seed);
            const rec = t.key === recKey;
            return (
              <View key={t.key} style={[s.row, {
                paddingVertical: 11, paddingHorizontal: 10, borderRadius: 12, marginBottom: 8,
                borderWidth: 1, borderColor: rec ? C.gold : C.line,
                borderLeftWidth: 4, borderLeftColor: t.color,
                backgroundColor: rec ? C.goldSoft : C.panel2,
              }]}>
                <MiniHunter avatar={persona.avatar} tierColor={t.color} size={40} />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <View style={s.row}>
                    <Text style={{ fontSize: 15, fontWeight: '800', color: C.text }}>{persona.name}</Text>
                    {rec ? <Text style={{ fontSize: 9, color: C.ink, backgroundColor: C.gold, fontWeight: '800', marginLeft: 6, paddingVertical: 2, paddingHorizontal: 6, borderRadius: 4, overflow: 'hidden' }}>PICK</Text> : null}
                  </View>
                  <Text style={{ fontSize: 11, color: t.color, fontWeight: '800', marginTop: 1 }}>{t.name.toUpperCase()} · ~{t.daily[0]}–{t.daily[1]} XP/day</Text>
                  <Text style={{ fontSize: 11, color: C.mut, fontVariant: ['tabular-nums'], marginTop: 1 }}>
                    Win <Text style={{ color: C.gold, fontWeight: '700' }}>{Math.round(t.reward.coins * durMult)}c</Text> + <Text style={{ color: C.green, fontWeight: '700' }}>{Math.round(t.reward.xp * durMult)} XP</Text> · {duelDays}d
                  </Text>
                </View>
                <Pressable onPress={() => startDuel(t.key, seed, duelDays)} style={{ backgroundColor: C.gold, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 16 }}>
                  <Text style={{ color: C.ink, fontWeight: '800', fontSize: 13 }}>Duel</Text>
                </Pressable>
              </View>
            );
          })}
          <Text style={{ fontSize: 13, color: C.mut, fontWeight: '700' }}>
            New matchups every day.
          </Text>
        </Card>

        {past.length > 0 && <DuelHistory past={past} />}
        <ShareInvite data={data} dv={dv} onCreateInvite={onCreateInvite} onJoinByCode={onJoinByCode} />
      </View>
    );
  }

  const tier = duelTierByKey(active.tierKey);
  const rows = duelDayRows(data, active, now);
  const youTotal = rows.reduce((sum, r) => sum + r.you, 0);
  const ended = now >= active.endT;
  const botFinal = duelBotFullTotal(active);
  const botDisplay = ended ? botFinal : rows.reduce((sum, r) => sum + (r.bot || 0), 0);
  const dayIdx = Math.max(0, Math.min(6, Math.floor((now - active.startT) / DAY)));
  const lead = youTotal - botDisplay;
  const maxBar = Math.max(...rows.map((r) => Math.max(r.you, r.bot || 0)), tier.daily[1], 1);
  const result = ended ? (youTotal > botFinal ? 'win' : youTotal < botFinal ? 'loss' : 'draw') : null;
  const mult = result === 'win' ? 1 : result === 'draw' ? 0.4 : 0.15;

  return (
    <View>
      <Card style={[s.hero, { borderWidth: 1, borderColor: tier.color }]}>
        <View style={[s.row, { alignItems: 'flex-start' }]}>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <MiniHunter avatar={data.avatar || DEFAULT_DATA.avatar} tierColor={dv.placed ? dv.tier.color : C.dim} size={46} />
            <Text style={{ fontSize: 12, fontWeight: '700', color: C.gold, marginTop: 4 }} numberOfLines={1}>{data.name}</Text>
            <Text style={{ fontSize: 22, fontWeight: '800', color: C.text, fontVariant: ['tabular-nums'] }}>{youTotal}</Text>
          </View>
          <Text style={{ fontSize: 16, fontWeight: '800', color: tier.color, marginTop: 18 }}>VS</Text>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <MiniHunter avatar={active.bot.avatar} tierColor={tier.color} size={46} />
            <Text style={{ fontSize: 12, fontWeight: '700', color: tier.color, marginTop: 4 }} numberOfLines={1}>{active.bot.name}</Text>
            <Text style={{ fontSize: 22, fontWeight: '800', color: C.text, fontVariant: ['tabular-nums'] }}>{botDisplay}</Text>
          </View>
        </View>
        <Text style={{ textAlign: 'center', marginTop: 8, fontSize: 12, color: C.dim, fontVariant: ['tabular-nums'] }}>
          Day {dayIdx + 1} of 7 · {fmtShort(active.startT)} – {fmtShort(active.endT - 1)} · {ended ? 'ended' : 'ends in ' + fmtCountdown(active.endT - now)}
        </Text>
        {!ended && (
          <Text style={{ textAlign: 'center', marginTop: 6, fontSize: 12, fontWeight: '700', color: lead > 0 ? C.green : lead < 0 ? C.red : C.mut }}>
            {lead > 0 ? 'You lead by ' + lead + ' XP' : lead < 0 ? 'Behind by ' + (-lead) + ' XP — log a session!' : 'Dead even'}
          </Text>
        )}
      </Card>

      {ended && (
        <Card style={{ borderWidth: 1, borderColor: result === 'win' ? C.green : result === 'draw' ? C.gold : C.red }}>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: 20, fontWeight: '800', color: result === 'win' ? C.green : result === 'draw' ? C.gold : C.red }}>
              {result === 'win' ? 'Victory' : result === 'draw' ? 'Draw' : 'Defeat'}
            </Text>
            <Text style={{ fontSize: 12, color: C.mut, marginTop: 4, fontVariant: ['tabular-nums'] }}>{youTotal} – {botFinal}</Text>
            <GoldBtn onPress={() => claimDuel(active.id)} style={{ marginTop: 12, alignSelf: 'stretch' }}>
              Claim {Math.round(active.reward.coins * mult)} coins + {Math.round(active.reward.xp * mult)} XP
            </GoldBtn>
          </View>
        </Card>
      )}

      {/* Both builds, side by side. Cosmetics are visible to your opponent —
          that's the whole point of owning them. Purely visual: nothing here
          affects XP, rank or the duel result. */}
      <Card>
        <Lbl>Builds · what you're up against</Lbl>
        <View style={{ marginTop: 10 }}>
          <LoadoutCompare
            you={{
              avatar: data.avatar || DEFAULT_DATA.avatar,
              equipped: data.equipped || DEFAULT_DATA.equipped,
              name: data.name,
              color: dv.placed ? dv.tier.color : C.gold,
            }}
            them={{
              avatar: active.bot.avatar,
              equipped: active.bot.equipped,
              name: active.bot.name,
              color: tier.color,
            }}
          />
        </View>
      </Card>

      <Card>
        <Lbl>Daily Breakdown · you vs {active.bot.name}</Lbl>
        {rows.map((r) => (
          <View key={r.i} style={{ paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: C.line, opacity: r.state === 'future' ? 0.45 : 1 }}>
            <View style={[s.between, { marginBottom: 4 }]}>
              <Text style={{ fontSize: 12, color: r.state === 'today' ? C.gold : C.mut, fontWeight: r.state === 'today' ? '900' : '700' }}>
                {r.label}{r.state === 'today' ? ' · TODAY' : ''}
              </Text>
              <Text style={{ fontVariant: ['tabular-nums'], fontSize: 12 }}>
                <Text style={{ color: C.gold, fontWeight: '700' }}>{r.state === 'future' ? '—' : r.you}</Text>
                <Text style={{ color: C.dim }}> vs </Text>
                <Text style={{ color: tier.color, fontWeight: '700' }}>{r.bot == null ? '—' : r.bot}</Text>
                {r.state === 'past' && r.you !== r.bot ? <Text style={{ color: r.you > r.bot ? C.green : C.red, fontWeight: '800' }}> {r.you > r.bot ? '●' : '○'}</Text> : null}
              </Text>
            </View>
            <View style={s.row}>
              <View style={{ flex: 1, marginRight: 4 }}><PBar pct={r.state === 'future' ? 0 : (r.you / maxBar) * 100} color={C.gold} height={5} /></View>
              <View style={{ flex: 1 }}><PBar pct={((r.bot || 0) / maxBar) * 100} color={tier.color} height={5} /></View>
            </View>
          </View>
        ))}
        <Text style={{ fontSize: 14, color: C.mut, marginTop: 10, fontWeight: '700' }}>
          Only XP earned during this duel counts.
        </Text>
      </Card>

      {!ended && (
        <Pressable onPress={() => { if (confirmFF) { forfeitDuel(active.id); setConfirmFF(false); } else setConfirmFF(true); }}
          style={[s.ghostBtn, { marginBottom: 12 }, confirmFF && { backgroundColor: 'rgba(240,82,95,0.15)', borderColor: C.red }]}>
          <Text style={{ color: C.red, fontWeight: '700', fontSize: 12 }}>
            {confirmFF
              ? (youTotal === 0 ? 'Tap again to skip this duel' : 'Tap again to forfeit (counts as a loss)')
              : (youTotal === 0 ? 'Skip this duel' : 'Forfeit duel')}
          </Text>
        </Pressable>
      )}

      {past.length > 0 && <DuelHistory past={past} />}
      <Card>
        <Text style={{ ...TYPE.body, color: C.mut, fontWeight: '700', textAlign: 'center' }}>
          Finish this duel before starting another.
        </Text>
      </Card>
    </View>
  );
}
