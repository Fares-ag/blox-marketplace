"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ANONYMISED_NAME = exports.DATA_RIGHTS_TRANSITIONS = exports.PENDING_DATA_RIGHTS_STATUSES = exports.DELETION_BLOCKING_STATUSES = exports.DATA_RIGHTS_SLA_DAYS = void 0;
exports.dataRightsDueAt = dataRightsDueAt;
exports.canTransitionDataRights = canTransitionDataRights;
exports.isTerminalDataRightsStatus = isTerminalDataRightsStatus;
exports.anonymisedEmail = anonymisedEmail;
exports.anonymisationPatch = anonymisationPatch;
exports.toDataRightsRequestDto = toDataRightsRequestDto;
const client_1 = require("@prisma/client");
const application_access_1 = require("../applications/application-access");
exports.DATA_RIGHTS_SLA_DAYS = 30;
const DAY_MS = 86_400_000;
function dataRightsDueAt(now = new Date()) {
    return new Date(now.getTime() + exports.DATA_RIGHTS_SLA_DAYS * DAY_MS);
}
exports.DELETION_BLOCKING_STATUSES = application_access_1.BLOCKING_APPLICATION_STATUSES.filter((status) => status !== client_1.ApplicationStatus.draft);
exports.PENDING_DATA_RIGHTS_STATUSES = [
    client_1.DataRightsRequestStatus.open,
    client_1.DataRightsRequestStatus.in_progress,
];
exports.DATA_RIGHTS_TRANSITIONS = {
    open: ['in_progress', 'completed', 'rejected'],
    in_progress: ['completed', 'rejected'],
    completed: [],
    rejected: [],
};
function canTransitionDataRights(from, to) {
    return exports.DATA_RIGHTS_TRANSITIONS[from].includes(to);
}
function isTerminalDataRightsStatus(status) {
    return exports.DATA_RIGHTS_TRANSITIONS[status].length === 0;
}
exports.ANONYMISED_NAME = 'Deleted customer';
function anonymisedEmail(userId) {
    return `deleted-${userId}@anonymised.local`;
}
function anonymisationPatch(userId) {
    return {
        name: exports.ANONYMISED_NAME,
        email: anonymisedEmail(userId),
        emailVerified: false,
        image: null,
        phone: null,
        firstName: null,
        lastName: null,
        gender: null,
        dateOfBirth: null,
        nationality: null,
        isActive: false,
        twoFactorEnabled: false,
    };
}
function toDataRightsRequestDto(row, opts = {}) {
    return {
        id: row.id,
        kind: row.kind,
        status: row.status,
        details: row.details ?? null,
        consent_code: row.consentCode ?? null,
        resolution_note: row.resolutionNote ?? null,
        due_at: row.dueAt?.toISOString() ?? null,
        handled_at: row.handledAt?.toISOString() ?? null,
        handled_by_name: row.handledBy?.name ?? null,
        ...(opts.includeCustomer
            ? { customer: row.user ? { id: row.user.id, name: row.user.name, email: row.user.email } : null }
            : {}),
        created_at: row.createdAt.toISOString(),
    };
}
//# sourceMappingURL=data-rights-logic.js.map