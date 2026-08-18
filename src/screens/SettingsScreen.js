// ============================================================================
// LEVL — SettingsScreen
//
// Everything that used to be buried at the bottom of the "You" tab, plus the
// new Check In, notification, Health and privacy controls.
//
// "You" is no longer a bottom tab — five destinations was the point — so this
// opens as a sheet from the avatar in the header, which is where iOS users
// already look for it. It is organised in clear sections rather than one long
// scroll of switches, and nothing here is hidden behind jargon.
// ============================================================================

import React, { useCallback, useState } from 'react';
import {
  View, Text, Pressable, ScrollView, Switch, TextInput,
  Alert, Linking, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, s, T, RADIUS, SPACING, TOUCH } from '../theme';
import { Chip, GhostBtn, Sheet } from '../components/ui';
import { HunterAvatar } from '../components/HunterAvatar';
import SFIcon from '../components/SFIcon';
import BugReportModal from './BugReportModal';
import AppGuide from '../components/AppGuide';
import {
  PhysicalProfileForm, AccountTransfer, bmiOf,
  SEX_OPTS, EXPERIENCE_OPTS, ACTIVITY_OPTS,
} from './AuthScreens';
import { WINDOW_PRESETS, windowLabel, formatMinute } from '../hooks/useCheckInPreferences';
import { setUsername as claimUsername, listBlocked, unblockUser } from '../services/supabase/checkInService';
import { deleteAccount } from '../services/supabase/authService';
import notifications from '../services/notifications';
import haptics from '../services/haptics';

