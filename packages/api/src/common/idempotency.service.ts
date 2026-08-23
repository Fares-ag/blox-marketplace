import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { isUniqueConstraintError } from './prisma-errors';
import { MAX_IDEMPOTENCY_KEY_LENGTH } from './idempotency.constants';

const IN_FLIGHT_POLL_MS = 50;
const IN_FLIGHT_MAX_WAIT_MS = 30_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type IdempotencyWhere = {
  userId_scope_idempotencyKey: {
    userId: string;
    scope: string;
    idempotencyKey: string;
  };
};

@Injectable()
export class IdempotencyService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * When `idempotencyKey` is set, replays return the stored JSON body without
   * re-running the handler. Keys are scoped per user + route scope string.
   */
  async run<T>(opts: {
    userId: string;
    scope: string;
    idempotencyKey?: string | null;
    handler: () => Promise<T>;
    statusCode?: number;
  }): Promise<T> {
    const rawKey = opts.idempotencyKey?.trim();
    if (!rawKey) {
      return opts.handler();
    }
    if (rawKey.length > MAX_IDEMPOTENCY_KEY_LENGTH) {
      throw new BadRequestException('invalid_idempotency_key');
    }

    const where: IdempotencyWhere = {
      userId_scope_idempotencyKey: {
        userId: opts.userId,
        scope: opts.scope,
        idempotencyKey: rawKey,
      },
    };

    const existing = await this.prisma.idempotencyRecord.findUnique({ where });
    if (existing?.responseBody != null) {
      return existing.responseBody as T;
    }

    let ownsLock = false;
    if (!existing) {
      try {
        await this.prisma.idempotencyRecord.create({
          data: {
            userId: opts.userId,
            scope: opts.scope,
            idempotencyKey: rawKey,
            statusCode: opts.statusCode ?? 201,
          },
        });
        ownsLock = true;
      } catch (err) {
        if (!isUniqueConstraintError(err)) throw err;
      }
    }

    if (!ownsLock) {
      return this.waitForStoredResponse<T>(where);
    }

    try {
      const result = await opts.handler();
      await this.prisma.idempotencyRecord.update({
        where,
        data: {
          responseBody: result as Prisma.InputJsonValue,
          statusCode: opts.statusCode ?? 201,
          completedAt: new Date(),
        },
      });
      return result;
    } catch (err) {
      await this.prisma.idempotencyRecord
        .delete({ where })
        .catch(() => undefined);
      throw err;
    }
  }

  private async waitForStoredResponse<T>(where: IdempotencyWhere): Promise<T> {
    const deadline = Date.now() + IN_FLIGHT_MAX_WAIT_MS;
    while (Date.now() < deadline) {
      const row = await this.prisma.idempotencyRecord.findUnique({ where });
      if (row?.responseBody != null) {
        return row.responseBody as T;
      }
      await sleep(IN_FLIGHT_POLL_MS);
    }
    throw new ConflictException('idempotency_in_progress');
  }
}
