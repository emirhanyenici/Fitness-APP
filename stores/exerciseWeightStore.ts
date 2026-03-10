import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { secureStorage } from '../services/secureStorage';

export interface ExerciseWeightEntry {
  date: string;       // YYYY-MM-DD
  weightKg: number;
}

interface ExerciseWeightStore {
  /** Map: exerciseName → last 20 entries (newest first) */
  logs: Record<string, ExerciseWeightEntry[]>;

  /** Returns the most recently logged weight for an exercise, or null */
  getLastWeight: (exerciseName: string) => number | null;

  /** Returns all logged entries for an exercise (newest first) */
  getHistory: (exerciseName: string) => ExerciseWeightEntry[];

  /** Log a weight for an exercise on today's date */
  logWeight: (exerciseName: string, weightKg: number) => void;

  clearLogs: () => void;
}

export const useExerciseWeightStore = create<ExerciseWeightStore>()(
  persist(
    (set, get) => ({
      logs: {},

      getLastWeight: (exerciseName) => {
        const entries = get().logs[exerciseName];
        return entries && entries.length > 0 ? entries[0].weightKg : null;
      },

      getHistory: (exerciseName) => {
        return get().logs[exerciseName] ?? [];
      },

      logWeight: (exerciseName, weightKg) => {
        const date = new Date().toISOString().slice(0, 10);
        set((state) => {
          const prev = state.logs[exerciseName] ?? [];
          // Replace today's entry if it exists, otherwise prepend
          const filtered = prev.filter((e) => e.date !== date);
          const updated = [{ date, weightKg }, ...filtered].slice(0, 20);
          return { logs: { ...state.logs, [exerciseName]: updated } };
        });
      },

      clearLogs: () => set({ logs: {} }),
    }),
    {
      name: 'novra-exercise-weight-storage',
      storage: createJSONStorage(() => secureStorage),
    }
  )
);

/** Simple AI-based starting weight suggestion.
 *  Uses bodyweight, gender, experience (workout_frequency), and equipment type.
 */
export function suggestWeight(
  equipment: string,
  muscle: string,
  bodyWeightKg: number,
  gender: 'male' | 'female' | 'other',
  workoutFrequency: number  // 0 | 2 | 3 | 5 | 6
): number {
  if (equipment === 'bodyweight') return 0;

  // Experience multiplier
  const xp = workoutFrequency >= 5 ? 1.3 : workoutFrequency >= 3 ? 1.0 : 0.65;
  // Gender modifier
  const gm = gender === 'female' ? 0.65 : 1.0;

  // Base = % of bodyweight per equipment
  const baseRatios: Record<string, number> = {
    barbell:    0.50,
    dumbbell:   0.18,
    cable:      0.15,
    machine:    0.30,
    kettlebell: 0.18,
    ezbar:      0.25,
  };
  const baseRatio = baseRatios[equipment] ?? 0.20;

  // Leg exercises get more weight than upper body
  const isLeg = /quad|hamstring|glute|leg|calf/i.test(muscle);
  const muscleMod = isLeg ? 1.4 : 1.0;

  const raw = bodyWeightKg * baseRatio * xp * gm * muscleMod;
  // Round to nearest 2.5 kg
  return Math.max(2.5, Math.round(raw / 2.5) * 2.5);
}
