import {
  buildLocalWeeklyReport, buildLocalSections, computeWeekData,
  type WeekStats, type WeekDataInputs,
} from '../services/weeklyReport';
import { daysAgoStr } from '../services/dateUtils';
import { translate } from '../constants/i18n';

const t = translate;
const targets = { calories: 2000, sleepHours: 8 };

const stats = (partial: Partial<WeekStats>): WeekStats => ({
  daysLogged: 0, avgCalories: 0, totalWorkouts: 0, avgMood: 0, avgSleep: 0,
  ...partial,
});

describe('buildLocalWeeklyReport', () => {
  it('returns the no-data message for an empty week', () => {
    const report = buildLocalWeeklyReport(stats({}), targets, t);
    expect(report).toBe(t('weeklyReport.local.noData'));
  });

  it('contains all three sections when there is data', () => {
    const report = buildLocalWeeklyReport(
      stats({ daysLogged: 3, avgCalories: 1900, totalWorkouts: 2, avgMood: 3.5, avgSleep: 7 }),
      targets, t,
    );
    expect(report).toContain(t('weeklyReport.local.winsHeader'));
    expect(report).toContain(t('weeklyReport.local.improveHeader'));
    expect(report).toContain(t('weeklyReport.local.focusHeader'));
  });

  it('credits a strong week with workout and consistency wins', () => {
    const report = buildLocalWeeklyReport(
      stats({ daysLogged: 6, avgCalories: 2000, totalWorkouts: 4, avgMood: 4.2, avgSleep: 8.1 }),
      targets, t,
    );
    expect(report).toContain('4 workouts');
    expect(report).toContain('6 of 7 days');
  });

  it('flags missing workouts and short sleep on a weak week', () => {
    const report = buildLocalWeeklyReport(
      stats({ daysLogged: 2, avgCalories: 2600, totalWorkouts: 0, avgMood: 2, avgSleep: 5.5 }),
      targets, t,
    );
    expect(report).toContain(t('weeklyReport.local.improveNoWorkouts'));
    expect(report).toContain(t('weeklyReport.local.focusNoWorkouts'));
  });

  it('always offers exactly three focus actions', () => {
    const report = buildLocalWeeklyReport(
      stats({ daysLogged: 7, avgCalories: 2000, totalWorkouts: 5, avgMood: 5, avgSleep: 9 }),
      targets, t,
    );
    expect(report).toContain('1.  ');
    expect(report).toContain('2.  ');
    expect(report).toContain('3.  ');
  });

  it('caps improvements at three even when everything is off', () => {
    const report = buildLocalWeeklyReport(
      stats({ daysLogged: 1, avgCalories: 3000, totalWorkouts: 0, avgMood: 1, avgSleep: 0 }),
      targets, t,
    );
    const improveSection = report.split(t('weeklyReport.local.improveHeader'))[1]
      .split(t('weeklyReport.local.focusHeader'))[0];
    const bulletCount = (improveSection.match(/•/g) ?? []).length;
    expect(bulletCount).toBe(3);
  });
});

describe('buildLocalSections', () => {
  it('returns arrays capped at three items each', () => {
    const sections = buildLocalSections(
      stats({ daysLogged: 1, avgCalories: 3000, totalWorkouts: 0, avgMood: 1, avgSleep: 0 }),
      targets, t,
    );
    expect(sections.wins.length).toBeGreaterThanOrEqual(1);
    expect(sections.wins.length).toBeLessThanOrEqual(3);
    expect(sections.improvements).toHaveLength(3);
    expect(sections.focus).toHaveLength(3);
  });
});

