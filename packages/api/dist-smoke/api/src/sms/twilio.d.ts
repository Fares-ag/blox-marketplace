export declare const TWILIO_API_BASE = "https://api.twilio.com/2010-04-01";
export declare const DEFAULT_TWILIO_TIMEOUT_MS = 10000;
export type TwilioCredentials = {
    accountSid: string;
    authToken: string;
};
export type TwilioMessageInput = {
    to: string;
    body: string;
    from?: string | null;
    messagingServiceSid?: string | null;
};
export type TwilioSendResult = {
    sid: string;
    status: string;
};
export declare const TWILIO_INVALID_RECIPIENT_CODES: ReadonlySet<number>;
export declare class TwilioError extends Error {
    readonly httpStatus: number;
    readonly code: number | null;
    constructor(httpStatus: number, code: number | null, message: string);
    get invalidRecipient(): boolean;
}
export declare function twilioMessagesUrl(accountSid: string): string;
export declare function twilioAuthorizationHeader(creds: TwilioCredentials): string;
export declare function buildTwilioMessageForm(input: TwilioMessageInput): URLSearchParams;
export declare function whatsappAddress(value: string): string;
export declare function sendTwilioMessage(creds: TwilioCredentials, input: TwilioMessageInput, timeoutMs?: number): Promise<TwilioSendResult>;
