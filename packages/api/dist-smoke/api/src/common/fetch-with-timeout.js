"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FetchTimeoutError = exports.HTTP_REQUEST_TIMEOUT_CODE = void 0;
exports.resolveHttpTimeoutMs = resolveHttpTimeoutMs;
exports.fetchWithTimeout = fetchWithTimeout;
exports.HTTP_REQUEST_TIMEOUT_CODE = 'http_request_timeout';
class FetchTimeoutError extends Error {
    timeoutMs;
    url;
    constructor(timeoutMs, url) {
        super(exports.HTTP_REQUEST_TIMEOUT_CODE);
        this.name = 'FetchTimeoutError';
        this.timeoutMs = timeoutMs;
        this.url = url;
    }
}
exports.FetchTimeoutError = FetchTimeoutError;
function resolveHttpTimeoutMs(raw, fallback) {
    if (raw == null || raw.trim() === '')
        return fallback;
    const n = Number.parseInt(raw, 10);
    if (!Number.isFinite(n) || n <= 0)
        return fallback;
    return n;
}
function mergeAbortSignals(signals) {
    if (signals.length === 1)
        return signals[0];
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
async function fetchWithTimeout(url, init = {}, timeoutMs) {
    const controller = new AbortController();
    const urlString = String(url);
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const signal = init.signal
        ? mergeAbortSignals([init.signal, controller.signal])
        : controller.signal;
    try {
        return await fetch(url, { ...init, signal });
    }
    catch (err) {
        if (controller.signal.aborted) {
            throw new FetchTimeoutError(timeoutMs, urlString);
        }
        throw err;
    }
    finally {
        clearTimeout(timer);
    }
}
//# sourceMappingURL=fetch-with-timeout.js.map