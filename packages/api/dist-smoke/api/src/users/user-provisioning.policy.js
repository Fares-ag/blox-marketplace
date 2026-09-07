"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PRIVILEGED_STAFF_ROLES = exports.GROUP_MANAGEABLE_ROLES = exports.SUPER_ADMIN_ONLY_ROLES = void 0;
exports.isSuperAdminOnlyRole = isSuperAdminOnlyRole;
exports.assertCanProvisionRole = assertCanProvisionRole;
exports.assertCanManageUserRole = assertCanManageUserRole;
exports.assertPartnerViewerAssignment = assertPartnerViewerAssignment;
exports.assertHomeBranchInCompany = assertHomeBranchInCompany;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
exports.SUPER_ADMIN_ONLY_ROLES = [client_1.UserRole.super_admin];
exports.GROUP_MANAGEABLE_ROLES = [
    client_1.UserRole.customer,
    client_1.UserRole.dealer_agent,
    client_1.UserRole.credit_officer,
    client_1.UserRole.finance_officer,
];
exports.PRIVILEGED_STAFF_ROLES = [
    client_1.UserRole.admin,
    client_1.UserRole.super_admin,
    client_1.UserRole.group_admin,
];
function isSuperAdminOnlyRole(role) {
    return exports.SUPER_ADMIN_ONLY_ROLES.includes(role);
}
function assertCanProvisionRole(actor, targetRole) {
    if (isSuperAdminOnlyRole(targetRole) && actor.role !== client_1.UserRole.super_admin) {
        throw new common_1.ForbiddenException('super_admin_required');
    }
    if (actor.role === client_1.UserRole.group_admin && !exports.GROUP_MANAGEABLE_ROLES.includes(targetRole)) {
        throw new common_1.ForbiddenException('forbidden_role');
    }
}
function assertCanManageUserRole(actor, targetRole, nextRole) {
    const touchesSuperAdmin = isSuperAdminOnlyRole(targetRole) || (nextRole !== undefined && isSuperAdminOnlyRole(nextRole));
    if (touchesSuperAdmin && actor.role !== client_1.UserRole.super_admin) {
        throw new common_1.ForbiddenException('super_admin_required');
    }
    if (actor.role === client_1.UserRole.group_admin && nextRole && !exports.GROUP_MANAGEABLE_ROLES.includes(nextRole)) {
        throw new common_1.ForbiddenException('forbidden_role');
    }
}
function assertPartnerViewerAssignment(role, financePartner, requested) {
    if (role !== client_1.UserRole.partner_viewer)
        return null;
    if (!requested)
        throw new common_1.BadRequestException('partner_viewer_requires_finance_partner');
    if (!financePartner || financePartner.id !== requested) {
        throw new common_1.BadRequestException('finance_partner_not_found');
    }
    return financePartner.id;
}
function assertHomeBranchInCompany(branch, companyId) {
    if (!companyId)
        throw new common_1.BadRequestException('branch_requires_company');
    if (!branch || branch.companyId !== companyId) {
        throw new common_1.BadRequestException('branch_not_in_company');
    }
}
//# sourceMappingURL=user-provisioning.policy.js.map