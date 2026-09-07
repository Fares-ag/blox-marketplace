"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const seed_finance_partners_1 = require("./seed-finance-partners");
const seed_chery_1 = require("./seed-chery");
const seed_branches_1 = require("./seed-branches");
const seed_takaful_providers_1 = require("./seed-takaful-providers");
const prisma = new client_1.PrismaClient();
async function main() {
    const finance = await (0, seed_finance_partners_1.seedFinancePartners)(prisma);
    console.log(`Finance partners seeded: ${finance.partners.join(', ')} (default lender: ${finance.defaultLender ?? 'none'}).`);
    const chery = await (0, seed_chery_1.seedCheryInventory)(prisma);
    console.log(`Published ${chery.listingsPublished} Chery Elite Motors listings (${chery.companyName}).`);
    const branches = await (0, seed_branches_1.seedBranches)(prisma);
    console.log(`Branches seeded for ${branches.branches} dealership(s); ${branches.agentsAssigned} dealer agent(s) assigned a home branch.`);
    const takaful = await (0, seed_takaful_providers_1.seedTakafulProviders)(prisma);
    console.log(`Takaful providers seeded: ${takaful.codes.join(', ')}.`);
}
main()
    .catch((err) => {
    console.error(err);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=seed.js.map