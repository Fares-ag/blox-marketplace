import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  isMarketplaceKycHoldTerminal,
  liftMarketplaceKycHold,
} from './kyc-legal-hold';

describe('marketplace KYC legal-hold lift', () => {
  const original = {
    base: process.env.KYC_API_BASE_URL,
    key: process.env.KYC_API_KEY,
    tenant: process.env.KYC_TENANT_ID,
  };

  afterEach(() => {
    vi.unstubAllGlobals();
    if (original.base === undefined) delete process.env.KYC_API_BASE_URL;
    else process.env.KYC_API_BASE_URL = original.base;
    if (original.key === undefined) delete process.env.KYC_API_KEY;
    else process.env.KYC_API_KEY = original.key;
    if (original.tenant === undefined) delete process.env.KYC_TENANT_ID;
    else process.env.KYC_TENANT_ID = original.tenant;
  });

  it('treats completed, rejected, and cancelled as terminal', () => {
    expect(isMarketplaceKycHoldTerminal('completed')).toBe(true);
    expect(isMarketplaceKycHoldTerminal('rejected')).toBe(true);
    expect(isMarketplaceKycHoldTerminal('submission_cancelled')).toBe(true);
    expect(isMarketplaceKycHoldTerminal('active')).toBe(false);
    expect(isMarketplaceKycHoldTerminal('under_review')).toBe(false);
  });

  it('does not call KYC when the application is still live', async () => {
    const spy = vi.fn();
    vi.stubGlobal('fetch', spy);
    process.env.KYC_API_BASE_URL = 'https://kyc.example';
    process.env.KYC_API_KEY = 'kyc_key';
    process.env.KYC_TENANT_ID = 'tenant';
    await liftMarketplaceKycHold('case-1', 'active');
    expect(spy).not.toHaveBeenCalled();
  });

  it('POSTs hold=false on terminal statuses', async () => {
    const spy = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', spy);
    process.env.KYC_API_BASE_URL = 'https://kyc.example';
    process.env.KYC_API_KEY = 'kyc_key';
    process.env.KYC_TENANT_ID = 'tenant';
    await liftMarketplaceKycHold('case-9', 'completed', 'final_installment_paid');
    expect(spy).toHaveBeenCalledTimes(1);
    const [url, init] = spy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://kyc.example/api/v1/cases/case-9/legal-hold');
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({
      hold: false,
      reason: 'final_installment_paid',
    });
  });
});
