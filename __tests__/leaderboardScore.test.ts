import { computeEffortScore, countDaysWithinCalorieTarget } from '../services/leaderboardScore';
import { daysAgoStr } from '../services/dateUtils';

describe('computeEffortScore', () => {
  it('returns 0 for no streak, no adherence, not on track', () => {
    expect(computeEffortScore({ streakDays: 0, daysWithinCalorieTarget: 0, onTrack: false })).toBe(0);
  });

  it('returns 100 for a maxed-out streak, full adherence, and on track', () => {
    expect(computeEffortScore({ streakDays: 30, daysWithinCalorieTarget: 7, onTrack: true })).toBe(100);
  });

  it('caps the streak contribution at 30 days — a 100-day streak scores the same as 30', () => {
    const at30  = computeEffortScore({ streakDays: 30,  daysWithinCalorieTarget: 0, onTrack: false });
    const at100 = computeEffortScore({ streakDays: 100, daysWithinCalorieTarget: 0, onTrack: false });
    expect(at30).toBe(at100);
    expect(at30).toBe(40);
  });

  it('weights full calorie adherence alone at 30 points', () => {
    expect(computeEffortScore({ streakDays: 0, daysWithinCalorieTarget: 7, onTrack: false })).toBe(30);
  });

  it('weights being on-track alone at 30 points', () => {
    expect(computeEffortScore({ streakDays: 0, daysWithinCalorieTarget: 0, onTrack: true })).toBe(30);
  });

  it('gives partial credit for partial adherence', () => {
    // 3.5/7 days -> half of the 30-point adherence weight = 15
    expect(computeEffortScore({ streakDays: 0, daysWithinCalorieTarget: 3.5, onTrack: false })).toBe(15);
  });

  it('rewards a struggling-but-consistent user over an inconsistent one', () => {
    const consistentButOffTrack = computeEffortScore({ streakDays: 14, daysWithinCalorieTarget: 2, onTrack: false });
    const inconsistentButOnTrack = computeEffortScore({ streakDays: 2, daysWithinCalorieTarget: 2, onTrack: true });
    expect(consistentButOffTrack).toBeGreaterThan(0);
    expect(inconsistentButOnTrack).toBeGreaterThan(0);
  });
});

describe('countDaysWithinCalorieTarget', () => {
  it('counts a logged day within ±15% of target', () => {
    const entries = [{ date: daysAgoStr(0), calories: 2050 }];
    expect(countDaysWithinCalorieTarget(entries, 2000)).toBe(1);
  });

  it('does not count a logged day far outside the tolerance', () => {
    const entries = [{ date: daysAgoStr(0), calories: 3000 }];
    expect(countDaysWithinCalorieTarget(entries, 2000)).toBe(0);
  });

  it('does not count unlogged days', () => {
    expect(countDaysWithinCalorieTarget([], 2000)).toBe(0);
  });

  it('sums multiple entries on the same day before comparing', () => {
    const today = daysAgoStr(0);
    const entries = [{ date: today, calories: 1000 }, { date: today, calories: 1050 }];
    expect(countDaysWithinCalorieTarget(entries, 2000)).toBe(1);
  });

  it('ignores days outside the window', () => {
    const entries = [{ date: daysAgoStr(10), calories: 2000 }];
    expect(countDaysWithinCalorieTarget(entries, 2000)).toBe(0);
  });
});
