import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import {
  applyDefaultLenderPlan,
  assertDefaultLenderEligible,
  planDefaultLenderSwitch,
} from './default-lender';

const partners = [
  { id: 'aj', isDefaultLender: true, active: true },
  { id: 'blox', isDefaultLender: false, active: true },
  { id: 'qib', isDefaultLender: false, active: false },
];

describe('default lender switch', () => {
  it('clears every other default when a partner is made the default', () => {
    const plan = planDefaultLenderSwitch(partners, 'blox', true);
    expect(plan).toEqual({ clearIds: ['aj'], targetIsDefault: true, changed: true });
    const next = applyDefaultLenderPlan(partners, 'blox', plan);
    expect(next.filter((p) => p.isDefaultLender).map((p) => p.id)).toEqual(['blox']);
  });

  it('is a no-op when the target is already the only default', () => {
    const plan = planDefaultLenderSwitch(partners, 'aj', true);
    expect(plan).toEqual({ clearIds: [], targetIsDefault: true, changed: false });
    expect(applyDefaultLenderPlan(partners, 'aj', plan)).toEqual(partners);
  });

  it('repairs a corrupted state with several defaults', () => {
    const corrupted = [
      { id: 'a', isDefaultLender: true },
      { id: 'b', isDefaultLender: true },
      { id: 'c', isDefaultLender: false },
    ];
    const plan = planDefaultLenderSwitch(corrupted, 'a', true);
    expect(plan.clearIds).toEqual(['b']);
    expect(plan.changed).toBe(true);
    expect(applyDefaultLenderPlan(corrupted, 'a', plan).filter((p) => p.isDefaultLender)).toHaveLength(1);
  });

  it('un-marking the default leaves no default lender', () => {
    const plan = planDefaultLenderSwitch(partners, 'aj', false);
    expect(plan).toEqual({ clearIds: [], targetIsDefault: false, changed: true });
    expect(applyDefaultLenderPlan(partners, 'aj', plan).some((p) => p.isDefaultLender)).toBe(false);
  });

  it('leaves the flag untouched when the payload omits it', () => {
    expect(planDefaultLenderSwitch(partners, 'aj', undefined)).toEqual({
      clearIds: [],
      targetIsDefault: true,
      changed: false,
    });
    expect(planDefaultLenderSwitch(partners, 'blox', undefined).targetIsDefault).toBe(false);
  });

  it('treats a partner that is being created as a non-default newcomer', () => {
    const plan = planDefaultLenderSwitch(partners, 'new', true);
    expect(plan.clearIds).toEqual(['aj']);
    expect(plan.targetIsDefault).toBe(true);
  });

  it('refuses an inactive default lender', () => {
    expect(() => assertDefaultLenderEligible({ active: false }, true)).toThrow(BadRequestException);
    expect(() => assertDefaultLenderEligible({ active: false }, true)).toThrow(
      'default_lender_must_be_active',
    );
    expect(() => assertDefaultLenderEligible({ active: false }, false)).not.toThrow();
    expect(() => assertDefaultLenderEligible({ active: true }, true)).not.toThrow();
  });
});
