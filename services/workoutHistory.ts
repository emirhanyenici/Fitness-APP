import type { CompletedWorkout } from '../stores/workoutStore';
import { todayStr, daysAgoStr } from './dateUtils';

export function formatWorkoutDate(dateStr: string): string {
  const today = todayStr();
  const yesterday = daysAgoStr(1);
  if (dateStr === today) return 'Today';
  if (dateStr === yesterday) return 'Yesterday';
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' });
}

/** Merge multiple workouts from the same day into one summary entry */
export function groupByDate(history: CompletedWorkout[]): CompletedWorkout[] {
  const map = new Map<string, CompletedWorkout>();
  for (const w of history) {
    const existing = map.get(w.date);
    if (!existing) {
      map.set(w.date, { ...w, exerciseWeights: { ...w.exerciseWeights } });
    } else {
      const isSamePlan = existing.name === w.name;
      existing.calories += w.calories;
      const merged = { ...existing.exerciseWeights };
      for (const [name, kg] of Object.entries(w.exerciseWeights ?? {})) {
        if (kg > 0) merged[name] = kg;
      }
      existing.exerciseWeights = merged;

      if (isSamePlan) {
        // Same plan repeated — cap done at plan size, keep total fixed
        existing.exercisesDone  = Math.min(existing.exercisesDone + w.exercisesDone, existing.exercisesTotal);
      } else {
        // Different plan — accumulate both counts
        existing.exercisesDone  += w.exercisesDone;
        existing.exercisesTotal += w.exercisesTotal;
        // Use the stored dayLabel; fall back to legacy string-parse for old records.
        const dayPart = w.dayLabel ?? w.name.split('—')[1]?.trim() ?? w.name;
        existing.name = existing.name + ' + ' + dayPart;
      }
    }
  }
  return Array.from(map.values());
}
