/**
 * Unit tests for fetchWithTimeout — the offline/slow-network guard.
 * Verifies it resolves on a fast response and throws TimeoutError when the
 * request outlives the timeout budget.
 */
import { fetchWithTimeout, TimeoutError } from '../services/http';

describe('fetchWithTimeout', () => {
  const realFetch = global.fetch;
  afterEach(() => {
    global.fetch = realFetch;
    jest.useRealTimers();
  });

  it('resolves with the response when fetch succeeds in time', async () => {
    const fake = { ok: true, status: 200 } as Response;
    global.fetch = jest.fn().mockResolvedValue(fake);
    await expect(fetchWithTimeout('https://x.test', {}, 1000)).resolves.toBe(fake);
  });

  it('passes an AbortSignal to fetch', async () => {
    const spy = jest.fn().mockResolvedValue({ ok: true } as Response);
    global.fetch = spy;
    await fetchWithTimeout('https://x.test');
    expect(spy).toHaveBeenCalledWith('https://x.test', expect.objectContaining({ signal: expect.any(Object) }));
  });

  it('throws TimeoutError when fetch aborts', async () => {
    // Simulate fetch honoring the abort signal by rejecting with an AbortError.
    global.fetch = jest.fn((_input, init: any) => new Promise((_resolve, reject) => {
      init.signal.addEventListener('abort', () => {
        const err = new Error('Aborted');
        err.name = 'AbortError';
        reject(err);
      });
    })) as any;
    await expect(fetchWithTimeout('https://x.test', {}, 10)).rejects.toBeInstanceOf(TimeoutError);
  });

  it('re-throws non-abort network errors unchanged', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('DNS failure'));
    await expect(fetchWithTimeout('https://x.test', {}, 1000)).rejects.toThrow('DNS failure');
  });
});
