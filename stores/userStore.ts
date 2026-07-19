import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { secureStorage } from '../services/secureStorage';
import { todayStr } from '../services/dateUtils';

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
  /** Free-tier Snap photo analyses used on `freeSnapsDate` (daily quota, resets each local day) */
  freeSnapsUsed: number;
  /** Local calendar day (todayStr) the freeSnapsUsed counter belongs to */
  freeSnapsDate: string;
  setProfile: (p: UserProfile) => void;
  updateProfile: (updates: Partial<UserProfile>) => void;
  incrementFreeSnaps: () => void;
  clearProfile: () => void;
}

/**
 * Snap analyses consumed today. The persisted counter may belong to an earlier
 * day (or predate the daily-quota migration, when freeSnapsDate is ''); both
 * cases read as 0 — the quota self-resets at local midnight.
 */
export function snapsUsedToday(s: { freeSnapsUsed: number; freeSnapsDate: string }): number {
  return s.freeSnapsDate === todayStr() ? s.freeSnapsUsed : 0;
}

export const useUserStore = create<UserStore>()(
  persist(
    (set) => ({
      profile: null,
      isOnboarded: false,
      freeSnapsUsed: 0,
      freeSnapsDate: '',

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
        set((state) => {
          const today = todayStr();
          return {
            freeSnapsUsed: state.freeSnapsDate === today ? state.freeSnapsUsed + 1 : 1,
            freeSnapsDate: today,
          };
        }),

      clearProfile: () => set({ profile: null, isOnboarded: false, freeSnapsUsed: 0, freeSnapsDate: '' }),
    }),
    {
      name: 'zenova-user-storage',
      storage: createJSONStorage(() => secureStorage),
    }
  )
);
