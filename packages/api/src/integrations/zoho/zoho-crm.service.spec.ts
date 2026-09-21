import { beforeEach, describe, expect, it, vi } from 'vitest';

const fetchWithTimeout = vi.fn();

vi.mock('../../common/fetch-with-timeout', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../common/fetch-with-timeout')>();
  return { ...actual, fetchWithTimeout: (...args: unknown[]) => fetchWithTimeout(...args) };
});

import { ZohoCrmService } from './zoho-crm.service';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function zohoSuccess(id: string): Response {
  return jsonResponse(200, { data: [{ code: 'SUCCESS', details: { id } }] });
}

function applicationRecord(over: Record<string, unknown> = {}) {
  return {
    id: 'app-1',
    customerEmail: 'fares@example.com',
    zohoLeadId: null,
    status: 'partner_processing',
    customerSnapshot: { full_name: 'Fares Mahmoud', phone: '+974 5555 0001' },
    pricingSnapshot: { list_price: 90000, down_payment: 9000, tenor: 36, monthly: 2500 },
    product: { make: 'Toyota', model: 'Camry', modelYear: 2026, condition: 'new' },
    company: { id: 'c1', name: 'Elite Motors' },
    offer: { name: 'Al Jazeera Standard' },
    financePartner: { code: 'al-jazeera', crmAdapter: 'zoho' },
    documents: [],
    customer: { qid: null, qidEnc: null },
    zohoSyncAttempts: 0,
    ...over,
  };
}

type StoredApp = ReturnType<typeof applicationRecord>;

function buildService(apps: Map<string, StoredApp>) {
  const prisma = {
    application: {
      findUnique: vi.fn(async ({ where, select }: { where: { id: string }; select?: object }) => {
        const row = apps.get(where.id);
        if (!row) return null;
        if (select && 'zohoSyncAttempts' in select) return { zohoSyncAttempts: row.zohoSyncAttempts ?? 0 };
        return row;
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const row = apps.get(where.id);
        if (!row) return null;
        Object.assign(row, data);
        return row;
      }),
    },
  };

  const service = new ZohoCrmService(
    prisma as never,
    { getAccessToken: vi.fn().mockResolvedValue('token') } as never,
    {
      enabled: true,
      configurationError: null,
      apiDomain: 'https://www.zohoapis.com',
      leadSource: 'Partners',
      requestSubmittedTo: 'Direct to Partner',
      httpTimeoutMs: 8000,
    } as never,
    { log: vi.fn().mockResolvedValue(undefined) } as never,
    { readKyc: vi.fn() } as never,
    { readApplicationDocumentBytes: vi.fn() } as never,
    { readQid: vi.fn().mockReturnValue(null) } as never,
  );

  return { service, prisma };
}

function calls(): Array<{ method: string; url: string }> {
  return fetchWithTimeout.mock.calls.map(([url, init]) => ({
    method: String((init as RequestInit | undefined)?.method ?? 'GET'),
    url: String(url),
  }));
}

