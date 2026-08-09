import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { secureStorage } from '../services/secureStorage';

interface AchievementStore {
  /** Achievement id → ISO unlock date */
  unlocked: Record<string, string>;
  unlock: (id: string) => void;
  clearEntries: () => void;
}

export const useAchievementStore = create<AchievementStore>()(
  persist(
    (set) => ({
      unlocked: {},

      unlock: (id) =>
        set((state) =>
          state.unlocked[id]
            ? state
            : { unlocked: { ...state.unlocked, [id]: new Date().toISOString() } }
        ),

      clearEntries: () => set({ unlocked: {} }),
    }),
    {
      name: 'zenova-achievement-storage',
      storage: createJSONStorage(() => secureStorage),
    }
  )
);
