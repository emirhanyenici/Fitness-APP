import { WeightEntry } from '../stores/weightLogStore';
import { RecoveryEntry } from '../stores/recoveryStore';
import { dateStr } from './dateUtils';

/**
 * Returns true when the user's weight hasn't changed meaningfully
 * over the last `weeks` weeks (delta < 0.5 kg).
 * Requires at least 2 entries separated by the specified period.
 */
export function detectPlateau(entries: WeightEntry[], weeks = 3): boolean {
  if (entries.length < 2) return false;

  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const latest = sorted[sorted.length - 1];
  const cutoff = new Date(latest.date);
  cutoff.setDate(cutoff.getDate() - weeks * 7);
  const cutoffStr = dateStr(cutoff);

  // `sorted` is ascending by date, so find() returns the *oldest* entry that is
  // at or before the cutoff — i.e. the reference point `weeks` weeks back to
  // compare the latest weight against. (Reads like it might grab the newest, but
  // ascending order guarantees it's the earliest qualifying entry.)
  const earliest = sorted.find((e) => e.date <= cutoffStr);
  if (!earliest) return false;

  return Math.abs(latest.weight_kg - earliest.weight_kg) < 0.5;
}

export interface AdjustmentSuggestion {
  calorieAdj: number;       // negative = cut, 0 = no change
  message: string;
  action: 'cut' | 'cardio' | 'deload' | 'none';
}

/**
 * Returns a coaching suggestion based on plateau state and fatigue.
 *
 * fatigueScore: average of (6 - energy) over last 7 days (1 = low fatigue, 5 = high).
 * Values above 3.5 indicate the user is consistently tired.
 */
export function suggestAdjustment(
  goal: string,
  plateau: boolean,
  currentCalories: number,
  fatigueScore: number,
): AdjustmentSuggestion {
  // Fatigue overrides everything — always recommend recovery first
  if (fatigueScore > 3.5) {
    return {
      calorieAdj: 0,
      action: 'deload',
      message:
        'Your energy levels have been low for several days. Consider a deload week — reduce training volume by 40% and prioritise sleep and nutrition.',
    };
  }

  if (!plateau) {
    return { calorieAdj: 0, action: 'none', message: 'Progress is on track. Keep it up!' };
  }

  if (goal === 'lose_weight') {
    const cut = Math.round(currentCalories * 0.075); // 7.5% deficit
    return {
      calorieAdj: -cut,
      action: 'cut',
      message: `Weight has been stable for 3 weeks. Try reducing daily calories by ${cut} kcal (to ${currentCalories - cut} kcal) or adding one extra cardio session per week.`,
    };
  }

  if (goal === 'gain_muscle') {
    return {
      calorieAdj: 0,
      action: 'cardio',
      message:
        'Strength progress has stalled. Consider adding a progressive overload week — increase working weight by 2.5–5% on your main lifts, or reduce rep range to 4–6 for 2 weeks.',
    };
  }

  return {
    calorieAdj: 0,
    action: 'cardio',
    message:
      'Progress has slowed. Try adding a HIIT session or increasing workout intensity to break through the plateau.',
  };
}

/**
 * Compute a fatigue score (1–5) from the last N recovery entries.
 * Higher = more fatigued. Based on inverted energy ratings.
 */
export function computeFatigueScore(entries: RecoveryEntry[], days = 7): number {
  const recent = [...entries]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, days);

  if (recent.length === 0) return 1;

  const avg = recent.reduce((sum, e) => sum + e.energy, 0) / recent.length;
  return parseFloat((6 - avg).toFixed(1)); // invert: high energy = low fatigue
}
