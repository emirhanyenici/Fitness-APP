import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { secureStorage } from '../services/secureStorage';
import { todayStr } from '../services/dateUtils';

export type SuggestionType = 'nutrition' | 'workout';

export interface AISuggestion {
  type: SuggestionType;
  text: string;
  date: string;      // YYYY-MM-DD
  savedAt: string;   // ISO timestamp
}

interface AISuggestionsStore {
  nutrition: AISuggestion | null;
  workout:   AISuggestion | null;
  save:   (type: SuggestionType, text: string) => void;
  clear:  (type: SuggestionType) => void;
  clearAll: () => void;
}

export const useAISuggestionsStore = create<AISuggestionsStore>()(
  persist(
    (set) => ({
      nutrition: null,
      workout:   null,

      save: (type, text) => {
        const entry: AISuggestion = {
          type,
          text,
          date:    todayStr(),
          savedAt: new Date().toISOString(),
        };
        set(type === 'nutrition' ? { nutrition: entry } : { workout: entry });
      },

      clear: (type) =>
        set(type === 'nutrition' ? { nutrition: null } : { workout: null }),

      clearAll: () => set({ nutrition: null, workout: null }),
    }),
    {
      name: 'zenova-ai-suggestions-storage',
      storage: createJSONStorage(() => secureStorage),
    }
  )
);
