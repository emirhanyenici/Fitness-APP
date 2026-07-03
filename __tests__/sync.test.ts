/**
 * Data-loss guards in services/sync.ts:
 *  - a failed pull must NOT attach push subscribers (empty local state would
 *    overwrite the cloud backup via last-write-wins)
 *  - a failed pull schedules a retry, and a later successful pull attaches them
 *  - a successful pull with no remote rows seeds the cloud from local state
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

const mockUpsert = jest.fn();
const mockPull: { result: { data: unknown[] | null; error: { message: string } | null } } = {
  result: { data: [], error: null },
};

jest.mock('../services/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({ eq: jest.fn(() => Promise.resolve(mockPull.result)) })),
      upsert: (...args: unknown[]) => mockUpsert(...args),
    })),
  },
}));

import { startSync, stopSync, pullUserState } from '../services/sync';
import { useNutritionStore } from '../stores/nutritionStore';

const USER = 'user-1';

// Let pending microtasks (mocked network promises) settle under fake timers.
const flush = () => jest.advanceTimersByTimeAsync(0);

beforeEach(() => {
  jest.useFakeTimers();
  mockUpsert.mockReset().mockResolvedValue({ error: null });
  mockPull.result = { data: [], error: null };
  useNutritionStore.setState({ entries: [], waterByDate: {} });
});

afterEach(() => {
  stopSync();
  jest.useRealTimers();
});

describe('sync data-loss guards', () => {
  it('pullUserState reports failure instead of treating errors as "cloud empty"', async () => {
    mockPull.result = { data: null, error: { message: 'network down' } };
    await expect(pullUserState(USER)).resolves.toBe(false);
    expect(mockUpsert).not.toHaveBeenCalled(); // no seeding on failure
  });

  it('does not attach push subscribers when the initial pull fails', async () => {
    mockPull.result = { data: null, error: { message: 'network down' } };
    const start = startSync(USER);
    await flush();
    await start;

    mockUpsert.mockClear();
    useNutritionStore.getState().addEntry({ name: 'Egg', calories: 78, protein: 6, carbs: 0.6, fat: 5, mealType: 'breakfast' });
    await jest.advanceTimersByTimeAsync(3000); // past the 1.5s push debounce
    expect(mockUpsert).not.toHaveBeenCalled(); // local write did NOT push over the cloud
  });

  it('retries a failed pull and attaches subscribers once it succeeds', async () => {
    mockPull.result = { data: null, error: { message: 'flaky' } };
    const start = startSync(USER);
    await flush();
    await start;

    mockPull.result = { data: [], error: null }; // network recovers
    await jest.advanceTimersByTimeAsync(5000); // first backoff delay

    mockUpsert.mockClear();
    useNutritionStore.getState().addEntry({ name: 'Rice', calories: 200, protein: 4, carbs: 45, fat: 0.5, mealType: 'lunch' });
    await jest.advanceTimersByTimeAsync(2000);
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ store: 'nutrition', user_id: USER }),
      expect.anything(),
    );
  });

  it('seeds the cloud from local state when the pull succeeds with no rows', async () => {
    await expect(pullUserState(USER)).resolves.toBe(true);
    // one seed upsert per synced store
    const seededStores = mockUpsert.mock.calls.map((c) => (c[0] as any).store);
    expect(seededStores).toContain('nutrition');
    expect(seededStores).toContain('user');
    expect(seededStores.length).toBeGreaterThanOrEqual(9);
  });

  it('hydrates stores from remote rows on a successful pull', async () => {
    const entry = { id: 'x1', name: 'Oats', calories: 150, protein: 5, carbs: 27, fat: 3, mealType: 'breakfast', date: '2026-07-01' };
    mockPull.result = { data: [{ store: 'nutrition', data: { entries: [entry], waterByDate: { '2026-07-01': 3 } } }], error: null };
    await expect(pullUserState(USER)).resolves.toBe(true);
    expect(useNutritionStore.getState().entries).toEqual([entry]);
    expect(useNutritionStore.getState().waterByDate['2026-07-01']).toBe(3);
  });

  it('stopSync cancels a pending retry', async () => {
    mockPull.result = { data: null, error: { message: 'down' } };
    const start = startSync(USER);
    await flush();
    await start;

    stopSync();
    mockPull.result = { data: [], error: null };
    await jest.advanceTimersByTimeAsync(120_000); // way past every backoff

    mockUpsert.mockClear();
    useNutritionStore.getState().addEntry({ name: 'Tea', calories: 2, protein: 0, carbs: 0.5, fat: 0, mealType: 'snack' });
    await jest.advanceTimersByTimeAsync(3000);
    expect(mockUpsert).not.toHaveBeenCalled();
  });
});
