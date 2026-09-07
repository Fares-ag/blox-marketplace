import { createVerify, generateKeyPairSync } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildFcmMessage,
  buildServiceAccountJwt,
  classifyFcmResponse,
  decodeJwtSegments,
  exchangeJwtForAccessToken,
  FCM_SCOPE,
  fcmSendUrl,
  GOOGLE_TOKEN_URI,
  normalizePrivateKey,
  parseServiceAccount,
  sendFcmMessage,
  stringifyPushData,
} from './fcm';

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

const account = {
  projectId: 'blox-app',
  clientEmail: 'push@blox-app.iam.gserviceaccount.com',
  privateKey,
  tokenUri: GOOGLE_TOKEN_URI,
};

describe('buildServiceAccountJwt', () => {
  it('builds an RS256 JWT with the Google service-account claims', () => {
    const now = new Date('2026-09-07T10:00:00.000Z');
    const { jwt, claims, expiresAt } = buildServiceAccountJwt(account, { now });
    const { header, claims: decoded, signature, signingInput } = decodeJwtSegments(jwt);

    expect(header).toEqual({ alg: 'RS256', typ: 'JWT' });
    expect(decoded).toEqual({
      iss: account.clientEmail,
      scope: FCM_SCOPE,
      aud: GOOGLE_TOKEN_URI,
      iat: Math.floor(now.getTime() / 1000),
      exp: Math.floor(now.getTime() / 1000) + 3600,
    });
    expect(claims).toEqual(decoded);
    expect(expiresAt.toISOString()).toBe('2026-09-07T11:00:00.000Z');
    expect(createVerify('RSA-SHA256').update(signingInput).end().verify(publicKey, signature)).toBe(true);
  });

  it('caps the lifetime at one hour and floors it at a minute', () => {
    const now = new Date('2026-09-07T10:00:00.000Z');
    expect(buildServiceAccountJwt(account, { now, ttlSec: 99_999 }).claims.exp).toBe(
      Math.floor(now.getTime() / 1000) + 3600,
    );
    expect(buildServiceAccountJwt(account, { now, ttlSec: 5 }).claims.exp).toBe(Math.floor(now.getTime() / 1000) + 60);
  });

  it('signs with the raw key, so a tampered payload no longer verifies', () => {
    const { jwt } = buildServiceAccountJwt(account);
    const [h, c, s] = jwt.split('.');
    const forgedClaims = Buffer.from(JSON.stringify({ iss: 'attacker' })).toString('base64url');
    expect(
      createVerify('RSA-SHA256')
        .update(`${h}.${forgedClaims}`)
        .end()
        .verify(publicKey, Buffer.from(s!, 'base64url')),
    ).toBe(false);
    expect(c).not.toBe(forgedClaims);
  });
});

describe('parseServiceAccount', () => {
  const raw = JSON.stringify({
    project_id: 'blox-app',
    client_email: account.clientEmail,
    private_key: privateKey.replace(/\n/g, '\\n'),
  });

  it('accepts raw JSON and restores the literal \\n in the key', () => {
    const parsed = parseServiceAccount(raw);
    expect(parsed.projectId).toBe('blox-app');
    expect(parsed.clientEmail).toBe(account.clientEmail);
    expect(parsed.privateKey).toBe(privateKey.trim());
    expect(parsed.tokenUri).toBe(GOOGLE_TOKEN_URI);
  });

  it('accepts the base64 form used for single-line env vars', () => {
    const parsed = parseServiceAccount(Buffer.from(raw, 'utf8').toString('base64'));
    expect(parsed.projectId).toBe('blox-app');
  });

  it('rejects malformed or incomplete keys', () => {
    expect(() => parseServiceAccount('')).toThrow('fcm_service_account_empty');
    expect(() => parseServiceAccount('{not json')).toThrow('fcm_service_account_invalid_json');
    expect(() => parseServiceAccount(JSON.stringify({ project_id: 'x' }))).toThrow(/missing_fields/);
  });

  it('normalises escaped newlines', () => {
    expect(normalizePrivateKey('a\\nb\\n')).toBe('a\nb');
  });
});

