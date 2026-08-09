import { useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useUserStore } from '../stores/userStore';
import { useNutritionStore } from '../stores/nutritionStore';
import { useWorkoutStore } from '../stores/workoutStore';
import { useRecoveryStore } from '../stores/recoveryStore';
import { useWeightLogStore } from '../stores/weightLogStore';
import { useMeasurementLogStore } from '../stores/measurementLogStore';
import { computeTargets } from '../services/recommendations';
import { detectPlateau, suggestAdjustment, computeFatigueScore } from '../services/progressUtils';
import { computeStreak, todayStr } from '../services/dateUtils';
import { computeWeekData } from '../services/weeklyReport';
import { computeEffortScore, countDaysWithinCalorieTarget } from '../services/leaderboardScore';
import { upsertMyStats } from '../services/leaderboard';

/**
 * Pushes the current user's leaderboard stats whenever opted in and the
 * underlying data changes (same dependency-on-real-data pattern as
 * useAchievementCheck) — not just once per cold start, since the relevant
 * stores rehydrate from secureStorage asynchronously and independently of
 * the profile flag; depending only on the opt-in flag risked pushing a
 * stale/zero snapshot if it resolved before the data stores did. No
 * debounce — a leaderboard row doesn't need sub-second freshness, just to
 * never ship provably-wrong data for the rest of the session.
 */
export function useLeaderboardSync() {
  const userId = useAuthStore((s) => s.user?.id);
  const profile = useUserStore((s) => s.profile);
  const entries = useNutritionStore((s) => s.entries);
  const workoutHistory = useWorkoutStore((s) => s.history);
  const recoveryEntries = useRecoveryStore((s) => s.entries);
  const weightEntries = useWeightLogStore((s) => s.entries);
  const measurementEntries = useMeasurementLogStore((s) => s.entries);

  useEffect(() => {
    if (!userId || !profile?.leaderboard_optin || !profile.leaderboard_nickname) return;

    const activeDates = new Set([
      ...entries.map((e) => e.date),
      ...recoveryEntries.map((e) => e.date),
    ]);
    const streakDays = computeStreak(activeDates, todayStr());

    const targets = computeTargets(profile);
    const { stats } = computeWeekData({
      entries,
      workoutHistory,
      recoveryEntries,
      weightEntries,
      measurementEntries,
      targets: { calories: targets.calories, sleepHours: targets.sleepHours },
    });

    const plateau = detectPlateau(weightEntries);
    const fatigueScore = computeFatigueScore(recoveryEntries);
    const adjustment = suggestAdjustment(profile.primary_goal ?? 'general_health', plateau, targets.calories, fatigueScore);
    const daysWithinCalorieTarget = countDaysWithinCalorieTarget(entries, targets.calories);
    const effortScore = computeEffortScore({
      streakDays,
      daysWithinCalorieTarget,
      onTrack: adjustment.action === 'none',
    });

    void upsertMyStats(userId, profile.leaderboard_nickname, streakDays, stats.avgScore, effortScore);
  }, [
    userId, profile?.leaderboard_optin, profile?.leaderboard_nickname, profile?.primary_goal,
    entries, workoutHistory, recoveryEntries, weightEntries, measurementEntries,
  ]);
}
