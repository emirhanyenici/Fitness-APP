/**
 * Encrypted storage adapter for Zustand persist middleware.
 *
 * Strategy:
 *  - Production native build: expo-secure-store → device Keychain (iOS) /
 *    EncryptedSharedPreferences (Android). Data is encrypted at rest by the OS.
 *  - Expo Go / dev client without native build: graceful fallback to AsyncStorage.
 *    SecureStore requires a custom dev build or production build to function.
 *  - Web: plain AsyncStorage (dev only — never ship health data to web without
 *    server-side session storage).
 *
 * expo-secure-store has a ~2 048 byte per-item limit on iOS.
 * Large payloads are chunked automatically to stay under this limit.
 */

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Detect whether the native ExpoSecureStore module is actually linked.
// In Expo Go it is not available; in a real dev/production build it is.
let SecureStore: typeof import('expo-secure-store') | null = null;
try {
  SecureStore = require('expo-secure-store');
  // Perform a quick probe — if the native module is missing this throws.
  SecureStore!.getItemAsync('__probe__').catch(() => {});
} catch {
  SecureStore = null;
}

const IS_SECURE_AVAILABLE = SecureStore !== null && (Platform.OS === 'ios' || Platform.OS === 'android');

// expo-secure-store key names must match /^[a-zA-Z0-9._-]+$/
function sanitizeKey(key: string): string {
  return key.replace(/[^a-zA-Z0-9._-]/g, '_');
}

// Chunk size: safely under the 2 048-byte iOS limit per item.
const CHUNK_SIZE = 1800;

async function setSecure(key: string, value: string): Promise<void> {
  const safeKey = sanitizeKey(key);
  if (value.length <= CHUNK_SIZE) {
    await SecureStore!.setItemAsync(`${safeKey}__0`, value);
    await SecureStore!.setItemAsync(`${safeKey}__len`, '1');
    return;
  }
  const chunks: string[] = [];
  for (let i = 0; i < value.length; i += CHUNK_SIZE) {
    chunks.push(value.slice(i, i + CHUNK_SIZE));
  }
  await Promise.all(chunks.map((chunk, i) => SecureStore!.setItemAsync(`${safeKey}__${i}`, chunk)));
  await SecureStore!.setItemAsync(`${safeKey}__len`, String(chunks.length));
}

async function getSecure(key: string): Promise<string | null> {
  const safeKey = sanitizeKey(key);
  const lenStr = await SecureStore!.getItemAsync(`${safeKey}__len`);
  if (!lenStr) return null;
  const len = parseInt(lenStr, 10);
  if (Number.isNaN(len) || len <= 0) return null;
  const chunks = await Promise.all(
    Array.from({ length: len }, (_, i) => SecureStore!.getItemAsync(`${safeKey}__${i}`))
  );
  if (chunks.some((c) => c === null)) return null;
  return chunks.join('');
}

async function removeSecure(key: string): Promise<void> {
  const safeKey = sanitizeKey(key);
  const lenStr = await SecureStore!.getItemAsync(`${safeKey}__len`);
  const len = lenStr ? parseInt(lenStr, 10) : 1;
  await Promise.all(
    Array.from({ length: len }, (_, i) => SecureStore!.deleteItemAsync(`${safeKey}__${i}`))
  );
  await SecureStore!.deleteItemAsync(`${safeKey}__len`);
}

/** Drop-in replacement for createJSONStorage(() => AsyncStorage). */
export const secureStorage = {
  getItem: async (key: string): Promise<string | null> => {
    if (IS_SECURE_AVAILABLE) {
      try { return await getSecure(key); } catch { /* fall through */ }
    }
    return AsyncStorage.getItem(key);
  },
  setItem: async (key: string, value: string): Promise<void> => {
    if (IS_SECURE_AVAILABLE) {
      try { return await setSecure(key, value); } catch { /* fall through */ }
    }
    return AsyncStorage.setItem(key, value);
  },
  removeItem: async (key: string): Promise<void> => {
    if (IS_SECURE_AVAILABLE) {
      try { return await removeSecure(key); } catch { /* fall through */ }
    }
    return AsyncStorage.removeItem(key);
  },
};
