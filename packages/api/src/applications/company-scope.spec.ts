import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { OfficerScope, User, UserRole } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import {
  assertCompanyScope,
  assertCompanyScopeForRead,
  opsCompanyFilter,
} from './company-scope';
import type { PrismaService } from '../prisma/prisma.service';

function officer(
  role: UserRole.credit_officer | UserRole.finance_officer,
  scope: OfficerScope,
  id = 'officer-1',
): User {
  return {
    id,
    role,
    creditScope: role === UserRole.credit_officer ? scope : OfficerScope.assigned,
    financeScope: role === UserRole.finance_officer ? scope : OfficerScope.assigned,
  } as User;
}

function mockPrisma(companyIds: string[], companies?: Array<{ id: string; kind: 'holding' | 'dealership' }>) {
  const rows = companyIds.map((companyId) => ({ companyId }));
  const companyRows = companies ?? companyIds.map((id) => ({ id, kind: 'dealership' as const }));
  return {
    creditOfficerCompany: {
      findMany: vi.fn().mockResolvedValue(rows),
    },
    financeOfficerCompany: {
      findMany: vi.fn().mockResolvedValue(rows),
    },
    company: {
      findUnique: vi.fn().mockImplementation(({ where }: { where: { id: string } }) =>
        Promise.resolve(companyRows.find((c) => c.id === where.id) ?? { id: where.id, kind: 'dealership' }),
      ),
      findMany: vi.fn().mockImplementation(({ where }: { where?: { id?: { in: string[] }; parentCompanyId?: string | { in: string[] } } }) => {
        if (where?.parentCompanyId) {
          const parentIds = typeof where.parentCompanyId === 'string'
            ? [where.parentCompanyId]
            : where.parentCompanyId.in;
          return Promise.resolve(
            companyRows
              .filter((c) => c.kind === 'dealership' && parentIds.includes('qauto'))
              .map((c) => ({ id: c.id })),
          );
        }
        if (where?.id?.in) {
          return Promise.resolve(companyRows.filter((c) => where.id!.in.includes(c.id)));
        }
        return Promise.resolve(companyRows);
      }),
    },
  } as unknown as PrismaService;
}

describe('company-scope', () => {
  const companyA = 'company-a';
  const companyB = 'company-b';

  describe('assertCompanyScope', () => {
    it('allows admin for any company', async () => {
      const prisma = mockPrisma([]);
      await expect(
        assertCompanyScope(prisma, { role: UserRole.admin } as User, companyB),
      ).resolves.toBeUndefined();
      expect(prisma.creditOfficerCompany.findMany).not.toHaveBeenCalled();
    });

    it('allows super_admin for any company', async () => {
      const prisma = mockPrisma([]);
      await expect(
        assertCompanyScope(prisma, { role: UserRole.super_admin } as User, companyB),
      ).resolves.toBeUndefined();
    });

    it('allows credit_officer with scope all', async () => {
      const prisma = mockPrisma([]);
      await expect(
        assertCompanyScope(prisma, officer(UserRole.credit_officer, OfficerScope.all), companyB),
      ).resolves.toBeUndefined();
      expect(prisma.creditOfficerCompany.findMany).not.toHaveBeenCalled();
    });

    it('allows finance_officer with scope all', async () => {
      const prisma = mockPrisma([]);
      await expect(
        assertCompanyScope(prisma, officer(UserRole.finance_officer, OfficerScope.all), companyB),
      ).resolves.toBeUndefined();
      expect(prisma.financeOfficerCompany.findMany).not.toHaveBeenCalled();
    });

    it('allows credit_officer assigned to the company', async () => {
      const prisma = mockPrisma([companyA]);
      await expect(
        assertCompanyScope(prisma, officer(UserRole.credit_officer, OfficerScope.assigned), companyA),
      ).resolves.toBeUndefined();
    });

    it('throws out_of_scope for credit_officer assigned to a different company', async () => {
      const prisma = mockPrisma([companyA]);
      await expect(
        assertCompanyScope(prisma, officer(UserRole.credit_officer, OfficerScope.assigned), companyB),
      ).rejects.toMatchObject({ message: 'out_of_scope' });
    });

    it('throws out_of_scope for finance_officer assigned to a different company', async () => {
      const prisma = mockPrisma([companyA]);
      await expect(
        assertCompanyScope(prisma, officer(UserRole.finance_officer, OfficerScope.assigned), companyB),
      ).rejects.toMatchObject({ message: 'out_of_scope' });
    });

    it('throws forbidden_role for non-ops roles', async () => {
      const prisma = mockPrisma([companyA]);
      await expect(
        assertCompanyScope(prisma, { role: UserRole.customer } as User, companyA),
      ).rejects.toMatchObject({ message: 'forbidden_role' });
    });
  });

  describe('assertCompanyScopeForRead', () => {
    it('throws NotFoundException instead of out_of_scope on reads', async () => {
      const prisma = mockPrisma([companyA]);
      await expect(
        assertCompanyScopeForRead(
          prisma,
          officer(UserRole.finance_officer, OfficerScope.assigned),
          companyB,
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('allows assigned company on reads', async () => {
      const prisma = mockPrisma([companyA]);
      await expect(
        assertCompanyScopeForRead(
          prisma,
          officer(UserRole.finance_officer, OfficerScope.assigned),
          companyA,
        ),
      ).resolves.toBeUndefined();
    });
  });

  describe('opsCompanyFilter', () => {
    it('returns null for admin', async () => {
      const prisma = mockPrisma([]);
      await expect(opsCompanyFilter(prisma, { role: UserRole.admin } as User)).resolves.toBeNull();
    });

    it('returns assigned company ids for scoped credit_officer', async () => {
      const prisma = mockPrisma([companyA]);
      await expect(
        opsCompanyFilter(prisma, officer(UserRole.credit_officer, OfficerScope.assigned)),
      ).resolves.toEqual([companyA]);
    });

    it('expands a holding assignment to child dealerships', async () => {
      const prisma = mockPrisma(['qauto'], [
        { id: 'qauto', kind: 'holding' },
        { id: 'audi', kind: 'dealership' },
        { id: 'vw', kind: 'dealership' },
      ]);
      await expect(
        opsCompanyFilter(prisma, officer(UserRole.credit_officer, OfficerScope.assigned)),
      ).resolves.toEqual(['qauto', 'audi', 'vw']);
    });

    it('scopes group_admin to their holding descendants', async () => {
      const prisma = mockPrisma([], [
        { id: 'qauto', kind: 'holding' },
        { id: 'audi', kind: 'dealership' },
        { id: 'vw', kind: 'dealership' },
      ]);
      await expect(
        opsCompanyFilter(prisma, { role: UserRole.group_admin, companyId: 'qauto' } as User),
      ).resolves.toEqual(['qauto', 'audi', 'vw']);
    });
  });

  describe('holding assignment on assert', () => {
    it('allows credit_officer assigned to a holding to access a child', async () => {
      const prisma = mockPrisma(['qauto'], [
        { id: 'qauto', kind: 'holding' },
        { id: 'audi', kind: 'dealership' },
      ]);
      await expect(
        assertCompanyScope(prisma, officer(UserRole.credit_officer, OfficerScope.assigned), 'audi'),
      ).resolves.toBeUndefined();
    });
  });
});
