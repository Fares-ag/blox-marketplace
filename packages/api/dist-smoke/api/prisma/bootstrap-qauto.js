"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.bootstrapQauto = bootstrapQauto;
const client_1 = require("@prisma/client");
const HOLDING = { code: 'qauto', name: 'QAuto' };
const DEALERSHIPS = [
    { code: 'qauto-audi', name: 'QAuto Audi' },
    { code: 'qauto-vw', name: 'QAuto Volkswagen' },
    { code: 'qauto-skoda', name: 'QAuto Skoda' },
];
async function bootstrapQauto(prisma) {
    const holding = await prisma.company.upsert({
        where: { code: HOLDING.code },
        create: {
            name: HOLDING.name,
            code: HOLDING.code,
            kind: client_1.CompanyKind.holding,
            status: 'active',
        },
        update: {
            name: HOLDING.name,
            kind: client_1.CompanyKind.holding,
            parentCompanyId: null,
            status: 'active',
        },
    });
    const children = [];
    for (const d of DEALERSHIPS) {
        const existing = await prisma.company.findUnique({ where: { code: d.code } });
        const child = existing
            ? await prisma.company.update({
                where: { id: existing.id },
                data: {
                    name: d.name,
                    kind: client_1.CompanyKind.dealership,
                    parentCompanyId: holding.id,
                    status: 'active',
                },
            })
            : await prisma.company.create({
                data: {
                    name: d.name,
                    code: d.code,
                    kind: client_1.CompanyKind.dealership,
                    parentCompanyId: holding.id,
                    status: 'active',
                },
            });
        children.push({ id: child.id, code: child.code, name: child.name });
    }
    const seededUsers = process.env.SEED_PASSWORD ? await seedDemoUsers(prisma, holding.id, children) : [];
    return {
        holding: { id: holding.id, code: holding.code, name: holding.name },
        dealerships: children,
        users: seededUsers,
    };
}
async function seedDemoUsers(prisma, holdingId, children) {
    const audi = children.find((c) => c.code === 'qauto-audi');
    const specs = [
        {
            email: 'group@qauto.local',
            name: 'QAuto Group Admin',
            role: client_1.UserRole.group_admin,
            companyId: holdingId,
        },
        {
            email: 'audi.dealer@qauto.local',
            name: 'QAuto Audi Dealer',
            role: client_1.UserRole.dealer_agent,
            companyId: audi?.id ?? null,
        },
        {
            email: 'credit@qauto.local',
            name: 'QAuto Credit',
            role: client_1.UserRole.credit_officer,
            companyId: holdingId,
            creditScope: client_1.OfficerScope.assigned,
        },
        {
            email: 'finance@qauto.local',
            name: 'QAuto Finance',
            role: client_1.UserRole.finance_officer,
            companyId: holdingId,
            financeScope: client_1.OfficerScope.assigned,
        },
    ];
    const created = [];
    for (const spec of specs) {
        const existing = await prisma.user.findUnique({ where: { email: spec.email } });
        const user = existing
            ? await prisma.user.update({
                where: { id: existing.id },
                data: {
                    name: spec.name,
                    role: spec.role,
                    companyId: spec.companyId,
                    creditScope: 'creditScope' in spec ? spec.creditScope : client_1.OfficerScope.assigned,
                    financeScope: 'financeScope' in spec ? spec.financeScope : client_1.OfficerScope.assigned,
                    emailVerified: true,
                    isActive: true,
                },
            })
            : await prisma.user.create({
                data: {
                    email: spec.email,
                    name: spec.name,
                    role: spec.role,
                    companyId: spec.companyId,
                    creditScope: 'creditScope' in spec ? spec.creditScope : client_1.OfficerScope.assigned,
                    financeScope: 'financeScope' in spec ? spec.financeScope : client_1.OfficerScope.assigned,
                    emailVerified: true,
                    isActive: true,
                },
            });
        if (spec.role === client_1.UserRole.credit_officer) {
            await prisma.creditOfficerCompany.deleteMany({ where: { userId: user.id } });
            await prisma.creditOfficerCompany.create({
                data: { userId: user.id, companyId: holdingId },
            });
        }
        if (spec.role === client_1.UserRole.finance_officer) {
            await prisma.financeOfficerCompany.deleteMany({ where: { userId: user.id } });
            await prisma.financeOfficerCompany.create({
                data: { userId: user.id, companyId: holdingId },
            });
        }
        created.push(spec.email);
    }
    return created;
}
//# sourceMappingURL=bootstrap-qauto.js.map