import { createSign } from 'node:crypto';
import { fetchWithTimeout } from '../common/fetch-with-timeout';

/**
 * Firebase Cloud Messaging HTTP v1 without the Firebase Admin SDK:
 *
 *   1. build an RS256 JWT from the service-account key (node crypto),
 *   2. exchange it for an OAuth2 access token at the Google token endpoint,
 *   3. POST `projects/{project}/messages:send` per device token.
 *
 * Everything here is pure except the two fetch helpers at the bottom.
 */

export const FCM_SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';
export const GOOGLE_TOKEN_URI = 'https://oauth2.googleapis.com/token';
export const DEFAULT_FCM_TIMEOUT_MS = 10_000;
export const DEFAULT_JWT_TTL_SEC = 3600;

export type FcmServiceAccount = {
  projectId: string;
  clientEmail: string;
  privateKey: string;
  tokenUri: string;
};

export function base64url(input: Buffer | string): string {
  return (typeof input === 'string' ? Buffer.from(input, 'utf8') : input).toString('base64url');
}

/** Keys pasted into env files often carry literal `\n` sequences instead of newlines. */
export function normalizePrivateKey(key: string): string {
  return key.replace(/\\n/g, '\n').trim();
}

/** Accepts the raw service-account JSON or its base64 encoding (handy for single-line env vars). */
export function parseServiceAccount(raw: string): FcmServiceAccount {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error('fcm_service_account_empty');
  const json = trimmed.startsWith('{') ? trimmed : Buffer.from(trimmed, 'base64').toString('utf8');
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(json) as Record<string, unknown>;
  } catch {
    throw new Error('fcm_service_account_invalid_json');
  }
  const projectId = typeof parsed.project_id === 'string' ? parsed.project_id.trim() : '';
  const clientEmail = typeof parsed.client_email === 'string' ? parsed.client_email.trim() : '';
  const privateKey = typeof parsed.private_key === 'string' ? normalizePrivateKey(parsed.private_key) : '';
  const tokenUri = typeof parsed.token_uri === 'string' && parsed.token_uri.trim() ? parsed.token_uri.trim() : GOOGLE_TOKEN_URI;
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('fcm_service_account_missing_fields (project_id, client_email, private_key)');
  }
  return { projectId, clientEmail, privateKey, tokenUri };
}

export type ServiceAccountJwtClaims = {
  iss: string;
  scope: string;
  aud: string;
  iat: number;
  exp: number;
};

export type ServiceAccountJwt = { jwt: string; claims: ServiceAccountJwtClaims; expiresAt: Date };

