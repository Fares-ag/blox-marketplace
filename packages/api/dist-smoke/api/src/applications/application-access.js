"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BLOCKING_APPLICATION_STATUSES = void 0;
exports.assertApplicationCanView = assertApplicationCanView;
const client_1 = require("@prisma/client");
const common_1 = require("@nestjs/common");
const company_scope_1 = require("./company-scope");
exports.BLOCKING_APPLICATION_STATUSES = [
    'draft',
    'under_review',
    'resubmission_required',
    'contract_signing_required',
    'contracts_submitted',
    'contract_under_review',
    'down_payment_required',
    'down_payment_submitted',
    'pending_finance_activation',
    'partner_processing',
    'active',
];
async function assertApplicationCanView(prisma, user, app) {
    if (user.role === client_1.UserRole.customer && app.customerUserId === user.id)
        return;
    if (user.role === client_1.UserRole.dealer_agent && user.companyId === app.companyId)
        return;
    const ops = [
        client_1.UserRole.credit_officer,
        client_1.UserRole.finance_officer,
        client_1.UserRole.admin,
        client_1.UserRole.super_admin,
        client_1.UserRole.group_admin,
    ];
    if (ops.includes(user.role)) {
        await (0, company_scope_1.assertCompanyScopeForRead)(prisma, user, app.companyId);
        return;
    }
    throw new common_1.ForbiddenException('forbidden_role');
}
//# sourceMappingURL=application-access.js.map