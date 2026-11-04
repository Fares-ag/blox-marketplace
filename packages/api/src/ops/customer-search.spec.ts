import { describe, expect, it, vi } from 'vitest';
import { searchScopedCustomers, snapshotMatchesTerm } from './customer-search';

const walkIn = {
  id: 'app-1',
  customerEmail: 'walkin@example.com',
  customerSnapshot: {
    full_name: 'Ahmad Hassan',
    phone: '+97455510000',
    qid: '28512345678',
    applicantType: 'individual',
  },
};

function db(overrides?: {
  users?: unknown[];
  apps?: unknown[];
}) {
  return {
    user: { findMany: vi.fn().mockResolvedValue(overrides?.users ?? []) },
    application: {
      findMany: vi.fn().mockResolvedValue(overrides?.apps ?? []),
      findFirst: vi.fn().mockResolvedValue(null),
    },
  };
}

describe('snapshotMatchesTerm', () => {
  it('matches name, phone, qid, and email', () => {
    expect(snapshotMatchesTerm(walkIn.customerEmail, walkIn.customerSnapshot, 'hassan')).toBe(true);
    expect(snapshotMatchesTerm(walkIn.customerEmail, walkIn.customerSnapshot, '55510000')).toBe(true);
    expect(snapshotMatchesTerm(walkIn.customerEmail, walkIn.customerSnapshot, '28512345678')).toBe(true);
    expect(snapshotMatchesTerm(walkIn.customerEmail, walkIn.customerSnapshot, 'walkin@')).toBe(true);
    expect(snapshotMatchesTerm(walkIn.customerEmail, walkIn.customerSnapshot, 'other')).toBe(false);
  });
});

describe('searchScopedCustomers', () => {
  it('returns a walk-in applicant at the dealer company when no customer account exists', async () => {
    const prisma = db({ apps: [walkIn] });
    const items = await searchScopedCustomers(prisma as never, { companyIds: ['company-a'], limit: 30 });
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      id: 'app:app-1',
      email: 'walkin@example.com',
      name: 'Ahmad Hassan',
      phone: '+97455510000',
      qid: '28512345678',
    });
    expect(prisma.application.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { customerUserId: null, companyId: { in: ['company-a'] } },
      }),
    );
  });

  it('hides walk-ins from another dealership because the query is company-scoped', async () => {
    const prisma = db({ apps: [] });
    const items = await searchScopedCustomers(prisma as never, { companyIds: ['company-a'], term: 'Ahmad', limit: 30 });
    expect(items).toEqual([]);
    expect(prisma.application.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { customerUserId: null, companyId: { in: ['company-a'] } },
      }),
    );
  });

  it('filters walk-ins by snapshot name', async () => {
    const prisma = db({
      apps: [
        walkIn,
        {
          id: 'app-2',
          customerEmail: 'other@example.com',
          customerSnapshot: { full_name: 'Sara Ali', phone: '', qid: '', applicantType: 'individual' },
        },
      ],
    });
    const items = await searchScopedCustomers(prisma as never, { companyIds: ['company-a'], term: 'Sara', limit: 30 });
    expect(items.map((row) => row.email)).toEqual(['other@example.com']);
  });

  it('does not duplicate a walk-in email that already has a customer account', async () => {
    const prisma = db({
      users: [
        {
          id: 'user-1',
          email: 'walkin@example.com',
          name: 'Ahmad Hassan',
          firstName: 'Ahmad',
          lastName: 'Hassan',
          phone: '+97455510000',
          qid: '28512345678',
          gender: null,
          dateOfBirth: null,
          nationality: null,
          address: null,
        },
      ],
      apps: [walkIn],
    });
    const items = await searchScopedCustomers(prisma as never, { companyIds: ['company-a'], limit: 30 });
    expect(items).toHaveLength(1);
    expect(items[0]?.id).toBe('user-1');
  });
});
