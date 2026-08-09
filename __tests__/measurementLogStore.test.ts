/**
 * measurementLogStore.addEntry's per-day merge-upsert: logging one field must
 * never clear other fields already logged the same day (doc-commented risk
 * in the store itself — a spread-order or filter mistake would silently lose
 * data), and a different day must never be touched.
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

import { useMeasurementLogStore } from '../stores/measurementLogStore';
import { todayStr, daysAgoStr } from '../services/dateUtils';

beforeEach(() => {
  useMeasurementLogStore.setState({ entries: [] });
});

describe('measurementLogStore.addEntry', () => {
  it('creates a new entry for today on the first call', () => {
    useMeasurementLogStore.getState().addEntry({ waist_cm: 80 });
    const entries = useMeasurementLogStore.getState().entries;
    expect(entries).toEqual([{ date: todayStr(), waist_cm: 80 }]);
  });

  it('merges a second field logged the same day without clearing the first', () => {
    useMeasurementLogStore.getState().addEntry({ waist_cm: 80 });
    useMeasurementLogStore.getState().addEntry({ chest_cm: 100 });
    const entries = useMeasurementLogStore.getState().entries;
    expect(entries).toHaveLength(1);
    expect(entries[0]).toEqual({ date: todayStr(), waist_cm: 80, chest_cm: 100 });
  });

  it('overwrites only the field re-logged the same day', () => {
    useMeasurementLogStore.getState().addEntry({ waist_cm: 80, chest_cm: 100 });
    useMeasurementLogStore.getState().addEntry({ waist_cm: 79 });
    const entries = useMeasurementLogStore.getState().entries;
    expect(entries).toHaveLength(1);
    expect(entries[0]).toEqual({ date: todayStr(), waist_cm: 79, chest_cm: 100 });
  });

  it('keeps a previous day entry separate from today', () => {
    useMeasurementLogStore.setState({ entries: [{ date: daysAgoStr(1), waist_cm: 82 }] });
    useMeasurementLogStore.getState().addEntry({ waist_cm: 80 });
    const entries = useMeasurementLogStore.getState().entries;
    expect(entries).toHaveLength(2);
    expect(entries.find((e) => e.date === daysAgoStr(1))).toEqual({ date: daysAgoStr(1), waist_cm: 82 });
    expect(entries.find((e) => e.date === todayStr())).toEqual({ date: todayStr(), waist_cm: 80 });
  });
});
