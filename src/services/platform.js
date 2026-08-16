// LEVL React Native — platform services (storage, hashing, clipboard, share)
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import * as Clipboard from 'expo-clipboard';
import { Share } from 'react-native';

const MEM = {};

export async function stGet(k) {
  try { const v = await AsyncStorage.getItem(k); if (v != null) return v; } catch (e) {}
  return MEM[k] != null ? MEM[k] : null;
}
export async function stSet(k, v) {
  try { await AsyncStorage.setItem(k, v); } catch (e) {}
  MEM[k] = v;
}
export async function stDel(k) {
  try { await AsyncStorage.removeItem(k); } catch (e) {}
  delete MEM[k];
}

// SHA-256 via expo-crypto, with a deterministic fallback so auth never crashes.
export async function sha256Hex(str) {
  try {
    return await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, str);
  } catch (e) {
    let h = 5381;
    for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
    return 'x' + h.toString(16);
  }
}

export async function copyText(t) {
  try { await Clipboard.setStringAsync(t); return true; } catch (e) { return false; }
}
export async function pasteText() {
  try { return await Clipboard.getStringAsync(); } catch (e) { return ''; }
}
export async function shareText(message) {
  try { await Share.share({ message }); return true; } catch (e) { return false; }
}

// Dependency-free base64 (Hermes availability of btoa/atob varies by version).
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
export function b64encode(str) {
  const bytes = [];
  for (let i = 0; i < str.length; i++) {
    let c = str.charCodeAt(i);
    if (c < 128) bytes.push(c);
    else if (c < 2048) { bytes.push(192 | (c >> 6), 128 | (c & 63)); }
    else if (c >= 0xd800 && c <= 0xdbff && i + 1 < str.length) {
      const c2 = str.charCodeAt(++i);
      const cp = 0x10000 + ((c & 0x3ff) << 10) + (c2 & 0x3ff);
      bytes.push(240 | (cp >> 18), 128 | ((cp >> 12) & 63), 128 | ((cp >> 6) & 63), 128 | (cp & 63));
    } else { bytes.push(224 | (c >> 12), 128 | ((c >> 6) & 63), 128 | (c & 63)); }
  }
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i], b = bytes[i + 1], c = bytes[i + 2];
    out += B64[a >> 2] + B64[((a & 3) << 4) | ((b || 0) >> 4)];
    out += b == null ? '=' : B64[((b & 15) << 2) | ((c || 0) >> 6)];
    out += c == null ? '=' : B64[c & 63];
  }
  return out;
}
export function b64decode(str) {
  const clean = str.replace(/[^A-Za-z0-9+/=]/g, '');
  const bytes = [];
  for (let i = 0; i < clean.length; i += 4) {
    const n = [0, 1, 2, 3].map((j) => B64.indexOf(clean[i + j]));
    bytes.push((n[0] << 2) | (n[1] >> 4));
    if (clean[i + 2] !== '=' && n[2] >= 0) bytes.push(((n[1] & 15) << 4) | (n[2] >> 2));
    if (clean[i + 3] !== '=' && n[3] >= 0) bytes.push(((n[2] & 3) << 6) | n[3]);
  }
  let out = '', i = 0;
  while (i < bytes.length) {
    const b0 = bytes[i++];
    if (b0 < 128) out += String.fromCharCode(b0);
    else if (b0 < 224) out += String.fromCharCode(((b0 & 31) << 6) | (bytes[i++] & 63));
    else if (b0 < 240) out += String.fromCharCode(((b0 & 15) << 12) | ((bytes[i++] & 63) << 6) | (bytes[i++] & 63));
    else {
      const cp = ((b0 & 7) << 18) | ((bytes[i++] & 63) << 12) | ((bytes[i++] & 63) << 6) | (bytes[i++] & 63);
      const v = cp - 0x10000;
      out += String.fromCharCode(0xd800 + (v >> 10), 0xdc00 + (v & 0x3ff));
    }
  }
  return out;
}
