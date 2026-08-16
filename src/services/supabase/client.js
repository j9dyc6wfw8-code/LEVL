// LEVL — Supabase client (the single, shared connection).
//
// DESIGN NOTES
// - This is the ONLY file that constructs a Supabase client. Every service
//   imports `supabase` from here; nothing else calls createClient.
// - Session persistence uses AsyncStorage, so a logged-in user stays logged in
//   across app launches (Supabase writes/reads the session token there).
// - CONFIG comes from app.json -> expo.extra (see setup docs). We deliberately
//   do NOT hardcode keys in source. The anon key is safe to ship (it only does
//   what Row Level Security allows), but keeping it in config keeps it swappable.
// - SAFE FALLBACK: if the project isn't configured yet (no URL/key), we export
//   `supabase = null` and `isConfigured = false` instead of throwing. This is
//   what lets the app keep running 100% locally today — nothing breaks just
//   because the backend isn't wired up. Every service checks isConfigured first.

import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

// Pull config from expo.extra (app.json). Fall back to env for local dev.
const extra =
  (Constants.expoConfig && Constants.expoConfig.extra) ||
  (Constants.manifest && Constants.manifest.extra) ||
  {};

const SUPABASE_URL = extra.supabaseUrl || process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = extra.supabaseAnonKey || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

export const isConfigured = !!(SUPABASE_URL && SUPABASE_ANON_KEY);

// Build the client only when configured. Otherwise stay null so the app runs
// fully offline/local exactly as it does today.
export const supabase = isConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        storage: AsyncStorage,          // session persists across launches
        autoRefreshToken: true,         // refresh the JWT before it expires
        persistSession: true,
        detectSessionInUrl: false,      // not a web app; no URL parsing
      },
    })
  : null;

// Small helper every service uses to fail gracefully when the backend is off.
// Returns a rejected-shaped result rather than throwing, so callers can treat
// "backend not configured" the same as any other network miss.
export function offline(reason) {
  return { data: null, error: { message: reason || 'Backend not configured', offline: true } };
}
