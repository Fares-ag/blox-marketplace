/** Machine-readable code recorded by retry/backoff paths (Zoho sync, etc.). */
export const HTTP_REQUEST_TIMEOUT_CODE = 'http_request_timeout';

export class FetchTimeoutError extends Error {
  readonly timeoutMs: number;
  readonly url: string;

  constructor(timeoutMs: number, url: string) {
    super(HTTP_REQUEST_TIMEOUT_CODE);
    this.name = 'FetchTimeoutError';
    this.timeoutMs = timeoutMs;
    this.url = url;
  }
}

export function resolveHttpTimeoutMs(raw: string | undefined, fallback: number): number {
  if (raw == null || raw.trim() === '') return fallback;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return n;
}

function mergeAbortSignals(signals: AbortSignal[]): AbortSignal {
  if (signals.length === 1) return signals[0]!;
  if (typeof AbortSignal.any === 'function') {
    return AbortSignal.any(signals);
  }
  const controller = new AbortController();
  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort(signal.reason);
      return controller.signal;
    }
    signal.addEventListener('abort', () => controller.abort(signal.reason), { once: true });
  }
  return controller.signal;
}

/**
 * Outbound fetch with an AbortController timeout. Throws {@link FetchTimeoutError}
 * with message `http_request_timeout` when the deadline is exceeded.
 */
export async function fetchWithTimeout(
  url: string | URL,
  init: RequestInit = {},
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const urlString = String(url);
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const signal = init.signal
    ? mergeAbortSignals([init.signal, controller.signal])
    : controller.signal;

  try {
    return await fetch(url, { ...init, signal });
  } catch (err) {
    if (controller.signal.aborted) {
      throw new FetchTimeoutError(timeoutMs, urlString);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
