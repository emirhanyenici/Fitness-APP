import { kgToLbs, lbsToKg, cmToIn, inToCm, cmToFtIn, parseLocaleFloat } from '../services/units';

describe('parseLocaleFloat', () => {
  it('parses a plain dot-decimal string', () => {
    expect(parseLocaleFloat('74.6')).toBe(74.6);
  });

  it('parses a Turkish-keyboard comma-decimal string', () => {
    expect(parseLocaleFloat('74,6')).toBe(74.6);
  });

  it('parses a plain integer string', () => {
    expect(parseLocaleFloat('80')).toBe(80);
  });

  it('trims surrounding whitespace', () => {
    expect(parseLocaleFloat('  74,6  ')).toBe(74.6);
  });

  it('returns NaN for an empty string', () => {
    expect(parseLocaleFloat('')).toBeNaN();
  });

  it('returns NaN for non-numeric input', () => {
    expect(parseLocaleFloat('abc')).toBeNaN();
  });

  it('parses the leading numeric prefix like parseFloat, ignoring trailing garbage', () => {
    expect(parseLocaleFloat('74,6kg')).toBe(74.6);
  });

  it('handles a negative comma-decimal value', () => {
    expect(parseLocaleFloat('-3,5')).toBe(-3.5);
  });
});

describe('kgToLbs / lbsToKg', () => {
  it('converts kg to lbs at known reference values', () => {
    expect(kgToLbs(100)).toBe(220);
    expect(kgToLbs(0)).toBe(0);
  });

  it('converts lbs to kg at known reference values', () => {
    expect(lbsToKg(220.462, 0)).toBe(100);
  });

  it('round-trips within rounding tolerance', () => {
    const kg = 82;
    const roundTripped = lbsToKg(kgToLbs(kg, 4), 4);
    expect(roundTripped).toBeCloseTo(kg, 1);
  });
});

describe('cmToIn / inToCm', () => {
  it('converts cm to inches at known reference values', () => {
    expect(cmToIn(2.54, 0)).toBe(1);
  });

  it('converts inches to cm at known reference values', () => {
    expect(inToCm(1)).toBe(3);
    expect(inToCm(1, 2)).toBe(2.54);
  });
});

describe('cmToFtIn', () => {
  it('formats a height in the 5\'9" style', () => {
    expect(cmToFtIn(175.26)).toBe(`5'9"`);
  });

  it('formats an even-foot height without a fractional inch remainder', () => {
    expect(cmToFtIn(182.88)).toBe(`6'0"`);
  });
});
