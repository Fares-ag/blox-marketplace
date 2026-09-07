export declare const FCM_SCOPE = "https://www.googleapis.com/auth/firebase.messaging";
export declare const GOOGLE_TOKEN_URI = "https://oauth2.googleapis.com/token";
export declare const DEFAULT_FCM_TIMEOUT_MS = 10000;
export declare const DEFAULT_JWT_TTL_SEC = 3600;
export type FcmServiceAccount = {
    projectId: string;
    clientEmail: string;
    privateKey: string;
    tokenUri: string;
};
export declare function base64url(input: Buffer | string): string;
export declare function normalizePrivateKey(key: string): string;
export declare function parseServiceAccount(raw: string): FcmServiceAccount;
export type ServiceAccountJwtClaims = {
    iss: string;
    scope: string;
    aud: string;
    iat: number;
    exp: number;
};
export type ServiceAccountJwt = {
    jwt: string;
    claims: ServiceAccountJwtClaims;
    expiresAt: Date;
};
export declare function buildServiceAccountJwt(account: Pick<FcmServiceAccount, 'clientEmail' | 'privateKey' | 'tokenUri'>, opts?: {
    now?: Date;
    ttlSec?: number;
    scope?: string;
}): ServiceAccountJwt;
export declare function decodeJwtSegments(jwt: string): {
    header: Record<string, unknown>;
    claims: Record<string, unknown>;
    signature: Buffer;
    signingInput: string;
};
export type PushPayload = {
    title: string;
    body?: string | null;
    linkPath?: string | null;
    data?: Record<string, string | number | boolean | null | undefined>;
};
export declare function stringifyPushData(data: Record<string, string | number | boolean | null | undefined> | undefined): Record<string, string>;
export declare function buildFcmMessage(token: string, payload: PushPayload): Record<string, unknown>;
export declare function fcmSendUrl(projectId: string): string;
export type FcmSendOutcome = 'sent' | 'unregistered' | 'error';
export type FcmClassifiedResponse = {
    outcome: FcmSendOutcome;
    code: string | null;
    message: string | null;
};
export declare function classifyFcmResponse(status: number, body: unknown): FcmClassifiedResponse;
export declare function exchangeJwtForAccessToken(tokenUri: string, jwt: string, timeoutMs?: number): Promise<{
    accessToken: string;
    expiresAt: Date;
}>;
export declare function sendFcmMessage(accessToken: string, projectId: string, message: Record<string, unknown>, timeoutMs?: number): Promise<FcmClassifiedResponse>;
