import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { secureStorage } from '../services/secureStorage';
import { todayStr } from '../services/dateUtils';

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export interface FoodEntry {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  mealType: MealType;
  date: string; // YYYY-MM-DD
}

interface NutritionStore {
  entries: FoodEntry[];
  /** Water glass count keyed by YYYY-MM-DD — prevents yesterday's count bleeding into today */
  waterByDate: Record<string, number>;
  addEntry: (entry: Omit<FoodEntry, 'id' | 'date'>) => void;
  removeEntry: (id: string) => void;
  /** Set water glass count for today */
  setWater: (count: number) => void;
  clearEntries: () => void;
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export const useNutritionStore = create<NutritionStore>()(
  persist(
    (set) => ({
      entries: [],
      waterByDate: {},

      addEntry: (entry) => {
        const newEntry: FoodEntry = {
          ...entry,
          id: generateId(),
          date: todayStr(),
        };
        set((state) => ({ entries: [...state.entries, newEntry] }));
      },

      removeEntry: (id) =>
        set((state) => ({ entries: state.entries.filter((e) => e.id !== id) })),

      setWater: (count) => {
        const today = todayStr();
        set((state) => ({ waterByDate: { ...state.waterByDate, [today]: count } }));
      },

      clearEntries: () => set({ entries: [], waterByDate: {} }),
    }),
    {
      name: 'zenova-nutrition-storage',
      storage: createJSONStorage(() => secureStorage),
    }
  )
);