export default function SettingsScreen({
  data,
  dv,
  userEmail,
  profile,
  prefs,
  prefsLoading,
  updatePrefs,
  enableReminders,
  notifPermission,
  health,
  rename,
  setUnit,
  saveProfile,
  makeCode,
  importCode,
  resetAll,
  loadDemo,
  signOut,
  onClose,
}) {
  const insets = useSafeAreaInsets();
  const [bugOpen, setBugOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [profileEdit, setProfileEdit] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  // Account deletion asks you to TYPE the word, not tap twice. Two-tap is the
  // right weight for "reset my local save"; it is far too light for an action
  // that erases a server account and every photo attached to it.
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteWord, setDeleteWord] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteErr, setDeleteErr] = useState('');
  const [nameDraft, setNameDraft] = useState(data.name);
  const [handleDraft, setHandleDraft] = useState((profile && profile.username) || '');
  const [handleBusy, setHandleBusy] = useState(false);
  const [blocked, setBlocked] = useState(null);
  const empty = data.lifts.length + data.cardio.length === 0;

  const set = useCallback((patch) => {
    haptics.selection();
    updatePrefs(patch);
  }, [updatePrefs]);

  const saveHandle = useCallback(async () => {
    const wanted = handleDraft.trim();
    if (!wanted || wanted === (profile && profile.username)) return;
    setHandleBusy(true);
    const res = await claimUsername(wanted);
    setHandleBusy(false);
    if (res.error) {
      haptics.error();
      Alert.alert('Could not save that username', res.error.message || 'Try another one.');
      return;
    }
    haptics.success();
    Alert.alert('Username updated', `You are now @${res.data}.`);
  }, [handleDraft, profile]);

  const loadBlocked = useCallback(async () => {
    const res = await listBlocked();
    setBlocked(res.data || []);
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>

      {/* ---- header ------------------------------------------------------- */}
      <View style={{
        flexDirection: 'row', alignItems: 'center',
        paddingTop: insets.top + 6, paddingHorizontal: SPACING.lg, paddingBottom: 12,
        borderBottomWidth: 1, borderBottomColor: C.lineSoft,
      }}>
        <Text style={{ ...T.title2, color: C.text, flex: 1 }}>Profile</Text>
        <Pressable
          onPress={onClose}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Close settings"
          style={{ minHeight: 36, justifyContent: 'center', paddingLeft: 12 }}>
          <Text style={{ ...T.subheadline, color: C.gold }}>Done</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: SPACING.lg, paddingBottom: insets.bottom + 60 }}
        keyboardShouldPersistTaps="handled">

        {/* ---- identity --------------------------------------------------- */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.xxl }}>
          <HunterAvatar
            avatar={data.avatar}
            character={{ deco: data.equippedDecoration }}
            size={58}
          />
          <View style={{ flex: 1, marginLeft: 14 }}>
            <TextInput
              value={nameDraft}
              onChangeText={setNameDraft}
              onEndEditing={() => rename(nameDraft.trim() || 'Player')}
              maxLength={18}
              accessibilityLabel="Display name"
              style={{ ...T.title3, color: C.text, paddingVertical: 2 }}
            />
            <Text style={{ ...T.caption, color: C.dim, marginTop: 1 }}>
              LV {dv.level} · {dv.placed ? dv.tier.name + dv.division : 'Unranked'}
            </Text>
          </View>
        </View>

        {/* ---- public identity -------------------------------------------- */}
        {userEmail ? (
          <Section label="PUBLIC IDENTITY">
            <Text style={{ ...T.footnote, color: C.mut, lineHeight: 18, marginBottom: 10 }}>
              Your username is how friends find you. Your email address is never
              shown to anyone.
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{
                flexDirection: 'row', alignItems: 'center', flex: 1,
                backgroundColor: C.sunken, borderWidth: 1, borderColor: C.lineSoft,
                borderRadius: RADIUS.md, paddingHorizontal: 12, minHeight: TOUCH,
              }}>
                <Text style={{ ...T.subheadline, color: C.dim }}>@</Text>
                <TextInput
                  value={handleDraft}
                  onChangeText={(t) => setHandleDraft(t.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20))}
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholder="username"
                  placeholderTextColor={C.faint}
                  accessibilityLabel="Username"
                  style={{ flex: 1, ...T.subheadline, color: C.text, paddingVertical: 10 }}
                />
              </View>
              <Pressable
                onPress={saveHandle}
                disabled={handleBusy || !handleDraft.trim()}
                accessibilityRole="button"
                accessibilityLabel="Save username"
                style={{
                  marginLeft: 8, minHeight: TOUCH, paddingHorizontal: 16,
                  borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center',
                  backgroundColor: handleDraft.trim() ? C.gold : C.panel2,
                }}>
                {handleBusy
                  ? <ActivityIndicator size="small" color={C.ink} />
                  : <Text style={{ ...T.footnote, fontWeight: '700', color: handleDraft.trim() ? C.ink : C.dim }}>Save</Text>}
              </Pressable>
            </View>
          </Section>
        ) : null}

        {/* ---- Check In ---------------------------------------------------- */}
        <Section label="CHECK IN">
          {prefsLoading || !prefs ? (
            <ActivityIndicator color={C.dim} style={{ paddingVertical: 20 }} />
          ) : (
            <>
              <Row
                title="Daily reminder"
                subtitle={
                  notifPermission === 'granted'
                    ? 'A prompt at an unpredictable time inside your window'
                    : 'Notifications are off for LEVL'
                }
                right={
                  <Switch
                    value={!!prefs.enabled && !!prefs.notify_check_in && notifPermission === 'granted'}
                    onValueChange={async (on) => {
                      if (on && notifPermission !== 'granted') {
                        const res = await enableReminders();
                        if (res.status !== 'granted') {
                          Alert.alert(
                            'Notifications are off',
                            'Turn them on in Settings › LEVL › Notifications to get your daily Check In prompt.',
                            [
                              { text: 'Not now', style: 'cancel' },
                              { text: 'Open Settings', onPress: () => Linking.openSettings() },
                            ],
                          );
                        }
                        return;
                      }
                      set({ enabled: on, notify_check_in: on });
                    }}
                    trackColor={{ true: C.gold, false: C.line }}
                    thumbColor="#fff"
                  />
                }
              />

              <Text style={{ ...T.label, color: C.dim, marginTop: 16, marginBottom: 8 }}>
                TRAINING WINDOW · {windowLabel(prefs)}
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                {WINDOW_PRESETS.map((p) => {
                  const on = prefs.window_start_minute === p.start && prefs.window_end_minute === p.end;
                  return (
                    <Pressable
                      key={p.key}
                      onPress={() => set({ window_start_minute: p.start, window_end_minute: p.end })}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: on }}
                      accessibilityLabel={`${p.label}, ${p.sub}`}
                      style={{
                        width: '48%', marginRight: '2%', marginBottom: 8,
                        minHeight: 54, borderRadius: RADIUS.md, paddingHorizontal: 12,
                        justifyContent: 'center',
                        backgroundColor: on ? C.goldSoft : C.panel2,
                        borderWidth: 1, borderColor: on ? C.gold : C.lineSoft,
                      }}>
                      <Text style={{ ...T.subheadline, fontWeight: '600', color: on ? C.gold : C.mut }}>
                        {p.label}
                      </Text>
                      <Text style={{ ...T.caption, ...T.numeric, color: on ? C.gold + 'cc' : C.dim, marginTop: 1 }}>
                        {p.sub}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <CustomWindow prefs={prefs} onChange={set} />

              <Text style={{ ...T.label, color: C.dim, marginTop: 16, marginBottom: 8 }}>
                DEFAULT AUDIENCE
              </Text>
              <View style={s.row}>
                <Chip active={prefs.default_visibility === 'friends'} onPress={() => set({ default_visibility: 'friends' })}>
                  Friends
                </Chip>
                <Chip active={prefs.default_visibility === 'public'} onPress={() => set({ default_visibility: 'public' })}>
                  Public
                </Chip>
              </View>
              <Text style={{ ...T.caption, color: C.faint, marginTop: 4, lineHeight: 16 }}>
                You still choose per Check In before posting. Changing this never
                makes an existing post public.
              </Text>

              <Row
                title="Public discovery"
                subtitle="Let people who aren't your friends see Check Ins you mark Public"
                right={
                  <Switch
                    value={prefs.public_discovery !== false}
                    onValueChange={(on) => set({ public_discovery: on })}
                    trackColor={{ true: C.gold, false: C.line }}
                    thumbColor="#fff"
                  />
                }
              />
            </>
          )}
        </Section>

        {/* ---- notifications ------------------------------------------------ */}
        {prefs ? (
          <Section label="NOTIFICATIONS">
            <Row
              title="Social activity"
              subtitle="Reactions and comments on your Check Ins"
              right={<Switch value={prefs.notify_social !== false} onValueChange={(v) => set({ notify_social: v })}
                trackColor={{ true: C.gold, false: C.line }} thumbColor="#fff" />}
            />
            <Row
              title="Duels"
              subtitle="Challenges, results and rank changes"
              right={<Switch value={prefs.notify_duels !== false} onValueChange={(v) => set({ notify_duels: v })}
                trackColor={{ true: C.gold, false: C.line }} thumbColor="#fff" />}
            />
            <Row
              title="Rewards"
              subtitle="Packs and pass tiers you can claim"
              right={<Switch value={prefs.notify_rewards !== false} onValueChange={(v) => set({ notify_rewards: v })}
                trackColor={{ true: C.gold, false: C.line }} thumbColor="#fff" />}
            />
            <Row
              title="Training reminders"
              subtitle="Rest timer alerts while you train"
              right={<Switch value={prefs.notify_training === true} onValueChange={(v) => set({ notify_training: v })}
                trackColor={{ true: C.gold, false: C.line }} thumbColor="#fff" />}
            />
            {__DEV__ ? (
              <GhostBtn
                onPress={() => notifications.debugFireCheckInPrompt(3)}
                style={{ marginTop: 12 }}>
                Dev · fire a Check In prompt in 3s
              </GhostBtn>
            ) : null}
          </Section>
        ) : null}

        {/* ---- health -------------------------------------------------------- */}
        {health && health.available ? (
          <Section label="APPLE HEALTH">
            <Row
              title="Apple Health"
              subtitle={
                !health.optedIn ? 'Not connected'
                  : health.connected ? 'Connected'
                  : 'Connected, but no data is shared yet'
              }
              right={
                !health.optedIn ? (
                  <Pressable
                    onPress={health.connect}
                    accessibilityRole="button"
                    style={{
                      minHeight: 34, paddingHorizontal: 14, borderRadius: RADIUS.pill,
                      backgroundColor: C.goldSoft, borderWidth: 1, borderColor: C.gold,
                      alignItems: 'center', justifyContent: 'center',
                    }}>
                    <Text style={{ ...T.footnote, fontWeight: '600', color: C.gold }}>Connect</Text>
                  </Pressable>
                ) : (
                  <Switch value onValueChange={() => health.decline()}
                    trackColor={{ true: C.green, false: C.line }} thumbColor="#fff" />
                )
              }
            />
            <Text style={{ ...T.caption, color: C.faint, marginTop: 8, lineHeight: 16 }}>
              LEVL reads your daily activity to show beside your training, and can
              save completed workouts to Health. Health data never affects XP,
              stats, rank or duels, is never uploaded, and never appears on a
              Check In. Choose exactly what LEVL can read in Settings › Health ›
              Data Access &amp; Devices.
            </Text>
          </Section>
        ) : null}

        {/* ---- privacy -------------------------------------------------------- */}
        {userEmail ? (
          <Section label="PRIVACY">
            <Pressable
              onPress={() => { if (blocked === null) loadBlocked(); else setBlocked(null); }}
              accessibilityRole="button"
              accessibilityState={{ expanded: blocked !== null }}
              style={{ flexDirection: 'row', alignItems: 'center', minHeight: TOUCH }}>
              <View style={{ flex: 1 }}>
                <Text style={{ ...T.subheadline, color: C.text }}>Blocked people</Text>
                <Text style={{ ...T.caption, color: C.dim, marginTop: 1 }}>
                  Neither of you can see or interact with the other
                </Text>
              </View>
              <SFIcon name={blocked === null ? 'chevron.right' : 'chevron.left'} size={14} color={C.dim} />
            </Pressable>

            {blocked !== null ? (
              blocked.length === 0 ? (
                <Text style={{ ...T.footnote, color: C.faint, paddingVertical: 10 }}>
                  You haven&apos;t blocked anyone.
                </Text>
              ) : (
                blocked.map((p) => (
                  <View key={p.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8 }}>
                    <HunterAvatar avatar={p.avatar} size={30} dim />
                    <Text style={{ ...T.subheadline, color: C.mut, flex: 1, marginLeft: 10 }}>
                      {p.display_name || p.username}
                    </Text>
                    <Pressable
                      onPress={async () => { await unblockUser(p.id); loadBlocked(); }}
                      accessibilityRole="button"
                      accessibilityLabel={`Unblock ${p.display_name || p.username}`}
                      style={{ minHeight: 34, paddingHorizontal: 12, justifyContent: 'center' }}>
                      <Text style={{ ...T.footnote, color: C.gold }}>Unblock</Text>
                    </Pressable>
                  </View>
                ))
              )
            ) : null}
          </Section>
        ) : null}

        {/* ---- physical profile ------------------------------------------------ */}
        <Section label="PHYSICAL PROFILE">
          {profileEdit ? (
            <PhysicalProfileForm
              data={data}
              embedded
              onSave={(p) => { saveProfile(p); setProfileEdit(false); }}
              onCancel={() => setProfileEdit(false)}
            />
          ) : (
            <View>
              <View style={s.row}>
                {[
                  ['Weight', data.bodyweight ? `${data.bodyweight} ${data.unit}` : '—'],
                  ['Height', data.heightCm ? `${data.heightCm} cm` : '—'],
                  ['Age', data.age ? `${data.age} yrs` : '—'],
                ].map((c) => (
                  <View key={c[0]} style={{
                    flex: 1, backgroundColor: C.panel2, borderWidth: 1, borderColor: C.line,
                    borderRadius: RADIUS.sm, paddingVertical: 8, alignItems: 'center', marginRight: 6,
                  }}>
                    <Text style={{ ...T.label, color: C.dim, marginBottom: 3 }}>{c[0]}</Text>
                    <Text style={{ ...T.subheadline, ...T.numeric, fontWeight: '600', color: C.text }}>{c[1]}</Text>
                  </View>
                ))}
              </View>
              <View style={[s.between, { marginTop: 10 }]}>
                <Text style={{ ...T.caption, color: C.mut }}>
                  {data.sex ? (SEX_OPTS.find((x) => x[0] === data.sex) || ['', data.sex])[1] : 'Sex —'}
                  {data.experience ? ` · ${(EXPERIENCE_OPTS.find((e) => e[0] === data.experience) || ['', data.experience])[1]}` : ''}
                </Text>
                {bmiOf(data) != null ? (
                  <Text style={{ ...T.caption, ...T.numeric, color: C.gold }}>BMI {bmiOf(data)}</Text>
                ) : null}
              </View>
              {data.activity ? (
                <Text style={{ ...T.caption, color: C.dim, marginTop: 4 }}>
                  {(ACTIVITY_OPTS.find((a) => a[0] === data.activity) || ['', data.activity])[1]}
                </Text>
              ) : null}
              <GhostBtn onPress={() => setProfileEdit(true)} style={{ marginTop: 12 }}>Edit</GhostBtn>
            </View>
          )}
        </Section>

        {/* ---- units & account -------------------------------------------------- */}
        <Section label="UNITS">
          <View style={s.row}>
            <Chip active={data.unit === 'kg'} onPress={() => setUnit('kg')}>kg</Chip>
            <Chip active={data.unit === 'lb'} onPress={() => setUnit('lb')}>lb</Chip>
          </View>
        </Section>

        <Section label="ACCOUNT">
          <Row title="Signed in as" subtitle={userEmail || 'Guest · this device only'} />
          {makeCode && importCode ? <AccountTransfer makeCode={makeCode} importCode={importCode} /> : null}
          <GhostBtn onPress={signOut} style={{ marginTop: 10 }}>
            {userEmail ? 'Sign out' : 'Sign in / create account'}
          </GhostBtn>
        </Section>

        <Section label="HELP & DATA">
          <GhostBtn onPress={() => setGuideOpen(true)}>Replay app guide</GhostBtn>
          <GhostBtn onPress={() => setBugOpen(true)} style={{ marginTop: 10 }}>Report a bug</GhostBtn>
          {empty ? (
            <Pressable onPress={loadDemo} style={[s.ghostBtn, { marginTop: 10, borderColor: C.gold }]}>
              <Text style={{ ...T.subheadline, fontWeight: '600', color: C.gold }}>Load 4-week demo save</Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={() => {
              if (confirmReset) { resetAll(); setConfirmReset(false); onClose(); }
              else { haptics.warning(); setConfirmReset(true); }
            }}
            accessibilityRole="button"
            style={[
              s.ghostBtn,
              { marginTop: 10 },
              confirmReset && { backgroundColor: 'rgba(240,82,95,0.15)', borderColor: C.red },
            ]}>
            <Text style={{ ...T.subheadline, fontWeight: '600', color: C.red }}>
              {confirmReset ? 'Tap again to erase everything' : 'Reset all data'}
            </Text>
          </Pressable>

          {/* Apple requires an in-app route to delete the ACCOUNT, not just the
              local save, for any app that lets you create one. Shown only when
              there is a server account to delete — a guest has nothing on a
              server, and "Reset all data" above already erases their device. */}
          {userEmail ? (
            <Pressable
              onPress={() => { haptics.warning(); setDeleteWord(''); setDeleteErr(''); setDeleteOpen(true); }}
              accessibilityRole="button"
              accessibilityLabel="Delete your account and all of your data"
              style={[s.ghostBtn, { marginTop: 10, borderColor: C.red }]}>
              <Text style={{ ...T.subheadline, fontWeight: '700', color: C.red }}>
                Delete account
              </Text>
            </Pressable>
          ) : null}
        </Section>
      </ScrollView>

      <BugReportModal visible={bugOpen} onClose={() => setBugOpen(false)} />
      <AppGuide visible={guideOpen} onClose={() => setGuideOpen(false)} />

      {/* ---- delete account ------------------------------------------------
          Spells out exactly what goes, requires the word DELETE typed in full,
          and states plainly that it cannot be undone. */}
      {deleteOpen ? (
        <Sheet visible title="Delete account" onClose={() => { if (!deleting) setDeleteOpen(false); }}>
          <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 20 }}>
            <Text style={{ ...T.subheadline, color: C.text, fontWeight: '700' }}>
              This permanently deletes your account.
            </Text>
            <Text style={{ ...T.footnote, color: C.mut, marginTop: 8, lineHeight: 19 }}>
              Your training history, Check In photos, friends, duels, rank and
              saved workouts are all removed from our servers. This cannot be
              undone, and your username becomes available to somebody else.
            </Text>
            <Text style={{ ...T.footnote, color: C.mut, marginTop: 8, lineHeight: 19 }}>
              If you only want to start over, use “Reset all data” instead — that
              clears this device and keeps your account.
            </Text>

            <Text style={{ ...T.caption, color: C.dim, marginTop: 16, marginBottom: 6 }}>
              Type DELETE to confirm
            </Text>
            <TextInput
              value={deleteWord}
              onChangeText={(t) => { setDeleteWord(t); setDeleteErr(''); }}
              autoCapitalize="characters"
              autoCorrect={false}
              editable={!deleting}
              placeholder="DELETE"
              placeholderTextColor={C.faint}
              accessibilityLabel="Type the word DELETE to confirm"
              style={[s.input, { borderColor: deleteWord.trim().toUpperCase() === 'DELETE' ? C.red : C.lineSoft }]}
            />

            {deleteErr ? (
              <Text style={{ ...T.footnote, color: C.red, marginTop: 10 }}>{deleteErr}</Text>
            ) : null}

            <Pressable
              disabled={deleting || deleteWord.trim().toUpperCase() !== 'DELETE'}
              onPress={async () => {
                setDeleting(true); setDeleteErr('');
                const res = await deleteAccount();
                setDeleting(false);
                if (res && res.error) {
                  setDeleteErr((res.error.message || 'Could not delete the account.')
                    + ' Nothing was deleted — please try again.');
                  return;
                }
                haptics.success();
                setDeleteOpen(false);
                // Drops back to a clean signed-out app with no local remnants.
                resetAll();
                signOut();
                onClose();
              }}
              accessibilityRole="button"
              accessibilityState={{ disabled: deleting || deleteWord.trim().toUpperCase() !== 'DELETE' }}
              accessibilityLabel="Permanently delete my account"
              style={{
                minHeight: 48, marginTop: 16, borderRadius: RADIUS.md,
                alignItems: 'center', justifyContent: 'center',
                backgroundColor: deleteWord.trim().toUpperCase() === 'DELETE' ? C.red : C.panel2,
                opacity: deleting ? 0.6 : 1,
              }}>
              <Text style={{
                ...T.subheadline, fontWeight: '700',
                color: deleteWord.trim().toUpperCase() === 'DELETE' ? '#fff' : C.faint,
              }}>
                {deleting ? 'Deleting…' : 'Delete my account permanently'}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => { if (!deleting) setDeleteOpen(false); }}
              accessibilityRole="button"
              accessibilityLabel="Keep my account"
              style={[s.ghostBtn, { marginTop: 10 }]}>
              <Text style={s.ghostTxt}>Keep my account</Text>
            </Pressable>
          </View>
        </Sheet>
      ) : null}
    </View>
  );
}

