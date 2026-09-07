"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.planDefaultLenderSwitch = planDefaultLenderSwitch;
exports.applyDefaultLenderPlan = applyDefaultLenderPlan;
exports.assertDefaultLenderEligible = assertDefaultLenderEligible;
const common_1 = require("@nestjs/common");
function planDefaultLenderSwitch(partners, targetId, requested) {
    const target = partners.find((p) => p.id === targetId);
    const currentlyDefault = target?.isDefaultLender ?? false;
    const targetIsDefault = requested === undefined ? currentlyDefault : requested;
    const clearIds = targetIsDefault
        ? partners.filter((p) => p.id !== targetId && p.isDefaultLender).map((p) => p.id)
        : [];
    return {
        clearIds,
        targetIsDefault,
        changed: clearIds.length > 0 || targetIsDefault !== currentlyDefault,
    };
}
function applyDefaultLenderPlan(partners, targetId, plan) {
    return partners.map((p) => {
        if (p.id === targetId)
            return { ...p, isDefaultLender: plan.targetIsDefault };
        if (plan.clearIds.includes(p.id))
            return { ...p, isDefaultLender: false };
        return p;
    });
}
function assertDefaultLenderEligible(partner, isDefault) {
    if (isDefault && !partner.active) {
        throw new common_1.BadRequestException('default_lender_must_be_active');
    }
}
//# sourceMappingURL=default-lender.js.map