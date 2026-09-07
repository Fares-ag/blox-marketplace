import { describe, expect, it } from 'vitest';
import { ApiError } from '../lib/api';
import type { IntakeTranslate } from './customer-info';
import { submitGateCode, submitGateMessage } from './submit-gate';

/** Echoes the key (like a locale with every key present) so assertions can name the copy that would show. */
const t: IntakeTranslate = (key) => key;

describe('submit gate codes (wave 2)', () => {
  it('recognises the freshness and guarantor gates', () => {
    expect(submitGateCode(new ApiError('x', 409, 'documents_stale'))).toBe('documents_stale');
    expect(submitGateCode(new ApiError('x', 409, 'guarantor_consent_required'))).toBe('guarantor_consent_required');
    expect(submitGateCode(new ApiError('x', 409, 'approval_authority_required'))).toBeNull();
    expect(submitGateCode(new Error('boom'))).toBeNull();
  });

  it('lists the stale categories after the guidance', () => {
    const error = new ApiError('documents_stale', 409, 'documents_stale', { stale: ['salary', 'bank'] });
    const message = submitGateMessage(error, t);
    expect(message).toContain('dealerOps.submitGate.documents_stale');
    expect(message).toContain('applyFlow.docs.salary');
    expect(message).toContain('applyFlow.docs.bank');
  });

  it('returns the bare guidance when the API sent no categories', () => {
    const error = new ApiError('documents_stale', 409, 'documents_stale');
    expect(submitGateMessage(error, t)).toBe('dealerOps.submitGate.documents_stale');
    expect(submitGateMessage(new ApiError('x', 409, 'guarantor_consent_required'), t)).toBe(
      'dealerOps.submitGate.guarantor_consent_required',
    );
  });
});
