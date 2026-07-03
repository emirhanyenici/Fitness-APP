import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { secureStorage } from '../services/secureStorage';
import { todayStr } from '../services/dateUtils';

export interface RecoveryEntry {
  mood: number;         // 1-5
  energy: number;       // 1-5
  stress: number;       // 1-5
  sleepHours?: number;  // e.g. 7.5
  date: string;         // YYYY-MM-DD
}

interface RecoveryStore {
  entries: RecoveryEntry[];
  saveEntry: (entry: Omit<RecoveryEntry, 'date'>) => void;
  clearEntries: () => void;
}

export const useRecoveryStore = create<RecoveryStore>()(
  persist(
    (set) => ({
      entries: [],

      saveEntry: (entry) => {
        const date = todayStr();
        set((state) => ({
          entries: [
            ...state.entries.filter((e) => e.date !== date),
            { ...entry, date },
          ],
        }));
      },

      clearEntries: () => set({ entries: [] }),
    }),
    {
      name: 'zenova-recovery-storage',
      storage: createJSONStorage(() => secureStorage),
    }
  )
);
