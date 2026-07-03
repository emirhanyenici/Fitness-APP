// Mock the native SDK before importing the service — jest-expo has no
// native RevenueCat module, and the service only needs it at runtime.
jest.mock('react-native-purchases', () => ({
  __esModule: true,
  default: {
    configure: jest.fn(),
    getCustomerInfo: jest.fn(),
    addCustomerInfoUpdateListener: jest.fn(),
    logIn: jest.fn(),
    logOut: jest.fn(),
  },
}));

import { planFromCustomerInfo } from '../services/purchases';

const withEntitlements = (keys: string[]) => ({
  entitlements: {
    active: Object.fromEntries(keys.map((k) => [k, { identifier: k }])),
  },
}) as any;

describe('planFromCustomerInfo', () => {
  it('returns free when no entitlements are active', () => {
    expect(planFromCustomerInfo(withEntitlements([]))).toBe('free');
  });

  it('returns pro for an active pro entitlement', () => {
    expect(planFromCustomerInfo(withEntitlements(['pro']))).toBe('pro');
  });

  it('returns elite for an active elite entitlement', () => {
    expect(planFromCustomerInfo(withEntitlements(['elite']))).toBe('elite');
  });

  it('prefers elite when both entitlements are active', () => {
    expect(planFromCustomerInfo(withEntitlements(['pro', 'elite']))).toBe('elite');
  });

  it('ignores unrelated entitlements', () => {
    expect(planFromCustomerInfo(withEntitlements(['something_else']))).toBe('free');
  });
});
