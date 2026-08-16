// LEVL React Native — auth, physical-profile onboarding, account transfer
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, KeyboardAvoidingView, Platform, Animated, Easing, Dimensions } from 'react-native';
import { C, s, MONO, RADIUS, TYPE, TOUCH } from '../theme';
import { Card, Lbl, Chip, GoldBtn, GhostBtn, ChunkyBtn } from '../components/ui';
import { copyText, pasteText } from '../services/platform';
import { isConfigured } from '../services/supabase/client';
import { signInEmail, signUpEmail, resetPassword, verifyResetCode, setNewPassword } from '../services/supabase/authService';
import { isAppleAuthAvailable, signInWithApple } from '../services/appleAuth';

// Friendlier text for the handful of Supabase auth errors a user actually hits.
function readableAuthError(msg) {
  const m = (msg || '').toLowerCase();
  if (m.includes('invalid login')) return 'Incorrect email or password.';
  if (m.includes('already registered') || m.includes('already exists')) return 'An account with this email already exists — sign in instead.';
  if (m.includes('email not confirmed')) return 'Check your email to confirm your account, then sign in.';
  if (m.includes('password') && m.includes('6')) return 'Password must be at least 6 characters.';
  if (m.includes('rate limit')) return 'Too many attempts. Wait an hour, then try again.';
  if (m.includes('audience') || m.includes('id_token')) return 'Apple sign-in isn\'t finished setting up yet. Use email for now.';
  return msg || 'Something went wrong — try again.';
}

export const ACTIVITY_OPTS = [
  ['sedentary', 'Sedentary'], ['light', 'Lightly active'], ['moderate', 'Moderately active'],
  ['very', 'Very active'], ['athlete', 'Athlete'],
];
export const EXPERIENCE_OPTS = [['beginner', 'Beginner'], ['intermediate', 'Intermediate'], ['advanced', 'Advanced']];
export const SEX_OPTS = [['male', 'Male'], ['female', 'Female'], ['other', 'Prefer not to say']];

export function bmiOf(data) {
  const kg = data.unit === 'lb' ? (data.bodyweight || 0) / 2.2046226 : (data.bodyweight || 0);
  const m = (data.heightCm || 0) / 100;
  if (kg <= 0 || m <= 0) return null;
  return +(kg / (m * m)).toFixed(1);
}

// ---------------------------------------------------------------------------
// Sign-in visuals. The brief was "detailed yet minimalistic", which resolves as
// few elements, each layered: depth comes from light and motion rather than
// from adding more objects. Three pieces only — a backdrop, a mark, a field.
// ---------------------------------------------------------------------------

const { width: SCR_W } = Dimensions.get('window');

