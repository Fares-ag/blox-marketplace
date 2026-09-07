import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApplicationStatus, ComplianceCheckStatus, UserRole } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { ActivityService } from '../common/activity.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { ApplicationsLifecycleService } from '../applications/applications-lifecycle.service';
import { ComplianceService } from './compliance.service';
import { assertCompliancePassed, deriveOverallComplianceStatus } from './compliance-gate';

describe('compliance-gate', () => {
  describe('assertCompliancePassed', () => {
    it('throws when no check exists', () => {
      expect(() => assertCompliancePassed(null)).toThrow(BadRequestException);
      expect(() => assertCompliancePassed(null)).toThrow('compliance_check_required');
    });

    it('throws when overall status is pending', () => {
      expect(() =>
        assertCompliancePassed({ overallStatus: ComplianceCheckStatus.pending }),
      ).toThrow('compliance_check_required');
    });

    it('throws when overall status is fail', () => {
      expect(() =>
        assertCompliancePassed({ overallStatus: ComplianceCheckStatus.fail }),
      ).toThrow('compliance_check_required');
    });

    it('passes when overall status is pass', () => {
      expect(() =>
        assertCompliancePassed({ overallStatus: ComplianceCheckStatus.pass }),
      ).not.toThrow();
    });
  });

  describe('deriveOverallComplianceStatus', () => {
    it('returns fail when either check fails', () => {
      expect(
        deriveOverallComplianceStatus(ComplianceCheckStatus.fail, ComplianceCheckStatus.pass),
      ).toBe(ComplianceCheckStatus.fail);
      expect(
        deriveOverallComplianceStatus(ComplianceCheckStatus.pass, ComplianceCheckStatus.fail),
      ).toBe(ComplianceCheckStatus.fail);
    });

    it('returns pass only when both pass', () => {
      expect(
        deriveOverallComplianceStatus(ComplianceCheckStatus.pass, ComplianceCheckStatus.pass),
      ).toBe(ComplianceCheckStatus.pass);
    });

    it('returns pending otherwise', () => {
      expect(
        deriveOverallComplianceStatus(ComplianceCheckStatus.pending, ComplianceCheckStatus.pass),
      ).toBe(ComplianceCheckStatus.pending);
    });
  });
});

describe('ApplicationsLifecycleService.approveWithContract compliance gate', () => {
  const opsUser = {
    id: 'ops-1',
    role: UserRole.admin,
    companyId: 'co-1',
  } as never;

  const baseApp = {
    id: 'app-1',
    status: ApplicationStatus.under_review,
    companyId: 'co-1',
    customerUserId: 'cust-1',
    customerEmail: 'cust@example.com',
    customerSnapshot: { full_name: 'Test User', phone: '+97412345678', qid: '28412345678' },
    pricingSnapshot: {
      list_price: 100_000,
      down_payment: 20_000,
      down_payment_pct: 20,
      monthly: 2500,
      tenor: 36,
      rate: 5,
      financed_total: 90_000,
    },
    product: { make: 'Toyota', model: 'Camry', modelYear: 2024 },
    company: { name: 'Demo Dealer' },
  };

  function buildService(
    prisma: Partial<PrismaService>,
    compliance: Partial<ComplianceService>,
    storage: Partial<StorageService> = { storeContractPdf: vi.fn(), readContract: vi.fn() },
  ) {
    return new ApplicationsLifecycleService(
      prisma as PrismaService,
      { log: vi.fn(), notify: vi.fn() } as unknown as ActivityService,
      { track: vi.fn() } as unknown as AnalyticsService,
      storage as StorageService,
      compliance as ComplianceService,
      { get: vi.fn() } as unknown as ConfigService,
    );
  }

  it('blocks approval when no passing compliance check exists', async () => {
    const compliance = {
      assertPassedForApproval: vi.fn().mockRejectedValue(new BadRequestException('compliance_check_required')),
    };
    const prisma = {
      application: { findUnique: vi.fn().mockResolvedValue(baseApp) },
    };
    const service = buildService(prisma, compliance);

    await expect(service.approveWithContract(opsUser, 'app-1')).rejects.toMatchObject({
      message: 'compliance_check_required',
    });
    expect(compliance.assertPassedForApproval).toHaveBeenCalledWith('app-1');
  });

  it('blocks approval when compliance check is not pass', async () => {
    const compliance = {
      assertPassedForApproval: vi.fn().mockRejectedValue(new BadRequestException('compliance_check_required')),
    };
    const prisma = {
      application: { findUnique: vi.fn().mockResolvedValue(baseApp) },
    };
    const service = buildService(prisma, compliance);

    await expect(service.approveWithContract(opsUser, 'app-1')).rejects.toThrow(BadRequestException);
  });

  it('proceeds when a passing compliance check exists', async () => {
    const compliance = {
      assertPassedForApproval: vi.fn().mockResolvedValue(undefined),
    };
    const approved = { ...baseApp, status: ApplicationStatus.contract_signing_required };
    const prisma = {
      application: {
        findUnique: vi.fn().mockResolvedValue(baseApp),
        update: vi.fn().mockResolvedValue(approved),
      },
      // Lender-of-record lookup: no default lender configured in this scenario.
      financePartner: { findFirst: vi.fn().mockResolvedValue(null) },
    };
    const storage = {
      storeContractPdf: vi.fn().mockResolvedValue('contracts/app-1.pdf'),
    };
    const service = buildService(prisma, compliance, storage);

    const result = await service.approveWithContract(opsUser, 'app-1');
    expect(compliance.assertPassedForApproval).toHaveBeenCalledWith('app-1');
    expect(result.status).toBe(ApplicationStatus.contract_signing_required);
  });
});

