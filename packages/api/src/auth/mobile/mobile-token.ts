import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const ACCESS_TTL_SECONDS = 15 * 60;
const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export type MobileJwtPayload = {
  sub: string;
  email: string;
  role: string;
  iat: number;
  exp: number;
};

function b64url(input: Buffer | string): string {
  const buf = typeof input === 'string' ? Buffer.from(input) : input;
  return buf.toString('base64url');
}

export function signMobileAccessToken(
  secret: string,
  claims: { sub: string; email: string; role: string },
  ttlSeconds = ACCESS_TTL_SECONDS,
): { token: string; expiresAt: Date } {
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + ttlSeconds;
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify({ ...claims, iat, exp }));
  const sig = b64url(createHmac('sha256', secret).update(`${header}.${body}`).digest());
  return {
    token: `${header}.${body}.${sig}`,
    expiresAt: new Date(exp * 1000),
  };
}

export function verifyMobileAccessToken(secret: string, token: string): MobileJwtPayload | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, body, sig] = parts;
  const expected = b64url(createHmac('sha256', secret).update(`${header}.${body}`).digest());
  try {
    if (expected.length !== sig.length) return null;
    if (!timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) return null;
  } catch {
    return null;
  }
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString()) as MobileJwtPayload;
    if (!payload.sub || !payload.exp) return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function newRefreshToken(): { raw: string; hash: string; expiresAt: Date } {
  const raw = randomBytes(32).toString('base64url');
  const hash = createHmac('sha256', 'refresh').update(raw).digest('hex');
  return { raw, hash, expiresAt: new Date(Date.now() + REFRESH_TTL_MS) };
}

export function hashRefreshToken(raw: string): string {
  return createHmac('sha256', 'refresh').update(raw).digest('hex');
}

export function bearerFromHeader(header: string | undefined): string | null {
  if (!header) return null;
  const [scheme, token] = header.split(' ');
  if (!scheme || !token) return null;
  if (scheme.toLowerCase() !== 'bearer') return null;
  return token.trim() || null;
}