/** RS256 self-signed JWT for the OAuth2 `jwt-bearer` grant (Google service accounts). */
export function buildServiceAccountJwt(
  account: Pick<FcmServiceAccount, 'clientEmail' | 'privateKey' | 'tokenUri'>,
  opts: { now?: Date; ttlSec?: number; scope?: string } = {},
): ServiceAccountJwt {
  const now = opts.now ?? new Date();
  const ttl = Math.min(Math.max(opts.ttlSec ?? DEFAULT_JWT_TTL_SEC, 60), 3600);
  const iat = Math.floor(now.getTime() / 1000);
  const claims: ServiceAccountJwtClaims = {
    iss: account.clientEmail,
    scope: opts.scope ?? FCM_SCOPE,
    aud: account.tokenUri,
    iat,
    exp: iat + ttl,
  };
  const header = { alg: 'RS256', typ: 'JWT' };
  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claims))}`;
  const signature = createSign('RSA-SHA256').update(signingInput).end().sign(account.privateKey);
  return { jwt: `${signingInput}.${base64url(signature)}`, claims, expiresAt: new Date(claims.exp * 1000) };
}

export function decodeJwtSegments(jwt: string): {
  header: Record<string, unknown>;
  claims: Record<string, unknown>;
  signature: Buffer;
  signingInput: string;
} {
  const [h, c, s] = jwt.split('.');
  if (!h || !c || !s) throw new Error('jwt_malformed');
  return {
    header: JSON.parse(Buffer.from(h, 'base64url').toString('utf8')) as Record<string, unknown>,
    claims: JSON.parse(Buffer.from(c, 'base64url').toString('utf8')) as Record<string, unknown>,
    signature: Buffer.from(s, 'base64url'),
    signingInput: `${h}.${c}`,
  };
}

export type PushPayload = {
  title: string;
  body?: string | null;
  /** Deep link the app opens; forwarded as `data.link_path`. */
  linkPath?: string | null;
  data?: Record<string, string | number | boolean | null | undefined>;
};

/** FCM `data` values must be strings; drop empties so the payload stays small. */
export function stringifyPushData(
  data: Record<string, string | number | boolean | null | undefined> | undefined,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(data ?? {})) {
    if (value === null || value === undefined || value === '') continue;
    out[key] = String(value);
  }
  return out;
}

export function buildFcmMessage(token: string, payload: PushPayload): Record<string, unknown> {
  const body = payload.body?.trim() || undefined;
  const data = stringifyPushData({ ...(payload.data ?? {}), link_path: payload.linkPath ?? undefined });
  return {
    message: {
      token,
      notification: { title: payload.title, ...(body ? { body } : {}) },
      ...(Object.keys(data).length ? { data } : {}),
      android: { priority: 'high', notification: { channel_id: 'default', sound: 'default' } },
      apns: { headers: { 'apns-priority': '10' }, payload: { aps: { sound: 'default' } } },
    },
  };
}

export function fcmSendUrl(projectId: string): string {
  return `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/messages:send`;
}

export type FcmSendOutcome = 'sent' | 'unregistered' | 'error';
export type FcmClassifiedResponse = { outcome: FcmSendOutcome; code: string | null; message: string | null };

type FcmErrorBody = {
  error?: {
    code?: number;
    status?: string;
    message?: string;
    details?: Array<{ '@type'?: string; errorCode?: string }>;
  };
};

/**
 * `unregistered` means the device token is dead and must be pruned: HTTP 404,
 * `NOT_FOUND`, the FCM `UNREGISTERED` detail, or `INVALID_ARGUMENT` about the
 * registration token itself. Anything else is a transient/config error.
 */
export function classifyFcmResponse(status: number, body: unknown): FcmClassifiedResponse {
  if (status >= 200 && status < 300) return { outcome: 'sent', code: null, message: null };
  const error = (body as FcmErrorBody | null)?.error;
  const detailCode = error?.details?.find((d) => typeof d.errorCode === 'string')?.errorCode ?? null;
  const code = detailCode ?? error?.status ?? `http_${status}`;
  const message = error?.message ?? null;
  const tokenInvalid =
    status === 404 ||
    detailCode === 'UNREGISTERED' ||
    error?.status === 'NOT_FOUND' ||
    (status === 400 && /registration token/i.test(message ?? ''));
  return { outcome: tokenInvalid ? 'unregistered' : 'error', code, message };
}

export async function exchangeJwtForAccessToken(
  tokenUri: string,
  jwt: string,
  timeoutMs: number = DEFAULT_FCM_TIMEOUT_MS,
): Promise<{ accessToken: string; expiresAt: Date }> {
  const form = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion: jwt,
  });
  const res = await fetchWithTimeout(
    tokenUri,
    { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: form.toString() },
    timeoutMs,
  );
  const body = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };
  if (!res.ok || !body.access_token) {
    throw new Error(`fcm_token_exchange_failed: ${body.error ?? res.status} ${body.error_description ?? ''}`.trim());
  }
  const ttlSec = typeof body.expires_in === 'number' && body.expires_in > 0 ? body.expires_in : DEFAULT_JWT_TTL_SEC;
  return { accessToken: body.access_token, expiresAt: new Date(Date.now() + ttlSec * 1000) };
}

export async function sendFcmMessage(
  accessToken: string,
  projectId: string,
  message: Record<string, unknown>,
  timeoutMs: number = DEFAULT_FCM_TIMEOUT_MS,
): Promise<FcmClassifiedResponse> {
  const res = await fetchWithTimeout(
    fcmSendUrl(projectId),
    {
      method: 'POST',
      headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
      body: JSON.stringify(message),
    },
    timeoutMs,
  );
  const body: unknown = await res.json().catch(() => null);
  return classifyFcmResponse(res.status, body);
}
