/**
 * computeDayScore is the single source of truth for a day's LifeScore —
 * the hero score, the vs-yesterday delta and the Home trend chart all go
 * through it (F1/F15). These tests pin the pillar formula and the rest-day
 * credit symmetry.
 */
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem:    jest.fn().mockResolvedValue(null),
  setItem:    jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
}));

import { computeDayScore, formatDeltaLabel, DayScoreInputs } from '../hooks/useZenovaScore';
import { translate } from '../constants/i18n';

const D = '2026-07-03';
const OTHER = '2026-07-02';

const base = (over: Partial<DayScoreInputs> = {}): DayScoreInputs => ({
  entries: [],
  workoutHistory: [],
  recoveryEntries: [],
  targets: { calories: 2000, sleepHours: 8 },
  ...over,
});

describe('computeDayScore', () => {
  it('returns 0 for a day with no data', () => {
    const s = computeDayScore(D, base());
    expect(s).toEqual({ foodScore: 0, moveScore: 0, moodScore: 0, sleepScore: 0, score: 0 });
  });

  it('scores each pillar 0-25 and sums them', () => {
    const s = computeDayScore(D, base({
      entries: [{ date: D, calories: 1000 }],                      // 50% → 13 (rounded)
      workoutHistory: [{ date: D }],                               // 25
      recoveryEntries: [{ date: D, mood: 4, sleepHours: 8 }],      // mood 20, sleep 25
    }));
    expect(s.foodScore).toBe(13);
    expect(s.moveScore).toBe(25);
    expect(s.moodScore).toBe(20);
    expect(s.sleepScore).toBe(25);
    expect(s.score).toBe(83);
  });

  it('clamps overeating and oversleeping to 25 per pillar', () => {
    const s = computeDayScore(D, base({
      entries: [{ date: D, calories: 5000 }],
      recoveryEntries: [{ date: D, mood: 5, sleepHours: 14 }],
    }));
    expect(s.foodScore).toBe(25);
    expect(s.sleepScore).toBe(25);
  });

  it('ignores data from other days', () => {
    const s = computeDayScore(D, base({
      entries: [{ date: OTHER, calories: 2000 }],
      workoutHistory: [{ date: OTHER }],
      recoveryEntries: [{ date: OTHER, mood: 5, sleepHours: 8 }],
    }));
    expect(s.score).toBe(0);
  });

  it('applies the rest-day credit (10) uniformly — no fake day-over-day delta', () => {
    const inputs = base({ restDaySelected: true });
    const today = computeDayScore(D, inputs);
    const yesterday = computeDayScore(OTHER, inputs);
    expect(today.moveScore).toBe(10);
    expect(yesterday.moveScore).toBe(10);   // F15: symmetric, delta stays 0
    expect(today.score - yesterday.score).toBe(0);
  });

  it('a completed workout beats the rest-day credit', () => {
    const s = computeDayScore(D, base({ restDaySelected: true, workoutHistory: [{ date: D }] }));
    expect(s.moveScore).toBe(25);
  });
});

describe('pillar labelKeys resolve', () => {
  // tsc can't catch a labelKey typo — translate() would silently render the
  // raw key string on the Home hero card. Pin every key used by the hook.
  const KEYS = [
    'score.pillarSleep', 'score.pillarFood', 'score.pillarMove', 'score.pillarMood',
    'score.sameAsYesterday',
  ];
  it.each(KEYS)('%s exists in the dictionary', (key) => {
    expect(translate(key)).not.toBe(key);
  });
});

describe('formatDeltaLabel', () => {
  it('formats positive, negative and zero deltas', () => {
    expect(formatDeltaLabel(7, 'same')).toBe('+7 ↑');
    expect(formatDeltaLabel(-3, 'same')).toBe('-3 ↓');
    expect(formatDeltaLabel(0, '= same as yesterday')).toBe('= same as yesterday');
  });
});
