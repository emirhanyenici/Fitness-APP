import { useMemo } from 'react';
import { useNutritionStore } from '../stores/nutritionStore';
import { useWorkoutStore } from '../stores/workoutStore';
import { useRecoveryStore } from '../stores/recoveryStore';
import { useUserStore } from '../stores/userStore';
import { computeTargets } from '../services/recommendations';
import { daysAgoStr } from '../services/dateUtils';
import { colors } from '../constants/colors';

export interface ZenovaScore {
  /** Normalized 0-100 score: sum of the 4 pillars (Sleep/Food/Move/Mood, 0-25 each) */
  score: number;
  scoreColor: string;
  /** Raw pillar values (0-25 each) */
  foodScore: number;
  moveScore: number;
  moodScore: number;
  sleepScore: number;
  /** labelKey is an i18n key — render with t(p.labelKey) */
  pillars: { labelKey: string; value: number; color: string }[];
  /** vs yesterday delta */
  delta: number;
  deltaColor: string;
  /** Calorie data for reuse */
  todayCalories: number;
  calPct: number;
  todayStr: string;
}

export interface DayScoreInputs {
  entries: { date: string; calories: number }[];
  workoutHistory: { date: string }[];
  recoveryEntries: { date: string; mood: number; sleepHours?: number }[];
  targets: { calories: number; sleepHours: number };
  /**
   * Whether the current workout-type selection is 'rest'. The selection is a
   * sticky, date-less preference (workoutStore.selectedType), so the credit is
   * applied uniformly to every day it's asked about — that keeps the hero
   * score, the vs-yesterday delta and the trend chart mutually consistent
   * (a rest selection can never manufacture a fake "+10 ↑" day-over-day).
   */
  restDaySelected?: boolean;
}

export interface DayScore {
  foodScore: number;
  moveScore: number;
  moodScore: number;
  sleepScore: number;
  score: number;
}

/**
 * Single source of truth for a day's LifeScore. Used by useZenovaScore (today
 * + yesterday delta) and the Home trend chart — do NOT re-derive the formula
 * elsewhere or the trend/hero/delta numbers will drift apart.
 */
export function computeDayScore(date: string, inp: DayScoreInputs): DayScore {
  const cal = inp.entries
    .filter((e) => e.date === date)
    .reduce((s, e) => s + e.calories, 0);
  const calPct = inp.targets.calories > 0 ? Math.min(cal / inp.targets.calories, 1) : 0;
  const foodScore = Math.min(Math.round(calPct * 25), 25);

  // moveScore: 25 = workout completed that day, 10 = rest day selected, 0 = none
  const moveScore = inp.workoutHistory.some((w) => w.date === date)
    ? 25
    : inp.restDaySelected ? 10 : 0;

  const rec = inp.recoveryEntries.find((e) => e.date === date);
  const moodScore = rec ? Math.round(rec.mood * 5) : 0;

  const sleepScore = rec?.sleepHours && inp.targets.sleepHours
    ? Math.min(Math.round((rec.sleepHours / inp.targets.sleepHours) * 25), 25)
    : 0;

  return {
    foodScore, moveScore, moodScore, sleepScore,
    score: Math.min(foodScore + moveScore + moodScore + sleepScore, 100),
  };
}

/**
 * Formats the vs-yesterday delta for display. Returns the numeric arrow form
 * for non-zero deltas and the given translated "same as yesterday" string for
 * zero — call as formatDeltaLabel(delta, t('score.sameAsYesterday')).
 */
export function formatDeltaLabel(delta: number, sameLabel: string): string {
  if (delta > 0) return `+${delta} ↑`;
  if (delta < 0) return `${delta} ↓`;
  return sameLabel;
}

export function useZenovaScore(): ZenovaScore {
  const entries         = useNutritionStore((s) => s.entries);
  const selectedType    = useWorkoutStore((s) => s.selectedType);
  const workoutHistory  = useWorkoutStore((s) => s.history);
  const recoveryEntries = useRecoveryStore((s) => s.entries);
  const profile         = useUserStore((s) => s.profile);

  const targets = useMemo(() => computeTargets(profile), [profile]);

  // Recomputed on every render — avoids stale dates after midnight.
  const todayStr     = daysAgoStr(0);
  const yesterdayStr = daysAgoStr(1);

  const dayInputs: DayScoreInputs = useMemo(() => ({
    entries,
    workoutHistory,
    recoveryEntries,
    targets: { calories: targets.calories, sleepHours: targets.sleepHours },
    restDaySelected: selectedType === 'rest',
  }), [entries, workoutHistory, recoveryEntries, targets, selectedType]);

  const today = useMemo(
    () => computeDayScore(todayStr, dayInputs),
    [todayStr, dayInputs],
  );
  const yesterday = useMemo(
    () => computeDayScore(yesterdayStr, dayInputs),
    [yesterdayStr, dayInputs],
  );

  const { foodScore, moveScore, moodScore, sleepScore, score } = today;

  const todayCalories = useMemo(
    () => entries.filter((e) => e.date === todayStr).reduce((s, e) => s + e.calories, 0),
    [entries, todayStr],
  );
  const calPct = Math.min(todayCalories / targets.calories, 1);

  const scoreColor =
    score >= 70 ? colors.score.excellent :
    score >= 50 ? colors.score.good :
    score >= 30 ? colors.score.fair :
    colors.score.poor;

  const pillars = [
    { labelKey: 'score.pillarSleep', value: sleepScore, color: colors.accent.primary },
    { labelKey: 'score.pillarFood',  value: foodScore,  color: colors.status.success },
    { labelKey: 'score.pillarMove',  value: moveScore,  color: colors.status.warning },
    { labelKey: 'score.pillarMood',  value: moodScore,  color: colors.violet.primary },
  ];

  const delta = score - yesterday.score;
  const deltaColor =
    delta > 0 ? colors.status.success :
    delta < 0 ? colors.status.danger :
    colors.text.tertiary;

  return {
    score, scoreColor,
    foodScore, moveScore, moodScore, sleepScore,
    pillars,
    delta, deltaColor,
    todayCalories, calPct,
    todayStr,
  };
}
