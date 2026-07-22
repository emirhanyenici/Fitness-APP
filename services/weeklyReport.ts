import type { TFunction } from '../constants/i18n';
import { computeDayScore, DayScoreInputs } from '../hooks/useZenovaScore';
import { daysAgoStr } from './dateUtils';

/**
 * Weekly report data + rule-based text generation, fully on-device.
 *
 * `computeWeekData` aggregates the last 7 days of store data into a structured
 * `WeeklyReportData` that drives both the in-app card UI and the PDF export.
 * Charts/stats are ALWAYS computed locally; the ai-coach edge function only
 * contributes an optional narrative (`aiNarrative`) — when it fails, the
 * rule-based sections below stand alone, so the feature always works.
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

// ── Structured week data (drives the card UI and the PDF) ────────────────────

export interface WeekStatsExtended extends WeekStats {
  /** Average LifeScore (0-100) across days with data; 0 when none. */
  avgScore: number;
  /** Average pillar values (0-25) across days with data. */
  pillarAvgs: { food: number; move: number; mood: number; sleep: number };
  /** Average grams/day across days that logged food. */
  macroAvgs: { protein: number; carbs: number; fat: number };
  workoutBreakdown: { bodyPart: string; count: number; minutes: number; calories: number }[];
  /** Weight change (kg) across the week's entries; null when fewer than 2. */
  weightDelta: number | null;
  /** Averages across days with any synced health-app data; null when Health
   *  isn't connected (no data supplied at all). */
  activityAvgs: { steps: number; caloriesBurned: number; distanceKm: number; exerciseMin: number } | null;
}

export interface DailyScorePoint {
  date: string;      // YYYY-MM-DD
  dayLabel: string;  // narrow weekday, e.g. "M"
  score: number;     // 0-100
  hasData: boolean;
}

export interface ReportSections {
  wins: string[];
  improvements: string[];
  focus: string[];
}

export interface WeeklyReportData {
  period: { start: string; end: string; label: string };
  stats: WeekStatsExtended;
  daily: DailyScorePoint[];
  sections: ReportSections;
  /** Raw AI coach text when the edge function succeeded; null on local path. */
  aiNarrative: string | null;
  source: 'ai' | 'local';
}

export interface WeekDataInputs {
  entries: { date: string; calories: number; protein: number; carbs: number; fat: number }[];
  workoutHistory: {
    date: string; bodyPart: string; calories: number;
    duration: string; durationMinutes?: number;
  }[];
  recoveryEntries: { date: string; mood: number; sleepHours?: number }[];
  weightEntries: { date: string; weight_kg: number }[];
  targets: { calories: number; sleepHours: number };
  restDaySelected?: boolean;
  /** Apple Health / Health Connect daily caches, keyed by local YYYY-MM-DD.
   *  Omit (or leave undefined) when the user hasn't connected a health app. */
  health?: {
    stepsByDate?: Record<string, number>;
    caloriesByDate?: Record<string, number>;
    distanceByDate?: Record<string, number>;
    exerciseMinByDate?: Record<string, number>;
  };
}

/** Older records only have the "40 min" string form. */
const workoutMinutes = (w: WeekDataInputs['workoutHistory'][number]): number =>
  w.durationMinutes ?? (parseInt(w.duration, 10) || 0);

const round1 = (n: number) => Math.round(n * 10) / 10;
const avg = (nums: number[]) => (nums.length ? nums.reduce((s, n) => s + n, 0) / nums.length : 0);

/**
 * Pure aggregation of the last 7 calendar days (local time, via daysAgoStr).
 * Scores come from computeDayScore — the single source of the LifeScore
 * formula — so the report always matches the Home screen.
 */
