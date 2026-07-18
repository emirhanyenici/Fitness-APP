/**
 * Exercise demo lookup — name normalization, alias map integrity, and the
 * cache → ExerciseDB → wger fetch cascade.
 */
import {
  normalizeExerciseName,
  resolveSearchTerm,
  EXERCISE_ALIASES,
  fetchExerciseDemo,
  FALLBACK,
} from '../services/exercisedb';
import { ALL_PROGRAM_EXERCISE_NAMES } from '../services/workoutPrograms';
import { _clearDemoCacheForTests } from '../services/exerciseDemoCache';

jest.mock('../services/http', () => ({
  fetchWithTimeout: (...args: unknown[]) => mockFetch(...args),
}));
jest.mock('../services/secureStorage', () => ({
  secureStorage: {
    getItem: jest.fn().mockResolvedValue(null),
    setItem: jest.fn().mockResolvedValue(undefined),
    removeItem: jest.fn().mockResolvedValue(undefined),
  },
}));
jest.mock('../services/monitoring', () => ({ logError: jest.fn() }));

const mockFetch = jest.fn();
process.env.EXPO_PUBLIC_RAPIDAPI_KEY = 'test-key';

const edbHit = (name: string, id = '0031') => ({
  ok: true,
  json: async () => [
    { id, name, bodyPart: 'chest', target: 'pecs', equipment: 'barbell', instructions: ['Step one.'] },
  ],
});

describe('normalizeExerciseName', () => {
  it.each([
    ['Cat-Cow Stretch', 'cat cow stretch'],
    ["Child's Pose", 'childs pose'],
    ['Bench Press', 'bench press'],
    ['  Squats  (Barbell) ', 'squats'],
    ['Close-Grip Bench Press', 'close grip bench press'],
  ])('%s → %s', (input, expected) => {
    expect(normalizeExerciseName(input)).toBe(expected);
  });
});

describe('EXERCISE_ALIASES integrity', () => {
  it('every key is already in normalized form', () => {
    for (const key of Object.keys(EXERCISE_ALIASES)) {
      expect(normalizeExerciseName(key)).toBe(key);
    }
  });

  it('every non-null value is a non-empty search term', () => {
    for (const value of Object.values(EXERCISE_ALIASES)) {
      if (value !== null) expect(value.trim().length).toBeGreaterThan(0);
    }
  });
});

describe('resolveSearchTerm', () => {
  it('maps aliased names to their ExerciseDB term', () => {
    expect(resolveSearchTerm('Skull Crushers')).toBe('lying triceps extension');
    expect(resolveSearchTerm('Push Ups')).toBe('id:0662'); // pinned catalog id
  });

  it('returns null for youtube-only yoga moves', () => {
    expect(resolveSearchTerm('Sun Salutation Flow')).toBeNull();
    expect(resolveSearchTerm("Child's Pose")).toBeNull();
    expect(resolveSearchTerm('Cat-Cow Stretch')).toBeNull();
  });

  it('passes unknown names through normalized', () => {
    expect(resolveSearchTerm('Hammer Curl')).toBe('hammer curl');
    expect(resolveSearchTerm('Arnold Press')).toBe('arnold press');
  });

  it('covers every built-in program and fallback exercise name', () => {
    const allNames = [
      ...ALL_PROGRAM_EXERCISE_NAMES,
      ...Object.values(FALLBACK).flat().map((e) => e.name),
    ];
    for (const name of allNames) {
      const term = resolveSearchTerm(name);
      expect(term === null || term.trim().length > 0).toBe(true);
    }
  });
});

describe('fetchExerciseDemo', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    _clearDemoCacheForTests();
  });

  const gifUrlFor = (id: string) =>
    `https://exercisedb.p.rapidapi.com/image?exerciseId=${id}&resolution=360`;

  it('returns a demo from ExerciseDB and caches it', async () => {
    mockFetch.mockResolvedValueOnce(edbHit('deadlift', '0032'));
    const demo = await fetchExerciseDemo('Deadlift');
    expect(demo).toMatchObject({ gifUrl: gifUrlFor('0032'), bodyPart: 'chest' });
    expect(mockFetch).toHaveBeenCalledTimes(1);

    // Second call: served from cache, no network.
    const again = await fetchExerciseDemo('Deadlift');
    expect(again?.gifUrl).toBe(gifUrlFor('0032'));
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('prefers exact normalized-name match over first result', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        { id: '0100', name: 'barbell deadlift (side pov)' },
        { id: '0200', name: 'deadlift' },
      ],
    });
    const demo = await fetchExerciseDemo('Deadlift');
    expect(demo?.gifUrl).toBe(gifUrlFor('0200'));
  });

  it('never calls the network for youtube-only exercises', async () => {
    const demo = await fetchExerciseDemo('Downward Dog');
    expect(demo).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('falls back to wger when ExerciseDB returns an error status', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: false, status: 429 }) // ExerciseDB quota
      .mockResolvedValueOnce({                            // wger search
        ok: true,
        json: async () => ({ suggestions: [{ data: { base_id: 7, image: '/img/x.png', category: 'Chest' } }] }),
      })
      .mockResolvedValueOnce({ ok: false, status: 500 }); // wger info → partial result
    const demo = await fetchExerciseDemo('Bench Press');
    expect(demo?.gifUrl).toBe('https://wger.de/img/x.png');
  });

  it('returns null without throwing when everything is offline, and does not cache the failure', async () => {
    mockFetch.mockRejectedValue(new Error('network down'));
    await expect(fetchExerciseDemo('Deadlift')).resolves.toBeNull();

    // Next attempt retries the network (failure was not cached).
    mockFetch.mockReset();
    mockFetch.mockResolvedValueOnce(edbHit('deadlift'));
    const demo = await fetchExerciseDemo('Deadlift');
    expect(demo).not.toBeNull();
  });
});
