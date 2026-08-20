// LEVL — BugReportModal: quick in-app bug reporting for testers.
import React, { useState } from 'react';
import { View } from 'react-native';
import { Text, TextInput } from '../components/Text';
import { C, s } from '../theme';
import { Sheet, Chip, GoldBtn } from '../components/ui';
import { submitBugReport } from '../services/supabase/bugReportService';

const CATS = [['bug', 'Something broke'], ['crash', 'App crashed'], ['idea', 'Idea / feedback']];

export default function BugReportModal({ visible, onClose }) {
  const [category, setCategory] = useState('bug');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState('');
  const [error, setError] = useState('');

  const close = () => { setMessage(''); setCategory('bug'); setDone(''); setError(''); onClose && onClose(); };

  const submit = async () => {
    setError(''); setBusy(true);
    const res = await submitBugReport({ message, category });
    setBusy(false);
    if (!res.ok) { setError(res.error); return; }
    setDone(res.via === 'email' ? 'Opening your email app…' : 'Sent — thank you!');
    setTimeout(close, 1200);
  };

  if (!visible) return null;
  return (
    <Sheet visible title="Report a bug" onClose={close}>
      <View style={{ padding: 16 }}>
        <Text style={{ fontSize: 15, color: C.text, fontWeight: '700', marginBottom: 12, lineHeight: 21 }}>
          Tell us what happened. Device details attach automatically.
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 12 }}>
          {CATS.map(([k, label]) => <Chip key={k} active={category === k} onPress={() => setCategory(k)}>{label}</Chip>)}
        </View>
        <TextInput
          value={message} onChangeText={setMessage} multiline textAlignVertical="top"
          placeholder="Describe the problem…" placeholderTextColor={C.dim}
          style={[s.input, { minHeight: 110, paddingTop: 12 }]}
        />
        {!!done && <Text style={{ fontSize: 12, color: C.green, marginTop: 12 }}>{done}</Text>}
        {!!error && <Text style={{ fontSize: 12, color: C.red, marginTop: 12 }}>{error}</Text>}
        <GoldBtn onPress={submit} disabled={busy} style={{ marginTop: 16 }}>{busy ? 'Sending…' : 'Send report'}</GoldBtn>
      </View>
    </Sheet>
  );
}
