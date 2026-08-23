import { describe, expect, it, vi } from 'vitest';
import { IdempotencyService } from './idempotency.service';

describe('IdempotencyService', () => {
  it('replays a stored response without re-running the handler', async () => {
    const stored = { id: 'app-1', status: 'draft' };
    const handler = vi.fn();

    const prisma = {
      idempotencyRecord: {
        findUnique: vi.fn().mockResolvedValue({
          responseBody: stored,
          statusCode: 201,
        }),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
    };

    const service = new IdempotencyService(prisma as never);
    const result = await service.run({
      userId: 'user-1',
      scope: 'POST:applications',
      idempotencyKey: 'key-abc',
      handler,
    });

    expect(result).toEqual(stored);
    expect(handler).not.toHaveBeenCalled();
    expect(prisma.idempotencyRecord.create).not.toHaveBeenCalled();
  });

  it('stores the handler result on first use', async () => {
    const handlerResult = { transaction_id: 'txn-1' };
    const handler = vi.fn().mockResolvedValue(handlerResult);

    const prisma = {
      idempotencyRecord: {
        findUnique: vi
          .fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({ responseBody: handlerResult }),
        create: vi.fn().mockResolvedValue(undefined),
        update: vi.fn().mockResolvedValue(undefined),
        delete: vi.fn(),
      },
    };

    const service = new IdempotencyService(prisma as never);
    const result = await service.run({
      userId: 'user-1',
      scope: 'POST:applications/foo/skipcash',
      idempotencyKey: 'pay-1',
      handler,
    });

    expect(result).toEqual(handlerResult);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(prisma.idempotencyRecord.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        scope: 'POST:applications/foo/skipcash',
        idempotencyKey: 'pay-1',
        statusCode: 201,
      },
    });
    expect(prisma.idempotencyRecord.update).toHaveBeenCalledWith({
      where: {
        userId_scope_idempotencyKey: {
          userId: 'user-1',
          scope: 'POST:applications/foo/skipcash',
          idempotencyKey: 'pay-1',
        },
      },
      data: expect.objectContaining({
        responseBody: handlerResult,
        statusCode: 201,
        completedAt: expect.any(Date),
      }),
    });
  });

  it('runs the handler when no idempotency key is provided', async () => {
    const handlerResult = { ok: true };
    const handler = vi.fn().mockResolvedValue(handlerResult);

    const prisma = {
      idempotencyRecord: {
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
    };

    const service = new IdempotencyService(prisma as never);
    const result = await service.run({
      userId: 'user-1',
      scope: 'POST:applications',
      handler,
    });

    expect(result).toEqual(handlerResult);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(prisma.idempotencyRecord.findUnique).not.toHaveBeenCalled();
  });
});
