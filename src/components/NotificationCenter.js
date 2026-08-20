// LEVL — a calm, readable in-app inbox.
// Vector glyphs keep the visual language consistent across iOS and Android;
// no platform emoji or novelty symbols are used for core actions.

import React from 'react';
import { View, Pressable, ScrollView } from 'react-native';
import { Text } from './Text';
import Svg, { Path, Circle, Line, Polyline } from 'react-native-svg';
import { C, MONO, RADIUS, T } from '../theme';
import { Sheet } from './ui';

const META = {
  friend_request: {
    title: 'New friend request', action: 'Open requests', color: C.cyan, glyph: 'friend',
  },
  duel_challenge: {
    title: 'Duel challenge', action: 'View challenge', color: C.orange, glyph: 'duel',
  },
  reward: {
    title: 'Reward ready', action: 'Open Forge', color: C.gold, glyph: 'reward',
  },
  duel_result: {
    title: 'Duel complete', action: 'View result', color: C.green, glyph: 'duel',
  },
};

const metaFor = (kind, payload) => {
  if (kind === 'duel_challenge' && payload && payload.started) {
    return { title: 'Duel started', action: 'Open duel', color: C.green, glyph: 'duel' };
  }
  if (kind === 'duel_result' && payload && payload.result) {
    if (payload.result === 'win') return { title: 'Duel won', action: 'View result', color: C.green, glyph: 'duel' };
    if (payload.result === 'loss') return { title: 'Duel lost', action: 'View result', color: C.red, glyph: 'duel' };
    return { title: 'Duel drawn', action: 'View result', color: C.gold, glyph: 'duel' };
  }
  return META[kind] || {
    title: 'LEVL update', action: 'Open', color: C.purp, glyph: 'bell',
  };
};

function relativeTime(value) {
  const t = new Date(value || 0).getTime();
  if (!Number.isFinite(t) || !t) return '';
  const seconds = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (seconds < 60) return 'Now';
  if (seconds < 3600) return Math.floor(seconds / 60) + 'm';
  if (seconds < 86400) return Math.floor(seconds / 3600) + 'h';
  if (seconds < 604800) return Math.floor(seconds / 86400) + 'd';
  return new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function NoticeGlyph({ kind = 'bell', color = C.gold, size = 22 }) {
  const common = { stroke: color, strokeWidth: 1.8, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {kind === 'friend' ? (
        <>
          <Circle cx="9" cy="8" r="3" {...common} />
          <Path d="M3.8 18c.7-3.1 2.4-4.7 5.2-4.7s4.5 1.6 5.2 4.7" {...common} />
          <Line x1="18" y1="7" x2="18" y2="13" {...common} />
          <Line x1="15" y1="10" x2="21" y2="10" {...common} />
        </>
      ) : kind === 'duel' ? (
        <>
          <Path d="M5 4l6.2 6.2-2 2L3 6z" {...common} />
          <Path d="M19 4l-6.2 6.2 2 2L21 6z" {...common} />
          <Path d="M8.7 11.7l-3.2 3.2M15.3 11.7l3.2 3.2" {...common} />
          <Polyline points="4,15.5 6.5,18 9,15.5" {...common} />
          <Polyline points="15,15.5 17.5,18 20,15.5" {...common} />
        </>
      ) : kind === 'reward' ? (
        <>
          <Path d="M12 3l7 5-2.7 8.2L12 21l-4.3-4.8L5 8z" {...common} />
          <Path d="M5 8h14M8.5 8L12 21 15.5 8M9 3l3 5 3-5" {...common} />
        </>
      ) : (
        <>
          <Path d="M6.5 16.5h11l-1.3-2.1V10a4.2 4.2 0 00-8.4 0v4.4z" {...common} />
          <Path d="M10 18.5c.4 1 1.1 1.5 2 1.5s1.6-.5 2-1.5" {...common} />
          <Line x1="12" y1="3" x2="12" y2="2" {...common} />
        </>
      )}
    </Svg>
  );
}

function NoticeRow({ item, onOpen }) {
  const meta = metaFor(item.kind, item.payload);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={meta.title}
      onPress={() => onOpen(item)}
      style={{
        flexDirection: 'row', alignItems: 'center', minHeight: 76,
        marginBottom: 8, padding: 12, borderRadius: RADIUS.md,
        backgroundColor: item.read ? C.panel : C.panel2,
        borderWidth: 1, borderColor: item.read ? C.lineSoft : meta.color + '66',
      }}>
      <View style={{
        width: 44, height: 44, borderRadius: 14, marginRight: 12,
        backgroundColor: meta.color + '16', borderWidth: 1, borderColor: meta.color + '44',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <NoticeGlyph kind={meta.glyph} color={meta.color} size={23} />
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ ...T.footnote, color: item.read ? C.mut : C.text, fontWeight: '700', flex: 1 }}>
            {meta.title}
          </Text>
          <Text style={{ ...T.micro, color: C.dim, fontVariant: ['tabular-nums'], marginLeft: 8 }}>
            {relativeTime(item.created_at)}
          </Text>
        </View>
        <Text style={{ ...T.caption, color: meta.color, fontWeight: '700', marginTop: 4 }}>
          {meta.action}  ›
        </Text>
      </View>
      {!item.read ? (
        <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: meta.color, marginLeft: 8 }} />
      ) : null}
    </Pressable>
  );
}

