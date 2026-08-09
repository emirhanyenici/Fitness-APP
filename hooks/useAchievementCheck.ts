import { useEffect, useState } from 'react';
import { useNutritionStore } from '../stores/nutritionStore';
import { useRecoveryStore } from '../stores/recoveryStore';
import { useWorkoutStore } from '../stores/workoutStore';
import { useUserStore } from '../stores/userStore';
import { useAchievementStore } from '../stores/achievementStore';
import { evaluateAchievements } from '../services/achievements';
import { findAchievement, type AchievementDef } from '../constants/achievements';
import { computeStreak, todayStr } from '../services/dateUtils';
import { hapticSuccess } from '../services/haptics';

/**
 * Watches the stores achievements are derived from and unlocks any that
 * newly qualify. Mounted once in app/_layout.tsx so unlocks are detected
 * regardless of which tab is open. Returns a one-at-a-time celebration
 * queue for the UI to render (AchievementUnlockModal).
 */
export function useAchievementCheck() {
  const entries = useNutritionStore((s) => s.entries);
  const recoveryEntries = useRecoveryStore((s) => s.entries);
  const totalWorkoutsLogged = useWorkoutStore((s) => s.totalWorkoutsLogged);
  const profile = useUserStore((s) => s.profile);
  const unlocked = useAchievementStore((s) => s.unlocked);
  const unlock = useAchievementStore((s) => s.unlock);

  const [queue, setQueue] = useState<AchievementDef[]>([]);

  useEffect(() => {
    const activeDates = new Set([
      ...entries.map((e) => e.date),
      ...recoveryEntries.map((e) => e.date),
    ]);
    const streakDays = computeStreak(activeDates, todayStr());

    const newlyUnlockedIds = evaluateAchievements({
      streakDays,
      workoutCount: totalWorkoutsLogged,
      nutritionCount: entries.length,
      weightKg: profile?.weight_kg,
      goalWeightKg: profile?.goal_weight_kg,
      alreadyUnlocked: unlocked,
    });
    if (newlyUnlockedIds.length === 0) return;

    const defs = newlyUnlockedIds
      .map(findAchievement)
      .filter((d): d is AchievementDef => d !== undefined);
    defs.forEach((d) => unlock(d.id));
    hapticSuccess();
    setQueue((q) => [...q, ...defs]);
  }, [entries, recoveryEntries, totalWorkoutsLogged, profile?.weight_kg, profile?.goal_weight_kg, unlocked, unlock]);

  return {
    current: queue[0] ?? null,
    dismiss: () => setQueue((q) => q.slice(1)),
  };
}
