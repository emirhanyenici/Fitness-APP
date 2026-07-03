import type { TFunction } from '../constants/i18n';

/**
 * Rule-based weekly report, generated fully on-device.
 *
 * The weekly-report modal first tries the ai-coach edge function; until that
 * is deployed (no Anthropic key yet) — or whenever the network/server fails —
 * this local generator produces the report instead, so the feature always
 * works. Output is plain text (the screen renders it in a <Text>, so no
 * markdown syntax here).
 */

export interface WeekStats {
  /** Days (0-7) with any food or workout logged. */
  daysLogged: number;
  /** Average calories across days that logged food; 0 when none. */
  avgCalories: number;
  totalWorkouts: number;
  /** Average mood 1-5 across logged days; 0 when none. */
  avgMood: number;
  /** Average sleep hours across logged days; 0 when none. */
  avgSleep: number;
}

export interface ReportTargets {
  calories: number;
  sleepHours: number;
}

export function buildLocalWeeklyReport(
  stats: WeekStats,
  targets: ReportTargets,
  t: TFunction,
): string {
  const { daysLogged, avgCalories, totalWorkouts, avgMood, avgSleep } = stats;

  if (daysLogged === 0) return t('weeklyReport.local.noData');

  const calRatio = targets.calories > 0 ? avgCalories / targets.calories : 0;

  // ── Wins (max 3, highest-signal first) ──
  const wins: string[] = [];
  if (totalWorkouts >= 3) wins.push(t('weeklyReport.local.winWorkouts', { count: totalWorkouts }));
  if (daysLogged >= 5) wins.push(t('weeklyReport.local.winConsistency', { days: daysLogged }));
  if (avgSleep >= targets.sleepHours) wins.push(t('weeklyReport.local.winSleep', { hours: avgSleep.toFixed(1) }));
  if (avgMood >= 4) wins.push(t('weeklyReport.local.winMood', { mood: avgMood.toFixed(1) }));
  if (avgCalories > 0 && calRatio >= 0.9 && calRatio <= 1.1) {
    wins.push(t('weeklyReport.local.winCalories', { target: targets.calories }));
  }
  if (wins.length === 0) wins.push(t('weeklyReport.local.winShowedUp', { days: daysLogged }));

  // ── Improvements + the focus action paired with each ──
  const improvements: string[] = [];
  const focuses: string[] = [];
  const add = (improveKey: string, focusKey: string, params?: Record<string, string | number>) => {
    improvements.push(t(improveKey, params));
    focuses.push(t(focusKey, params));
  };

  if (daysLogged <= 4) {
    add('weeklyReport.local.improveLogging', 'weeklyReport.local.focusLogging', { days: daysLogged });
  }
  if (totalWorkouts === 0) {
    add('weeklyReport.local.improveNoWorkouts', 'weeklyReport.local.focusNoWorkouts');
  } else if (totalWorkouts < 3) {
    add('weeklyReport.local.improveFewWorkouts', 'weeklyReport.local.focusFewWorkouts', { count: totalWorkouts });
  }
  if (avgSleep === 0) {
    add('weeklyReport.local.improveNoSleep', 'weeklyReport.local.focusNoSleep');
  } else if (avgSleep < targets.sleepHours - 0.5) {
    add('weeklyReport.local.improveSleep', 'weeklyReport.local.focusSleep', {
      hours: avgSleep.toFixed(1),
      target: targets.sleepHours,
    });
  }
  if (avgCalories > 0 && calRatio > 1.1) {
    add('weeklyReport.local.improveOverCalories', 'weeklyReport.local.focusOverCalories', { target: targets.calories });
  } else if (avgCalories > 0 && calRatio < 0.7) {
    add('weeklyReport.local.improveUnderCalories', 'weeklyReport.local.focusUnderCalories', { target: targets.calories });
  }
  if (avgMood > 0 && avgMood < 3) {
    add('weeklyReport.local.improveMood', 'weeklyReport.local.focusMood');
  }
  if (improvements.length === 0) {
    add('weeklyReport.local.improveKeepGoing', 'weeklyReport.local.focusKeepGoing');
  }

  // Pad focus list to 3 with evergreen actions (skip duplicates).
  const evergreen = [
    t('weeklyReport.local.focusEvergreenProtein'),
    t('weeklyReport.local.focusEvergreenCheckin'),
    t('weeklyReport.local.focusEvergreenWater'),
  ];
  for (const f of evergreen) {
    if (focuses.length >= 3) break;
    if (!focuses.includes(f)) focuses.push(f);
  }

  const bullets = (items: string[]) => items.slice(0, 3).map((s) => `•  ${s}`).join('\n');
  const numbered = (items: string[]) => items.slice(0, 3).map((s, i) => `${i + 1}.  ${s}`).join('\n');

  return [
    `🏆  ${t('weeklyReport.local.winsHeader')}`,
    bullets(wins),
    '',
    `🎯  ${t('weeklyReport.local.improveHeader')}`,
    bullets(improvements),
    '',
    `🚀  ${t('weeklyReport.local.focusHeader')}`,
    numbered(focuses),
  ].join('\n');
}
