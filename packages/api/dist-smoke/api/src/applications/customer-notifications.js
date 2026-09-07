"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DECISION_STATUSES_WITHOUT_REASON = void 0;
exports.customerNotificationBody = customerNotificationBody;
const client_1 = require("@prisma/client");
exports.DECISION_STATUSES_WITHOUT_REASON = new Set([
    client_1.ApplicationStatus.rejected,
    client_1.ApplicationStatus.submission_cancelled,
]);
function customerNotificationBody(toStatus, reason) {
    if (exports.DECISION_STATUSES_WITHOUT_REASON.has(toStatus))
        return undefined;
    return reason?.trim() || undefined;
}
//# sourceMappingURL=customer-notifications.js.map