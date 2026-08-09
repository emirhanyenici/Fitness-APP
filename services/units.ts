/**
 * Shared metric↔imperial conversion helpers. Previously duplicated (with
 * slightly different rounding) across profile.tsx, history.tsx, and
 * add-measurement.tsx — consolidated here so all three stay in sync.
 */

function round(n: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}

/** kg → lbs. Weight display conventionally uses whole lbs (decimals=0); charts/measurements want more precision. */
export function kgToLbs(kg: number, decimals = 0): number {
  return round(kg * 2.20462, decimals);
}

export function lbsToKg(lbs: number, decimals = 1): number {
  return round(lbs / 2.20462, decimals);
}

/** cm → inches. Measurements default to 1 decimal; height conventionally rounds to a whole inch (decimals=0). */
export function cmToIn(cm: number, decimals = 1): number {
  return round(cm / 2.54, decimals);
}

export function inToCm(inches: number, decimals = 0): number {
  return round(inches * 2.54, decimals);
}

/** cm → a `5'9"` style feet+inches string, for height display. */
export function cmToFtIn(cm: number): string {
  const totalIn = cm / 2.54;
  const ft = Math.floor(totalIn / 12);
  const inch = Math.round(totalIn % 12);
  return `${ft}'${inch}"`;
}
