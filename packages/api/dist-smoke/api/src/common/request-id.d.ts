import { AsyncLocalStorage } from 'node:async_hooks';
import type { Express } from 'express';
import { ConsoleLogger } from '@nestjs/common';
export declare const REQUEST_ID_HEADER = "x-request-id";
type RequestContextStore = {
    requestId: string;
};
export declare const requestContext: AsyncLocalStorage<RequestContextStore>;
export declare function getRequestId(): string | undefined;
export declare function resolveRequestId(raw: string | string[] | undefined): string;
export declare function applyRequestIdMiddleware(expressApp: Express): void;
export declare class RequestIdLogger extends ConsoleLogger {
    private withRequestId;
    log(message: unknown, context?: string): void;
    warn(message: unknown, context?: string): void;
    error(message: unknown, stack?: string, context?: string): void;
    debug(message: unknown, context?: string): void;
    verbose(message: unknown, context?: string): void;
}
export {};
