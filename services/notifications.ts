/**
 * Local (device-scheduled, not push) daily reminders — workout, calorie
 * logging, streak, and sleep. The `expo-notifications` native module is
 * loaded lazily so platforms/environments without it (web, Jest, a dev build
 * made before this feature) never touch it — same pattern as
 * services/healthkit.ts. Each reminder is scheduled with an explicit
 * `identifier` equal to its key, so re-syncing never needs to track
 * previously-returned IDs — cancelling by key is always enough.
 */
import { Platform } from 'react-native';
import type { UserProfile } from '../stores/userStore';

export type NotifKey = 'notif_workout' | 'notif_calorie' | 'notif_streak' | 'notif_sleep';

export const NOTIF_KEYS: NotifKey[] = ['notif_workout', 'notif_calorie', 'notif_streak', 'notif_sleep'];

export const DEFAULT_TIMES: Record<NotifKey, string> = {
  notif_workout: '09:00',
  notif_calorie: '19:00',
  notif_streak: '20:00',
  notif_sleep: '22:00',
};

const CONTENT: Record<NotifKey, { title: string; body: string }> = {
  notif_workout: { title: "Time to move 💪", body: "Your workout is waiting — let's keep the streak going." },
  notif_calorie: { title: 'Log your meals 🥗', body: "Don't forget to log what you've eaten today." },
  notif_streak:  { title: 'Keep your streak alive 🔥', body: "You haven't checked in today yet — a couple of minutes is all it takes." },
  notif_sleep:   { title: 'Wind down 🌙', body: "It's almost bedtime — good sleep keeps your LifeScore up." },
};

function supported(): boolean {
  return Platform.OS === 'ios' || Platform.OS === 'android';
}

/** Resolves the effective "HH:mm" time for a key, falling back to its default. */
export function resolveTime(profile: Pick<UserProfile, `${NotifKey}_time`> | null | undefined, key: NotifKey): string {
  return (profile?.[`${key}_time`] as string | undefined) ?? DEFAULT_TIMES[key];
}

/** Parses "HH:mm" into numeric hour/minute; falls back to the key's default on malformed input. */
export function parseTime(time: string, key: NotifKey): { hour: number; minute: number } {
  const m = /^(\d{1,2}):(\d{2})$/.exec(time);
  if (!m) {
    const [h, mi] = DEFAULT_TIMES[key].split(':').map(Number);
    return { hour: h, minute: mi };
  }
  const hour = Math.min(23, Math.max(0, parseInt(m[1], 10)));
  const minute = Math.min(59, Math.max(0, parseInt(m[2], 10)));
  return { hour, minute };
}

/** One-time setup: Android notification channel + foreground display behavior. No-op on web. */
export function initNotifications(): void {
  if (!supported()) return;
  const Notifications = require('expo-notifications');
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
  if (Platform.OS === 'android') {
    void Notifications.setNotificationChannelAsync('default', {
      name: 'Reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
}

/** Checks/requests OS notification permission. Returns whether it's granted. */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!supported()) return false;
  const Notifications = require('expo-notifications');
  const existing = await Notifications.getPermissionsAsync();
  if (existing.status === 'granted') return true;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.status === 'granted';
}

/** Cancels any existing schedule for `key`, then re-schedules it if `enabled`. */
export async function syncNotification(key: NotifKey, enabled: boolean, time: string): Promise<void> {
  if (!supported()) return;
  const Notifications = require('expo-notifications');
  await Notifications.cancelScheduledNotificationAsync(key);
  if (!enabled) return;
  const { hour, minute } = parseTime(time, key);
  await Notifications.scheduleNotificationAsync({
    identifier: key,
    content: { ...CONTENT[key], sound: true },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.CALENDAR, hour, minute, repeats: true },
  });
}

/** Reconciles all four reminders against the current profile. No-op on web or without a profile. */
export async function syncAllNotifications(profile: UserProfile | null | undefined): Promise<void> {
  if (!profile || !supported()) return;
  for (const key of NOTIF_KEYS) {
    await syncNotification(key, profile[key] ?? false, resolveTime(profile, key));
  }
}
