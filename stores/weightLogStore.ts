import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { secureStorage } from '../services/secureStorage';

export interface WeightEntry {
  date: string;       // YYYY-MM-DD
  weight_kg: number;
}

interface WeightLogStore {
  entries: WeightEntry[];
  addEntry: (weight_kg: number) => void;
  clearEntries: () => void;
}

export const useWeightLogStore = create<WeightLogStore>()(
  persist(
    (set) => ({
      entries: [],

      addEntry: (weight_kg) => {
        const date = new Date().toISOString().slice(0, 10);
        set((state) => ({
          entries: [
            ...state.entries.filter((e) => e.date !== date),
            { date, weight_kg },
          ],
        }));
      },

      clearEntries: () => set({ entries: [] }),
    }),
    {
      name: 'novra-weight-log-storage',
      storage: createJSONStorage(() => secureStorage),
    }
  )
);
