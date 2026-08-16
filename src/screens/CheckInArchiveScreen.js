// ============================================================================
// LEVL — CheckInArchiveScreen
//
// Every Check In you have posted, as a calendar.
//
// A grid of months reads consistency at a glance in a way a reverse-chronological
// list never does — the shape of the month IS the story. Filled days are your
// Check Ins, ringed days are Verified Sessions, and tapping one opens it.
//
// Deliberately not anxiety-inducing: there is no red for a missed day, no
// "streak in danger" nagging, no guilt. Days you didn't post are simply empty.
// ============================================================================

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { C, RADIUS, SPACING, T, TOUCH } from '../theme';
import SFIcon from '../components/SFIcon';
import * as checkIns from '../services/supabase/checkInService';
import haptics from '../services/haptics';

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

const monthKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
const monthLabel = (d) => d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

export default function CheckInArchiveScreen({ userId, isMe, onClose, onOpenCheckIn }) {
  const insets = useSafeAreaInsets();
  const [month, setMonth] = useState(() => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [days, setDays] = useState([]);
  const [photos, setPhotos] = useState({});
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [monthRes, statsRes] = await Promise.all([
      checkIns.getMonth(userId || null, monthKey(month)),
      checkIns.getStats(userId || null),
    ]);
    const rows = monthRes.data || [];
    setDays(rows);
    setStats(statsRes.data || null);
    setLoading(false);

    // Only the lead photo of each day needs signing for the grid.
    const paths = rows.map((r) => (r.primaryPhoto === 'front' ? r.frontPath : r.rearPath));
    const { data } = await checkIns.signPhotoUrls(paths);
    if (data) setPhotos((cur) => ({ ...cur, ...data }));
  }, [userId, month]);

  useEffect(() => { load(); }, [load]);

  const byDate = useMemo(() => {
    const map = {};
    days.forEach((d) => { map[d.localDate] = d; });
    return map;
  }, [days]);

  // Monday-first grid, with leading blanks so the columns line up.
  const cells = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const lead = (first.getDay() + 6) % 7;
    const out = [];
    for (let i = 0; i < lead; i++) out.push(null);
    for (let day = 1; day <= daysInMonth; day++) {
      const key = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      out.push({ day, key, entry: byDate[key] || null });
    }
    return out;
  }, [month, byDate]);

  const shift = useCallback((delta) => {
    haptics.selection();
    setMonth((m) => new Date(m.getFullYear(), m.getMonth() + delta, 1));
  }, []);

  // Never let someone page into the future.
  const atCurrentMonth = useMemo(() => {
    const now = new Date();
    return month.getFullYear() === now.getFullYear() && month.getMonth() === now.getMonth();
  }, [month]);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{
        flexDirection: 'row', alignItems: 'center',
        paddingTop: insets.top + 6, paddingHorizontal: SPACING.lg, paddingBottom: 12,
        borderBottomWidth: 1, borderBottomColor: C.lineSoft,
      }}>
        <Pressable
          onPress={onClose}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={{ minHeight: 36, justifyContent: 'center', paddingRight: 12 }}>
          <SFIcon name="chevron.left" size={17} color={C.gold} />
        </Pressable>
        <Text style={{ ...T.title3, color: C.text, flex: 1 }}>
          {isMe ? 'Your Check Ins' : 'Check Ins'}
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: SPACING.lg, paddingBottom: insets.bottom + 40 }}>

        {stats ? (
          <View style={{ flexDirection: 'row', marginBottom: SPACING.xxl }}>
            <Stat value={stats.checkIns} label="Check Ins" />
            <Stat value={stats.verified} label="Verified" tint={C.green} />
            <Stat value={stats.streak} label="Day streak" tint={C.gold} />
            <Stat value={stats.bestStreak} label="Best" />
          </View>
        ) : null}

        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
          <Pressable
            onPress={() => shift(-1)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Previous month"
            style={arrow}>
            <SFIcon name="chevron.left" size={14} color={C.mut} />
          </Pressable>
          <Text style={{ ...T.headline, color: C.text, flex: 1, textAlign: 'center' }}>
            {monthLabel(month)}
          </Text>
          <Pressable
            onPress={() => shift(1)}
            hitSlop={10}
            disabled={atCurrentMonth}
            accessibilityRole="button"
            accessibilityLabel="Next month"
            style={[arrow, { opacity: atCurrentMonth ? 0.3 : 1 }]}>
            <SFIcon name="chevron.right" size={14} color={C.mut} />
          </Pressable>
        </View>

        <View style={{ flexDirection: 'row', marginBottom: 8 }}>
          {WEEKDAYS.map((w, i) => (
            <Text
              key={i}
              accessibilityElementsHidden
              style={{ ...T.caption2, color: C.faint, flex: 1, textAlign: 'center', fontWeight: '600' }}>
              {w}
            </Text>
          ))}
        </View>

        {loading ? (
          <ActivityIndicator color={C.dim} style={{ paddingVertical: 40 }} />
        ) : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {cells.map((cell, i) => {
              if (!cell) return <View key={`blank-${i}`} style={{ width: '14.28%', aspectRatio: 1, padding: 3 }} />;
              const entry = cell.entry;
              const url = entry ? photos[entry.primaryPhoto === 'front' ? entry.frontPath : entry.rearPath] : null;
              return (
                <Pressable
                  key={cell.key}
                  disabled={!entry}
                  onPress={() => { haptics.tap(); onOpenCheckIn(entry.id); }}
                  accessibilityRole={entry ? 'button' : 'text'}
                  accessibilityLabel={
                    entry
                      ? `${cell.day}, ${entry.verified ? 'Verified Session' : 'Check In'}. Open it.`
                      : `${cell.day}, no Check In`
                  }
                  style={{ width: '14.28%', aspectRatio: 1, padding: 3 }}>
                  <View style={{
                    flex: 1, borderRadius: RADIUS.sm, overflow: 'hidden',
                    backgroundColor: entry ? C.panel2 : C.sunken,
                    borderWidth: entry && entry.verified ? 1.5 : 1,
                    borderColor: entry
                      ? (entry.verified ? C.green : C.line)
                      : 'transparent',
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    {url ? (
                      <Image
                        source={{ uri: url }}
                        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
                        contentFit="cover"
                        cachePolicy="memory-disk"
                        transition={140}
                      />
                    ) : null}
                    <Text style={{
                      ...T.caption2, ...T.numeric, fontWeight: '600',
                      color: url ? 'rgba(255,255,255,0.92)' : entry ? C.mut : C.faint,
                      textShadowColor: url ? 'rgba(0,0,0,0.7)' : 'transparent',
                      textShadowRadius: 3,
                    }}>
                      {cell.day}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}

        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: SPACING.xl }}>
          <Legend color={C.line} label="Check In" />
          <Legend color={C.green} label="Verified Session" />
        </View>
      </ScrollView>
    </View>
  );
}

const arrow = {
  width: 34, height: 34, borderRadius: 17,
  backgroundColor: C.panel2, borderWidth: 1, borderColor: C.line,
  alignItems: 'center', justifyContent: 'center',
};

function Stat({ value, label, tint }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ ...T.title2, ...T.numeric, color: tint || C.text }}>{value || 0}</Text>
      <Text style={{ ...T.caption, color: C.dim, marginTop: 1 }}>{label}</Text>
    </View>
  );
}

function Legend({ color, label }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 18 }}>
      <View style={{
        width: 14, height: 14, borderRadius: 4,
        borderWidth: 1.5, borderColor: color, backgroundColor: C.panel2, marginRight: 6,
      }} />
      <Text style={{ ...T.caption, color: C.dim }}>{label}</Text>
    </View>
  );
}
