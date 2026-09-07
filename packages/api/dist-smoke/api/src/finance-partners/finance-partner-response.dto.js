"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FINANCE_PARTNER_INCLUDE = void 0;
exports.toFinancePartnerDto = toFinancePartnerDto;
exports.toFinancePartnerBranchDto = toFinancePartnerBranchDto;
exports.toFinancePartnerAdminDto = toFinancePartnerAdminDto;
exports.FINANCE_PARTNER_INCLUDE = {
    branches: { orderBy: [{ active: 'desc' }, { name: 'asc' }] },
    _count: { select: { applications: true } },
};
function toFinancePartnerDto(partner) {
    return {
        id: partner.id,
        code: partner.code,
        name: partner.name,
        crm_adapter: partner.crmAdapter,
    };
}
function toFinancePartnerBranchDto(branch) {
    return {
        id: branch.id,
        partner_id: branch.partnerId,
        code: branch.code,
        name: branch.name,
        city: branch.city,
        active: branch.active,
    };
}
function toFinancePartnerAdminDto(partner) {
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
//# sourceMappingURL=finance-partner-response.dto.js.map