import type { FinancePartner, FinancePartnerBranch, Prisma } from '@prisma/client';

export const FINANCE_PARTNER_INCLUDE = {
  branches: { orderBy: [{ active: 'desc' }, { name: 'asc' }] },
  _count: { select: { applications: true } },
} satisfies Prisma.FinancePartnerInclude;

export type FinancePartnerRow = FinancePartner & {
  branches?: FinancePartnerBranch[];
  _count?: { applications?: number };
};

/** Legacy compact shape (`FinancePartner` in `@drivemarket/shared/types/domain`). */
export function toFinancePartnerDto(partner: Pick<FinancePartner, 'id' | 'code' | 'name' | 'crmAdapter'>) {
  return {
    id: partner.id,
    code: partner.code,
    name: partner.name,
    crm_adapter: partner.crmAdapter,
  };
}

/** Mirrors `FinancePartnerBranchDto` in `@drivemarket/shared/types/customer-platform`. */
export function toFinancePartnerBranchDto(branch: FinancePartnerBranch) {
  return {
    id: branch.id,
    partner_id: branch.partnerId,
    code: branch.code,
    name: branch.name,
    city: branch.city,
    active: branch.active,
  };
}

/**
 * Mirrors `FinancePartnerAdminDto` (finance-provider master, LOS FSD §5.8).
 * `crm_adapter` is kept as an extra field for the legacy consumers.
 */
export function toFinancePartnerAdminDto(partner: FinancePartnerRow) {
  return {
    id: partner.id,
    code: partner.code,
    name: partner.name,
    active: partner.active,
    crm_adapter: partner.crmAdapter,
    engagement_mode: partner.engagementMode,
    bre_ownership: partner.breOwnership,
    is_default_lender: partner.isDefaultLender,
    contact_name: partner.contactName,
    contact_email: partner.contactEmail,
    contact_phone: partner.contactPhone,
    notes: partner.notes,
    branches: (partner.branches ?? []).map((branch) => toFinancePartnerBranchDto(branch)),
    application_count: partner._count?.applications ?? 0,
  };
}
