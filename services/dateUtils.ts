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
