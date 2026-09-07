import { ConfigService } from '@nestjs/config';
export type WhatsAppKind = 'notification' | 'reminder' | 'generic';
export type WhatsAppMessage = {
    to: string;
    body: string;
    kind: WhatsAppKind;
};
export type WhatsAppProvider = 'log' | 'twilio' | 'http';
export type WhatsAppSendResult = {
    delivered: boolean;
    provider: WhatsAppProvider;
    id?: string;
};
export declare function resolveWhatsAppProvider(raw: string | undefined): WhatsAppProvider;
export declare class WhatsAppService {
    private readonly logger;
    private readonly provider;
    private readonly twilio;
    private readonly twilioFrom;
    private readonly twilioTimeoutMs;
    private readonly httpUrl;
    private readonly httpToken;
    constructor(config: ConfigService);
    get isLive(): boolean;
    get providerName(): WhatsAppProvider;
    send(message: WhatsAppMessage): Promise<WhatsAppSendResult>;
    private sendViaTwilio;
    private sendViaHttp;
}
