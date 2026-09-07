"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.backfillInstallmentPlans = backfillInstallmentPlans;
const installment_plan_1 = require("@drivemarket/shared/installment-plan");
const client_1 = require("@prisma/client");
async function backfillInstallmentPlans(prisma) {
    const apps = await prisma.application.findMany({
        where: { installmentPlan: { equals: client_1.Prisma.DbNull } },
        select: { id: true, pricingSnapshot: true },
    });
    let updated = 0;
    for (const app of apps) {
        const snap = app.pricingSnapshot;
        const plan = (0, installment_plan_1.buildPlanFromPricingSnapshot)({ pricingSnapshot: snap });
        await prisma.application.update({
            where: { id: app.id },
            data: { installmentPlan: plan },
        });
        updated += 1;
    }
    return { updated };
}
//# sourceMappingURL=backfill-installment-plan.js.map