export declare const HTTP_REQUEST_TIMEOUT_CODE = "http_request_timeout";
export declare class FetchTimeoutError extends Error {
    readonly timeoutMs: number;
    readonly url: string;
    constructor(timeoutMs: number, url: string);
}
export declare function resolveHttpTimeoutMs(raw: string | undefined, fallback: number): number;
export declare function fetchWithTimeout(url: string | URL, init: RequestInit | undefined, timeoutMs: number): Promise<Response>;
