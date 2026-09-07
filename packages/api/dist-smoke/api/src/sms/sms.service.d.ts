import { ConfigService } from '@nestjs/config';
export type SmsKind = 'assist_otp' | 'assist_link' | 'guarantor_otp' | 'guarantor_link' | 'reminder' | 'notification' | 'generic';
export type SmsMessage = {
    to: string;
    body: string;
    kind: SmsKind;
};
export type SmsProvider = 'log' | 'http' | 'twilio';
export type SmsSendResult = {
    delivered: boolean;
    provider: SmsProvider;
    id?: string;
};
export declare function resolveSmsProvider(raw: string | undefined): SmsProvider;
export declare class SmsService {
    private readonly logger;
    private readonly provider;
    private readonly httpUrl;
    private readonly httpToken;
    private readonly sender;
    private readonly twilio;
    private readonly twilioFrom;
    private readonly twilioMessagingServiceSid;
    private readonly twilioTimeoutMs;
    constructor(config: ConfigService);
    get isLive(): boolean;
    get providerName(): SmsProvider;
    send(message: SmsMessage): Promise<SmsSendResult>;
    private sendViaHttp;
    private sendViaTwilio;
}
export declare function normalizePhone(raw: string | null | undefined): string | null;