/* ------------------------------------------------------------------------- */

function Section({ label, children }) {
  return (
    <View style={{ marginBottom: SPACING.xxl }}>
      <Text style={{ ...T.label, color: C.dim, marginBottom: 10 }}>{label}</Text>
      <View style={{
        backgroundColor: C.panel, borderRadius: RADIUS.lg,
        borderWidth: 1, borderColor: C.lineSoft, padding: SPACING.lg,
      }}>
        {children}
      </View>
    </View>
  );
}

function Row({ title, subtitle, right }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: TOUCH, paddingVertical: 6 }}>
      <View style={{ flex: 1, paddingRight: 12 }}>
        <Text style={{ ...T.subheadline, color: C.text }}>{title}</Text>
        {subtitle ? (
          <Text style={{ ...T.caption, color: C.dim, marginTop: 2, lineHeight: 16 }}>{subtitle}</Text>
        ) : null}
      </View>
      {right}
    </View>
  );
}

// A custom range, in whole hours. Deliberately coarse: the prompt lands at a
// random minute inside the window anyway, so minute-level precision here would
// be false precision.
function CustomWindow({ prefs, onChange }) {
  const [open, setOpen] = useState(false);
  const startHour = Math.floor(prefs.window_start_minute / 60);
  const endHour = Math.floor(prefs.window_end_minute / 60);

  const shift = (which, delta) => {
    if (which === 'start') {
      const next = Math.max(0, Math.min(22, startHour + delta));
      onChange({
        window_start_minute: next * 60,
        window_end_minute: Math.max((next + 1) * 60, prefs.window_end_minute),
      });
    } else {
      const next = Math.max(1, Math.min(23, endHour + delta));
      onChange({
        window_end_minute: next * 60,
        window_start_minute: Math.min((next - 1) * 60, prefs.window_start_minute),
      });
    }
  };

  if (!open) {
    return (
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        style={{ minHeight: 38, justifyContent: 'center' }}>
        <Text style={{ ...T.footnote, color: C.dim }}>+ Custom time range</Text>
      </Pressable>
    );
  }

  return (
    <View style={{ marginTop: 6 }}>
      {[['start', 'From', startHour], ['end', 'To', endHour]].map(([which, label, hour]) => (
        <View key={which} style={{ flexDirection: 'row', alignItems: 'center', minHeight: TOUCH }}>
          <Text style={{ ...T.subheadline, color: C.mut, width: 52 }}>{label}</Text>
          <Pressable
            onPress={() => shift(which, -1)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`${label} one hour earlier`}
            style={stepper}>
            <Text style={{ ...T.headline, color: C.mut }}>−</Text>
          </Pressable>
          <Text style={{
            ...T.subheadline, ...T.numeric, color: C.text,
            minWidth: 84, textAlign: 'center',
          }}>
            {formatMinute(hour * 60)}
          </Text>
          <Pressable
            onPress={() => shift(which, 1)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`${label} one hour later`}
            style={stepper}>
            <Text style={{ ...T.headline, color: C.mut }}>+</Text>
          </Pressable>
        </View>
      ))}
    </View>
  );
}

const stepper = {
  width: 38, height: 38, borderRadius: 10,
  backgroundColor: C.panel2, borderWidth: 1, borderColor: C.lineSoft,
  alignItems: 'center', justifyContent: 'center',
};