describe('ApplicationsLifecycleService.activate direct-activate compliance gate', () => {
  const opsUser = {
    id: 'ops-1',
    role: UserRole.admin,
    companyId: 'co-1',
  } as never;

  const directApp = {
    id: 'app-1',
    status: ApplicationStatus.under_review,
    companyId: 'co-1',
    productId: 'prod-1',
    customerUserId: 'cust-1',
    pricingSnapshot: {
      list_price: 100_000,
      down_payment: 0,
      down_payment_pct: 0,
      monthly: 2500,
      tenor: 36,
    },
    paymentSchedules: [],
    company: { allowDirectActivate: true },
    contractGenerated: true,
    contractPdfPath: 'app-1/generated/contract.pdf',
    signedContractPath: 'app-1/signed/contract.pdf',
  };

  function buildService(
    prisma: Partial<PrismaService>,
    compliance: Partial<ComplianceService>,
  ) {
    return new ApplicationsLifecycleService(
      prisma as PrismaService,
      { log: vi.fn(), notify: vi.fn() } as unknown as ActivityService,
      { track: vi.fn() } as unknown as AnalyticsService,
      {} as StorageService,
      compliance as ComplianceService,
      { get: vi.fn() } as unknown as ConfigService,
    );
  }

  it('blocks direct activate when compliance has not passed', async () => {
    const compliance = {
      assertPassedForApproval: vi
        .fn()
        .mockRejectedValue(new BadRequestException('compliance_check_required')),
    };
    const prisma = {
      application: { findUnique: vi.fn().mockResolvedValue(directApp) },
    };
    const service = buildService(prisma, compliance);

    await expect(service.activate(opsUser, 'app-1', { direct: true })).rejects.toMatchObject({
      message: 'compliance_check_required',
    });
    expect(compliance.assertPassedForApproval).toHaveBeenCalledWith('app-1');
  });

  it('blocks direct activate when no generated contract is on file', async () => {
    const compliance = {
      assertPassedForApproval: vi.fn().mockResolvedValue(undefined),
    };
    const prisma = {
      application: {
        findUnique: vi.fn().mockResolvedValue({
          ...directApp,
          contractGenerated: false,
          contractPdfPath: null,
        }),
      },
    };
    const service = buildService(prisma, compliance);

    await expect(service.activate(opsUser, 'app-1', { direct: true })).rejects.toMatchObject({
      message: 'contract_not_generated',
    });
  });

  it('blocks direct activate when signed contract is missing', async () => {
    const compliance = {
      assertPassedForApproval: vi.fn().mockResolvedValue(undefined),
    };
    const prisma = {
      application: {
        findUnique: vi.fn().mockResolvedValue({
          ...directApp,
          signedContractPath: null,
        }),
      },
    };
    const service = buildService(prisma, compliance);

    await expect(service.activate(opsUser, 'app-1', { direct: true })).rejects.toMatchObject({
      message: 'signed_contract_required',
    });
  });

  it('proceeds on direct activate when compliance and contract artifacts exist', async () => {
    const compliance = {
      assertPassedForApproval: vi.fn().mockResolvedValue(undefined),
    };
    const activated = { ...directApp, status: ApplicationStatus.active };
    const prisma = {
      application: { findUnique: vi.fn().mockResolvedValue(directApp) },
      paymentEvent: { findMany: vi.fn().mockResolvedValue([]) },
      $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          $queryRaw: vi.fn().mockResolvedValue([]),
          paymentSchedule: {
            count: vi.fn().mockResolvedValue(0),
            createMany: vi.fn(),
          },
          application: {
            updateMany: vi.fn().mockResolvedValue({ count: 1 }),
            findUniqueOrThrow: vi.fn().mockResolvedValue(activated),
          },
          product: { update: vi.fn() },
        }),
      ),
    };
    const service = buildService(prisma, compliance);

    const result = await service.activate(opsUser, 'app-1', { direct: true });
    expect(compliance.assertPassedForApproval).toHaveBeenCalledWith('app-1');
    expect(result.status).toBe(ApplicationStatus.active);
  });
});
