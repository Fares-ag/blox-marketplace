import { describe, it, expect } from 'vitest';
import { DecisioningService } from '../src/kyc/case-engine/decisioning.service';
import type { KycCheckType } from '@prisma/client';

const svc = new DecisioningService();
const required = svc.requiredForV1();
const pass = (type: KycCheckType) => ({ type, status: 'passed' as const });

describe('KYC decisioning', () => {
  it('auto-approves when every required check passes', () => {
    const latest = required.map(pass);
    expect(svc.decide(required, latest).nextStatus).toBe('approved');
  });

  it('routes to step_up when a required check is missing', () => {
    const latest = required.slice(1).map(pass);
    const out = svc.decide(required, latest);
    expect(out.nextStatus).toBe('step_up_required');
    expect(out.missing).toContain(required[0]);
  });

  it('routes to review on a failed check', () => {
    const latest = required.map((t, i) => (i === 0 ? { type: t, status: 'failed' as const } : pass(t)));
    expect(svc.decide(required, latest).nextStatus).toBe('needs_review');
  });

  it('routes to review when a check needs manual review (stub adapters)', () => {
    const latest = required.map((t, i) => (i === 0 ? { type: t, status: 'manual_review' as const } : pass(t)));
    expect(svc.decide(required, latest).nextStatus).toBe('needs_review');
  });
});
