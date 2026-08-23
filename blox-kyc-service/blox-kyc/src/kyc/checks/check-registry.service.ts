import { Inject, Injectable } from '@nestjs/common';
import { KycCheckType } from '@prisma/client';
import { KYC_CHECK, type KycCheckPort, type CheckContext, type CheckResult } from './check.types';

/** Resolves check adapters by type and runs them. */
@Injectable()
export class CheckRegistryService {
  private readonly byType = new Map<KycCheckType, KycCheckPort>();

  constructor(@Inject(KYC_CHECK) adapters: KycCheckPort[]) {
    for (const adapter of adapters) {
      this.byType.set(adapter.type, adapter);
    }
  }

  has(type: KycCheckType): boolean {
    return this.byType.has(type);
  }

  async run(type: KycCheckType, ctx: CheckContext): Promise<CheckResult> {
    const adapter = this.byType.get(type);
    if (!adapter) {
      return {
        status: 'error',
        provider: 'registry',
        providerVersion: '1.0.0',
        reason: `no_adapter_for:${type}`,
      };
    }
    try {
      return await adapter.run(ctx);
    } catch (err) {
      return {
        status: 'error',
        provider: adapter.type,
        providerVersion: '0.0.0',
        reason: err instanceof Error ? err.message : 'adapter_threw',
      };
    }
  }
}
