import { buildLocalWeeklyReport, type WeekStats } from '../services/weeklyReport';
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
