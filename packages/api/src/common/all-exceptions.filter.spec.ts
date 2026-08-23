import {
  ArgumentsHost,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { AllExceptionsFilter } from './all-exceptions.filter';
import { requestContext } from './request-id';

function mockHost(requestId?: string) {
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  const setHeader = vi.fn();
  const response = { status, setHeader, json };
  const request = {
    method: 'GET',
    url: '/api/test',
    headers: requestId ? { 'x-request-id': requestId } : {},
  };

  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => request,
    }),
  } as unknown as ArgumentsHost;

  return { host, status, json, setHeader };
}

describe('AllExceptionsFilter', () => {
  it('returns the standard envelope for HttpException', () => {
    const filter = new AllExceptionsFilter();
    const { host, status, json, setHeader } = mockHost('trace-abc');

    requestContext.run({ requestId: 'trace-abc' }, () => {
      filter.catch(new BadRequestException('documents_incomplete'), host);
    });

    expect(status).toHaveBeenCalledWith(400);
    expect(setHeader).toHaveBeenCalledWith('x-request-id', 'trace-abc');
    expect(json).toHaveBeenCalledWith({
      error: {
        code: 'documents_incomplete',
        message: 'Please upload all required documents before submitting.',
        requestId: 'trace-abc',
      },
    });
  });

  it('maps Prisma P2002 to 409 conflict', () => {
    const filter = new AllExceptionsFilter();
    const { host, status, json } = mockHost('trace-prisma');

    const err = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: 'test',
      meta: { target: ['code'] },
    });

    requestContext.run({ requestId: 'trace-prisma' }, () => {
      filter.catch(err, host);
    });

    expect(status).toHaveBeenCalledWith(409);
    expect(json.mock.calls[0][0].error.code).toBe('conflict');
    expect(json.mock.calls[0][0].error.requestId).toBe('trace-prisma');
  });

  it('returns internal_error without stack for unhandled errors', () => {
    const filter = new AllExceptionsFilter();
    const { host, status, json } = mockHost('trace-500');

    requestContext.run({ requestId: 'trace-500' }, () => {
      filter.catch(new Error('boom'), host);
    });

    expect(status).toHaveBeenCalledWith(500);
    const body = json.mock.calls[0][0];
    expect(body.error.code).toBe('internal_error');
    expect(body.error.requestId).toBe('trace-500');
    expect(body.error.message).toBe('An unexpected error occurred.');
    expect(body.stack).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain('boom');
  });

  it('maps bare NotFoundException to not_found', () => {
    const filter = new AllExceptionsFilter();
    const { host, status, json } = mockHost();

    filter.catch(new NotFoundException(), host);

    expect(status).toHaveBeenCalledWith(404);
    expect(json.mock.calls[0][0].error.code).toBe('not_found');
  });
});
