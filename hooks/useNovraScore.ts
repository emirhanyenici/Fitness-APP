import { useMemo } from 'react';
import { useNutritionStore } from '../stores/nutritionStore';
import { useWorkoutStore } from '../stores/workoutStore';
import { useRecoveryStore } from '../stores/recoveryStore';
import { useUserStore } from '../stores/userStore';
import { computeTargets } from '../services/recommendations';
import { colors } from '../constants/colors';

export interface NovraScore {
  /** Normalized 0-100 score (based on 3 active pillars, sleep excluded until sensor available) */
  score: number;
  scoreColor: string;
  /** Raw pillar values (0-25 each) */
  foodScore: number;
  moveScore: number;
  moodScore: number;
  sleepScore: number;
  pillars: { label: string; value: number; color: string }[];
  /** vs yesterday delta */
  delta: number;
  deltaLabel: string;
  deltaColor: string;
  /** Calorie data for reuse */
  todayCalories: number;
  calPct: number;
  todayStr: string;
}

export function useNovraScore(): NovraScore {
  const entries        = useNutritionStore((s) => s.entries);
  const selectedType   = useWorkoutStore((s) => s.selectedType);
  const recoveryEntries = useRecoveryStore((s) => s.entries);
  const profile        = useUserStore((s) => s.profile);

  const targets = useMemo(() => computeTargets(profile), [profile]);

  // Stable date strings — computed once per hook call, not per render tick
  const todayStr     = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const yesterdayStr = useMemo(() => new Date(Date.now() - 86_400_000).toISOString().slice(0, 10), []);

  // ── Today ──────────────────────────────────────────────────────────────
  const todayEntries = useMemo(
    () => entries.filter((e) => e.date === todayStr),
    [entries, todayStr],
  );
  const todayCalories = useMemo(
    () => todayEntries.reduce((s, e) => s + e.calories, 0),
    [todayEntries],
  );
  const calPct = Math.min(todayCalories / targets.calories, 1);

  const foodScore  = Math.min(Math.round(calPct * 25), 25);
  // moveScore: 0 = no selection, 10 = rest day chosen, 25 = active workout chosen
  const moveScore  = selectedType === 'rest' ? 10 : selectedType ? 25 : 0;
  const todayRecovery = useMemo(
    () => recoveryEntries.find((e) => e.date === todayStr),
    [recoveryEntries, todayStr],
  );
  const moodScore  = todayRecovery ? Math.round(todayRecovery.mood * 5) : 0;
  const sleepScore = 0; // no sensor yet

  const rawScore = foodScore + moveScore + moodScore + sleepScore;
  // Score is the sum of all 4 pillars (each 0-25, total 0-100)
  const score = Math.min(rawScore, 100);

  const scoreColor =
    score >= 70 ? colors.score.excellent :
    score >= 50 ? colors.score.good :
    score >= 30 ? colors.score.fair :
    colors.score.poor;

  const pillars = [
    { label: 'Sleep', value: sleepScore, color: colors.accent.primary },
    { label: 'Food',  value: foodScore,  color: colors.status.success },
    { label: 'Move',  value: moveScore,  color: colors.status.warning },
    { label: 'Mood',  value: moodScore,  color: colors.violet.primary },
  ];

  // ── Yesterday ──────────────────────────────────────────────────────────
  const yEntries = useMemo(
    () => entries.filter((e) => e.date === yesterdayStr),
    [entries, yesterdayStr],
  );
  const yCalPct = Math.min(
    yEntries.reduce((s, e) => s + e.calories, 0) / targets.calories,
    1,
  );
  const yRecovery = useMemo(
    () => recoveryEntries.find((e) => e.date === yesterdayStr),
    [recoveryEntries, yesterdayStr],
  );
  const yFoodScore = Math.min(Math.round(yCalPct * 25), 25);
  const yMoodScore = yRecovery ? Math.round(yRecovery.mood * 5) : 0;
  const yRaw = yFoodScore + yMoodScore; // moveScore for yesterday unknowable
  const yesterdayScore = Math.min(yRaw, 100);

  const delta = score - yesterdayScore;
  const deltaLabel =
    delta > 0 ? `+${delta} ↑` :
    delta < 0 ? `${delta} ↓` :
    '= same as yesterday';
  const deltaColor =
    delta > 0 ? colors.status.success :
    delta < 0 ? colors.status.danger :
    colors.text.tertiary;

  return {
    score, scoreColor,
    foodScore, moveScore, moodScore, sleepScore,
    pillars,
    delta, deltaLabel, deltaColor,
    todayCalories, calPct,
    todayStr,
  };
}
