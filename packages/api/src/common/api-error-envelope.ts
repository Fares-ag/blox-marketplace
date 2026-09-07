import { HttpException, HttpStatus } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  defaultCodeForHttpStatus,
  humanMessageForCode,
  isMachineErrorCode,
} from './error-messages';

export type ApiErrorBody = {
  error: {
    code: string;
    message: string;
    requestId: string;
    details?: Record<string, unknown>;
  };
};

export type ResolvedApiError = {
  status: number;
  code: string;
  message: string;
  details?: Record<string, unknown>;
};

export function buildApiErrorEnvelope(
  resolved: ResolvedApiError,
  requestId: string,
): ApiErrorBody {
  return {
    error: {
      code: resolved.code,
      message: resolved.message,
      requestId,
      ...(resolved.details ? { details: resolved.details } : {}),
    },
  };
}

function nestDefaultMessage(status: number): string | undefined {
  const labels: Record<number, string> = {
    [HttpStatus.BAD_REQUEST]: 'Bad Request',
    [HttpStatus.UNAUTHORIZED]: 'Unauthorized',
    [HttpStatus.FORBIDDEN]: 'Forbidden',
    [HttpStatus.NOT_FOUND]: 'Not Found',
    [HttpStatus.CONFLICT]: 'Conflict',
    [HttpStatus.PAYLOAD_TOO_LARGE]: 'Payload Too Large',
    [HttpStatus.INTERNAL_SERVER_ERROR]: 'Internal Server Error',
    [HttpStatus.NOT_IMPLEMENTED]: 'Not Implemented',
  };
  return labels[status];
}

/** Keys Nest itself puts on exception bodies; everything else is caller-supplied context. */
const ENVELOPE_RESERVED_KEYS = new Set(['message', 'statusCode', 'error']);

/**
 * Structured context thrown alongside a machine code, e.g.
 * `new ConflictException({ message: 'documents_missing', missing: ['bank'] })`.
 * Surfaces as `error.details` so clients can act on it (LOS flows rely on
 * `missing`, `application_id`, `remaining`, `retry_after_sec`, `violations`).
 */
function callerDetails(body: Record<string, unknown>): Record<string, unknown> | undefined {
  const entries = Object.entries(body).filter(
    ([key, value]) => !ENVELOPE_RESERVED_KEYS.has(key) && value !== undefined,
  );
  return entries.length ? Object.fromEntries(entries) : undefined;
}

export function resolveHttpException(exception: HttpException): ResolvedApiError {
  const status = exception.getStatus();
  const response = exception.getResponse();

  if (typeof response === 'string') {
    if (isMachineErrorCode(response)) {
      return { status, code: response, message: humanMessageForCode(response) };
    }
    return { status, code: defaultCodeForHttpStatus(status), message: response };
  }

  if (typeof response === 'object' && response !== null) {
    const body = response as Record<string, unknown>;
    const details = callerDetails(body);

    if (typeof body.error === 'string' && isMachineErrorCode(body.error)) {
      return {
        status,
        code: body.error,
        message: humanMessageForCode(body.error),
        ...(details ? { details } : {}),
      };
    }

    const rawMessage = body.message;
    if (typeof rawMessage === 'string' && isMachineErrorCode(rawMessage)) {
      return {
        status,
        code: rawMessage,
        message: humanMessageForCode(rawMessage),
        ...(details ? { details } : {}),
      };
    }

    if (Array.isArray(rawMessage)) {
      const messages = rawMessage.map(String);
      return {
        status,
        code: 'validation_failed',
        message: messages.join('; ') || humanMessageForCode('validation_failed'),
        details: { messages },
      };
    }

    if (typeof rawMessage === 'string') {
      if (rawMessage === nestDefaultMessage(status)) {
        const code = defaultCodeForHttpStatus(status);
        return { status, code, message: humanMessageForCode(code) };
      }
      return { status, code: defaultCodeForHttpStatus(status), message: rawMessage };
    }
  }

  const code = defaultCodeForHttpStatus(status);
  return { status, code, message: humanMessageForCode(code) };
}

export function resolvePrismaKnownError(error: Prisma.PrismaClientKnownRequestError): ResolvedApiError {
  switch (error.code) {
    case 'P2002':
      return {
        status: HttpStatus.CONFLICT,
        code: 'conflict',
        message: humanMessageForCode('conflict'),
        details: {
          prismaCode: error.code,
          target: error.meta?.target ?? null,
        },
      };
    case 'P2003':
      return {
        status: HttpStatus.CONFLICT,
        code: 'conflict',
        message: humanMessageForCode('conflict'),
        details: {
          prismaCode: error.code,
          field: error.meta?.field_name ?? null,
        },
      };
    case 'P2025':
      return {
        status: HttpStatus.NOT_FOUND,
        code: 'not_found',
        message: humanMessageForCode('not_found'),
        details: { prismaCode: error.code },
      };
    default:
      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        code: 'internal_error',
        message: humanMessageForCode('internal_error'),
        details: { prismaCode: error.code },
      };
  }
}
