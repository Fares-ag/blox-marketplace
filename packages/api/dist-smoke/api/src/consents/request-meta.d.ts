import type { Request } from 'express';
export declare function requestMeta(req: Request): {
    ipAddress: string | null;
    userAgent: string | null;
};
