"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SEEDED_DEALERSHIP_CODES = exports.SEED_BRANCH_CODE = void 0;
exports.seedBranchFor = seedBranchFor;
exports.seedBranches = seedBranches;
const client_1 = require("@prisma/client");
exports.SEED_BRANCH_CODE = 'MAIN';
exports.SEEDED_DEALERSHIP_CODES = [
    'chery-elite-motors',
    'qauto-audi',
    'qauto-vw',
    'qauto-skoda',
];
function seedBranchFor(company) {
    return { code: exports.SEED_BRANCH_CODE, name: `${company.name} Main Branch`, city: 'Doha' };
}
async function seedBranches(prisma, companyCodes = exports.SEEDED_DEALERSHIP_CODES) {
    const companies = await prisma.company.findMany({
        where: { code: { in: [...companyCodes] }, kind: client_1.CompanyKind.dealership },
        orderBy: { name: 'asc' },
    });
    let agentsAssigned = 0;
    const branches = [];
    for (const company of companies) {
        const spec = seedBranchFor(company);
        const branch = await prisma.branch.upsert({
            where: { companyId_code: { companyId: company.id, code: spec.code } },
            create: { companyId: company.id, ...spec },
            update: { active: true },
        });
        const assigned = await prisma.user.updateMany({
            where: { companyId: company.id, role: client_1.UserRole.dealer_agent, homeBranchId: null },
            data: { homeBranchId: branch.id },
        });
        agentsAssigned += assigned.count;
        branches.push({ companyCode: company.code, branchId: branch.id, code: branch.code });
    }
    return {
        branches: branches.length,
        agentsAssigned,
        companies: branches.map((b) => b.companyCode),
    };
}
//# sourceMappingURL=seed-branches.js.map