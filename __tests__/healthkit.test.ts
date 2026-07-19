import { sleepHoursByDate, mapHKWorkout } from '../services/healthkit';

// Local-noon anchor keeps dateStr() deterministic regardless of TZ.
const at = (day: string, h: number, m = 0) => {
  const d = new Date(`${day}T12:00:00`);
  d.setHours(h, m, 0, 0);
  return d;
};

describe('sleepHoursByDate', () => {
  test('sums asleep intervals keyed by the morning sleep ends', () => {
    const out = sleepHoursByDate([
      // 23:00 → 03:00 core, 03:00 → 07:00 REM/deep mix
      { startDate: at('2026-07-18', 23), endDate: at('2026-07-19', 3), value: 3 },
      { startDate: at('2026-07-19', 3), endDate: at('2026-07-19', 7), value: 5 },
    ]);
    expect(out['2026-07-19']).toBe(8);
  });

  test('ignores inBed (0) and awake (2) samples', () => {
    const out = sleepHoursByDate([
      { startDate: at('2026-07-19', 0), endDate: at('2026-07-19', 8), value: 0 },
      { startDate: at('2026-07-19', 1), endDate: at('2026-07-19', 2), value: 2 },
      { startDate: at('2026-07-19', 2), endDate: at('2026-07-19', 6), value: 1 },
    ]);
    expect(out['2026-07-19']).toBe(4);
  });

  test('merges overlapping iPhone+Watch samples so time counts once', () => {
    const out = sleepHoursByDate([
      { startDate: at('2026-07-19', 0), endDate: at('2026-07-19', 6), value: 1 },
      { startDate: at('2026-07-19', 1), endDate: at('2026-07-19', 7), value: 3 }, // overlaps 1-6
    ]);
    expect(out['2026-07-19']).toBe(7); // not 12
  });

  test('separate nights land on separate days; zero/invalid intervals dropped', () => {
    const out = sleepHoursByDate([
      { startDate: at('2026-07-17', 23), endDate: at('2026-07-18', 6), value: 1 },
      { startDate: at('2026-07-18', 23), endDate: at('2026-07-19', 6, 30), value: 1 },
      { startDate: at('2026-07-19', 6), endDate: at('2026-07-19', 6), value: 1 }, // zero-length
    ]);
    expect(out['2026-07-18']).toBe(7);
    expect(out['2026-07-19']).toBe(7.5);
  });
});

describe('mapHKWorkout', () => {
  const base = {
    uuid: 'abc-123',
    startDate: at('2026-07-19', 18),
    endDate: at('2026-07-19', 18, 45),
  };

  test('maps known activity types with stable hk- ids', () => {
    const w = mapHKWorkout({
      ...base,
      workoutActivityType: 37,
      duration: { quantity: 45 * 60 },
      totalEnergyBurned: { quantity: 320.6 },
    });
    expect(w.id).toBe('hk-abc-123');
    expect(w.name).toBe('Running');
    expect(w.programName).toBe('Apple Health');
    expect(w.durationMinutes).toBe(45);
    expect(w.duration).toBe('45 min');
    expect(w.calories).toBe(321);
    expect(w.date).toBe('2026-07-19');
    expect(w.timestamp).toBe(base.endDate.getTime());
  });

  test('unknown activity falls back to generic name; duration derived from dates', () => {
    const w = mapHKWorkout({ ...base, workoutActivityType: 9999 });
    expect(w.name).toBe('Workout');
    expect(w.durationMinutes).toBe(45); // (end-start)/60s
    expect(w.calories).toBe(0);
  });
});
