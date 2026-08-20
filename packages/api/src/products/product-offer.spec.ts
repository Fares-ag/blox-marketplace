import { describe, expect, it, vi } from 'vitest';
import { assertDefaultOfferForCompany } from './product-offer';

describe('assertDefaultOfferForCompany', () => {
  const companyId = 'company-a';

  it('accepts an active platform-wide offer', async () => {
    const prisma = {
      offer: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'offer-1',
          status: 'active',
          companyId: null,
        }),
      },
    };
    await expect(assertDefaultOfferForCompany(prisma, companyId, 'offer-1')).resolves.toMatchObject({
      id: 'offer-1',
    });
  });

  it('accepts an active offer scoped to the dealer company', async () => {
    const prisma = {
      offer: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'offer-2',
          status: 'active',
          companyId,
        }),
      },
    };
    await expect(assertDefaultOfferForCompany(prisma, companyId, 'offer-2')).resolves.toBeTruthy();
  });

  it('rejects missing, inactive, and cross-company offers', async () => {
    const cases = [
      { id: 'missing', value: null, error: 'offer_not_found' },
      {
        id: 'inactive',
        value: { id: 'inactive', status: 'inactive', companyId: null },
        error: 'offer_not_active',
      },
      {
        id: 'other-co',
        value: { id: 'other-co', status: 'active', companyId: 'company-b' },
        error: 'offer_not_permitted',
      },
    ] as const;

    for (const testCase of cases) {
      const prisma = {
        offer: { findUnique: vi.fn().mockResolvedValue(testCase.value) },
      };
      await expect(assertDefaultOfferForCompany(prisma, companyId, testCase.id)).rejects.toThrow(
        testCase.error,
      );
    }
  });
});
