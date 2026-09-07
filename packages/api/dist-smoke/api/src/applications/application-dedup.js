"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IDENTITY_HOLD_REASON = exports.ACTIVE_BLOCKING_APPLICATION_STATUSES = void 0;
exports.decideDuplicateApplication = decideDuplicateApplication;
exports.summarizeBlocking = summarizeBlocking;
exports.decideIdentityHold = decideIdentityHold;
const client_1 = require("@prisma/client");
const application_access_1 = require("./application-access");
const customer_snapshot_1 = require("./customer-snapshot");
exports.ACTIVE_BLOCKING_APPLICATION_STATUSES = application_access_1.BLOCKING_APPLICATION_STATUSES.filter((status) => status !== client_1.ApplicationStatus.draft);
function newestFirst(a, b) {
    return (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0);
}
function isActivelyBlocking(candidate) {
    return exports.ACTIVE_BLOCKING_APPLICATION_STATUSES.includes(candidate.status);
}
function decideDuplicateApplication(existing, productId) {
    const sorted = [...existing].sort(newestFirst);
    const blocked = sorted.find(isActivelyBlocking);
    if (blocked)
        return { kind: 'blocked', applicationId: blocked.id, status: blocked.status };
    const draft = sorted.find((a) => a.status === client_1.ApplicationStatus.draft && a.productId === productId);
    if (draft)
        return { kind: 'resume', applicationId: draft.id };
    return { kind: 'create' };
}
function summarizeBlocking(existing, productId) {
    const sorted = [...existing].sort(newestFirst);
    const blocked = sorted.find(isActivelyBlocking);
    const draft = sorted.find((a) => a.status === client_1.ApplicationStatus.draft && (!productId || a.productId === productId));
    return {
        blocking: !!blocked,
        applicationId: blocked?.id ?? null,
        status: blocked?.status ?? null,
        draftApplicationId: draft?.id ?? null,
    };
}
exports.IDENTITY_HOLD_REASON = 'qid_identity_mismatch';
function decideIdentityHold(subject, matches) {
    const subjectName = (0, customer_snapshot_1.normalizePersonName)(subject.name);
    const conflicts = [];
    for (const match of matches) {
        if (match.userId === subject.userId)
            continue;
        const otherName = (0, customer_snapshot_1.normalizePersonName)(match.name);
        const nameMismatch = !!subjectName && !!otherName && subjectName !== otherName;
        const birthYearMismatch = subject.birthYear != null && match.birthYear != null && subject.birthYear !== match.birthYear;
        if (nameMismatch || birthYearMismatch) {
            conflicts.push({ userId: match.userId, source: match.source ?? 'user', nameMismatch, birthYearMismatch });
        }
    }
    return conflicts.length > 0 ? { reason: exports.IDENTITY_HOLD_REASON, conflicts } : null;
}
//# sourceMappingURL=application-dedup.js.map