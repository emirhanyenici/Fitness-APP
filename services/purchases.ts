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
 * Safe to call multiple times; no-ops on web, in Expo Go (native module
 * missing), or when no API key is set — the app then stays on 'free'.
 */
export async function initPurchases(): Promise<void> {
  if (configured) return;
  if (Platform.OS === 'web' || !API_KEY) return;
  try {
    Purchases.configure({ apiKey: API_KEY });
    configured = true;
    // Live updates: fires on purchase, renewal, expiration and restore.
    Purchases.addCustomerInfoUpdateListener(applyCustomerInfo);
    applyCustomerInfo(await Purchases.getCustomerInfo());
  } catch (e) {
    // Native module unavailable (Expo Go) or network/store failure —
    // purchases simply stay disabled for this session.
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
