import { BadRequestException } from '@nestjs/common';

export type DefaultLenderCandidate = { id: string; isDefaultLender: boolean };

export type DefaultLenderPlan = {
  /** Partners that currently carry the flag and must lose it. */
  clearIds: string[];
  /** Whether the target partner ends up as the default lender. */
  targetIsDefault: boolean;
  /** True when the plan changes anything. */
  changed: boolean;
};

/**
 * Exactly one partner may be the lender of record for untagged offers.
 * Computes the writes needed to make (or un-make) `targetId` the default so
 * the controller can apply them inside a single transaction.
 *
 * `requested === undefined` keeps the target's current flag untouched.
 */
export function planDefaultLenderSwitch(
  partners: DefaultLenderCandidate[],
  targetId: string,
  requested: boolean | undefined,
): DefaultLenderPlan {
  const target = partners.find((p) => p.id === targetId);
  const currentlyDefault = target?.isDefaultLender ?? false;
  const targetIsDefault = requested === undefined ? currentlyDefault : requested;
  const clearIds = targetIsDefault
    ? partners.filter((p) => p.id !== targetId && p.isDefaultLender).map((p) => p.id)
    : [];
  return {
    clearIds,
    targetIsDefault,
    changed: clearIds.length > 0 || targetIsDefault !== currentlyDefault,
  };
}

/** Applies a plan to an in-memory list (used by tests and seeds). */
export function applyDefaultLenderPlan<T extends DefaultLenderCandidate>(
  partners: T[],
  targetId: string,
  plan: DefaultLenderPlan,
): T[] {
  return partners.map((p) => {
    if (p.id === targetId) return { ...p, isDefaultLender: plan.targetIsDefault };
    if (plan.clearIds.includes(p.id)) return { ...p, isDefaultLender: false };
    return p;
  });
}

/** The lender of record must be an active provider. */
export function assertDefaultLenderEligible(partner: { active: boolean }, isDefault: boolean): void {
  if (isDefault && !partner.active) {
    throw new BadRequestException('default_lender_must_be_active');
  }
}
