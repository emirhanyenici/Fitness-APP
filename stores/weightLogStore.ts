import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { secureStorage } from '../services/secureStorage';
import { todayStr } from '../services/dateUtils';

export interface WeightEntry {
  date: string;       // YYYY-MM-DD
  weight_kg: number;
}

interface WeightLogStore {
  entries: WeightEntry[];
  addEntry: (weight_kg: number) => void;
  /** Merge imported entries (e.g. Apple Health); manually logged dates win. */
  importEntries: (imported: WeightEntry[]) => void;
  clearEntries: () => void;
}

export const useWeightLogStore = create<WeightLogStore>()(
  persist(
    (set) => ({
      entries: [],

      addEntry: (weight_kg) => {
        const date = todayStr();
        set((state) => ({
          entries: [
            ...state.entries.filter((e) => e.date !== date),
            { date, weight_kg },
          ],
        }));
      },

      importEntries: (imported) =>
        set((state) => {
          const have = new Set(state.entries.map((e) => e.date));
          const fresh = imported.filter((e) => !have.has(e.date) && e.weight_kg > 0);
          if (fresh.length === 0) return state;
          return { entries: [...state.entries, ...fresh].sort((a, b) => a.date.localeCompare(b.date)) };
        }),

      clearEntries: () => set({ entries: [] }),
    }),
    {
      name: 'zenova-weight-log-storage',
      storage: createJSONStorage(() => secureStorage),
    }
  )
);
