import { CompanyKind } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { expandCompanyIds, resolveDescendantCompanyIds } from './company-hierarchy';

function mockPrisma(opts: {
  companies?: Array<{ id: string; kind: CompanyKind }>;
  children?: Array<{ id: string }>;
}) {
  return {
    company: {
      findUnique: vi.fn().mockImplementation(({ where }: { where: { id: string } }) => {
        return Promise.resolve(opts.companies?.find((c) => c.id === where.id) ?? null);
      }),
      findMany: vi.fn().mockImplementation(({ where }: { where: { id?: { in: string[] }; parentCompanyId?: string | { in: string[] } } }) => {
        if (where.parentCompanyId) return Promise.resolve(opts.children ?? []);
        if (where.id?.in) {
          return Promise.resolve((opts.companies ?? []).filter((c) => where.id!.in.includes(c.id)));
        }
        return Promise.resolve(opts.companies ?? []);
      }),
    },
  };
}

describe('company-hierarchy', () => {
  it('returns the dealership id when resolving a leaf', async () => {
    const prisma = mockPrisma({
      companies: [{ id: 'audi', kind: CompanyKind.dealership }],
    });
    await expect(resolveDescendantCompanyIds(prisma as never, 'audi')).resolves.toEqual(['audi']);
  });

  it('includes children when resolving a holding', async () => {
    const prisma = mockPrisma({
      companies: [{ id: 'qauto', kind: CompanyKind.holding }],
      children: [{ id: 'audi' }, { id: 'vw' }, { id: 'skoda' }],
    });
    await expect(resolveDescendantCompanyIds(prisma as never, 'qauto')).resolves.toEqual([
      'qauto',
      'audi',
      'vw',
      'skoda',
    ]);
  });

  it('expands holding assignments to child dealerships', async () => {
    const prisma = mockPrisma({
      companies: [
        { id: 'qauto', kind: CompanyKind.holding },
        { id: 'other', kind: CompanyKind.dealership },
      ],
      children: [{ id: 'audi' }, { id: 'vw' }],
    });
    await expect(expandCompanyIds(prisma as never, ['qauto', 'other'])).resolves.toEqual([
      'qauto',
      'other',
      'audi',
      'vw',
    ]);
  });
});
