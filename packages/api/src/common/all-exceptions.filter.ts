import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as Sentry from '@sentry/node';
import type { Request, Response } from 'express';
import {
  buildApiErrorEnvelope,
  resolveHttpException,
  resolvePrismaKnownError,
  type ResolvedApiError,
} from './api-error-envelope';
import { humanMessageForCode } from './error-messages';
import { getRequestId, REQUEST_ID_HEADER, resolveRequestId } from './request-id';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const requestId =
      getRequestId() ??
      resolveRequestId(request.headers[REQUEST_ID_HEADER] as string | string[] | undefined);

    response.setHeader(REQUEST_ID_HEADER, requestId);

    const resolved = this.resolveException(exception);

    // Client errors are logged too, at warn. They are not our crash, but they
    // are the only trace of a request the caller could not complete: a form
    // that will not submit, or an upload the UI offered and the API refused,
    // otherwise leaves nothing on the server at all. Without this a 400 can
    // only be diagnosed by asking the person to reproduce it with devtools
    // open. The code and request id are enough to find it; no payload is
    // logged, since these carry customer details.
    if (
      resolved.status >= HttpStatus.BAD_REQUEST &&
      resolved.status < HttpStatus.INTERNAL_SERVER_ERROR &&
      resolved.status !== HttpStatus.UNAUTHORIZED &&
      resolved.status !== HttpStatus.NOT_FOUND
    ) {
      this.logger.warn(
        `${request.method} ${request.url} -> ${resolved.status} ${resolved.code} [${requestId}]`,
      );
    }

    if (resolved.status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${request.method} ${request.url} -> ${resolved.code}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
      Sentry.withScope((scope) => {
        scope.setTag('request_id', requestId);
        scope.setTag('error_code', resolved.code);
        Sentry.captureException(exception);
      });
    }

    response.status(resolved.status).json(buildApiErrorEnvelope(resolved, requestId));
  }

  private resolveException(exception: unknown): ResolvedApiError {
    if (exception instanceof HttpException) {
      return resolveHttpException(exception);
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      return resolvePrismaKnownError(exception);
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'internal_error',
      message: humanMessageForCode('internal_error'),
    };
  }
}
