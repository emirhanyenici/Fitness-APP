import { computeStreak, todayStr, daysAgoStr } from '../services/dateUtils';

describe('computeStreak', () => {
  const today = todayStr();

  it('returns 0 for no activity at all', () => {
    expect(computeStreak(new Set(), today)).toBe(0);
  });

  it('counts today alone as a 1-day streak', () => {
    expect(computeStreak(new Set([today]), today)).toBe(1);
  });

  it('counts consecutive days including today', () => {
    const dates = new Set([today, daysAgoStr(1), daysAgoStr(2)]);
    expect(computeStreak(dates, today)).toBe(3);
  });

  it('does not zero out an existing streak just because today has no entry yet', () => {
    const dates = new Set([daysAgoStr(1), daysAgoStr(2), daysAgoStr(3)]);
    expect(computeStreak(dates, today)).toBe(3);
  });

  it('breaks the streak at the first gap', () => {
    // today + yesterday active, but the day before is missing
    const dates = new Set([today, daysAgoStr(1), daysAgoStr(3)]);
    expect(computeStreak(dates, today)).toBe(2);
  });

  it('returns 0 when neither today nor yesterday has an entry', () => {
    const dates = new Set([daysAgoStr(2), daysAgoStr(3)]);
    expect(computeStreak(dates, today)).toBe(0);
  });
});
