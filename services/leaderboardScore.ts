import { daysAgoStr } from './dateUtils';

/**
 * Counts how many of the last `days` calendar days had food logged within
 * ±15% of the calorie target. Unlogged days don't count either way — this
 * measures adherence on days the user actually tracked, not raw compliance.
 */
export function countDaysWithinCalorieTarget(
  entries: { date: string; calories: number }[],
  targetCalories: number,
  days = 7,
): number {
  if (targetCalories <= 0) return 0;
  const tolerance = targetCalories * 0.15;
  let count = 0;
  for (let i = 0; i < days; i++) {
    const date = daysAgoStr(i);
    const dayCalories = entries.filter((e) => e.date === date).reduce((s, e) => s + e.calories, 0);
    if (dayCalories > 0 && Math.abs(dayCalories - targetCalories) <= tolerance) count++;
  }
  return count;
}

export interface EffortScoreInput {
  streakDays: number;
  /** 0-7: how many of the last 7 logged days fell within ±15% of the calorie target */
  daysWithinCalorieTarget: number;
  /** suggestAdjustment(...).action === 'none' — reuses progressUtils' existing plateau/fatigue signal */
  onTrack: boolean;
}

const STREAK_CAP_DAYS = 30;
const STREAK_WEIGHT = 40;
const ADHERENCE_DAYS = 7;
const ADHERENCE_WEIGHT = 30;
const ON_TRACK_WEIGHT = 30;

/**
 * Blends consistency (streak), calorie-target adherence, and the app's
 * existing plateau/fatigue "on track" signal into a single 0-100 score —
 * rewards users making good progress toward their own goal, not just raw
 * streak/LifeScore totals.
 */
export function computeEffortScore(input: EffortScoreInput): number {
  const streakPart    = (Math.min(Math.max(input.streakDays, 0), STREAK_CAP_DAYS) / STREAK_CAP_DAYS) * STREAK_WEIGHT;
  const adherencePart = (Math.min(Math.max(input.daysWithinCalorieTarget, 0), ADHERENCE_DAYS) / ADHERENCE_DAYS) * ADHERENCE_WEIGHT;
  const onTrackPart   = input.onTrack ? ON_TRACK_WEIGHT : 0;
  return Math.round(Math.min(100, streakPart + adherencePart + onTrackPart));
}
