import { KycCheckType } from '@prisma/client';
import type { CheckContext, CheckResult, KycCheckPort } from '../check.types';

/**
 * Base for the v1 stub adapters. Each real check will replace `run` with its
 * implementation (OCR service call, AML provider call, etc.). Until then the
 * stub returns `manual_review` so the case routes to a human rather than
 * silently passing — the safe default for a KYC gate.
 */
export abstract class StubCheckAdapter implements KycCheckPort {
  abstract readonly type: KycCheckType;
  protected abstract readonly implNote: string;

  async run(_ctx: CheckContext): Promise<CheckResult> {
    return {
      status: 'manual_review',
      provider: `stub:${this.type}`,
      providerVersion: '0.0.0',
      reason: `not_implemented: ${this.implNote}`,
      evidence: { stub: true },
    };
  }
}
