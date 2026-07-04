/**
 * Haptic feedback seam (finding T3). All screens call these helpers, never
 * expo-haptics directly:
 *  - the current dev-build APK may predate the native module — the lazy
 *    require + catch turns every call into a silent no-op there (and on web)
 *    instead of a crash; real haptics activate on the next prebuild.
 *  - keeps the vocabulary curated: tap = Light impact on interactive touches
 *    (quick log, water, checkboxes), success = notification on completed
 *    actions (workout finish, check-in save).
 */
import { Platform } from 'react-native';

type HapticsModule = typeof import('expo-haptics');

let Haptics: HapticsModule | null = null;
if (Platform.OS !== 'web') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    Haptics = require('expo-haptics') as HapticsModule;
  } catch {
    Haptics = null;
  }
}

function fire(run: (h: HapticsModule) => Promise<void>): void {
  if (!Haptics) return;
  run(Haptics).catch(() => {
    // Native module missing from this build — disable for the session.
    Haptics = null;
  });
}

/** Light impact — small interactive touches (toggles, water glasses, checkboxes). */
export function hapticTap(): void {
  fire((h) => h.impactAsync(h.ImpactFeedbackStyle.Light));
}

/** Success notification — a meaningful action completed (finish workout, save check-in). */
export function hapticSuccess(): void {
  fire((h) => h.notificationAsync(h.NotificationFeedbackType.Success));
}
