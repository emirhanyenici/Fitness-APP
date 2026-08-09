import { groupByDate, formatWorkoutDate } from '../services/workoutHistory';
import { todayStr, daysAgoStr } from '../services/dateUtils';
import type { CompletedWorkout } from '../stores/workoutStore';

const workout = (over: Partial<CompletedWorkout>): CompletedWorkout => ({
  id: Math.random().toString(36),
  name: 'Push Day',
  icon: '🏋️',
  bodyPart: 'chest',
  duration: '40 min',
  calories: 300,
  exercisesDone: 5,
  exercisesTotal: 5,
  date: todayStr(),
  timestamp: Date.now(),
  ...over,
});

describe('formatWorkoutDate', () => {
  it('labels today as "Today"', () => {
    expect(formatWorkoutDate(todayStr())).toBe('Today');
  });

  it('labels yesterday as "Yesterday"', () => {
    expect(formatWorkoutDate(daysAgoStr(1))).toBe('Yesterday');
  });

  it('labels older dates with a weekday name', () => {
    const label = formatWorkoutDate(daysAgoStr(5));
    expect(label).not.toBe('Today');
    expect(label).not.toBe('Yesterday');
  });
});

describe('groupByDate', () => {
  it('leaves a single workout untouched', () => {
    const result = groupByDate([workout({ id: 'a' })]);
    expect(result).toHaveLength(1);
  });

  it('does not merge workouts from different days', () => {
    const result = groupByDate([
      workout({ id: 'a', date: todayStr() }),
      workout({ id: 'b', date: daysAgoStr(1) }),
    ]);
    expect(result).toHaveLength(2);
  });

  it('merges two same-day same-plan workouts, capping exercisesDone at exercisesTotal', () => {
    const date = todayStr();
    const result = groupByDate([
      workout({ id: 'a', date, name: 'Push Day', exercisesDone: 5, exercisesTotal: 5, calories: 300 }),
      workout({ id: 'b', date, name: 'Push Day', exercisesDone: 5, exercisesTotal: 5, calories: 200 }),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].exercisesDone).toBe(5);
    expect(result[0].exercisesTotal).toBe(5);
    expect(result[0].calories).toBe(500);
    expect(result[0].name).toBe('Push Day');
  });

  it('merges two same-day different-plan workouts, accumulating both totals and concatenating names', () => {
    const date = todayStr();
    const result = groupByDate([
      workout({ id: 'a', date, name: 'Push Day', dayLabel: 'Push', exercisesDone: 5, exercisesTotal: 5 }),
      workout({ id: 'b', date, name: 'Leg Day', dayLabel: 'Legs', exercisesDone: 4, exercisesTotal: 4 }),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].exercisesDone).toBe(9);
    expect(result[0].exercisesTotal).toBe(9);
    expect(result[0].name).toBe('Push Day + Legs');
  });

  it('recognizes a third same-day workout as a repeat of an already-merged plan (regression: isSamePlan against the original name, not the mutated one)', () => {
    const date = todayStr();
    const result = groupByDate([
      workout({ id: 'a', date, name: 'Push Day', dayLabel: 'Push', exercisesDone: 5, exercisesTotal: 5 }),
      workout({ id: 'b', date, name: 'Leg Day', dayLabel: 'Legs', exercisesDone: 4, exercisesTotal: 4 }),
      workout({ id: 'c', date, name: 'Push Day', dayLabel: 'Push', exercisesDone: 5, exercisesTotal: 5 }),
    ]);
    expect(result).toHaveLength(1);
    // Third entry repeats "Push Day" (already merged) — should be capped, not accumulated again.
    expect(result[0].exercisesTotal).toBe(9);
    expect(result[0].exercisesDone).toBe(9);
    expect(result[0].name).toBe('Push Day + Legs');
  });

  it('merges exerciseWeights, only overwriting with positive values', () => {
    const date = todayStr();
    const result = groupByDate([
      workout({ id: 'a', date, exerciseWeights: { Squat: 60, Bench: 40 } }),
      workout({ id: 'b', date, exerciseWeights: { Squat: 0, Bench: 45 } }),
    ]);
    expect(result[0].exerciseWeights).toEqual({ Squat: 60, Bench: 45 });
  });
});
