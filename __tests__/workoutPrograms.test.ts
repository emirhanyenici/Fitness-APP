import { getRotationDays, getPlanByLabel, getTodayPlan, ProgramType } from '../services/workoutPrograms';

describe('getRotationDays', () => {
  it('returns the 3-day Push/Pull/Legs rotation', () => {
    const days = getRotationDays('push_pull_legs');
    expect(days.map((d) => d.dayLabel)).toEqual(['Push', 'Pull', 'Legs']);
  });

  it('returns the 2-day Upper/Lower rotation', () => {
    const days = getRotationDays('upper_lower');
    expect(days.map((d) => d.dayLabel)).toEqual(['Upper', 'Lower']);
  });

  it('returns the 5-day Bro Split rotation', () => {
    const days = getRotationDays('bro_split');
    expect(days.map((d) => d.dayLabel)).toEqual(['Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5']);
  });

  it.each<ProgramType>(['full_body', 'cardio_core', 'flexibility', 'custom'])(
    'returns an empty array for single-day program %s',
    (program) => {
      expect(getRotationDays(program)).toEqual([]);
    },
  );
});

describe('getPlanByLabel', () => {
  it('returns the matching day plan for a valid label', () => {
    const plan = getPlanByLabel('push_pull_legs', 'Legs');
    expect(plan?.dayLabel).toBe('Legs');
    expect(plan?.muscleGroup).toBe('Legs & Glutes');
  });

  it('returns null for a label not in the rotation', () => {
    expect(getPlanByLabel('push_pull_legs', 'Upper')).toBeNull();
  });

  it('returns null for a program with no rotation at all', () => {
    expect(getPlanByLabel('full_body', 'Full Body')).toBeNull();
  });

  it('filters to home-compatible equipment when environment is home', () => {
    const plan = getPlanByLabel('push_pull_legs', 'Push', 6, 'home');
    expect(plan).not.toBeNull();
    expect(plan!.exercises.length).toBeGreaterThan(0);
    for (const ex of plan!.exercises) {
      expect(['bodyweight', 'dumbbell']).toContain(ex.equipment);
    }
  });

  it('does not filter equipment for gym environment', () => {
    const plan = getPlanByLabel('push_pull_legs', 'Push', 6, 'gym');
    const equipmentTypes = new Set(plan!.exercises.map((e) => e.equipment));
    expect(equipmentTypes.size).toBeGreaterThan(1);
  });

  it('truncates exercises to the requested count', () => {
    const plan = getPlanByLabel('push_pull_legs', 'Push', 2, 'gym');
    expect(plan!.exercises).toHaveLength(2);
  });
});

describe('getTodayPlan', () => {
  it('cycles through the rotation as dayOfWeek increases', () => {
    const labels = [0, 1, 2, 3, 4, 5, 6].map((d) => getTodayPlan('push_pull_legs', d, 1, 'gym').dayLabel);
    expect(labels).toEqual(['Push', 'Pull', 'Legs', 'Push', 'Pull', 'Legs', 'Push']);
  });

  it('returns no exercises for an unconfigured custom program day', () => {
    const plan = getTodayPlan('custom', 0, 6, 'gym');
    expect(plan.exercises).toEqual([]);
  });

  it('returns the single full-body day regardless of dayOfWeek', () => {
    expect(getTodayPlan('full_body', 0).dayLabel).toBe('Full Body');
    expect(getTodayPlan('full_body', 6).dayLabel).toBe('Full Body');
  });
});
