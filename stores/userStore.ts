import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { secureStorage } from '../services/secureStorage';

export interface UserProfile {
  id: string;
  email: string;
  name?: string;
  age?: number;
  height_cm?: number;
  weight_kg?: number;
  bmi?: number;
  primary_goal?: string;
  activity_level?: string;
  target_calories?: number;
  target_sleep_hours?: number;
  onboarding_completed?: boolean;
  plan?: 'free' | 'pro' | 'elite';
  workout_frequency?: string;   // '0' | '2' | '3' | '5' | '6' (days/week from onboarding)
  main_obstacle?: string;
  gender?: 'male' | 'female' | 'other';
  workout_environment?: 'gym' | 'home';
  avatar?: string;  // local URI from image picker
  units?: 'metric' | 'imperial';
  notif_workout?: boolean;
  notif_calorie?: boolean;
  notif_streak?: boolean;
  notif_sleep?: boolean;
}

interface UserStore {
  profile: UserProfile | null;
  isOnboarded: boolean;
  /** Lifetime count of free-tier Snap photo analyses used (3 free tastes, then paywall) */
  freeSnapsUsed: number;
  setProfile: (p: UserProfile) => void;
  updateProfile: (updates: Partial<UserProfile>) => void;
  incrementFreeSnaps: () => void;
  clearProfile: () => void;
}

export const useUserStore = create<UserStore>()(
  persist(
    (set) => ({
      profile: null,
      isOnboarded: false,
      freeSnapsUsed: 0,

      setProfile: (profile) =>
        set({ profile, isOnboarded: profile.onboarding_completed ?? false }),

      updateProfile: (updates) =>
        set((state) => {
          const profile = state.profile
            ? { ...state.profile, ...updates }
            : (updates as UserProfile);
          return { profile, isOnboarded: profile.onboarding_completed ?? false };
        }),

      incrementFreeSnaps: () =>
        set((state) => ({ freeSnapsUsed: state.freeSnapsUsed + 1 })),

      clearProfile: () => set({ profile: null, isOnboarded: false, freeSnapsUsed: 0 }),
    }),
    {
      name: 'zenova-user-storage',
      storage: createJSONStorage(() => secureStorage),
    }
  )
);