export function computeWeekData(inp: WeekDataInputs): {
  period: WeeklyReportData['period'];
  stats: WeekStatsExtended;
  daily: DailyScorePoint[];
} {
  const dayInputs: DayScoreInputs = {
    entries: inp.entries,
    workoutHistory: inp.workoutHistory,
    recoveryEntries: inp.recoveryEntries,
    targets: inp.targets,
    restDaySelected: inp.restDaySelected,
    healthActivity: { stepsByDate: inp.health?.stepsByDate, exerciseMinByDate: inp.health?.exerciseMinByDate },
  };

  const days = Array.from({ length: 7 }, (_, i) => {
    const offset = 6 - i;
    const date = daysAgoStr(offset);
    const jsDate = new Date(Date.now() - offset * 86_400_000);
    const dayCalories = inp.entries.filter((e) => e.date === date).reduce((s, e) => s + e.calories, 0);
    const dayWorkouts = inp.workoutHistory.filter((w) => w.date === date);
    const recovery = inp.recoveryEntries.find((e) => e.date === date);
    const dayScore = computeDayScore(date, dayInputs);
    const hasHealthActivity = (inp.health?.stepsByDate?.[date] ?? 0) > 0
      || (inp.health?.exerciseMinByDate?.[date] ?? 0) > 0;
    return {
      date,
      jsDate,
      calories: dayCalories,
      protein:  inp.entries.filter((e) => e.date === date).reduce((s, e) => s + e.protein, 0),
      carbs:    inp.entries.filter((e) => e.date === date).reduce((s, e) => s + e.carbs, 0),
      fat:      inp.entries.filter((e) => e.date === date).reduce((s, e) => s + e.fat, 0),
      workouts: dayWorkouts,
      recovery,
      dayScore,
      hasData: dayCalories > 0 || dayWorkouts.length > 0 || recovery != null || hasHealthActivity,
    };
  });

  const daily: DailyScorePoint[] = days.map((d) => ({
    date: d.date,
    dayLabel: d.jsDate.toLocaleDateString('en-US', { weekday: 'narrow' }),
    score: d.dayScore.score,
    hasData: d.hasData,
  }));

  const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const period = {
    start: days[0].date,
    end:   days[6].date,
    label: `${fmt(days[0].jsDate)} – ${fmt(days[6].jsDate)}`,
  };

  const loggedDays   = days.filter((d) => d.calories > 0 || d.workouts.length > 0);
  const foodDays     = days.filter((d) => d.calories > 0);
  const recoveryDays = days.filter((d) => d.recovery != null);
  const sleepDays    = days.filter((d) => d.recovery?.sleepHours != null);
  const dataDays     = days.filter((d) => d.hasData);

  const breakdown = new Map<string, { count: number; minutes: number; calories: number }>();
  for (const d of days) {
    for (const w of d.workouts) {
      const row = breakdown.get(w.bodyPart) ?? { count: 0, minutes: 0, calories: 0 };
      row.count    += 1;
      row.minutes  += workoutMinutes(w);
      row.calories += w.calories;
      breakdown.set(w.bodyPart, row);
    }
  }

  const weekWeights = inp.weightEntries
    .filter((e) => e.date >= period.start && e.date <= period.end)
    .sort((a, b) => a.date.localeCompare(b.date));

  // Health-app averages: only days the health app actually synced something
  // count, so a partial week (e.g. connected mid-week) doesn't drag the
  // average down with phantom zero days.
  const health = inp.health;
  const healthDates = health
    ? days
        .map((d) => d.date)
        .filter((date) =>
          (health.stepsByDate?.[date] ?? 0) > 0 ||
          (health.caloriesByDate?.[date] ?? 0) > 0 ||
          (health.distanceByDate?.[date] ?? 0) > 0 ||
          (health.exerciseMinByDate?.[date] ?? 0) > 0,
        )
    : [];
  const activityAvgs = healthDates.length > 0
    ? {
        steps:          Math.round(avg(healthDates.map((d) => health!.stepsByDate?.[d] ?? 0))),
        caloriesBurned: Math.round(avg(healthDates.map((d) => health!.caloriesByDate?.[d] ?? 0))),
        distanceKm:     round1(avg(healthDates.map((d) => health!.distanceByDate?.[d] ?? 0))),
        exerciseMin:    Math.round(avg(healthDates.map((d) => health!.exerciseMinByDate?.[d] ?? 0))),
      }
    : null;

  const stats: WeekStatsExtended = {
    daysLogged:    loggedDays.length,
    avgCalories:   Math.round(avg(foodDays.map((d) => d.calories))),
    totalWorkouts: days.reduce((s, d) => s + d.workouts.length, 0),
    avgMood:       round1(avg(recoveryDays.map((d) => d.recovery!.mood))),
    avgSleep:      round1(avg(sleepDays.map((d) => d.recovery!.sleepHours!))),
    avgScore:      Math.round(avg(dataDays.map((d) => d.dayScore.score))),
    pillarAvgs: {
      food:  round1(avg(dataDays.map((d) => d.dayScore.foodScore))),
      move:  round1(avg(dataDays.map((d) => d.dayScore.moveScore))),
      mood:  round1(avg(dataDays.map((d) => d.dayScore.moodScore))),
      sleep: round1(avg(dataDays.map((d) => d.dayScore.sleepScore))),
    },
    macroAvgs: {
      protein: Math.round(avg(foodDays.map((d) => d.protein))),
      carbs:   Math.round(avg(foodDays.map((d) => d.carbs))),
      fat:     Math.round(avg(foodDays.map((d) => d.fat))),
    },
    workoutBreakdown: [...breakdown.entries()]
      .map(([bodyPart, row]) => ({ bodyPart, ...row }))
      .sort((a, b) => b.count - a.count),
    weightDelta: weekWeights.length >= 2
      ? round1(weekWeights[weekWeights.length - 1].weight_kg - weekWeights[0].weight_kg)
      : null,
    activityAvgs,
  };

  return { period, stats, daily };
}

/**
 * Rule-based Wins / Improvements / Focus lists (max 3 each). Extracted from
 * the original text generator so the card UI and PDF can render structured
 * sections; buildLocalWeeklyReport below joins them into the legacy string.
 */
export function buildLocalSections(
  stats: WeekStats,
  targets: ReportTargets,
  t: TFunction,
): ReportSections {
  const { daysLogged, avgCalories, totalWorkouts, avgMood, avgSleep } = stats;
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

  return {
    wins: wins.slice(0, 3),
    improvements: improvements.slice(0, 3),
    focus: focuses.slice(0, 3),
  };
}

export function buildLocalWeeklyReport(
  stats: WeekStats,
  targets: ReportTargets,
  t: TFunction,
): string {
  if (stats.daysLogged === 0) return t('weeklyReport.local.noData');

  const { wins, improvements, focus } = buildLocalSections(stats, targets, t);

  const bullets = (items: string[]) => items.map((s) => `•  ${s}`).join('\n');
  const numbered = (items: string[]) => items.map((s, i) => `${i + 1}.  ${s}`).join('\n');

  return [
    `🏆  ${t('weeklyReport.local.winsHeader')}`,
    bullets(wins),
    '',
    `🎯  ${t('weeklyReport.local.improveHeader')}`,
    bullets(improvements),
    '',
    `🚀  ${t('weeklyReport.local.focusHeader')}`,
    numbered(focus),
  ].join('\n');
}
