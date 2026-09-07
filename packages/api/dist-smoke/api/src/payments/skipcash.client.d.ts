export type SkipCashCreateInput = {
    amount: number;
    firstName: string;
    lastName: string;
    phone: string;
    email: string;
    transactionId: string;
    custom1?: string;
    subject?: string;
    description?: string;
    returnUrl?: string;
    webhookUrl?: string;
    onlyDebitCard?: boolean;
};
export type SkipCashCreateResult = {
    id: string;
    payUrl: string;
    status?: string | number;
    statusId?: number;
};
export type SkipCashPaymentStatus = {
    id: string;
    status?: string | number;
    statusId?: number;
    custom1?: string;
};
export declare class SkipCashClient {
    private readonly config;
    constructor(config: {
        secretKey: string;
        keyId: string;
        clientId: string;
        apiUrl: string;
    });
    static fromEnv(env: NodeJS.ProcessEnv): SkipCashClient | null;
    private signCreate;
    private signVerify;
    createPayment(input: SkipCashCreateInput): Promise<SkipCashCreateResult>;
    getPayment(paymentId: string): Promise<SkipCashPaymentStatus>;
}
export declare function mapSkipCashPaid(status: unknown): boolean;
