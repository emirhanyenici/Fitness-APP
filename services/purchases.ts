import { Platform } from 'react-native';
import Purchases, { type CustomerInfo } from 'react-native-purchases';
import { useSubscriptionStore } from '../stores/subscriptionStore';
import { logError } from './monitoring';

// RevenueCat is the single source of truth for the subscription plan.
// The plan is intentionally NOT persisted locally and NOT cloud-synced:
// on every cold start we re-derive it from the SDK (which has its own
// on-device cache and works offline), so a revoked/expired subscription
// can never be resurrected from stale local state.

const API_KEY = Platform.select({
  ios: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY,
  android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY,
}) ?? '';

// TestFlight-only override: RevenueCat products/offering aren't set up yet,
// so real purchases can't be tested pre-launch. Every build submitted while
// this is 'true' grants Pro to every install for free — MUST be set back to
// 'false' (and rebuilt) before the App Store review submission.
const FORCE_PRO = process.env.EXPO_PUBLIC_FORCE_PRO === 'true';

let configured = false;
// Separate from `configured`: tracks whether getCustomerInfo() has ever
// actually succeeded. A transient failure (offline/timeout) used to leave
// `configured = true` forever (set right after Purchases.configure(), before
// the await), which made every later initPurchases() call a no-op — a paying
// user on a flaky network could get stuck on 'free' until they force-quit the
// app. Now only a successful hydration marks it done; initPurchases() keeps
// retrying (without re-configuring the SDK) until one succeeds.
let hydrated = false;

export function isPurchasesConfigured(): boolean {
  return configured;
}

export type Plan = 'free' | 'pro' | 'elite';

/** Map RevenueCat entitlements to our plan tiers. */
export function planFromCustomerInfo(info: Pick<CustomerInfo, 'entitlements'>): Plan {
  const active = info.entitlements.active;
  if (active['elite']) return 'elite';
  if (active['pro']) return 'pro';
  return 'free';
}

function applyCustomerInfo(info: CustomerInfo): void {
  useSubscriptionStore.getState().setPlan(FORCE_PRO ? 'pro' : planFromCustomerInfo(info));
}

/**
 * Configure the SDK and hydrate the plan from the current customer info.
 * Safe to call multiple times (e.g. on every foreground) — cheap no-op once
 * hydration has actually succeeded; retries hydration without re-configuring
 * the SDK if a prior attempt failed. No-ops entirely on web, in Expo Go
 * (native module missing), or when no API key is set — the app then stays
 * on 'free'.
 */
export async function initPurchases(): Promise<void> {
  if (hydrated) return;
  if (Platform.OS === 'web' || !API_KEY) return;
  try {
    if (!configured) {
      Purchases.configure({ apiKey: API_KEY });
      configured = true;
      // Live updates: fires on purchase, renewal, expiration and restore.
      Purchases.addCustomerInfoUpdateListener(applyCustomerInfo);
    }
    applyCustomerInfo(await Purchases.getCustomerInfo());
    hydrated = true;
  } catch (e) {
    // Native module unavailable (Expo Go) or network/store failure — plan
    // stays at its current value (default 'free') for now; the next
    // initPurchases() call (e.g. on foreground) will retry hydration.
    logError(e, { scope: 'purchases', op: 'init' });
  }
}

/**
 * Tie the RevenueCat identity to the Supabase account so entitlements
 * follow the user across devices. Best-effort.
 */
export async function logInPurchases(userId: string): Promise<void> {
  if (!configured) return;
  try {
    const { customerInfo } = await Purchases.logIn(userId);
    applyCustomerInfo(customerInfo);
  } catch (e) {
    logError(e, { scope: 'purchases', op: 'logIn' });
  }
}

/** Switch back to an anonymous RevenueCat identity on sign-out. Best-effort. */
export async function logOutPurchases(): Promise<void> {
  if (!configured) return;
  try {
    await Purchases.logOut();
  } catch (e) {
    logError(e, { scope: 'purchases', op: 'logOut' });
  }
}

export interface SubscriptionPeriodLabel {
  /** Full length, e.g. "1 year", "3 months", "1 week". */
  length: string;
  /** Unit for "per" pricing, e.g. "year", "month", "week". */
  per: string;
}

/**
 * App Store 3.1.2 requires the paywall to state each subscription's
 * length in plain words next to its price. Maps an ISO-8601 duration
 * from RevenueCat (`product.subscriptionPeriod`, e.g. "P1Y", "P1M",
 * "P3M", "P1W") to display strings. Returns null for a missing or
 * unrecognized period so the caller can fall back to a per-product label.
 */
export function formatSubscriptionPeriod(iso: string | null | undefined): SubscriptionPeriodLabel | null {
  if (!iso) return null;
  const m = /^P(\d+)([DWMY])$/.exec(iso);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n <= 0) return null;
  const unit = { D: 'day', W: 'week', M: 'month', Y: 'year' }[m[2] as 'D' | 'W' | 'M' | 'Y'];
  return { length: `${n} ${unit}${n === 1 ? '' : 's'}`, per: n === 1 ? unit : `${n} ${unit}s` };
}
