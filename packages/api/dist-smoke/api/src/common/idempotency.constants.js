"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_IDEMPOTENCY_KEY_LENGTH = exports.IDEMPOTENCY_SCOPES = exports.IDEMPOTENCY_KEY_HEADER = void 0;
exports.IDEMPOTENCY_KEY_HEADER = 'idempotency-key';
exports.IDEMPOTENCY_SCOPES = {
    applicationCreate: 'POST:applications',
    opsApplicationCreate: 'POST:ops/applications',
    opsSchedulePay: (scheduleId) => `POST:ops/payment-schedules/${scheduleId}/pay`,
    opsDownPayment: (applicationId) => `POST:ops/applications/${applicationId}/down-payment`,
    skipCashCreate: (applicationId, scheduleId) => `POST:applications/${applicationId}/schedules/${scheduleId}/skipcash`,
};
exports.MAX_IDEMPOTENCY_KEY_LENGTH = 256;
//# sourceMappingURL=idempotency.constants.js.map