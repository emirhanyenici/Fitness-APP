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

// Key names that must never reach logs/Sentry, wherever they appear in a context object.
const SENSITIVE_KEY_RE = /token|password|secret|session|jwt|auth|key|email/i;

/**
 * Strip sensitive fields and deep objects from a log context before it leaves
 * the device. Guards against a future caller accidentally passing a full
 * user/session object into logError — only shallow primitives survive.
 */
function sanitizeContext(context: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(context)) {
    if (SENSITIVE_KEY_RE.test(k)) {
      out[k] = '[redacted]';
    } else if (v === null || v === undefined || typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
      out[k] = v;
    } else if (Array.isArray(v)) {
      out[k] = '[array]';
    } else {
      out[k] = '[object]';
    }
  }
  return out;
}

/** Log a handled or boundary-caught error with optional structured context. */
export function logError(error: unknown, context?: Record<string, unknown>): void {
  const err = error instanceof Error ? error : new Error(String(error));
  const safeContext = context ? sanitizeContext(context) : {};

  // eslint-disable-next-line no-console
  console.error('[monitoring]', err.message, safeContext, err.stack ?? '');

  // When a DSN is set and @sentry/react-native is installed, forward here:
  //   if (MONITORING_CONFIGURED) Sentry.captureException(err, { extra: safeContext });
}
