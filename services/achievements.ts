import { ACHIEVEMENTS } from '../constants/achievements';

export interface AchievementProgressInput {
  streakDays: number;
  workoutCount: number;
  nutritionCount: number;
  weightKg?: number;
  goalWeightKg?: number;
  alreadyUnlocked: Record<string, string>;
}

/** Weight goal counts as hit once within half a kilo of the target, regardless of loss/gain direction. */
const WEIGHT_GOAL_TOLERANCE_KG = 0.5;

function hasHitWeightGoal(current: number, goal: number): boolean {
  return Math.abs(current - goal) <= WEIGHT_GOAL_TOLERANCE_KG;
}

/**
 * Returns the ids of achievements that newly qualify given the current stats,
 * excluding anything already in `alreadyUnlocked`. Pure function — no store
 * reads/writes — so it's easy to unit test and to call from a hook.
 */
export function evaluateAchievements(input: AchievementProgressInput): string[] {
  const newly: string[] = [];

  for (const a of ACHIEVEMENTS) {
    if (input.alreadyUnlocked[a.id]) continue;

    let qualifies = false;
    switch (a.category) {
      case 'streak':
        qualifies = input.streakDays >= a.threshold;
        break;
      case 'workoutCount':
        qualifies = input.workoutCount >= a.threshold;
        break;
      case 'nutritionCount':
        qualifies = input.nutritionCount >= a.threshold;
        break;
      case 'weightGoal':
        if (input.weightKg !== undefined && input.goalWeightKg !== undefined) {
          qualifies = hasHitWeightGoal(input.weightKg, input.goalWeightKg);
        }
        break;
    }

    if (qualifies) newly.push(a.id);
  }

  return newly;
}