describe('computeWeekData', () => {
  const emptyInputs: WeekDataInputs = {
    entries: [], workoutHistory: [], recoveryEntries: [], weightEntries: [],
    targets: { calories: 2000, sleepHours: 8 },
  };

  it('returns zeros and no-data days for empty stores', () => {
    const { stats, daily, period } = computeWeekData(emptyInputs);
    expect(stats.daysLogged).toBe(0);
    expect(stats.avgScore).toBe(0);
    expect(stats.weightDelta).toBeNull();
    expect(stats.activityAvgs).toBeNull();
    expect(daily).toHaveLength(7);
    expect(daily.every((d) => !d.hasData && d.score === 0)).toBe(true);
    expect(period.start).toBe(daysAgoStr(6));
    expect(period.end).toBe(daysAgoStr(0));
  });

  it('averages health-app data only over the days it actually synced', () => {
    const today = daysAgoStr(0);
    const yesterday = daysAgoStr(1);
    const { stats } = computeWeekData({
      ...emptyInputs,
      health: {
        stepsByDate:       { [today]: 8000, [yesterday]: 6000 },
        caloriesByDate:    { [today]: 500,  [yesterday]: 300 },
        distanceByDate:    { [today]: 5,    [yesterday]: 3 },
        exerciseMinByDate: { [today]: 40,   [yesterday]: 20 },
      },
    });
    expect(stats.activityAvgs).toEqual({ steps: 7000, caloriesBurned: 400, distanceKm: 4, exerciseMin: 30 });
  });

  it('aggregates a synthetic week correctly', () => {
    const today = daysAgoStr(0);
    const yesterday = daysAgoStr(1);
    const inputs: WeekDataInputs = {
      entries: [
        { date: today, calories: 2000, protein: 120, carbs: 200, fat: 60 },
        { date: yesterday, calories: 1800, protein: 100, carbs: 180, fat: 50 },
      ],
      workoutHistory: [
        { date: today, bodyPart: 'chest', calories: 300, duration: '40 min', durationMinutes: 42 },
        { date: yesterday, bodyPart: 'chest', calories: 250, duration: '35 min' },
        { date: yesterday, bodyPart: 'legs', calories: 400, duration: '50 min', durationMinutes: 50 },
      ],
      recoveryEntries: [{ date: today, mood: 4, sleepHours: 8 }],
      weightEntries: [
        { date: daysAgoStr(5), weight_kg: 81.2 },
        { date: today, weight_kg: 80.4 },
      ],
      targets: { calories: 2000, sleepHours: 8 },
    };

    const { stats, daily } = computeWeekData(inputs);

    expect(stats.daysLogged).toBe(2);
    expect(stats.avgCalories).toBe(1900);
    expect(stats.totalWorkouts).toBe(3);
    expect(stats.avgMood).toBe(4);
    expect(stats.avgSleep).toBe(8);
    expect(stats.macroAvgs).toEqual({ protein: 110, carbs: 190, fat: 55 });
    // chest first (2 sessions); "35 min" string parsed for the legacy record
    expect(stats.workoutBreakdown[0]).toEqual({ bodyPart: 'chest', count: 2, minutes: 77, calories: 550 });
    expect(stats.workoutBreakdown[1]).toEqual({ bodyPart: 'legs', count: 1, minutes: 50, calories: 400 });
    expect(stats.weightDelta).toBe(-0.8);

    // Today: food 25 + move 25 + mood 20 + sleep 25 = 95
    expect(daily[6].score).toBe(95);
    expect(daily[6].hasData).toBe(true);
    expect(daily[0].hasData).toBe(false);
    expect(stats.avgScore).toBe(Math.round((95 + daily[5].score) / 2));
  });

  it('ignores entries outside the 7-day window', () => {
    const { stats } = computeWeekData({
      ...emptyInputs,
      entries: [{ date: daysAgoStr(8), calories: 2000, protein: 100, carbs: 200, fat: 60 }],
      weightEntries: [
        { date: daysAgoStr(30), weight_kg: 85 },
        { date: daysAgoStr(9), weight_kg: 84 },
      ],
    });
    expect(stats.daysLogged).toBe(0);
    expect(stats.weightDelta).toBeNull();
  });
});
