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
  // Tracks the distinct ORIGINAL plan names merged into each day's entry —
  // `existing.name` gets overwritten to a concatenated string ("PlanA + PlanB")
  // on the first cross-plan merge, so comparing a later workout's name against
  // `existing.name` directly would wrongly call a repeat of "PlanA" a "new"
  // plan once "PlanB" has already been merged in.
  const basePlans = new Map<string, Set<string>>();
  for (const w of history) {
    const existing = map.get(w.date);
    if (!existing) {
      map.set(w.date, { ...w, exerciseWeights: { ...w.exerciseWeights } });
      basePlans.set(w.date, new Set([w.name]));
    } else {
      const plans = basePlans.get(w.date)!;
      const isSamePlan = plans.has(w.name);
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
        plans.add(w.name);
      }
    }
  }
  return Array.from(map.values());
}
