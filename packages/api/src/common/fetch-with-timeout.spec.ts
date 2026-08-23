import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  FetchTimeoutError,
  HTTP_REQUEST_TIMEOUT_CODE,
  fetchWithTimeout,
  resolveHttpTimeoutMs,
} from './fetch-with-timeout';

describe('resolveHttpTimeoutMs', () => {
  it('returns fallback for empty or invalid values', () => {
    expect(resolveHttpTimeoutMs(undefined, 8000)).toBe(8000);
    expect(resolveHttpTimeoutMs('', 8000)).toBe(8000);
    expect(resolveHttpTimeoutMs('nope', 8000)).toBe(8000);
    expect(resolveHttpTimeoutMs('0', 8000)).toBe(8000);
  });

  it('parses positive integers', () => {
    expect(resolveHttpTimeoutMs('12000', 8000)).toBe(12000);
  });
});

describe('fetchWithTimeout', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('returns the response when fetch completes in time', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => '' }),
    );

    const res = await fetchWithTimeout('https://example.com/test', { method: 'GET' }, 5000);
    expect(res.ok).toBe(true);
  });

  it('throws http_request_timeout when the request hangs past the deadline', async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url: string, init?: RequestInit) =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => {
              reject(new DOMException('The operation was aborted.', 'AbortError'));
            });
          }),
      ),
    );

    const pending = fetchWithTimeout('https://zoho.example/leads', {}, 100);
    const assertion = expect(pending).rejects.toMatchObject({
      message: HTTP_REQUEST_TIMEOUT_CODE,
      timeoutMs: 100,
      url: 'https://zoho.example/leads',
    });
    await vi.advanceTimersByTimeAsync(100);
    await assertion;
  });
});
