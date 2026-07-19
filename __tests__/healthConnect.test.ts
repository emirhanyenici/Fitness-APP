import { hcSleepIntervals, mapHCWorkout } from '../services/healthConnect';
import { sleepHoursByDate } from '../services/healthkit';

const iso = (day: string, h: number, m = 0) => {
  const d = new Date(`${day}T12:00:00`);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
};

describe('hcSleepIntervals', () => {
  test('stage-less session counts whole; feeds sleepHoursByDate', () => {
    const intervals = hcSleepIntervals([
      { startTime: iso('2026-07-18', 23), endTime: iso('2026-07-19', 7) },
    ]);
    expect(intervals).toHaveLength(1);
    expect(sleepHoursByDate(intervals)['2026-07-19']).toBe(8);
  });

  test('with stages, only asleep stages count (awake/out-of-bed excluded)', () => {
    const intervals = hcSleepIntervals([
      {
        startTime: iso('2026-07-18', 23),
        endTime: iso('2026-07-19', 7),
        stages: [
          { startTime: iso('2026-07-18', 23), endTime: iso('2026-07-19', 0), stage: 1 },      // awake
          { startTime: iso('2026-07-19', 0), endTime: iso('2026-07-19', 3), stage: 4 },       // light
          { startTime: iso('2026-07-19', 3), endTime: iso('2026-07-19', 4), stage: 5 },       // deep
          { startTime: iso('2026-07-19', 4), endTime: iso('2026-07-19', 4, 30), stage: 7 },   // awake in bed
          { startTime: iso('2026-07-19', 4, 30), endTime: iso('2026-07-19', 6, 30), stage: 6 }, // REM
        ],
      },
    ]);
    expect(sleepHoursByDate(intervals)['2026-07-19']).toBe(6);
  });
});

describe('mapHCWorkout', () => {
  test('maps exercise types with stable hc- ids; title wins over type name', () => {
    const w = mapHCWorkout({
      id: 'rec-1',
      exerciseType: 56,
      startTime: iso('2026-07-19', 18),
      endTime: iso('2026-07-19', 18, 40),
    });
    expect(w.id).toBe('hc-rec-1');
    expect(w.name).toBe('Running');
    expect(w.programName).toBe('Health Connect');
    expect(w.durationMinutes).toBe(40);
    expect(w.date).toBe('2026-07-19');

    const titled = mapHCWorkout({
      id: 'rec-2',
      exerciseType: 0,
      startTime: iso('2026-07-19', 7),
      endTime: iso('2026-07-19', 7, 30),
      title: 'Morning Circuit',
    });
    expect(titled.name).toBe('Morning Circuit');
  });

  test('unknown type without title falls back to generic Workout', () => {
    const w = mapHCWorkout({
      id: 'rec-3',
      exerciseType: 9999,
      startTime: iso('2026-07-19', 7),
      endTime: iso('2026-07-19', 8),
    });
    expect(w.name).toBe('Workout');
    expect(w.calories).toBe(0);
  });
});
