/** HTTP header for client idempotency keys on money-moving POSTs. */
export const IDEMPOTENCY_KEY_HEADER = 'idempotency-key';

export const IDEMPOTENCY_SCOPES = {
  applicationCreate: 'POST:applications',
  opsApplicationCreate: 'POST:ops/applications',
  opsSchedulePay: (scheduleId: string) => `POST:ops/payment-schedules/${scheduleId}/pay`,
  opsDownPayment: (applicationId: string) => `POST:ops/applications/${applicationId}/down-payment`,
  skipCashCreate: (applicationId: string, scheduleId: string) =>
    `POST:applications/${applicationId}/schedules/${scheduleId}/skipcash`,
} as const;

export const MAX_IDEMPOTENCY_KEY_LENGTH = 256;
