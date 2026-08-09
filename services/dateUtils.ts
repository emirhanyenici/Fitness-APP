/**
 * Local-timezone date helpers.
 *
 * `new Date().toISOString().slice(0, 10)` keys by the *UTC* calendar day, which
 * produces an off-by-one for any user not in UTC around midnight — breaking
 * streaks, daily resets and "today" filtering. These helpers format by the
 * device's local calendar day instead. Use them everywhere a YYYY-MM-DD day key
 * is needed.
 */

/** Format a Date as a local `YYYY-MM-DD` string. */
export function dateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Today's local date as `YYYY-MM-DD`. */
export function todayStr(): string {
  return dateStr(new Date());
}

/**
 * Local date `n` days before today as `YYYY-MM-DD`.
 * Negative `n` returns a future date. Uses local calendar arithmetic so it is
 * DST-safe (unlike subtracting fixed 86_400_000 ms).
 */
export function daysAgoStr(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return dateStr(d);
}

/**
 * Consecutive-day streak ending today (or yesterday, if today has no entry
 * yet), walking backward through `activeDates` until the first gap. Shared by
 * the home screen's streak display and the achievement system so both agree
 * on the exact same count.
 */
export function computeStreak(activeDates: Set<string>, today = todayStr()): number {
  const startFrom = activeDates.has(today) ? 0 : 1;
  let count = 0;
  for (let i = startFrom; i <= 365; i++) {
    if (activeDates.has(daysAgoStr(i))) { count++; } else { break; }
  }
  return count;
}