describe('ZohoCrmService lead create vs update', () => {
  let createSeq = 0;

  beforeEach(() => {
    createSeq = 0;
    fetchWithTimeout.mockReset();
    fetchWithTimeout.mockImplementation(async (url: string | URL, init: RequestInit = {}) => {
      const href = String(url);
      const method = (init.method ?? 'GET').toUpperCase();

      if (method === 'POST' && /\/Leads$/.test(href)) {
        createSeq += 1;
        return zohoSuccess(`new-lead-${createSeq}`);
      }
      if (method === 'PUT' && /\/Leads\/[^/]+$/.test(href)) {
        const id = href.split('/').pop()!;
        return zohoSuccess(id);
      }
      if (/\/Leads\/search/.test(href)) {
        return jsonResponse(200, { data: [{ id: 'existing-email-lead' }] });
      }
      if (/\/Attachments/.test(href)) {
        return jsonResponse(204, {});
      }
      return jsonResponse(500, { error: `unexpected ${method} ${href}` });
    });
  });

  it('creates a new Zoho lead for a new application even when that email already exists', async () => {
    const apps = new Map([['app-2', applicationRecord({ id: 'app-2' })]]);
    const { service } = buildService(apps);

    const result = await service.syncApplicationToZoho('app-2', 'dealer-1');

    expect(result).toEqual({ zohoLeadId: 'new-lead-1', documentsUploaded: 0 });
    expect(apps.get('app-2')?.zohoLeadId).toBe('new-lead-1');
    expect(calls().some((c) => /\/Leads\/search/.test(c.url))).toBe(false);
    expect(calls().filter((c) => c.method === 'PUT')).toEqual([]);
    expect(calls().filter((c) => c.method === 'POST' && /\/Leads$/.test(c.url))).toHaveLength(1);
  });

  it('creates a separate lead for a second application from the same customer', async () => {
    const apps = new Map([
      ['app-a', applicationRecord({ id: 'app-a' })],
      ['app-b', applicationRecord({ id: 'app-b' })],
    ]);
    const { service } = buildService(apps);

    const first = await service.syncApplicationToZoho('app-a');
    const second = await service.syncApplicationToZoho('app-b');

    expect(first.zohoLeadId).toBe('new-lead-1');
    expect(second.zohoLeadId).toBe('new-lead-2');
    expect(first.zohoLeadId).not.toBe(second.zohoLeadId);
    expect(calls().filter((c) => c.method === 'PUT')).toEqual([]);
  });

  it('updates the existing lead when THIS application already has a zohoLeadId', async () => {
    const apps = new Map([
      ['app-1', applicationRecord({ id: 'app-1', zohoLeadId: 'lead-owned' })],
    ]);
    const { service } = buildService(apps);

    const result = await service.syncApplicationToZoho('app-1');

    expect(result.zohoLeadId).toBe('lead-owned');
    expect(calls().some((c) => c.method === 'PUT' && c.url.endsWith('/Leads/lead-owned'))).toBe(true);
    expect(calls().filter((c) => c.method === 'POST' && /\/Leads$/.test(c.url))).toEqual([]);
  });

  it('does not PUT the lead when document re-sync is attach-only', async () => {
    const apps = new Map([
      ['app-1', applicationRecord({ id: 'app-1', zohoLeadId: 'lead-owned' })],
    ]);
    const { service } = buildService(apps);

    const result = await service.syncApplicationToZoho('app-1', 'dealer-1', {
      updateLeadFields: false,
    });

    expect(result.zohoLeadId).toBe('lead-owned');
    expect(calls().filter((c) => c.method === 'PUT')).toEqual([]);
    expect(calls().filter((c) => c.method === 'POST' && /\/Leads$/.test(c.url))).toEqual([]);
  });

  it('creates a new lead for this application when its stored Zoho id is gone', async () => {
    fetchWithTimeout.mockImplementation(async (url: string | URL, init: RequestInit = {}) => {
      const href = String(url);
      const method = (init.method ?? 'GET').toUpperCase();
      if (method === 'PUT' && href.endsWith('/Leads/stale-lead')) {
        return new Response('', { status: 404 });
      }
      if (method === 'POST' && /\/Leads$/.test(href)) {
        return zohoSuccess('replacement-lead');
      }
      if (/\/Leads\/search/.test(href)) {
        return jsonResponse(200, { data: [{ id: 'existing-email-lead' }] });
      }
      if (/\/Attachments/.test(href)) return jsonResponse(204, {});
      return jsonResponse(500, { error: `unexpected ${method} ${href}` });
    });

    const apps = new Map([
      ['app-1', applicationRecord({ id: 'app-1', zohoLeadId: 'stale-lead' })],
    ]);
    const { service } = buildService(apps);

    const result = await service.syncApplicationToZoho('app-1');

    expect(result.zohoLeadId).toBe('replacement-lead');
    expect(calls().some((c) => /\/Leads\/search/.test(c.url))).toBe(false);
    expect(calls().some((c) => c.method === 'PUT' && c.url.endsWith('/existing-email-lead'))).toBe(
      false,
    );
  });

  it('serialises concurrent syncs of the same application so only one lead is created', async () => {
    let createStarted = 0;
    let releaseCreate: () => void = () => undefined;
    const createGate = new Promise<void>((resolve) => {
      releaseCreate = resolve;
    });

    fetchWithTimeout.mockImplementation(async (url: string | URL, init: RequestInit = {}) => {
      const href = String(url);
      const method = (init.method ?? 'GET').toUpperCase();
      if (method === 'POST' && /\/Leads$/.test(href)) {
        createStarted += 1;
        await createGate;
        createSeq += 1;
        return zohoSuccess(`new-lead-${createSeq}`);
      }
      if (method === 'PUT' && /\/Leads\/[^/]+$/.test(href)) {
        const id = href.split('/').pop()!;
        return zohoSuccess(id);
      }
      if (/\/Attachments/.test(href)) return jsonResponse(204, {});
      return jsonResponse(500, { error: `unexpected ${method} ${href}` });
    });

    const apps = new Map([['app-1', applicationRecord({ id: 'app-1' })]]);
    const { service } = buildService(apps);

    const first = service.syncApplicationToZoho('app-1');
    const second = service.syncApplicationToZoho('app-1');

    await vi.waitFor(() => expect(createStarted).toBe(1));
    releaseCreate();

    const [a, b] = await Promise.all([first, second]);
    expect(a.zohoLeadId).toBe('new-lead-1');
    expect(b.zohoLeadId).toBe('new-lead-1');
    expect(calls().filter((c) => c.method === 'POST' && /\/Leads$/.test(c.url))).toHaveLength(1);
  });
});