describe('buildFcmMessage', () => {
  it('builds a v1 message with notification, stringified data and high priority', () => {
    const message = buildFcmMessage('tok-1', {
      title: 'Installment due soon',
      body: 'QAR 1,200 due on 2026-09-10',
      linkPath: '/app/applications/a1',
      data: { category: 'payments', schedule_id: 's1', amount: 1200, skip: null, empty: '' },
    });
    expect(message).toEqual({
      message: {
        token: 'tok-1',
        notification: { title: 'Installment due soon', body: 'QAR 1,200 due on 2026-09-10' },
        data: { category: 'payments', schedule_id: 's1', amount: '1200', link_path: '/app/applications/a1' },
        android: { priority: 'high', notification: { channel_id: 'default', sound: 'default' } },
        apns: { headers: { 'apns-priority': '10' }, payload: { aps: { sound: 'default' } } },
      },
    });
  });

  it('omits empty body and data', () => {
    const message = buildFcmMessage('tok', { title: 'Hi' }) as { message: Record<string, unknown> };
    expect(message.message.notification).toEqual({ title: 'Hi' });
    expect(message.message).not.toHaveProperty('data');
    expect(stringifyPushData(undefined)).toEqual({});
  });

  it('targets the project send endpoint', () => {
    expect(fcmSendUrl('blox-app')).toBe('https://fcm.googleapis.com/v1/projects/blox-app/messages:send');
  });
});

describe('classifyFcmResponse', () => {
  it('treats 2xx as sent', () => {
    expect(classifyFcmResponse(200, { name: 'projects/x/messages/1' })).toEqual({ outcome: 'sent', code: null, message: null });
  });

  it('flags dead tokens for pruning (404, UNREGISTERED, NOT_FOUND, invalid registration token)', () => {
    expect(classifyFcmResponse(404, { error: { status: 'NOT_FOUND', message: 'Requested entity was not found.' } }).outcome).toBe(
      'unregistered',
    );
    expect(
      classifyFcmResponse(400, {
        error: {
          status: 'INVALID_ARGUMENT',
          message: 'The registration token is not a valid FCM registration token',
          details: [{ '@type': 'type.googleapis.com/google.firebase.fcm.v1.FcmError', errorCode: 'INVALID_ARGUMENT' }],
        },
      }).outcome,
    ).toBe('unregistered');
    expect(
      classifyFcmResponse(404, {
        error: { status: 'NOT_FOUND', details: [{ errorCode: 'UNREGISTERED' }] },
      }),
    ).toEqual({ outcome: 'unregistered', code: 'UNREGISTERED', message: null });
  });

  it('keeps transient and configuration errors out of the prune path', () => {
    expect(classifyFcmResponse(503, { error: { status: 'UNAVAILABLE', message: 'try later' } })).toEqual({
      outcome: 'error',
      code: 'UNAVAILABLE',
      message: 'try later',
    });
    expect(classifyFcmResponse(401, null)).toEqual({ outcome: 'error', code: 'http_401', message: null });
    expect(classifyFcmResponse(400, { error: { status: 'INVALID_ARGUMENT', message: 'data must be a map' } }).outcome).toBe('error');
  });
});

describe('fetch helpers', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('exchanges the JWT for an access token with the jwt-bearer grant', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ access_token: 'ya29.token', expires_in: 3599, token_type: 'Bearer' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const before = Date.now();
    const result = await exchangeJwtForAccessToken(GOOGLE_TOKEN_URI, 'jwt-value');
    expect(result.accessToken).toBe('ya29.token');
    expect(result.expiresAt.getTime()).toBeGreaterThanOrEqual(before + 3599 * 1000 - 5);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(GOOGLE_TOKEN_URI);
    expect(init.method).toBe('POST');
    expect(String(init.body)).toBe(
      new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: 'jwt-value' }).toString(),
    );
  });

  it('surfaces token exchange failures', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ error: 'invalid_grant', error_description: 'Invalid JWT Signature.' }),
      }),
    );
    await expect(exchangeJwtForAccessToken(GOOGLE_TOKEN_URI, 'bad')).rejects.toThrow(/invalid_grant Invalid JWT Signature/);
  });

  it('posts the message with the bearer token and classifies the reply', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ error: { status: 'NOT_FOUND', details: [{ errorCode: 'UNREGISTERED' }] } }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await sendFcmMessage('ya29.token', 'blox-app', buildFcmMessage('tok', { title: 'x' }));
    expect(result.outcome).toBe('unregistered');
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(fcmSendUrl('blox-app'));
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer ya29.token');
  });
});
