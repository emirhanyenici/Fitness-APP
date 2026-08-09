import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { secureStorage } from '../services/secureStorage';
import { todayStr } from '../services/dateUtils';

export type MeasurementField = 'waist_cm' | 'chest_cm' | 'arm_cm' | 'hips_cm' | 'thigh_cm';

/** Shared field catalog — profile.tsx, history.tsx, and the weekly report all iterate the same list/labels. */
export const MEASUREMENT_FIELDS: { key: MeasurementField; labelKey: string }[] = [
  { key: 'waist_cm', labelKey: 'measurements.waist' },
  { key: 'chest_cm', labelKey: 'measurements.chest' },
  { key: 'arm_cm',   labelKey: 'measurements.arm' },
  { key: 'hips_cm',  labelKey: 'measurements.hips' },
  { key: 'thigh_cm', labelKey: 'measurements.thigh' },
];

export interface MeasurementEntry {
  date: string; // YYYY-MM-DD
  waist_cm?: number;
  chest_cm?: number;
  arm_cm?: number;
  hips_cm?: number;
  thigh_cm?: number;
}

interface MeasurementLogStore {
  entries: MeasurementEntry[];
  /** Merges into today's entry — logging one field (e.g. waist) never clears the others logged earlier the same day. */
  addEntry: (fields: Partial<Omit<MeasurementEntry, 'date'>>) => void;
  clearEntries: () => void;
}

export const useMeasurementLogStore = create<MeasurementLogStore>()(
  persist(
    (set) => ({
      entries: [],

      addEntry: (fields) => {
        const date = todayStr();
        set((state) => {
          const existing = state.entries.find((e) => e.date === date);
          const merged: MeasurementEntry = { ...existing, ...fields, date };
          return {
            entries: [...state.entries.filter((e) => e.date !== date), merged],
          };
        });
      },

      clearEntries: () => set({ entries: [] }),
    }),
    {
      name: 'zenova-measurement-log-storage',
      storage: createJSONStorage(() => secureStorage),
    }
  )
);
