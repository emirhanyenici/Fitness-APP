import { DEFAULT_TIMES, resolveTime, parseTime } from '../services/notifications';

describe('resolveTime', () => {
  test('falls back to the default when the profile has no override', () => {
    expect(resolveTime(null, 'notif_workout')).toBe(DEFAULT_TIMES.notif_workout);
    expect(resolveTime({}, 'notif_sleep')).toBe(DEFAULT_TIMES.notif_sleep);
  });

  test('reads the per-key override when present', () => {
    expect(resolveTime({ notif_calorie_time: '13:30' }, 'notif_calorie')).toBe('13:30');
  });
});

describe('parseTime', () => {
  test('parses a valid "HH:mm" string', () => {
    expect(parseTime('07:05', 'notif_workout')).toEqual({ hour: 7, minute: 5 });
  });

  test('clamps out-of-range values', () => {
    expect(parseTime('25:99', 'notif_workout')).toEqual({ hour: 23, minute: 59 });
  });

  test('falls back to the key default on malformed input', () => {
    const [h, m] = DEFAULT_TIMES.notif_sleep.split(':').map(Number);
    expect(parseTime('not-a-time', 'notif_sleep')).toEqual({ hour: h, minute: m });
  });
});
