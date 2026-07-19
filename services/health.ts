/**
 * Platform-neutral facade over the two health integrations:
 * Apple Health (services/healthkit.ts, iOS) and Health Connect
 * (services/healthConnect.ts, Android). UI code imports from HERE so screens
 * never branch on platform themselves. Both paths share healthStore and the
 * same store-merge semantics.
 */
import { Platform } from 'react-native';
import {
  connectAppleHealth,
  disconnectAppleHealth,
  isHealthKitSupported,
  syncHealthData as syncHealthKit,
} from './healthkit';
import {
  connectHealthConnect,
  disconnectHealthConnect,
  isHealthConnectSupported,
  syncHealthConnectData,
} from './healthConnect';

/** Display name of the platform's health app. */
export const HEALTH_APP_NAME = Platform.OS === 'android' ? 'Health Connect' : 'Apple Health';

/** Whether this device can offer a health integration at all. */
export async function isHealthSupported(): Promise<boolean> {
  if (Platform.OS === 'ios') return isHealthKitSupported();
  if (Platform.OS === 'android') return isHealthConnectSupported();
  return false;
}

/** Runs the platform permission flow; true when connected + first sync done. */
export async function connectHealth(): Promise<boolean> {
  if (Platform.OS === 'ios') return connectAppleHealth();
  if (Platform.OS === 'android') return connectHealthConnect();
  return false;
}

/** Stops syncing and drops cached steps/sleep; imported entries are kept. */
export function disconnectHealth(): void {
  if (Platform.OS === 'ios') disconnectAppleHealth();
  else if (Platform.OS === 'android') disconnectHealthConnect();
}

/** Refreshes the last 7 days; no-op unless connected on a supported platform. */
export async function syncHealth(): Promise<void> {
  if (Platform.OS === 'ios') return syncHealthKit();
  if (Platform.OS === 'android') return syncHealthConnectData();
}
