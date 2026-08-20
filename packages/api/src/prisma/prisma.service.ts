import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ensureSystemUser } from '../common/ensure-system-user';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
    await ensureSystemUser(this);
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
