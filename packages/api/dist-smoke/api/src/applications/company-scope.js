"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.opsCompanyFilter = opsCompanyFilter;
exports.assertCompanyScope = assertCompanyScope;
exports.assertCompanyScopeForRead = assertCompanyScopeForRead;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const company_hierarchy_1 = require("../companies/company-hierarchy");
async function opsCompanyFilter(prisma, user) {
    if (user.role === client_1.UserRole.admin || user.role === client_1.UserRole.super_admin)
        return null;
    if (user.role === client_1.UserRole.group_admin) {
        if (!user.companyId)
            return [];
        return (0, company_hierarchy_1.resolveDescendantCompanyIds)(prisma, user.companyId);
    }
    if (user.role === client_1.UserRole.credit_officer) {
        if (user.creditScope === 'all')
            return null;
        const assigned = await prisma.creditOfficerCompany.findMany({
            where: { userId: user.id },
            select: { companyId: true },
        });
        return (0, company_hierarchy_1.expandCompanyIds)(prisma, assigned.map((r) => r.companyId));
    }
    if (user.role === client_1.UserRole.finance_officer) {
        if (user.financeScope === 'all')
            return null;
        const assigned = await prisma.financeOfficerCompany.findMany({
            where: { userId: user.id },
            select: { companyId: true },
        });
        return (0, company_hierarchy_1.expandCompanyIds)(prisma, assigned.map((r) => r.companyId));
    }
    return null;
}
async function assertCompanyScope(prisma, user, companyId) {
    if (user.role === client_1.UserRole.admin || user.role === client_1.UserRole.super_admin)
        return;
    if (user.role === client_1.UserRole.group_admin) {
        if (!user.companyId)
            throw new common_1.ForbiddenException('out_of_scope');
        const allowed = await (0, company_hierarchy_1.resolveDescendantCompanyIds)(prisma, user.companyId);
        if (!allowed.includes(companyId))
            throw new common_1.ForbiddenException('out_of_scope');
        return;
    }
    if (user.role === client_1.UserRole.credit_officer) {
        if (user.creditScope === 'all')
            return;
        const assigned = await prisma.creditOfficerCompany.findMany({
            where: { userId: user.id },
            select: { companyId: true },
        });
        const allowed = await (0, company_hierarchy_1.expandCompanyIds)(prisma, assigned.map((r) => r.companyId));
        if (!allowed.includes(companyId)) {
            throw new common_1.ForbiddenException('out_of_scope');
        }
        return;
    }
    if (user.role === client_1.UserRole.finance_officer) {
        if (user.financeScope === 'all')
            return;
        const assigned = await prisma.financeOfficerCompany.findMany({
            where: { userId: user.id },
            select: { companyId: true },
        });
        const allowed = await (0, company_hierarchy_1.expandCompanyIds)(prisma, assigned.map((r) => r.companyId));
        if (!allowed.includes(companyId)) {
            throw new common_1.ForbiddenException('out_of_scope');
        }
        return;
    }
    throw new common_1.ForbiddenException('forbidden_role');
}
async function assertCompanyScopeForRead(prisma, user, companyId) {
    try {
        await assertCompanyScope(prisma, user, companyId);
    }
    catch (e) {
        if (e instanceof common_1.ForbiddenException && e.message === 'out_of_scope') {
            throw new common_1.NotFoundException();
        }
        throw e;
    }
}
//# sourceMappingURL=company-scope.js.map