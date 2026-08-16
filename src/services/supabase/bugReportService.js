// LEVL — bugReportService: writes tester bug reports to the `bug_reports`
// table when possible, and ALWAYS falls back to a prefilled email so a report
// is never lost (even when not signed in / offline). Never throws.
//
// Requires the bug_reports table (run sql/bug_reports.sql). Set SUPPORT_EMAIL.

import { Platform, Linking } from 'react-native';
import Constants from 'expo-constants';
import { supabase, isConfigured } from './client';
import { currentUserId } from './authService';

const SUPPORT_EMAIL = 'you@example.com'; // <-- set to your inbox

function appMeta() {
  const cfg = (Constants.expoConfig || Constants.manifest || {});
  return {
    app_version: cfg.version || 'unknown',
    build_number: String((cfg.ios && cfg.ios.buildNumber) || (cfg.android && cfg.android.versionCode) || ''),
    platform: Platform.OS,
    os_version: String(Platform.Version || ''),
  };
}

// Returns { ok, via: 'cloud' | 'email', error? }.
export async function submitBugReport({ message, category = 'bug' }) {
  const text = (message || '').trim();
  if (!text) return { ok: false, error: 'Please describe the problem first.' };

  const meta = appMeta();
  const uid = isConfigured ? await currentUserId() : null;
  let email = null;
  if (isConfigured) {
    try { const { data } = await supabase.auth.getUser(); email = data && data.user ? data.user.email : null; } catch (e) {}
  }

  if (isConfigured) {
    try {
      const { error } = await supabase.from('bug_reports').insert({
        user_id: uid, email, message: text, category, ...meta,
      });
      if (!error) return { ok: true, via: 'cloud' };
    } catch (e) { /* fall through to email */ }
  }

  const sent = await emailFallback(text, category, meta, email);
  return sent
    ? { ok: true, via: 'email' }
    : { ok: false, error: 'Could not send. Please screenshot and message me directly.' };
}

async function emailFallback(text, category, meta, email) {
  const subject = 'LEVL bug (' + category + ')';
  const body = text + '\n\n---\n'
    + 'From: ' + (email || 'not signed in') + '\n'
    + 'App: ' + meta.app_version + ' (' + meta.build_number + ')\n'
    + 'Platform: ' + meta.platform + ' ' + meta.os_version;
  const url = 'mailto:' + SUPPORT_EMAIL + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
  try {
    if (!(await Linking.canOpenURL(url))) return false;
    await Linking.openURL(url);
    return true;
  } catch (e) { return false; }
}
