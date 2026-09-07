import type { Request } from 'express';

/** Client address and user agent captured on consent records (trust proxy is enabled in main.ts). */
export function requestMeta(req: Request): { ipAddress: string | null; userAgent: string | null } {
  const ua = req.headers['user-agent'];
  return {
    ipAddress: req.ip ?? null,
    userAgent: typeof ua === 'string' && ua.trim() ? ua.slice(0, 512) : null,
  };
}
