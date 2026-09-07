"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HARD_CAP_PERCENT = exports.MAX_EXCEPTION_TIER_BY_ROLE = exports.APPROVAL_AUTHORITY_ROLES = void 0;
exports.assessCredit = assessCredit;
exports.roleMayApprove = roleMayApprove;
exports.roleMayApproveTier = roleMayApproveTier;
const affordability_1 = require("./affordability");
const product_rules_1 = require("./product-rules");
function assessCredit(input, now = new Date()) {
    const affordability = input.affordability ? (0, affordability_1.assessAffordability)(input.affordability) : null;
    const guarantorIncome = Number(input.guarantorMonthlyIncome ?? 0);
    const affordabilityWithGuarantor = input.affordability && guarantorIncome > 0
        ? (0, affordability_1.assessAffordability)({
            ...input.affordability,
            monthlyIncome: Number(input.affordability.monthlyIncome) + guarantorIncome,
        })
        : null;
    const approvalAuthority = (0, product_rules_1.requiredApprovalAuthority)(input.vehicleCategory, input.financedAmount);
    const ruleFlags = input.ruleFlags ?? [];
    const reasons = [];
    let path = 'approve';
    if (!affordability) {
        reasons.push('affordability_unknown');
        path = 'refer';
    }
    else {
        const effective = affordabilityWithGuarantor ?? affordability;
        if (affordability.status === 'above_hard_cap' && effective.status === 'above_hard_cap') {
            reasons.push('dbr_above_hard_cap');
            path = 'decline';
        }
        else if (effective.status !== 'within_cap') {
            reasons.push(`dbr_exception_tier_${effective.exceptionTier}`);
            path = 'refer';
        }
        else if (affordability.status !== 'within_cap' && affordabilityWithGuarantor) {
            reasons.push('within_cap_with_guarantor');
            path = 'refer';
        }
        if (effective.stressed && !effective.stressed.withinLimit) {
            reasons.push('stress_test_failed');
            if (path === 'approve')
                path = 'refer';
        }
    }
    if (ruleFlags.some((f) => f.severity === 'hard')) {
        reasons.push('hard_rule_violation');
        path = 'decline';
    }
    else if (ruleFlags.length) {
        reasons.push('soft_rule_flags');
        if (path === 'approve')
            path = 'refer';
    }
    if (approvalAuthority === 'above_matrix') {
        reasons.push('above_approval_matrix');
        if (path === 'approve')
            path = 'refer';
    }
    return {
        affordability,
        affordabilityWithGuarantor,
        approvalAuthority,
        path,
        reasons,
        ruleFlags,
        assessedAt: now.toISOString(),
    };
}
exports.APPROVAL_AUTHORITY_ROLES = {
    senior_manager: ['credit_officer', 'admin', 'super_admin'],
    head_of_credit: ['admin', 'super_admin'],
    above_matrix: ['super_admin'],
};
function roleMayApprove(role, authority) {
    return exports.APPROVAL_AUTHORITY_ROLES[authority].includes(role);
}
exports.MAX_EXCEPTION_TIER_BY_ROLE = {
    credit_officer: 1,
    admin: 2,
    super_admin: 3,
};
function roleMayApproveTier(role, tier) {
    return (exports.MAX_EXCEPTION_TIER_BY_ROLE[role] ?? 0) >= tier;
}
exports.HARD_CAP_PERCENT = Math.round(product_rules_1.PRODUCT_RULES.dbr.hardCap * 100);
//# sourceMappingURL=credit-assessment.js.map