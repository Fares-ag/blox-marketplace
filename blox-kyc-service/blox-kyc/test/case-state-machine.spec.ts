import { describe, it, expect } from 'vitest';
import { canTransition, assertTransition, isTerminal, nextStatesFrom } from '../src/kyc/case-engine/case-state-machine';

describe('KYC case state machine', () => {
  it('allows the happy path created -> capturing -> checks_running -> reviewing -> approved', () => {
    expect(canTransition('created', 'capturing')).toBe(true);
    expect(canTransition('capturing', 'checks_running')).toBe(true);
    expect(canTransition('checks_running', 'needs_review')).toBe(true);
    expect(canTransition('needs_review', 'reviewing')).toBe(true);
    expect(canTransition('reviewing', 'approved')).toBe(true);
    expect(canTransition('reviewing', 'rejected')).toBe(true);
  });

  it('allows auto-approve directly from checks_running', () => {
    expect(canTransition('checks_running', 'approved')).toBe(true);
  });

  it('forbids illegal jumps', () => {
    expect(canTransition('created', 'approved')).toBe(false);
    expect(canTransition('approved', 'reviewing')).toBe(false);
    expect(() => assertTransition('created', 'approved')).toThrow(/illegal_transition/);
  });

  it('marks terminal states', () => {
    expect(isTerminal('approved')).toBe(true);
    expect(isTerminal('rejected')).toBe(true);
    expect(isTerminal('expired')).toBe(true);
    expect(isTerminal('reviewing')).toBe(false);
  });

  it('permits expiry from any active state', () => {
    for (const s of ['created', 'capturing', 'checks_running', 'needs_review', 'step_up_required', 'reviewing'] as const) {
      expect(canTransition(s, 'expired')).toBe(true);
    }
    expect(nextStatesFrom('reviewing')).toContain('approved');
  });
});
