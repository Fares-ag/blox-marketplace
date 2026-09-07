"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.separationOfDutiesEnabled = separationOfDutiesEnabled;
exports.resolveSeparationOfDutiesEnabled = resolveSeparationOfDutiesEnabled;
exports.isCreditApprovalLog = isCreditApprovalLog;
exports.findCreditApproverId = findCreditApproverId;
exports.violatesSeparationOfDuties = violatesSeparationOfDuties;
exports.assertActorNotCreditApprover = assertActorNotCreditApprover;
exports.assertDualControlWaive = assertDualControlWaive;
exports.resolveCreditApproverId = resolveCreditApproverId;
exports.assertSeparationOfDutiesForApplication = assertSeparationOfDutiesForApplication;
const common_1 = require("@nestjs/common");
function separationOfDutiesEnabled(opts) {
    const raw = opts?.envValue ?? process.env.SEPARATION_OF_DUTIES;
    const globalEnabled = raw !== 'false' && raw !== '0';
    if (!globalEnabled)
        return false;
    if (opts?.companyFlag === false)
        return false;
    return true;
}
function resolveSeparationOfDutiesEnabled(config, companyFlag) {
    return separationOfDutiesEnabled({
        envValue: config.get('SEPARATION_OF_DUTIES'),
        companyFlag,
    });
}
function isCreditApprovalLog(entry) {
    if (entry.action !== 'status_transition')
        return false;
    if (entry.toValue === 'contract_signing_required')
        return true;
    if (entry.toValue === 'pending_finance_activation')
        return true;
    if (entry.toValue === 'active' &&
        entry.fromValue === 'under_review' &&
        isDirectActivateMetadata(entry.metadata)) {
        return true;
    }
    return false;
}
function isDirectActivateMetadata(metadata) {
    if (!metadata || typeof metadata !== 'object')
        return false;
    return metadata.direct === true;
}
function findCreditApproverId(logs) {
    for (let i = logs.length - 1; i >= 0; i--) {
        const log = logs[i];
        if (isCreditApprovalLog(log) && log.actorUserId) {
            return log.actorUserId;
        }
    }
    return null;
}
function violatesSeparationOfDuties(actorUserId, creditApproverId) {
    if (!creditApproverId)
        return false;
    return actorUserId === creditApproverId;
}
function assertActorNotCreditApprover(actorUserId, creditApproverId) {
    if (violatesSeparationOfDuties(actorUserId, creditApproverId)) {
        throw new common_1.ForbiddenException('separation_of_duties');
    }
}
function assertDualControlWaive(confirmActorUserId, requestedByUserId) {
    if (!requestedByUserId) {
        throw new common_1.ForbiddenException('waive_not_requested');
    }
    if (confirmActorUserId === requestedByUserId) {
        throw new common_1.ForbiddenException('dual_control_required');
    }
}
async function resolveCreditApproverId(prisma, applicationId) {
    const logs = await prisma.activityLog.findMany({
        where: {
            entityType: 'application',
            entityId: applicationId,
            action: 'status_transition',
        },
        orderBy: { createdAt: 'asc' },
        select: {
            actorUserId: true,
            action: true,
            fromValue: true,
            toValue: true,
            metadata: true,
            createdAt: true,
        },
    });
    return findCreditApproverId(logs);
}
async function assertSeparationOfDutiesForApplication(prisma, actorUserId, applicationId, enabled) {
    if (!enabled)
        return;
    const creditApproverId = await resolveCreditApproverId(prisma, applicationId);
    assertActorNotCreditApprover(actorUserId, creditApproverId);
}
//# sourceMappingURL=separation-of-duties.js.map