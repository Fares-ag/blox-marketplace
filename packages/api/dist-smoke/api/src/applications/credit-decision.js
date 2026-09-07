"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.effectiveAffordability = effectiveAffordability;
exports.declinedForHardCap = declinedForHardCap;
exports.evaluateApprovalAuthorization = evaluateApprovalAuthorization;
exports.assertApprovalAuthorized = assertApprovalAuthorized;
const common_1 = require("@nestjs/common");
const domain_rules_1 = require("@drivemarket/shared/domain-rules");
function effectiveAffordability(assessment) {
    return assessment.affordabilityWithGuarantor ?? assessment.affordability;
}
function declinedForHardCap(assessment) {
    return assessment.path === 'decline' && assessment.reasons.includes('dbr_above_hard_cap');
}
function evaluateApprovalAuthorization(input) {
    const { role, assessment } = input;
    const authority = assessment.approvalAuthority;
    if (!(0, domain_rules_1.roleMayApprove)(role, authority)) {
        return {
            ok: false,
            status: 403,
            code: 'approval_authority_required',
            extras: { required_roles: [...domain_rules_1.APPROVAL_AUTHORITY_ROLES[authority]], authority },
        };
    }
    const tier = effectiveAffordability(assessment)?.exceptionTier ?? 0;
    if (tier > 0 && !(0, domain_rules_1.roleMayApproveTier)(role, tier)) {
        return { ok: false, status: 403, code: 'dbr_exception_escalation_required', extras: { tier } };
    }
    let overridden = false;
    if (declinedForHardCap(assessment)) {
        const reason = input.overrideReason?.trim();
        if (role !== 'super_admin' || !reason) {
            return { ok: false, status: 409, code: 'dbr_above_hard_cap', extras: { tier } };
        }
        overridden = true;
    }
    return { ok: true, overridden, authority, tier };
}
function assertApprovalAuthorized(input) {
    const outcome = evaluateApprovalAuthorization(input);
    if (outcome.ok)
        return outcome;
    const payload = { message: outcome.code, ...outcome.extras };
    if (outcome.status === 409)
        throw new common_1.ConflictException(payload);
    throw new common_1.ForbiddenException(payload);
}
//# sourceMappingURL=credit-decision.js.map