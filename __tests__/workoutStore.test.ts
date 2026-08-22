/**
 * dayOverride's core invariant is "scoped to a single calendar day" — set*
 * stamps today's date, and stale (yesterday's) overrides must be ignored by
 * readers. clearHistory (called on sign-out) must also reset it, or an
 * override can leak across accounts on a shared device.
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

import { useWorkoutStore } from '../stores/workoutStore';
import { todayStr } from '../services/dateUtils';

beforeEach(() => {
  useWorkoutStore.setState({ dayOverride: null, history: [], selectedType: null, selectedProgram: null, totalWorkoutsLogged: 0 });
});

describe('workoutStore.setDayOverride / clearDayOverride', () => {
  it('stamps the override with today\'s date and the given dayLabel', () => {
    useWorkoutStore.getState().setDayOverride({ dayLabel: 'Legs' });
    expect(useWorkoutStore.getState().dayOverride).toEqual({ date: todayStr(), dayLabel: 'Legs' });
  });

  it('stamps the override with today\'s date and the given dayOfWeekIndex (custom programs)', () => {
    useWorkoutStore.getState().setDayOverride({ dayOfWeekIndex: 3 });
    expect(useWorkoutStore.getState().dayOverride).toEqual({ date: todayStr(), dayOfWeekIndex: 3 });
  });

  it('clearDayOverride resets it to null', () => {
    useWorkoutStore.getState().setDayOverride({ dayLabel: 'Push' });
    useWorkoutStore.getState().clearDayOverride();
    expect(useWorkoutStore.getState().dayOverride).toBeNull();
  });

  it('a later setDayOverride call replaces the previous override entirely', () => {
    useWorkoutStore.getState().setDayOverride({ dayLabel: 'Push' });
    useWorkoutStore.getState().setDayOverride({ dayLabel: 'Pull' });
    expect(useWorkoutStore.getState().dayOverride).toEqual({ date: todayStr(), dayLabel: 'Pull' });
  });
});

describe('workoutStore.clearHistory', () => {
  it('also resets dayOverride, so it cannot survive a sign-out on a shared device', () => {
    useWorkoutStore.getState().setDayOverride({ dayLabel: 'Legs' });
    useWorkoutStore.getState().clearHistory();
    expect(useWorkoutStore.getState().dayOverride).toBeNull();
  });

  it('resets the other workout fields as before', () => {
    useWorkoutStore.setState({ selectedType: 'gym', selectedProgram: 'push_pull_legs', totalWorkoutsLogged: 5 });
    useWorkoutStore.getState().clearHistory();
    const state = useWorkoutStore.getState();
    expect(state.history).toEqual([]);
    expect(state.selectedType).toBeNull();
    expect(state.selectedProgram).toBeNull();
    expect(state.totalWorkoutsLogged).toBe(0);
  });
});
