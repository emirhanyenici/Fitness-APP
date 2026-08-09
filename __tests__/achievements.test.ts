/**
 * Unit tests for evaluateAchievements — boundary checks per category, and
 * making sure already-unlocked ids never re-fire.
 */
import { evaluateAchievements } from '../services/achievements';

const base = (over: Partial<Parameters<typeof evaluateAchievements>[0]> = {}) => ({
  streakDays: 0,
  workoutCount: 0,
  nutritionCount: 0,
  alreadyUnlocked: {},
  ...over,
});

describe('evaluateAchievements — streak milestones', () => {
  it('does not unlock 7-day streak at 6 days', () => {
    expect(evaluateAchievements(base({ streakDays: 6 }))).not.toContain('streak_7');
  });

  it('unlocks 7-day streak at exactly 7 days', () => {
    expect(evaluateAchievements(base({ streakDays: 7 }))).toContain('streak_7');
  });

  it('unlocks every milestone at or below the current streak', () => {
    const ids = evaluateAchievements(base({ streakDays: 30 }));
    expect(ids).toEqual(expect.arrayContaining(['streak_3', 'streak_7', 'streak_14', 'streak_30']));
    expect(ids).not.toContain('streak_60');
  });

  it('never re-fires an already-unlocked streak milestone', () => {
    const ids = evaluateAchievements(base({ streakDays: 30, alreadyUnlocked: { streak_7: '2026-01-01T00:00:00.000Z' } }));
    expect(ids).not.toContain('streak_7');
    expect(ids).toContain('streak_14');
  });
});

describe('evaluateAchievements — workout/nutrition counts', () => {
  it('unlocks workout_count_10 at exactly 10 logged workouts', () => {
    expect(evaluateAchievements(base({ workoutCount: 10 }))).toContain('workout_count_10');
  });

  it('does not unlock workout_count_10 at 9', () => {
    expect(evaluateAchievements(base({ workoutCount: 9 }))).not.toContain('workout_count_10');
  });

  it('unlocks nutrition_count_50 at 50 logged meals', () => {
    expect(evaluateAchievements(base({ nutritionCount: 50 }))).toContain('nutrition_count_50');
  });
});

describe('evaluateAchievements — weight goal', () => {
  it('does not unlock when no goal is set', () => {
    expect(evaluateAchievements(base({ weightKg: 70 }))).not.toContain('weight_goal');
  });

  it('unlocks when current weight matches a loss goal', () => {
    expect(evaluateAchievements(base({ weightKg: 65, goalWeightKg: 65 }))).toContain('weight_goal');
  });

  it('unlocks when current weight matches a gain goal', () => {
    expect(evaluateAchievements(base({ weightKg: 80, goalWeightKg: 80 }))).toContain('weight_goal');
  });

  it('unlocks within the half-kilo tolerance', () => {
    expect(evaluateAchievements(base({ weightKg: 65.4, goalWeightKg: 65 }))).toContain('weight_goal');
  });

  it('does not unlock when still far from the goal', () => {
    expect(evaluateAchievements(base({ weightKg: 70, goalWeightKg: 65 }))).not.toContain('weight_goal');
  });

  it('never re-fires an already-unlocked weight goal', () => {
    expect(evaluateAchievements(base({
      weightKg: 65, goalWeightKg: 65, alreadyUnlocked: { weight_goal: '2026-01-01T00:00:00.000Z' },
    }))).not.toContain('weight_goal');
  });
});
