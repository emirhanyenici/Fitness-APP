/**
 * Centralized error logging — one seam for crash/error reporting.
 *
 * Today this logs to the console. It is intentionally the SINGLE place to wire
 * a real backend (e.g. Sentry) later: set EXPO_PUBLIC_SENTRY_DSN, add
 * `@sentry/react-native`, and forward from `logError` — no other file changes.
 * Kept dependency-free so it works without a native SDK or an account.
 */

const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN ?? '';

/** True once a DSN is configured (real reporting can be enabled here). */
export const MONITORING_CONFIGURED = SENTRY_DSN.length > 0;

/** Log a handled or boundary-caught error with optional structured context. */
export function logError(error: unknown, context?: Record<string, unknown>): void {
  const err = error instanceof Error ? error : new Error(String(error));

  // eslint-disable-next-line no-console
  console.error('[monitoring]', err.message, context ?? {}, err.stack ?? '');

  // When a DSN is set and @sentry/react-native is installed, forward here:
  //   if (MONITORING_CONFIGURED) Sentry.captureException(err, { extra: context });
}
