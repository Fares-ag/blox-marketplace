import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import {
  buildApiErrorEnvelope,
  resolveHttpException,
  resolvePrismaKnownError,
} from './api-error-envelope';

describe('api-error-envelope', () => {
  it('maps machine-code HttpExceptions to code + human message', () => {
    const resolved = resolveHttpException(new ForbiddenException('forbidden_role'));
    expect(resolved).toEqual({
      status: 403,
      code: 'forbidden_role',
      message: 'You do not have permission to perform this action.',
    });
  });

  it('maps bare NotFoundException to not_found', () => {
    const resolved = resolveHttpException(new NotFoundException());
    expect(resolved.code).toBe('not_found');
    expect(resolved.status).toBe(404);
  });

  it('maps legacy object error payloads', () => {
    const resolved = resolveHttpException(
      new HttpException({ error: 'gateway_verification_required' }, HttpStatus.FORBIDDEN),
    );
    expect(resolved.code).toBe('gateway_verification_required');
  });

  it('maps validation arrays to validation_failed with details', () => {
    const resolved = resolveHttpException(
      new BadRequestException(['email must be an email', 'name should not be empty']),
    );
    expect(resolved.code).toBe('validation_failed');
    expect(resolved.details).toEqual({
      messages: ['email must be an email', 'name should not be empty'],
    });
  });

  it('maps Prisma P2002 to 409 conflict', () => {
    const err = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: 'test',
      meta: { target: ['email'] },
    });
    const resolved = resolvePrismaKnownError(err);
    expect(resolved.status).toBe(409);
    expect(resolved.code).toBe('conflict');
  });

  it('builds the standard response envelope', () => {
    const body = buildApiErrorEnvelope(
      {
        status: 409,
        code: 'stale_transition',
        message: 'This record was updated by another request. Refresh and try again.',
      },
      'req-123',
    );
    expect(body).toEqual({
      error: {
        code: 'stale_transition',
        message: 'This record was updated by another request. Refresh and try again.',
        requestId: 'req-123',
      },
    });
  });

  it('maps conflict machine codes from ConflictException', () => {
    const resolved = resolveHttpException(new ConflictException('stale_transition'));
    expect(resolved.status).toBe(409);
    expect(resolved.code).toBe('stale_transition');
  });

  it('maps user_already_exists to a customer-facing message', () => {
    const resolved = resolveHttpException(new BadRequestException('user_already_exists'));
    expect(resolved.code).toBe('user_already_exists');
    expect(resolved.message).toMatch(/already exists/i);
  });

  it('maps file_too_large payload errors', () => {
    const resolved = resolveHttpException(new PayloadTooLargeException('file_too_large'));
    expect(resolved.status).toBe(413);
    expect(resolved.code).toBe('file_too_large');
  });
});

describe('api-error-envelope structured details', () => {
  it('surfaces caller-supplied context next to a machine code', () => {
    const resolved = resolveHttpException(
      new ConflictException({ message: 'documents_missing', missing: ['bank', 'salary'] }),
    );
    expect(resolved.code).toBe('documents_missing');
    expect(resolved.details).toEqual({ missing: ['bank', 'salary'] });
  });

  it('omits details when the body only carries the code', () => {
    const resolved = resolveHttpException(new ConflictException({ message: 'blocking_application' }));
    expect(resolved.details).toBeUndefined();
  });
});
