import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { secureStorage } from '../services/secureStorage';
import { WorkoutExercise } from '../services/exercisedb';

export interface CustomDay {
  exercises: WorkoutExercise[];
}

interface CustomProgramStore {
  /** Keyed by JS getDay() — 0=Sun, 1=Mon, ..., 6=Sat */
  days: Record<number, CustomDay>;
  setDay: (day: number, plan: CustomDay) => void;
  clearDay: (day: number) => void;
  clearAll: () => void;
}

export const useCustomProgramStore = create<CustomProgramStore>()(
  persist(
    (set) => ({
      days: {},

      setDay: (day, plan) =>
        set((state) => ({ days: { ...state.days, [day]: plan } })),

      clearDay: (day) =>
        set((state) => {
          const next = { ...state.days };
          delete next[day];
          return { days: next };
        }),

      clearAll: () => set({ days: {} }),
    }),
    {
      name: 'zenova-custom-program',
      storage: createJSONStorage(() => secureStorage),
    }
  )
);
