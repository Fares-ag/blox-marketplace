export declare const IDEMPOTENCY_KEY_HEADER = "idempotency-key";
export declare const IDEMPOTENCY_SCOPES: {
    readonly applicationCreate: "POST:applications";
    readonly opsApplicationCreate: "POST:ops/applications";
    readonly opsSchedulePay: (scheduleId: string) => string;
    readonly opsDownPayment: (applicationId: string) => string;
    readonly skipCashCreate: (applicationId: string, scheduleId: string) => string;
};
export declare const MAX_IDEMPOTENCY_KEY_LENGTH = 256;
