import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { REQUEST_ID_HEADER } from '../../src/common/request-id';
import {
  createIntegrationApp,
  destroyIntegrationApp,
  type IntegrationContext,
} from './support/app';

describe('request id middleware (integration)', () => {
  let ctx: IntegrationContext;

  beforeAll(async () => {
    ctx = await createIntegrationApp();
  });

  afterAll(async () => {
    await destroyIntegrationApp(ctx);
  });

  it('generates x-request-id on API responses when the client omits it', async () => {
    const res = await ctx.agent.get('/api/health');
    expect(res.status).toBe(200);
    expect(res.headers[REQUEST_ID_HEADER]).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it('echoes a client-supplied x-request-id on responses', async () => {
    const clientId = 'client-correlation-abc123';
    const res = await ctx.agent.get('/api/health').set(REQUEST_ID_HEADER, clientId);
    expect(res.status).toBe(200);
    expect(res.headers[REQUEST_ID_HEADER]).toBe(clientId);
  });
});
