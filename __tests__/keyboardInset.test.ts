import { computeKeyboardInset } from '../hooks/useKeyboardInset';

describe('computeKeyboardInset', () => {
  it('returns the overlap between keyboard top and window bottom', () => {
    // 844pt window, keyboard top at 508 → 336pt of keyboard
    expect(computeKeyboardInset(844, 508)).toBe(336);
  });

  it('returns 0 when the keyboard is off-screen (dismissed)', () => {
    // Dismissed keyboards report screenY at (or past) the window bottom
    expect(computeKeyboardInset(844, 844)).toBe(0);
    expect(computeKeyboardInset(844, 900)).toBe(0);
  });

  it('subtracts static bottom padding the layout already reserves', () => {
    expect(computeKeyboardInset(844, 508, 32)).toBe(304);
  });

  it('never goes negative when the offset exceeds the overlap', () => {
    expect(computeKeyboardInset(844, 840, 32)).toBe(0);
  });
});