// Ambient depth: a broad gold bloom behind the mark and a handful of embers
// drifting up through it. Slow and low-opacity so it reads as atmosphere.
function AuthBackdrop() {
  const embers = useRef(
    [...Array(7)].map(() => ({
      v: new Animated.Value(0),
      x: 20 + Math.random() * (SCR_W - 40),
      delay: Math.random() * 3200,
      dur: 5200 + Math.random() * 3200,
      size: 1.5 + Math.random() * 2.2,
    }))
  ).current;
  const bloom = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const b = Animated.loop(Animated.sequence([
      Animated.timing(bloom, { toValue: 1, duration: 3600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(bloom, { toValue: 0, duration: 3600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]));
    const es = embers.map((e) => Animated.loop(
      Animated.timing(e.v, { toValue: 1, duration: e.dur, delay: e.delay, easing: Easing.linear, useNativeDriver: true })
    ));
    b.start(); es.forEach((a) => a.start());
    return () => { b.stop(); es.forEach((a) => a.stop()); };
  }, [bloom, embers]);

  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
      <Animated.View style={{
        position: 'absolute', top: -140, alignSelf: 'center',
        width: SCR_W * 1.5, height: SCR_W * 1.5, borderRadius: SCR_W,
        backgroundColor: C.gold,
        opacity: bloom.interpolate({ inputRange: [0, 1], outputRange: [0.045, 0.085] }),
      }} />
      {embers.map((e, i) => (
        <Animated.View key={i} style={{
          position: 'absolute', bottom: 0, left: e.x,
          width: e.size, height: e.size, borderRadius: e.size / 2, backgroundColor: C.gold,
          opacity: e.v.interpolate({ inputRange: [0, 0.12, 0.7, 1], outputRange: [0, 0.42, 0.2, 0] }),
          transform: [{ translateY: e.v.interpolate({ inputRange: [0, 1], outputRange: [0, -560] }) }],
        }} />
      ))}
    </View>
  );
}

// The mark: a slow outer ring, a static diamond, and the ascent glyph, each on
// its own layer so it has depth rather than being one flat icon.
function BrandMark() {
  const spin = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;
  const rise = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const a = Animated.timing(rise, { toValue: 1, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: true });
    const b = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 16000, easing: Easing.linear, useNativeDriver: true }));
    const c = Animated.loop(Animated.sequence([
      Animated.timing(glow, { toValue: 1, duration: 2100, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(glow, { toValue: 0, duration: 2100, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]));
    a.start(); b.start(); c.start();
    return () => { a.stop(); b.stop(); c.stop(); };
  }, [spin, glow, rise]);

  const rot = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const scale = rise.interpolate({ inputRange: [0, 1], outputRange: [0.86, 1] });

  return (
    <Animated.View style={{ width: 132, height: 132, alignItems: 'center', justifyContent: 'center', opacity: rise, transform: [{ scale }] }}>
      <Animated.View style={{
        position: 'absolute', width: 104, height: 104, borderRadius: 52, backgroundColor: C.gold,
        opacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0.10, 0.20] }),
        transform: [{ scale: glow.interpolate({ inputRange: [0, 1], outputRange: [1, 1.16] }) }],
      }} />
      <Animated.View style={{
        position: 'absolute', width: 124, height: 124, borderRadius: 62,
        borderWidth: 1, borderColor: 'transparent',
        borderTopColor: C.gold, borderRightColor: 'rgba(255,201,51,0.22)',
        transform: [{ rotate: rot }],
      }} />
      <View style={{ position: 'absolute', width: 96, height: 96, borderRadius: 48, borderWidth: 1, borderColor: 'rgba(255,201,51,0.13)' }} />
      <View style={{ position: 'absolute', width: 66, height: 66, borderWidth: 1, borderColor: 'rgba(255,201,51,0.42)', transform: [{ rotate: '45deg' }] }} />
      <Text style={{ fontSize: 34, color: C.gold, fontWeight: '900', marginTop: -2 }}>▲</Text>
    </Animated.View>
  );
}

// A field, not a box. Filled input boxes read as utility; a hairline that
// lights gold on focus is quieter and looks considered.
function AuthField({ label, ...props }) {
  const [focus, setFocus] = useState(false);
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(a, { toValue: focus ? 1 : 0, duration: 220, easing: Easing.out(Easing.quad), useNativeDriver: false }).start();
  }, [focus, a]);
  return (
    <View style={{ marginBottom: 20 }}>
      <Text style={{
        fontSize: 9.5, letterSpacing: 1.6, fontWeight: '800',
        color: focus ? C.gold : C.dim, marginBottom: 7, textTransform: 'uppercase',
      }}>{label}</Text>
      <TextInput
        placeholderTextColor={C.faint}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        style={{ color: C.text, fontSize: 16.5, paddingVertical: 8, paddingHorizontal: 0 }}
        {...props}
      />
      <View style={{ height: 1, backgroundColor: C.line }}>
        <Animated.View style={{
          height: 1.5, marginTop: -0.25, backgroundColor: C.gold,
          width: a.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
        }} />
      </View>
    </View>
  );
}

