"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveDescendantCompanyIds = resolveDescendantCompanyIds;
exports.expandCompanyIds = expandCompanyIds;
exports.assertValidCompanyHierarchy = assertValidCompanyHierarchy;
exports.assertDealershipCompany = assertDealershipCompany;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
async function resolveDescendantCompanyIds(prisma, companyId) {
    const company = await prisma.company.findUnique({
        where: { id: companyId },
        select: { id: true, kind: true },
    });
    if (!company)
        return [companyId];
    if (company.kind !== client_1.CompanyKind.holding)
        return [company.id];
    const children = await prisma.company.findMany({
        where: { parentCompanyId: companyId },
        select: { id: true },
    });
    return [company.id, ...children.map((c) => c.id)];
}
async function expandCompanyIds(prisma, ids) {
    if (!ids.length)
        return [];
    const companies = await prisma.company.findMany({
        where: { id: { in: ids } },
        select: { id: true, kind: true },
    });
    const holdingIds = companies.filter((c) => c.kind === client_1.CompanyKind.holding).map((c) => c.id);
    const children = holdingIds.length
        ? await prisma.company.findMany({
            where: { parentCompanyId: { in: holdingIds } },
            select: { id: true },
        })
        : [];
    return [...new Set([...ids, ...children.map((c) => c.id)])];
}
async function assertValidCompanyHierarchy(prisma, opts) {
    const kind = (opts.kind ?? client_1.CompanyKind.dealership);
    if (kind === client_1.CompanyKind.holding && opts.parentCompanyId) {
        throw new common_1.BadRequestException('holding_cannot_have_parent');
    }
    if (!opts.parentCompanyId)
        return;
    if (kind !== client_1.CompanyKind.dealership) {
        throw new common_1.BadRequestException('only_dealership_can_have_parent');
    }
    const parent = await prisma.company.findUnique({
        where: { id: opts.parentCompanyId },
        select: { id: true, kind: true },
    });
    if (!parent)
        throw new common_1.BadRequestException('parent_company_not_found');
    if (parent.kind !== client_1.CompanyKind.holding) {
        throw new common_1.BadRequestException('parent_must_be_holding');
    }
}
async function assertDealershipCompany(prisma, companyId) {
    const company = await prisma.company.findUnique({
        where: { id: companyId },
        select: { id: true, kind: true },
    });
    if (!company)
        throw new common_1.BadRequestException('company_not_found');
    if (company.kind === client_1.CompanyKind.holding) {
        throw new common_1.BadRequestException('holding_cannot_have_products');
    }
    return company;
}
//# sourceMappingURL=company-hierarchy.js.map