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

import { planFromCustomerInfo, formatSubscriptionPeriod } from '../services/purchases';

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

// App Store 3.1.2: the paywall must state each subscription's length next
// to its price; this maps RevenueCat's ISO-8601 period to display strings.
describe('formatSubscriptionPeriod', () => {
  it('maps the yearly product period', () => {
    expect(formatSubscriptionPeriod('P1Y')).toEqual({ length: '1 year', per: 'year' });
  });

  it('maps the monthly product period', () => {
    expect(formatSubscriptionPeriod('P1M')).toEqual({ length: '1 month', per: 'month' });
  });

  it('pluralizes multi-unit periods', () => {
    expect(formatSubscriptionPeriod('P3M')).toEqual({ length: '3 months', per: '3 months' });
    expect(formatSubscriptionPeriod('P1W')).toEqual({ length: '1 week', per: 'week' });
    expect(formatSubscriptionPeriod('P7D')).toEqual({ length: '7 days', per: '7 days' });
  });

  it('returns null for missing or unrecognized periods', () => {
    expect(formatSubscriptionPeriod(null)).toBeNull();
    expect(formatSubscriptionPeriod(undefined)).toBeNull();
    expect(formatSubscriptionPeriod('')).toBeNull();
    expect(formatSubscriptionPeriod('P0M')).toBeNull();
    expect(formatSubscriptionPeriod('1M')).toBeNull();
    expect(formatSubscriptionPeriod('P1Y2M')).toBeNull();
  });
});
