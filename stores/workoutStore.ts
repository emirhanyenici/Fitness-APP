import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { secureStorage } from '../services/secureStorage';
import { ProgramType } from '../services/workoutPrograms';

export interface CompletedWorkout {
  id: string;
  name: string;
  icon: string;
  bodyPart: string;
  duration: string;
  calories: number;
  exercisesDone: number;
  exercisesTotal: number;
  date: string;        // ISO date string YYYY-MM-DD
  timestamp: number;   // Date.now()
  /** Weights used per exercise: exerciseName → kg (0 = bodyweight) */
  exerciseWeights?: Record<string, number>;
}

interface WorkoutStore {
  /** Workout type set from log-workout modal (overrides goal-based default) */
  selectedType: string | null;
  setSelectedType: (type: string | null) => void;

  /** Selected workout program */
  selectedProgram: ProgramType | null;
  setSelectedProgram: (program: ProgramType | null) => void;

  /** Completed workout history */
  history: CompletedWorkout[];
  addWorkout: (workout: Omit<CompletedWorkout, 'id' | 'date' | 'timestamp'>) => void;
  clearHistory: () => void;
}

export const useWorkoutStore = create<WorkoutStore>()(
  persist(
    (set) => ({
      selectedType: null,
      setSelectedType: (type) => set({ selectedType: type }),

      selectedProgram: null,
      setSelectedProgram: (program) => set({ selectedProgram: program }),

      history: [],
      addWorkout: (workout) =>
        set((state) => ({
          history: [
            {
              ...workout,
              id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
              date: new Date().toISOString().slice(0, 10),
              timestamp: Date.now(),
            },
            ...state.history,
          ].slice(0, 50), // keep last 50 workouts
        })),
      clearHistory: () => set({ history: [], selectedType: null, selectedProgram: null }),
    }),
    {
      name: 'novra-workout-storage',
      storage: createJSONStorage(() => secureStorage),
    }
  )
);
