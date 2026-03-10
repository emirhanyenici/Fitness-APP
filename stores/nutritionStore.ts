import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { secureStorage } from '../services/secureStorage';

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
  waterGlasses: number;
  addEntry: (entry: Omit<FoodEntry, 'id' | 'date'>) => void;
  removeEntry: (id: string) => void;
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
      waterGlasses: 0,

      addEntry: (entry) => {
        const newEntry: FoodEntry = {
          ...entry,
          id: generateId(),
          date: new Date().toISOString().slice(0, 10),
        };
        set((state) => ({ entries: [...state.entries, newEntry] }));
      },

      removeEntry: (id) =>
        set((state) => ({ entries: state.entries.filter((e) => e.id !== id) })),

      setWater: (count) => set({ waterGlasses: count }),

      clearEntries: () => set({ entries: [], waterGlasses: 0 }),
    }),
    {
      name: 'novra-nutrition-storage',
      storage: createJSONStorage(() => secureStorage),
    }
  )
);
