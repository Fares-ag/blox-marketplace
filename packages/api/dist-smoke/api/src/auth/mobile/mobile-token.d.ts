export type MobileJwtPayload = {
    sub: string;
    email: string;
    role: string;
    iat: number;
    exp: number;
};
export declare function signMobileAccessToken(secret: string, claims: {
    sub: string;
    email: string;
    role: string;
}, ttlSeconds?: number): {
    token: string;
    expiresAt: Date;
};
export declare function verifyMobileAccessToken(secret: string, token: string): MobileJwtPayload | null;
export declare function newRefreshToken(): {
    raw: string;
    hash: string;
    expiresAt: Date;
};
export declare function hashRefreshToken(raw: string): string;
export declare function bearerFromHeader(header: string | undefined): string | null;
