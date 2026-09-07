"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MFA_REQUIRED_ROLES = void 0;
exports.isMfaRequiredRole = isMfaRequiredRole;
const client_1 = require("@prisma/client");
exports.MFA_REQUIRED_ROLES = [
    client_1.UserRole.admin,
    client_1.UserRole.super_admin,
    client_1.UserRole.credit_officer,
    client_1.UserRole.finance_officer,
    client_1.UserRole.group_admin,
];
function isMfaRequiredRole(role) {
    return exports.MFA_REQUIRED_ROLES.includes(role);
}
//# sourceMappingURL=privileged-roles.js.map