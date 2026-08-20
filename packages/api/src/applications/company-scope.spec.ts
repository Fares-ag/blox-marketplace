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

function mockPrisma(companyIds: string[]) {
  const rows = companyIds.map((companyId) => ({ companyId }));
  return {
    creditOfficerCompany: {
      findMany: vi.fn().mockResolvedValue(rows),
    },
    financeOfficerCompany: {
      findMany: vi.fn().mockResolvedValue(rows),
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
  });
});
