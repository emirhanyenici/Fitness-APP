jest.mock('../services/supabase', () => ({ supabase: {} }));

import { sanitizeNickname, formatHandle, isNicknameBlocked } from '../services/leaderboard';

describe('sanitizeNickname', () => {
  it('trims whitespace', () => {
    expect(sanitizeNickname('  Emir  ')).toBe('Emir');
  });

  it('strips the reserved # tag separator', () => {
    expect(sanitizeNickname('Emir#99')).toBe('Emir99');
  });

  it('caps length at 20 characters', () => {
    expect(sanitizeNickname('a'.repeat(30))).toHaveLength(20);
  });
});

describe('formatHandle', () => {
  it('joins nickname and tag with #', () => {
    expect(formatHandle('Emir', 1)).toBe('Emir#1');
  });

  it('disambiguates duplicate nicknames by tag', () => {
    expect(formatHandle('Emir', 1)).not.toBe(formatHandle('Emir', 2));
  });
});

describe('isNicknameBlocked', () => {
  it('allows a clean nickname', () => {
    expect(isNicknameBlocked('Emir')).toBe(false);
  });

  it('blocks a nickname containing a blocked word', () => {
    expect(isNicknameBlocked('fuckyou')).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(isNicknameBlocked('FUCKyou')).toBe(true);
  });

  it('blocks a substring match, not just exact match', () => {
    expect(isNicknameBlocked('xxbitchxx')).toBe(true);
  });
});
