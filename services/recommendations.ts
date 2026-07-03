import { UserProfile } from '../stores/userStore';

export interface DailyTargets {
  calories:          number;  // kcal/day
  protein:           number;  // g/day
  carbs:             number;  // g/day
  fat:               number;  // g/day
  sleepHours:        number;  // h/night
  workoutDaysPerWeek:number;
  workoutMinutes:    number;  // per session
  waterGlasses:      number;
}

// Maps workout_frequency chip value → TDEE activity multiplier
const ACTIVITY_MULT: Record<string, number> = {
  '0': 1.2,
  '2': 1.375,
  '3': 1.55,
  '5': 1.725,
  '6': 1.9,   // athlete / 6-7 days
};

export const GOAL_LABELS: Record<string, string> = {
  lose_weight:    'Weight Loss',
  gain_muscle:    'Muscle Gain',
  improve_energy: 'Energy Boost',
  better_sleep:   'Better Sleep',
  reduce_stress:  'Stress Relief',
  general_health: 'Healthy Lifestyle',
};

const DEFAULTS: DailyTargets = {
  calories: 2000, protein: 160, carbs: 200, fat: 65,
  sleepHours: 8, workoutDaysPerWeek: 3, workoutMinutes: 45, waterGlasses: 8,
};

/**
 * Compute personalized daily targets from the user's profile.
 * Falls back to sensible defaults when profile data is incomplete.
 */
export function computeTargets(profile: UserProfile | null): DailyTargets {
  if (!profile?.weight_kg || !profile?.height_cm) return DEFAULTS;

  // Guarded above, so both are defined here; the `!` keeps the destructured
  // bindings narrowed to `number` (the guard's narrowing doesn't carry over).
  const {
    weight_kg = profile.weight_kg!,
    height_cm = profile.height_cm!,
    primary_goal = 'general_health',
    workout_frequency = '3',
  } = profile as UserProfile & { workout_frequency?: string };

  // Mifflin-St Jeor BMR — gender-aware
  // Uses real age from profile when available, falls back to 30 as a safe default
  const age       = typeof profile.age === 'number' && profile.age > 0 ? profile.age : 30;
  const genderAdj = profile.gender === 'female' ? -161 : 5; // female: -161, male/other: +5
  const bmr       = 10 * weight_kg + 6.25 * height_cm - 5 * age + genderAdj;
  const actMult = ACTIVITY_MULT[String(workout_frequency)] ?? 1.375;
  const tdee    = Math.round((bmr * actMult) / 50) * 50; // round to nearest 50 kcal

  let calories:           number;
  let proteinPerKg:       number;
  let sleepHours:         number;
  let workoutDaysPerWeek: number;
  let workoutMinutes:     number;

  switch (primary_goal) {
    case 'lose_weight':
      calories           = Math.max(Math.round((tdee - 400) / 50) * 50, 1200);
      proteinPerKg       = 2.0;
      sleepHours         = 8;
      workoutDaysPerWeek = 4;
      workoutMinutes     = 45;
      break;
    case 'gain_muscle':
      calories           = Math.round((tdee + 300) / 50) * 50;
      proteinPerKg       = 2.2;
      sleepHours         = 8.5;
      workoutDaysPerWeek = 4;
      workoutMinutes     = 60;
      break;
    case 'improve_energy':
      calories           = tdee;
      proteinPerKg       = 1.8;
      sleepHours         = 8.5;
      workoutDaysPerWeek = 3;
      workoutMinutes     = 40;
      break;
    case 'better_sleep':
      calories           = tdee;
      proteinPerKg       = 1.6;
      sleepHours         = 9;
      workoutDaysPerWeek = 3;
      workoutMinutes     = 30;
      break;
    case 'reduce_stress':
      calories           = tdee;
      proteinPerKg       = 1.6;
      sleepHours         = 8.5;
      workoutDaysPerWeek = 3;
      workoutMinutes     = 30;
      break;
    default: // general_health
      calories           = tdee;
      proteinPerKg       = 1.6;
      sleepHours         = 8;
      workoutDaysPerWeek = 3;
      workoutMinutes     = 45;
  }

  const protein      = Math.round(weight_kg * proteinPerKg);
  const proteinCals  = protein * 4;
  const remaining    = Math.max(calories - proteinCals, 0);
  let   carbs        = Math.max(Math.round((remaining * 0.55) / 4), 50);
  let   fat          = Math.max(Math.round((remaining * 0.45) / 9), 30); // 55% carbs + 45% fat = 100% of remaining

  // The carbs/fat floors (50g / 30g) can push the macro total above the
  // calorie target on aggressive cuts (small frame + 1200 kcal floor).
  // Protein is fixed (priority macro); trim the flex macros so the sum
  // never exceeds `calories`. Carbs are trimmed first (down to their
  // floor), then fat — both stay ≥ 0. If even protein + both floors
  // exceed `calories`, the floors win (a documented, rare edge case the
  // 1200 kcal floor already guards against in practice).
  let overBudget = proteinCals + carbs * 4 + fat * 9 - calories;
  if (overBudget > 0) {
    const carbTrim = Math.min(Math.ceil(overBudget / 4), carbs);
    carbs     -= carbTrim;
    overBudget -= carbTrim * 4;
  }
  if (overBudget > 0) {
    const fatTrim = Math.min(Math.ceil(overBudget / 9), fat);
    fat -= fatTrim;
  }

  return { calories, protein, carbs, fat, sleepHours, workoutDaysPerWeek, workoutMinutes, waterGlasses: 8 };
}