export default function NotificationCenter({ visible, center, onClose, onOpen }) {
  const items = (center && center.items) || [];
  const unread = (center && center.unread) || 0;
  const fresh = items.filter((item) => !item.read);
  const earlier = items.filter((item) => item.read);
  const openItem = (item) => {
    if (center && center.markOneRead) center.markOneRead(item.id);
    if (onOpen) onOpen(item);
  };

  const section = (label, rows) => rows.length ? (
    <View style={{ marginTop: 14 }}>
      <Text style={{ ...T.label, color: C.dim, marginBottom: 8 }}>{label}</Text>
      {rows.map((item) => <NoticeRow key={item.id} item={item} onOpen={openItem} />)}
    </View>
  ) : null;

  return (
    <Sheet visible={visible} title="Activity" onClose={onClose}>
      <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View>
            <Text style={{ ...T.title2, color: C.text }}>Stay in the loop.</Text>
            <Text style={{ ...T.caption, color: center && center.live ? C.green : C.mut, marginTop: 3, fontWeight: '700' }}>
              {center && center.live ? 'Live updates on' : 'Syncing updates'}
            </Text>
          </View>
          {unread > 0 ? (
            <Pressable onPress={center.markAllRead} hitSlop={8} style={{
              minHeight: 38, paddingHorizontal: 12, borderRadius: RADIUS.pill,
              backgroundColor: C.goldSoft, borderWidth: 1, borderColor: C.gold,
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Text style={{ ...T.caption, color: C.gold, fontWeight: '700' }}>Mark all read</Text>
            </Pressable>
          ) : null}
        </View>

        {items.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: 42 }}>
            <View style={{
              width: 62, height: 62, borderRadius: 22, backgroundColor: C.panel2,
              borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center',
            }}>
              <NoticeGlyph color={C.mut} size={30} />
            </View>
            <Text style={{ ...T.callout, fontWeight: '600', color: C.text, marginTop: 14 }}>All clear.</Text>
            <Text style={{ ...T.footnote, color: C.mut, marginTop: 5, textAlign: 'center' }}>
              Requests, duels and rewards appear here.
            </Text>
          </View>
        ) : (
          <ScrollView style={{ maxHeight: 350 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
            {section('NEW', fresh)}
            {section(fresh.length ? 'EARLIER' : 'ACTIVITY', earlier)}
          </ScrollView>
        )}
      </View>
    </Sheet>
  );
}
