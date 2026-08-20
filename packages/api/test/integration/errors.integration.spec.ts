import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createAgent,
  createIntegrationApp,
  destroyIntegrationApp,
  type IntegrationContext,
} from './support/app';
import { authed, signUpFresh } from './support/auth';
import { REQUEST_ID_HEADER } from '../../src/common/request-id';

describe('API error envelope (integration)', () => {
  let ctx: IntegrationContext;

  beforeAll(async () => {
    ctx = await createIntegrationApp();
  });

  afterAll(async () => {
    await destroyIntegrationApp(ctx);
  });

  it('returns the standard envelope for auth failures', async () => {
    const res = await ctx.agent.get('/api/v1/me');
    expect(res.status).toBe(401);
    expect(res.body.error).toEqual(
      expect.objectContaining({
        code: 'unauthorized',
        message: expect.any(String),
        requestId: expect.any(String),
      }),
    );
    expect(res.headers[REQUEST_ID_HEADER]).toBe(res.body.error.requestId);
    expect(res.body.stack).toBeUndefined();
  });

  it('returns machine codes in error.code for role failures', async () => {
    const guest = createAgent(ctx);
    await signUpFresh(guest, 'errors-customer');
    const res = await authed(guest).get('/api/v1/ops/applications');
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('forbidden_role');
    expect(res.body.error.requestId).toBeTruthy();
  });

  it('rejects unknown body fields with 400', async () => {
    const guest = createAgent(ctx);
    await signUpFresh(guest, 'validation-customer');
    const res = await authed(guest)
      .post('/api/v1/applications/not-a-real-id/cancel')
      .send({ reason: 'changed mind', unknown_field: true });
    expect(res.status).toBe(400);
  });
});
