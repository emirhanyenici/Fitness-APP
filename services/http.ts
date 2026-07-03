/**
 * Network helpers shared by the API services (USDA, Open Food Facts, wger,
 * edge functions).
 *
 * `fetch` has no built-in timeout: on a dead or very slow connection a request
 * can hang indefinitely, leaving spinners stuck and buttons disabled. This
 * wrapper aborts after `ms` (default 12s) so the UI can fail fast and show a
 * clear "check your connection" message instead of hanging.
 */
const DEFAULT_TIMEOUT_MS = 12_000;

export class TimeoutError extends Error {
  constructor(message = 'Request timed out. Check your connection.') {
    super(message);
    this.name = 'TimeoutError';
  }
}

export async function fetchWithTimeout(
  input: RequestInfo,
  init: RequestInit = {},
  ms = DEFAULT_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (e: any) {
    // A caller-supplied AbortError (e.g. a real abort) and our timeout both
    // surface as AbortError; treat them as a connection/timeout failure.
    if (e?.name === 'AbortError') throw new TimeoutError();
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
