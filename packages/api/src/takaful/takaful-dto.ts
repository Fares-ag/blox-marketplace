import type { TakafulPolicy } from '@prisma/client';
import type { TakafulPolicyDto } from '../../../shared/src/types/customer-platform';
import { daysToExpiry } from '../customers/vault-logic';

/** Version of the takaful declaration text the customer accepts when declaring a policy. */
export const TAKAFUL_DECLARATION_VERSION = 'takaful-2026-09-v1';

export const TAKAFUL_COVERAGE_TYPES = ['comprehensive', 'third_party'] as const;
export type TakafulCoverageType = (typeof TAKAFUL_COVERAGE_TYPES)[number];

export function ridersFromJson(raw: unknown): string[] {
  return Array.isArray(raw)
    ? raw.filter((r): r is string => typeof r === 'string' && r.trim().length > 0).map((r) => r.trim())
    : [];
}

function decimalToNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function isoDate(value: Date | null | undefined): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

export function toTakafulPolicyDto(policy: TakafulPolicy, now: Date = new Date()): TakafulPolicyDto {
  const coverage =
    policy.coverageType === 'comprehensive' || policy.coverageType === 'third_party' ? policy.coverageType : null;
  return {
    id: policy.id,
    application_id: policy.applicationId,
    provider: policy.provider || null,
    policy_number: policy.policyNumber ?? null,
    coverage_type: coverage,
    coverage_amount: decimalToNumber(policy.coverageAmount),
    premium_amount: decimalToNumber(policy.premiumAmount),
    issued_at: isoDate(policy.issuedAt),
    effective_from: isoDate(policy.effectiveFrom),
    expires_at: isoDate(policy.expiresAt),
    days_to_expiry: daysToExpiry(policy.expiresAt, now),
    riders: ridersFromJson(policy.riders),
    status: policy.status,
    declaration_accepted_at: policy.declarationAcceptedAt?.toISOString() ?? null,
    declaration_version: policy.declarationVersion ?? null,
    has_document: Boolean(policy.documentPath),
    verified_at: policy.verifiedAt?.toISOString() ?? null,
    created_at: policy.createdAt.toISOString(),
  };
}
