import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { secureStorage } from '../services/secureStorage';

/**
 * Apple Health connection state + device-local caches of imported metrics.
 *
 * Steps and sleep live here (keyed by local YYYY-MM-DD) rather than in the
 * synced stores: HealthKit data stays on-device per Apple's rules, and both
 * are re-importable from the source at any time. Weight and workouts are
 * different — they merge into weightLogStore/workoutStore so they behave like
 * (and sync like) manually logged entries.
 */
interface HealthStore {
  /** User connected Apple Health from Profile (authorization sheet completed). */
  connected: boolean;
  /** ISO timestamp of the last successful sync, for the Profile row subtitle. */
  lastSyncAt: string | null;
  /** Local day → step count (from HKQuantityTypeIdentifierStepCount daily sums). */
  stepsByDate: Record<string, number>;
  /** Local day the sleep ENDED (the morning) → hours asleep. */
  sleepByDate: Record<string, number>;
  setConnected: (v: boolean) => void;
  /** Merge freshly synced days over the cache and prune anything older than 30 days. */
  applySync: (steps: Record<string, number>, sleep: Record<string, number>) => void;
  clearAll: () => void;
}

function pruned(rec: Record<string, number>, minDate: string): Record<string, number> {
  return Object.fromEntries(Object.entries(rec).filter(([d]) => d >= minDate));
}

export const useHealthStore = create<HealthStore>()(
  persist(
    (set) => ({
      connected: false,
      lastSyncAt: null,
      stepsByDate: {},
      sleepByDate: {},

      setConnected: (connected) => set({ connected }),

      applySync: (steps, sleep) =>
        set((s) => {
          const cutoff = new Date();
          cutoff.setDate(cutoff.getDate() - 30);
          const minDate = cutoff.toISOString().slice(0, 10);
          return {
            stepsByDate: pruned({ ...s.stepsByDate, ...steps }, minDate),
            sleepByDate: pruned({ ...s.sleepByDate, ...sleep }, minDate),
            lastSyncAt: new Date().toISOString(),
          };
        }),

      clearAll: () => set({ connected: false, lastSyncAt: null, stepsByDate: {}, sleepByDate: {} }),
    }),
    {
      name: 'zenova-health-storage',
      storage: createJSONStorage(() => secureStorage),
    }
  )
);
