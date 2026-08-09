import type { IconComponent } from '../components/ui/Icon';
import { Flame, Target, Dumbbell, UtensilsCrossed } from '../components/ui/Icon';

export type AchievementCategory = 'streak' | 'weightGoal' | 'workoutCount' | 'nutritionCount';

export interface AchievementDef {
  id: string;
  category: AchievementCategory;
  /** Threshold this badge represents — day count, log count, or 1 for the single weight-goal badge */
  threshold: number;
  titleKey: string;
  descKey: string;
  icon: IconComponent;
}

export const STREAK_MILESTONES = [3, 7, 14, 30, 60, 100] as const;
export const WORKOUT_COUNT_MILESTONES = [10, 50, 100] as const;
export const NUTRITION_COUNT_MILESTONES = [10, 50, 100] as const;

export const ACHIEVEMENTS: AchievementDef[] = [
  ...STREAK_MILESTONES.map((n) => ({
    id: `streak_${n}`,
    category: 'streak' as const,
    threshold: n,
    titleKey: `achievements.streak_${n}.title`,
    descKey: `achievements.streak_${n}.desc`,
    icon: Flame,
  })),
  {
    id: 'weight_goal',
    category: 'weightGoal',
    threshold: 1,
    titleKey: 'achievements.weight_goal.title',
    descKey: 'achievements.weight_goal.desc',
    icon: Target,
  },
  ...WORKOUT_COUNT_MILESTONES.map((n) => ({
    id: `workout_count_${n}`,
    category: 'workoutCount' as const,
    threshold: n,
    titleKey: `achievements.workout_count_${n}.title`,
    descKey: `achievements.workout_count_${n}.desc`,
    icon: Dumbbell,
  })),
  ...NUTRITION_COUNT_MILESTONES.map((n) => ({
    id: `nutrition_count_${n}`,
    category: 'nutritionCount' as const,
    threshold: n,
    titleKey: `achievements.nutrition_count_${n}.title`,
    descKey: `achievements.nutrition_count_${n}.desc`,
    icon: UtensilsCrossed,
  })),
];

export function findAchievement(id: string): AchievementDef | undefined {
  return ACHIEVEMENTS.find((a) => a.id === id);
}
