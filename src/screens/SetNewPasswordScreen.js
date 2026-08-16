// LEVL — SetNewPasswordScreen
// Shown when the user taps the password-reset link in their email. By the time
// this renders, the recovery session is already established (App.js does that),
// so all that's left is choosing a new password.

import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { C, s } from '../theme';
import { Card, GoldBtn } from '../components/ui';
import { setNewPassword } from '../services/supabase/authService';

export default function SetNewPasswordScreen({ onDone, onCancel }) {
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const submit = async () => {
    if (!pw || pw.length < 6) { setErr('Password must be at least 6 characters.'); return; }
    if (pw !== pw2) { setErr('Those passwords don\u2019t match.'); return; }
    setErr(''); setBusy(true);
    const { error } = await setNewPassword(pw);
    setBusy(false);
    if (error) { setErr(error.message || 'Could not update your password.'); return; }
    onDone && onDone();
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 16 }}>
        <View style={{ alignItems: 'center', marginBottom: 22 }}>
          <Text style={{ fontSize: 34, color: C.gold }}>▲</Text>
          <Text style={{ fontSize: 18, color: C.gold, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase', marginTop: 4 }}>
            New password
          </Text>
          <Text style={{ fontSize: 15, color: C.mut, fontWeight: '700', marginTop: 8, textAlign: 'center', lineHeight: 21 }}>
            Choose the password you’ll use next time.
          </Text>
        </View>

        <Card>
          <TextInput
            value={pw} onChangeText={setPw} secureTextEntry
            placeholder="New password (6+ characters)" placeholderTextColor={C.dim}
            style={[s.input, { marginBottom: 10 }]}
          />
          <TextInput
            value={pw2} onChangeText={setPw2} secureTextEntry
            placeholder="Confirm new password" placeholderTextColor={C.dim}
            style={[s.input, { marginBottom: 10 }]}
          />
          {err ? <Text style={{ fontSize: 12, color: C.red, marginBottom: 10 }}>{err}</Text> : null}
          <GoldBtn onPress={submit} disabled={busy}>{busy ? 'Saving…' : 'Save new password'}</GoldBtn>
          <Pressable onPress={onCancel} disabled={busy} hitSlop={8} style={{ alignItems: 'center', marginTop: 14 }}>
            <Text style={{ fontSize: 12, color: C.mut, fontWeight: '600' }}>Cancel</Text>
          </Pressable>
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