/* ------------------------------ auth screen ------------------------------ */
export function AuthScreen({ onAuthed, loadAuth, saveAuth, sha256Hex, makeSalt }) {
  const [mode, setMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [name, setName] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [resetCode, setResetCode] = useState('');
  const [resetPw, setResetPw] = useState('');
  const [showCodeEntry, setShowCodeEntry] = useState(false);
  const [notice, setNotice] = useState('');
  const [appleAvailable, setAppleAvailable] = useState(false);

  useEffect(() => { isAppleAuthAvailable().then(setAppleAvailable); }, []);

  const doApple = async () => {
    setErr(''); setNotice(''); setBusy(true);
    const { data, error } = await signInWithApple();
    setBusy(false);
    if (error) {
      if (error.canceled) return;            // user backed out — no message
      setErr(readableAuthError(error.message));
      return;
    }
    if (data && data.session) {
      const em = (data.session.user && data.session.user.email) || 'apple-user';
      onAuthed(em, (data.session.user && data.session.user.user_metadata && data.session.user.user_metadata.full_name) || 'Hunter', false);
    }
  };

  const submit = async () => {
    setErr(''); setNotice('');
    const em = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) { setErr('Enter a valid email address.'); return; }
    if (pw.length < 6) { setErr('Password must be at least 6 characters.'); return; }
    setBusy(true);

    // Cloud path: real Supabase auth, when configured. This runs ALONGSIDE the
    // existing local account system below rather than replacing it — local
    // save-keying (by email) and merge logic are untouched either way, so the
    // app behaves identically offline or if Supabase isn't set up yet.
    if (isConfigured) {
      try {
        if (mode === 'signup') {
          if (pw !== pw2) { setErr('Passwords do not match.'); setBusy(false); return; }
          const { data, error } = await signUpEmail(em, pw);
          if (error) { setErr(readableAuthError(error.message)); setBusy(false); return; }

          // Supabase returns a session ONLY if email confirmation is off. If
          // confirmation is required, data.session is null and the user must
          // click the email link first. Detect that and tell them clearly —
          // do NOT silently drop them into a local account (that was the bug
          // where a second signup logged you into the first account).
          const hasSession = !!(data && data.session);
          if (!hasSession) {
            setBusy(false);
            setErr('');
            setResetSent(false);
            setNotice('Account created. Check your email to confirm, then sign in.');
            setMode('signin');
            return;
          }

          // Real session: mirror to local and enter the app.
          const auth = await loadAuth();
          const salt = makeSalt();
          const hash = await sha256Hex(salt + ':' + pw);
          auth.users[em] = { email: em, salt, hash, name: name.trim() || 'Hunter', createdAt: Date.now(), cloud: true };
          auth.lastUser = em;
          await saveAuth(auth);
          onAuthed(em, auth.users[em].name, true);
          return;
        } else {
          const { data, error } = await signInEmail(em, pw);
          if (error) { setErr(readableAuthError(error.message)); setBusy(false); return; }
          // Only treat as signed-in if a real session came back.
          if (!(data && data.session)) {
            setBusy(false);
            setErr('Confirm your email first — check your inbox for the link.');
            return;
          }
          const auth = await loadAuth();
          const existingName = (auth.users[em] && auth.users[em].name) || name.trim() || 'Hunter';
          auth.lastUser = em;
          await saveAuth(auth);
          onAuthed(em, existingName, !auth.users[em]);
          return;
        }
      } catch (e) {
        // Network hiccup or Supabase unreachable — fall through to the local
        // system below rather than stranding the user. They keep playing;
        // sync catches up next time the network is back.
      }
    }

    // Local-only path: unchanged from before. This is also what runs when
    // Supabase isn't configured, or the cloud call above couldn't complete.
    try {
      const auth = await loadAuth();
      if (mode === 'signup') {
        if (auth.users[em]) { setErr('An account with this email already exists on this device — sign in instead.'); setBusy(false); return; }
        if (pw !== pw2) { setErr('Passwords do not match.'); setBusy(false); return; }
        const salt = makeSalt();
        const hash = await sha256Hex(salt + ':' + pw);
        auth.users[em] = { email: em, salt, hash, name: name.trim() || 'Hunter', createdAt: Date.now() };
        auth.lastUser = em;
        await saveAuth(auth);
        onAuthed(em, auth.users[em].name, true);
      } else {
        const u = auth.users[em];
        if (!u) { setErr('No account found for this email — create one.'); setBusy(false); return; }
        const hash = await sha256Hex(u.salt + ':' + pw);
        if (hash !== u.hash) { setErr('Incorrect password.'); setBusy(false); return; }
        auth.lastUser = em;
        await saveAuth(auth);
        onAuthed(em, u.name, false);
      }
    } catch (e) { setErr('Something went wrong — try again.'); setBusy(false); }
  };

  const forgotPassword = async () => {
    const em = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) { setErr('Enter your email above first, then tap "Forgot password".'); return; }
    setErr('');
    setBusy(true);
    const { error } = await resetPassword(em);
    setBusy(false);
    setErr(error ? readableAuthError(error.message) : '');
    if (!error) { setResetSent(true); setNotice('Check your email and tap the reset link — it opens LEVL so you can set a new password.'); }
  };

  // Step 2+3 of reset: verify the emailed code, then set the new password.
  const completeReset = async () => {
    const em = email.trim().toLowerCase();
    if (!resetCode.trim()) { setErr('Enter the 6-digit code from your email.'); return; }
    if (!resetPw || resetPw.length < 6) { setErr('New password must be at least 6 characters.'); return; }
    setErr(''); setNotice(''); setBusy(true);
    const v = await verifyResetCode(em, resetCode);
    if (v.error) { setBusy(false); setErr(readableAuthError(v.error.message) || 'That code is invalid or expired.'); return; }
    const u = await setNewPassword(resetPw);
    setBusy(false);
    if (u.error) { setErr(readableAuthError(u.error.message)); return; }
    setResetSent(false); setResetCode(''); setResetPw('');
    onAuthed(em, (email.split('@')[0] || 'Hunter'), false);
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: C.bg }}>
      <AuthBackdrop />
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: 28, paddingVertical: 40 }}
        keyboardShouldPersistTaps="handled">
        <View style={{ alignItems: 'center', marginBottom: 34 }}>
          <BrandMark />
          {/* the wordmark carries the weight — wide tracking, nothing competing */}
          <Text style={{
            fontSize: 40, color: C.text, fontWeight: '900', letterSpacing: 14,
            textTransform: 'uppercase', marginTop: 18, marginRight: -14,
          }}>LEVL</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 16 }}>
            <View style={{ width: 46, height: 1, backgroundColor: 'rgba(255,201,51,0.28)' }} />
            <Text style={{ color: C.gold, fontSize: 6.5, marginHorizontal: 10 }}>◆</Text>
            <View style={{ width: 46, height: 1, backgroundColor: 'rgba(255,201,51,0.28)' }} />
          </View>
          <Text style={{
            fontSize: 11, color: C.dim, marginTop: 16, textAlign: 'center',
            fontWeight: '700', letterSpacing: 2.6, textTransform: 'uppercase',
          }}>
            {mode === 'signup' ? 'Begin the climb' : 'Welcome back'}
          </Text>
        </View>

        {/* no panel — the form sits on the backdrop, which is the whole point */}
        <View>
          <View style={{
            flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 12,
            padding: 4, marginBottom: 26, borderWidth: 1, borderColor: C.line,
          }}>
            {[['signin', 'Sign in'], ['signup', 'Create account']].map((m) => (
              <Pressable key={m[0]} onPress={() => { setMode(m[0]); setErr(''); setNotice(''); }}
                accessibilityRole="tab" accessibilityState={{ selected: mode === m[0] }} accessibilityLabel={m[1]}
                style={{
                  flex: 1, minHeight: 42, borderRadius: 9, alignItems: 'center', justifyContent: 'center',
                  backgroundColor: mode === m[0] ? C.gold : 'transparent',
                }}>
                <Text style={{ fontSize: 13.5, fontWeight: '800', color: mode === m[0] ? C.ink : C.mut }}>{m[1]}</Text>
              </Pressable>
            ))}
          </View>
          {mode === 'signup' && (
            <AuthField label="Hunter name" value={name} onChangeText={setName} placeholder="Optional" />
          )}
          <AuthField label="Email" value={email} onChangeText={setEmail}
            placeholder="you@example.com" autoCapitalize="none" autoCorrect={false} keyboardType="email-address" />
          <AuthField label="Password" value={pw} onChangeText={setPw}
            placeholder="At least 6 characters" secureTextEntry />
          {mode === 'signup' && (
            <AuthField label="Confirm password" value={pw2} onChangeText={setPw2} placeholder="Repeat it" secureTextEntry />
          )}
          {err ? <Text style={{ fontSize: 12.5, color: C.red, marginBottom: 14, fontWeight: '600' }}>{err}</Text> : null}
          {notice ? <Text style={{ fontSize: 12.5, color: C.green, marginBottom: 14, fontWeight: '600' }}>{notice}</Text> : null}
          {resetSent ? (
            <View style={{ marginBottom: 4 }}>
              <Pressable onPress={forgotPassword} disabled={busy} hitSlop={8} style={{ alignItems: 'center', marginTop: 2 }}>
                <Text style={{ fontSize: 12, color: C.gold, fontWeight: '700' }}>{busy ? 'Sending…' : 'Resend email'}</Text>
              </Pressable>
              {/* Fallback: only useful if the reset email is customised to
                  include a 6-digit code (needs custom SMTP). Hidden by default
                  so it can't confuse anyone using the standard link email. */}
              <Pressable onPress={() => setShowCodeEntry((v) => !v)} hitSlop={8} style={{ alignItems: 'center', marginTop: 12 }}>
                <Text style={{ fontSize: 11.5, color: C.mut }}>{showCodeEntry ? 'Hide code entry' : 'Email contains a 6-digit code instead?'}</Text>
              </Pressable>
              {showCodeEntry && (
                <View style={{ marginTop: 10 }}>
                  <AuthField label="Reset code" value={resetCode} onChangeText={setResetCode}
                    placeholder="6 digits" keyboardType="number-pad" maxLength={6} />
                  <AuthField label="New password" value={resetPw} onChangeText={setResetPw}
                    placeholder="At least 6 characters" secureTextEntry />
                  <GoldBtn onPress={completeReset} disabled={busy}>{busy ? 'Working…' : 'Set new password'}</GoldBtn>
                </View>
              )}
              <Pressable onPress={() => { setResetSent(false); setNotice(''); setShowCodeEntry(false); }} hitSlop={8} style={{ alignItems: 'center', marginTop: 14 }}>
                <Text style={{ fontSize: 12, color: C.mut, fontWeight: '600' }}>Back to sign in</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable onPress={submit} disabled={busy}
              accessibilityRole="button"
              accessibilityLabel={mode === 'signup' ? 'Create account' : 'Sign in'}
              style={{
                minHeight: 54, borderRadius: 14, backgroundColor: C.gold,
                alignItems: 'center', justifyContent: 'center', opacity: busy ? 0.6 : 1,
                shadowColor: C.gold, shadowOpacity: 0.28, shadowRadius: 18,
                shadowOffset: { width: 0, height: 6 }, elevation: 6,
              }}>
              <Text style={{ fontSize: 14, fontWeight: '900', color: C.ink, letterSpacing: 1.6, textTransform: 'uppercase' }}>
                {busy ? 'Working…' : mode === 'signup' ? 'Create account' : 'Sign in'}
              </Text>
            </Pressable>
          )}
          {isConfigured && mode === 'signin' ? (
            <Pressable onPress={forgotPassword} disabled={busy} hitSlop={8} style={{ alignItems: 'center', marginTop: 12 }}>
              <Text style={{ fontSize: 12, color: C.mut, fontWeight: '600' }}>Forgot password?</Text>
            </Pressable>
          ) : null}
          {appleAvailable && isConfigured ? (
            <View style={{ marginTop: 14 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                <View style={{ flex: 1, height: 1, backgroundColor: C.line }} />
                <Text style={{ ...TYPE.micro, color: C.dim, marginHorizontal: 10 }}>OR</Text>
                <View style={{ flex: 1, height: 1, backgroundColor: C.line }} />
              </View>
              <Pressable onPress={doApple} disabled={busy}
                style={{ minHeight: TOUCH, borderRadius: RADIUS.md, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', flexDirection: 'row' }}>
                <Text style={{ fontSize: 17, fontWeight: '700', color: '#000', marginRight: 6 }}></Text>
                <Text style={{ fontSize: 15, fontWeight: '700', color: '#000' }}>Continue with Apple</Text>
              </Pressable>
            </View>
          ) : null}
          <Pressable onPress={() => onAuthed(null, 'Hunter', false)} hitSlop={8}
            accessibilityRole="button" accessibilityLabel="Continue as guest"
            style={{ alignItems: 'center', marginTop: 26, paddingVertical: 8 }}>
            <Text style={{ fontSize: 12.5, color: C.mut, fontWeight: '700' }}>Continue as guest</Text>
            <Text style={{ fontSize: 10.5, color: C.faint, marginTop: 3 }}>Saves to this device only</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/* --------------------------- physical profile ---------------------------- */
export function PhysicalProfileForm({ data, onSave, onCancel, embedded }) {
  const [bw, setBw] = useState(data.bodyweight ? String(data.bodyweight) : '');
  const [ht, setHt] = useState(data.heightCm ? String(data.heightCm) : '');
  const [age, setAge] = useState(data.age ? String(data.age) : '');
  const [sex, setSex] = useState(data.sex || '');
  const [activity, setActivity] = useState(data.activity || '');
  const [experience, setExperience] = useState(data.experience || '');
  const [err, setErr] = useState('');

  const save = () => {
    const bwN = parseFloat(bw) || 0, htN = parseFloat(ht) || 0, ageN = parseInt(age, 10) || 0;
    if (bwN <= 0) { setErr('Enter your bodyweight.'); return; }
    if (htN <= 0) { setErr('Enter your height.'); return; }
    if (ageN < 13 || ageN > 100) { setErr('Enter a valid age (13–100).'); return; }
    onSave({ bodyweight: bwN, heightCm: htN, age: ageN, sex, activity, experience });
  };

  const num = (label, val, set, suffix) => (
    <View style={{ flex: 1, marginRight: 8 }}>
      <Lbl>{label}</Lbl>
      <View style={[s.row, { backgroundColor: C.panel2, borderWidth: 1, borderColor: C.line, borderRadius: 10 }]}>
        <TextInput value={val} onChangeText={set} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={C.dim}
          style={{ flex: 1, paddingHorizontal: 10, paddingVertical: 12, color: C.text, fontSize: 16, fontVariant: ['tabular-nums'] }} />
        <Text style={{ paddingRight: 10, color: C.dim, fontSize: 12, fontWeight: '700' }}>{suffix}</Text>
      </View>
    </View>
  );
  const pick = (label, opts, val, set) => (
    <View style={{ marginTop: 12 }}>
      <Lbl>{label}</Lbl>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {opts.map((o) => <Chip key={o[0]} active={val === o[0]} onPress={() => set(o[0])}>{o[1]}</Chip>)}
      </View>
    </View>
  );

  const body = (
    <View>
      <View style={s.row}>
        {num('Bodyweight', bw, setBw, data.unit || 'kg')}
        {num('Height', ht, setHt, 'cm')}
        {num('Age', age, setAge, 'yrs')}
      </View>
      {pick('Sex', SEX_OPTS, sex, setSex)}
      {pick('Activity level', ACTIVITY_OPTS, activity, setActivity)}
      {pick('Training experience', EXPERIENCE_OPTS, experience, setExperience)}
      {err ? <Text style={{ fontSize: 12, color: C.red, marginTop: 10 }}>{err}</Text> : null}
      <GoldBtn onPress={save} style={{ marginTop: 14 }}>Save physical profile</GoldBtn>
      {onCancel && <GhostBtn onPress={onCancel} style={{ marginTop: 8 }}>Cancel</GhostBtn>}
      <Text style={{ fontSize: 13, color: C.mut, marginTop: 10, fontWeight: '700' }}>
        Used for realistic lift checks. Edit anytime.
      </Text>
    </View>
  );

  if (embedded) return body;
  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 16 }}>
      <View style={{ alignItems: 'center', marginBottom: 18 }}>
        <Text style={{ fontSize: 30, color: C.gold }}>▲</Text>
        <Text style={{ fontSize: 16, color: C.text, marginTop: 6, fontWeight: '800' }}>Build your Hunter profile</Text>
        <Text style={{ fontSize: 15, color: C.mut, marginTop: 6, textAlign: 'center', fontWeight: '700' }}>
          Three details keep your lift checks accurate.
        </Text>
      </View>
      <Card>{body}</Card>
    </ScrollView>
  );
}

/* --------------------------- account transfer ---------------------------- */
export function AccountTransfer({ makeCode, importCode }) {
  const [mode, setMode] = useState(null);
  const [code, setCode] = useState('');
  const [inCode, setInCode] = useState('');
  const [copied, setCopied] = useState(false);

  const doExport = () => { setCode(makeCode() || ''); setMode('export'); setCopied(false); };
  const copy = async () => { if (await copyText(code)) { setCopied(true); setTimeout(() => setCopied(false), 1800); } };
  const paste = async () => { const t = await pasteText(); if (t) setInCode(t); };

  return (
    <View style={{ marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: C.line }}>
      <Lbl>Move save to another device</Lbl>
      <View style={s.row}>
        <GhostBtn onPress={doExport} style={{ flex: 1, marginRight: 6 }}>Export backup code</GhostBtn>
        <GhostBtn onPress={() => setMode('import')} style={{ flex: 1 }}>Import a code</GhostBtn>
      </View>
      {mode === 'export' && (
        <View style={{ marginTop: 10 }}>
          <Text numberOfLines={3} style={{ backgroundColor: C.bgElev, borderWidth: 1, borderColor: C.line, borderRadius: 10, padding: 10, color: C.mut, fontSize: 10, fontVariant: ['tabular-nums'] }}>{code}</Text>
          <ChunkyBtn onPress={copy} small tone={copied ? 'green' : 'gold'} style={{ marginTop: 6 }}>
            {copied ? 'Copied ✓' : 'Copy code'}
          </ChunkyBtn>
          <Text style={{ fontSize: 13, color: C.mut, marginTop: 7, fontWeight: '700' }}>
            Paste this code on your other device.
          </Text>
        </View>
      )}
      {mode === 'import' && (
        <View style={{ marginTop: 10 }}>
          <TextInput value={inCode} onChangeText={setInCode} multiline placeholder="Paste your backup code here…"
            placeholderTextColor={C.dim}
            style={[s.input, { minHeight: 70, fontSize: 10, fontVariant: ['tabular-nums'], textAlignVertical: 'top' }]} />
          <View style={[s.row, { marginTop: 6 }]}>
            <GhostBtn onPress={paste} style={{ flex: 1, marginRight: 6 }}>Paste</GhostBtn>
            <Pressable onPress={() => { if (importCode(inCode)) setInCode(''); }} style={[s.greenBtn, { flex: 2, paddingVertical: 10 }]}>
              <Text style={s.goldBtnTxt}>Restore from code</Text>
            </Pressable>
          </View>
          <Text style={{ fontSize: 10, color: C.dim, marginTop: 6 }}>This replaces the current save on this device.</Text>
        </View>
      )}
    </View>
  );
}
