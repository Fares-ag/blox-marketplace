"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toFinancePartnerRefDto = toFinancePartnerRefDto;
exports.toAdminUserDto = toAdminUserDto;
exports.toAdminUserUpdateDto = toAdminUserUpdateDto;
exports.toAdminUserProvisionDto = toAdminUserProvisionDto;
exports.toAdminUserListResponse = toAdminUserListResponse;
const branch_response_dto_1 = require("../companies/branch-response.dto");
function toFinancePartnerRefDto(partner) {
    if (!partner)
        return null;
    return { id: partner.id, name: partner.name };
}
function toAdminUserDto(user) {
    return {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        company_id: user.companyId,
        company_name: user.company?.name ?? null,
        home_branch: (0, branch_response_dto_1.toBranchRefDto)(user.homeBranch),
        finance_partner: toFinancePartnerRefDto(user.financePartner),
        is_active: user.isActive,
        email_verified: user.emailVerified,
        created_at: user.createdAt,
    };
}
function toAdminUserUpdateDto(user) {
    return {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        company_id: user.companyId,
        home_branch: (0, branch_response_dto_1.toBranchRefDto)(user.homeBranch),
        finance_partner: toFinancePartnerRefDto(user.financePartner),
        is_active: user.isActive,
    };
}
function toAdminUserProvisionDto(user, extras) {
    return {
        ...toAdminUserUpdateDto(user),
        temporary_password: extras.temporaryPassword,
        login_url: extras.loginUrl,
        company_name: extras.companyName ?? null,
    };
}
function toAdminUserListResponse(items, total, limit, offset) {
    return { total, limit, offset, items: items.map((item) => toAdminUserDto(item)) };
}
//# sourceMappingURL=user-response.dto.js.map