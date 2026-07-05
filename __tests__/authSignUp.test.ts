/**
 * authStore.signUp — email-confirmation-aware return value.
 *
 * With "Confirm email" disabled in Supabase, signUp issues a session right
 * away and the login screen routes straight to onboarding; with it enabled
 * the session is null and the legacy "check your email" flow must run.
 */

const mockSignUp = jest.fn();

jest.mock('../services/supabase', () => ({
  supabase: { auth: { signUp: (...args: unknown[]) => mockSignUp(...args) } },
}));

jest.mock('../services/sync', () => ({
  stopSync: jest.fn(),
  startSync: jest.fn(),
}));

import { useAuthStore } from '../stores/authStore';

describe('authStore.signUp', () => {
  beforeEach(() => mockSignUp.mockReset());

  it('returns true when Supabase issues a session immediately (confirmation disabled)', async () => {
    mockSignUp.mockResolvedValue({ data: { session: { access_token: 'tok' } }, error: null });
    await expect(useAuthStore.getState().signUp('a@b.com', 'Password12345')).resolves.toBe(true);
  });

  it('returns false when a confirmation email is pending (no session)', async () => {
    mockSignUp.mockResolvedValue({ data: { session: null }, error: null });
    await expect(useAuthStore.getState().signUp('a@b.com', 'Password12345')).resolves.toBe(false);
  });

  it('throws on Supabase error', async () => {
    mockSignUp.mockResolvedValue({ data: { session: null }, error: new Error('email taken') });
    await expect(useAuthStore.getState().signUp('a@b.com', 'Password12345')).rejects.toThrow('email taken');
  });
});
