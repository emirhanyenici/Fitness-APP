/**
 * Unit tests for computeTargets — the BMR/TDEE/macro pipeline.
 * Focus: calorie floor enforcement, macro budget never exceeding the
 * calorie target (P0.4 regression), and gender-aware divergence.
 */
import { computeTargets, isValidHeightCm, isValidWeightKg } from '../services/recommendations';
import type { UserProfile } from '../stores/userStore';

const base = (over: Partial<UserProfile> = {}): UserProfile =>
  ({
    weight_kg: 70,
    height_cm: 175,
    age: 30,
    gender: 'male',
    primary_goal: 'general_health',
    workout_frequency: '3',
    ...over,
  } as UserProfile);

describe('computeTargets — calorie floor', () => {
  it('never drops below the 1200 kcal floor for aggressive weight loss', () => {
    // Small, sedentary female on a cut — the most aggressive deficit case.
    const t = computeTargets(
      base({ weight_kg: 40, height_cm: 145, gender: 'female', primary_goal: 'lose_weight', workout_frequency: '0' }),
    );
    expect(t.calories).toBeGreaterThanOrEqual(1200);
  });
});

describe('computeTargets — macro budget never exceeds calories (P0.4)', () => {
  const cases: Array<Partial<UserProfile>> = [
    { weight_kg: 40, height_cm: 145, gender: 'female', primary_goal: 'lose_weight', workout_frequency: '0' },
    { weight_kg: 45, height_cm: 150, gender: 'female', primary_goal: 'lose_weight', workout_frequency: '0' },
    { weight_kg: 50, height_cm: 155, gender: 'male',   primary_goal: 'lose_weight', workout_frequency: '0' },
    { weight_kg: 70, height_cm: 175, gender: 'male',   primary_goal: 'general_health', workout_frequency: '3' },
    { weight_kg: 90, height_cm: 185, gender: 'male',   primary_goal: 'gain_muscle', workout_frequency: '5' },
  ];

  it.each(cases)('macro kcal ≤ calorie target for %o', (over) => {
    const t = computeTargets(base(over));
    const macroCals = t.protein * 4 + t.carbs * 4 + t.fat * 9;
    // Allow a small rounding slack (per-macro Math.round can add a few kcal).
    expect(macroCals).toBeLessThanOrEqual(t.calories + 12);
  });

  it('keeps macros non-negative and protein as the priority macro', () => {
    const t = computeTargets(
      base({ weight_kg: 40, height_cm: 145, gender: 'female', primary_goal: 'lose_weight', workout_frequency: '0' }),
    );
    expect(t.carbs).toBeGreaterThanOrEqual(0);
    expect(t.fat).toBeGreaterThanOrEqual(0);
    expect(t.protein).toBeGreaterThan(0);
  });
});

describe('computeTargets — gender-aware divergence', () => {
  it('female TDEE/calories strictly lower than male for identical inputs', () => {
    const common = { weight_kg: 70, height_cm: 170, age: 30, primary_goal: 'general_health' as const, workout_frequency: '3' };
    const male   = computeTargets(base({ ...common, gender: 'male' }));
    const female = computeTargets(base({ ...common, gender: 'female' }));
    expect(female.calories).toBeLessThan(male.calories);
  });

  it('protein scales by goal-specific g/kg multiplier', () => {
    // gain_muscle uses 2.2 g/kg → 80kg * 2.2 = 176g
    const t = computeTargets(base({ weight_kg: 80, primary_goal: 'gain_muscle' }));
    expect(t.protein).toBe(176);
  });
});

describe('computeTargets — fallback', () => {
  it('returns defaults when profile lacks weight/height', () => {
    const t = computeTargets(null);
    expect(t.calories).toBe(2000);
  });
});

describe('height/weight plausibility validators (F13)', () => {
  it('accepts plausible values and the range bounds', () => {
    expect(isValidHeightCm(175)).toBe(true);
    expect(isValidHeightCm(100)).toBe(true);
    expect(isValidHeightCm(250)).toBe(true);
    expect(isValidWeightKg(70)).toBe(true);
    expect(isValidWeightKg(30)).toBe(true);
    expect(isValidWeightKg(300)).toBe(true);
  });

  it('rejects implausible, zero, negative and non-finite values', () => {
    expect(isValidHeightCm(1)).toBe(false);      // the "1 cm" bug
    expect(isValidHeightCm(99)).toBe(false);
    expect(isValidHeightCm(251)).toBe(false);
    expect(isValidHeightCm(0)).toBe(false);
    expect(isValidHeightCm(NaN)).toBe(false);
    expect(isValidWeightKg(9999)).toBe(false);   // the "9999 kg" bug
    expect(isValidWeightKg(29)).toBe(false);
    expect(isValidWeightKg(-70)).toBe(false);
    expect(isValidWeightKg(Infinity)).toBe(false);
  });
});
