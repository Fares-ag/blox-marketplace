import { BadRequestException } from '@nestjs/common';
import { ApplicationStatus, ComplianceCheckStatus, UserRole } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { ActivityService } from '../common/activity.service';
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
      monthly: 2500,
      tenor: 36,
      rate: 5,
    },
    product: { make: 'Toyota', model: 'Camry', modelYear: 2024 },
    company: { name: 'Demo Dealer' },
  };

  function buildService(
    prisma: Partial<PrismaService>,
    compliance: Partial<ComplianceService>,
  ) {
    return new ApplicationsLifecycleService(
      prisma as PrismaService,
      { log: vi.fn(), notify: vi.fn() } as unknown as ActivityService,
      { storeContractPdf: vi.fn(), readContract: vi.fn() } as unknown as StorageService,
      compliance as ComplianceService,
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
    };
    const storage = {
      storeContractPdf: vi.fn().mockResolvedValue('contracts/app-1.pdf'),
    };
    const service = new ApplicationsLifecycleService(
      prisma as PrismaService,
      { log: vi.fn(), notify: vi.fn() } as unknown as ActivityService,
      storage as unknown as StorageService,
      compliance as ComplianceService,
    );

    const result = await service.approveWithContract(opsUser, 'app-1');
    expect(compliance.assertPassedForApproval).toHaveBeenCalledWith('app-1');
    expect(result.status).toBe(ApplicationStatus.contract_signing_required);
  });
});
