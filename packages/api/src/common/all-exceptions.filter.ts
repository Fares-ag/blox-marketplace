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
