import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import type { Express, NextFunction, Request, Response } from 'express';
import { ConsoleLogger } from '@nestjs/common';
import * as Sentry from '@sentry/node';

export const REQUEST_ID_HEADER = 'x-request-id';

type RequestContextStore = {
  requestId: string;
};

export const requestContext = new AsyncLocalStorage<RequestContextStore>();

/** Current request correlation id when running inside HTTP middleware. */
export function getRequestId(): string | undefined {
  return requestContext.getStore()?.requestId;
}

export function resolveRequestId(raw: string | string[] | undefined): string {
  if (typeof raw === 'string' && raw.trim()) return raw.trim();
  if (Array.isArray(raw) && raw[0]?.trim()) return raw[0].trim();
  return randomUUID();
}

/**
 * Express middleware: accept or generate `x-request-id`, echo on responses,
 * store in AsyncLocalStorage, and tag the active Sentry scope.
 */
export function applyRequestIdMiddleware(expressApp: Express): void {
  expressApp.use((req: Request, res: Response, next: NextFunction) => {
    const requestId = resolveRequestId(req.headers[REQUEST_ID_HEADER]);
    req.headers[REQUEST_ID_HEADER] = requestId;
    res.setHeader(REQUEST_ID_HEADER, requestId);

    Sentry.getCurrentScope().setTag('request_id', requestId);

    requestContext.run({ requestId }, () => next());
  });
}

/** Nest logger that prefixes messages with the active request id when present. */
export class RequestIdLogger extends ConsoleLogger {
  private withRequestId(message: unknown): string {
    const id = getRequestId();
    const body = typeof message === 'string' ? message : JSON.stringify(message);
    return id ? `[${id}] ${body}` : body;
  }

  override log(message: unknown, context?: string) {
    super.log(this.withRequestId(message), context);
  }

  override warn(message: unknown, context?: string) {
    super.warn(this.withRequestId(message), context);
  }

  override error(message: unknown, stack?: string, context?: string) {
    super.error(this.withRequestId(message), stack, context);
  }

  override debug(message: unknown, context?: string) {
    super.debug(this.withRequestId(message), context);
  }

  override verbose(message: unknown, context?: string) {
    super.verbose(this.withRequestId(message), context);
  }
}
