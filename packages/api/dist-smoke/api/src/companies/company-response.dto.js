"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toAdminCompanyDto = toAdminCompanyDto;
exports.toDealerCompanyDto = toDealerCompanyDto;
exports.toPublicCompanyListItemDto = toPublicCompanyListItemDto;
exports.toPublicCompanyDetailDto = toPublicCompanyDetailDto;
const branding_1 = require("./branding");
function toAdminCompanyDto(company) {
    return {
        id: company.id,
        name: company.name,
        code: company.code,
        status: company.status,
        kind: company.kind,
        parent_company_id: company.parentCompanyId,
        parent_name: company.parentCompany?.name ?? null,
        child_count: company._count?.childCompanies ?? 0,
        can_pay: company.canPay,
        allow_direct_activate: company.allowDirectActivate,
        contact_email: company.contactEmail,
        contact_phone: company.contactPhone,
        logo_url: company.logoUrl,
        address: company.address,
        branding: (0, branding_1.toBrandingDto)(company.branding, company.logoUrl),
        created_at: company.createdAt,
        updated_at: company.updatedAt,
    };
}
function toDealerCompanyDto(company) {
    return {
        id: company.id,
        name: company.name,
        code: company.code,
        status: company.status,
        kind: company.kind,
        parent_company_id: company.parentCompanyId,
        logo_url: company.logoUrl,
        branding: (0, branding_1.toBrandingDto)(company.branding, company.logoUrl),
        contact_email: company.contactEmail,
        contact_phone: company.contactPhone,
        address: company.address,
        allow_direct_activate: company.allowDirectActivate,
        can_pay: company.canPay,
    };
}
function toPublicCompanyListItemDto(company) {
    return {
        id: company.id,
        name: company.name,
        code: company.code,
        logo_url: company.logoUrl,
        published_count: company.published_count,
    };
}
function toPublicCompanyDetailDto(company) {
    const branding = (0, branding_1.toBrandingDto)(company.branding, company.logoUrl);
    return {
        id: company.id,
        name: company.name,
        code: company.code,
        logo_url: company.logoUrl ?? branding?.logo_url ?? null,
        branding,
        address: company.address,
        contact_phone: company.contactPhone,
        published_count: company.published_count,
    };
}
//# sourceMappingURL=company-response.dto.js.map