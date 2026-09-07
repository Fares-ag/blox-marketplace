"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WITHDRAWAL_BLOCKING_STATUSES = void 0;
exports.applicationCarriesConsent = applicationCarriesConsent;
exports.consentWithdrawalDecision = consentWithdrawalDecision;
const client_1 = require("@prisma/client");
const application_access_1 = require("../applications/application-access");
exports.WITHDRAWAL_BLOCKING_STATUSES = application_access_1.BLOCKING_APPLICATION_STATUSES.filter((status) => status !== client_1.ApplicationStatus.draft);
function applicationCarriesConsent(app, code) {
    return app.consentsCompletedAt != null || app.consentCodes.includes(code);
}
function consentWithdrawalDecision(code, applications) {
    const carrying = applications.filter((app) => applicationCarriesConsent(app, code));
    const blockingApplicationIds = carrying
        .filter((app) => exports.WITHDRAWAL_BLOCKING_STATUSES.includes(app.status))
        .map((app) => app.id);
    const draftIdsToClear = carrying
        .filter((app) => app.status === client_1.ApplicationStatus.draft)
        .map((app) => app.id);
    return { allowed: blockingApplicationIds.length === 0, blockingApplicationIds, draftIdsToClear };
}
//# sourceMappingURL=consent-withdrawal.js.map