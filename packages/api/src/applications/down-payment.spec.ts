import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AnalyticsService } from '../analytics/analytics.service';
import { ApplicationStatus, PaymentEventType, Prisma, UserRole } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { ActivityService } from '../common/activity.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { ComplianceService } from '../compliance/compliance.service';
import { ApplicationsLifecycleService } from './applications-lifecycle.service';
import {
  assertDownPaymentRecordedForDirectActivation,
  assertDownPaymentSatisfied,
  requiredDownPaymentAmount,
  sumDownPaymentRecorded,
} from './down-payment';

describe('down-payment helpers', () => {
  it('reads required amount from pricingSnapshot.down_payment', () => {
    expect(
      requiredDownPaymentAmount({ list_price: 100_000, down_payment: 20_000 }).toFixed(2),
    ).toBe('20000.00');
  });

  it('derives required amount from list_price and down_payment_pct when down_payment missing', () => {
    expect(
      requiredDownPaymentAmount({ list_price: 100_000, down_payment_pct: 15 }).toFixed(2),
    ).toBe('15000.00');
  });

  it('throws down_payment_incomplete when recorded is below required', () => {
    expect(() =>
      assertDownPaymentSatisfied(new Prisma.Decimal(20_000), new Prisma.Decimal(19_999.99)),
    ).toThrow(BadRequestException);
    expect(() =>
      assertDownPaymentSatisfied(new Prisma.Decimal(20_000), new Prisma.Decimal(19_999.99)),
    ).toThrow('down_payment_incomplete');
  });

  it('passes when recorded meets or exceeds required', () => {
    expect(() =>
      assertDownPaymentSatisfied(new Prisma.Decimal(20_000), new Prisma.Decimal(20_000)),
    ).not.toThrow();
    expect(() =>
      assertDownPaymentSatisfied(new Prisma.Decimal(20_000), new Prisma.Decimal(25_000)),
    ).not.toThrow();
  });

  it('blocks direct activation shortcut when down payment is still owed', async () => {
    const db = {
      paymentEvent: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };
    await expect(
      assertDownPaymentRecordedForDirectActivation(db, 'app-1', {
        list_price: 100_000,
        down_payment: 20_000,
      }),
    ).rejects.toThrow('down_payment_required_before_activation');
  });

  it('allows direct activation shortcut when no down payment is required', async () => {
    const db = {
      paymentEvent: {
        findMany: vi.fn(),
      },
    };
    await expect(
      assertDownPaymentRecordedForDirectActivation(db, 'app-1', { list_price: 100_000, down_payment: 0 }),
    ).resolves.toBeUndefined();
    expect(db.paymentEvent.findMany).not.toHaveBeenCalled();
  });

  it('sums down_payment PaymentEvents', async () => {
    const db = {
      paymentEvent: {
        findMany: vi.fn().mockResolvedValue([
          { amount: new Prisma.Decimal(10_000) },
          { amount: new Prisma.Decimal(10_000) },
        ]),
      },
    };
    const total = await sumDownPaymentRecorded(db as never, 'app-1');
    expect(total.toFixed(2)).toBe('20000.00');
  });
});

describe('ApplicationsLifecycleService.activate down-payment guard', () => {
  const opsUser = {
    id: 'ops-1',
    role: UserRole.admin,
    companyId: 'co-1',
  } as never;

  function buildService(prisma: Partial<PrismaService>) {
    const config = { get: vi.fn().mockReturnValue(undefined) } as unknown as ConfigService;
    return new ApplicationsLifecycleService(
      prisma as PrismaService,
      { log: vi.fn(), notify: vi.fn() } as unknown as ActivityService,
      { track: vi.fn() } as unknown as AnalyticsService,
      {} as StorageService,
      { assertPassedForApproval: vi.fn().mockResolvedValue(undefined) } as unknown as ComplianceService,
      config,
    );
  }

  const baseApp = {
    id: 'app-1',
    status: ApplicationStatus.pending_finance_activation,
    companyId: 'co-1',
    productId: 'prod-1',
    customerUserId: 'cust-1',
    pricingSnapshot: {
      list_price: 100_000,
      down_payment: 20_000,
      down_payment_pct: 20,
      monthly: 2500,
      tenor: 36,
    },
    paymentSchedules: [],
    company: { allowDirectActivate: false, separationOfDutiesEnabled: true },
  };

  function prismaWithSodMocks(extra: Partial<PrismaService>) {
    return {
      activityLog: { findMany: vi.fn().mockResolvedValue([]) },
      ...extra,
    };
  }

  it('throws down_payment_incomplete when no down_payment events exist', async () => {
    const prisma = prismaWithSodMocks({
      application: { findUnique: vi.fn().mockResolvedValue(baseApp) },
      paymentEvent: { findMany: vi.fn().mockResolvedValue([]) },
      $transaction: vi.fn().mockRejectedValue(new Error('transaction should not run')),
    });
    const service = buildService(prisma);

    await expect(service.activate(opsUser, 'app-1')).rejects.toMatchObject({
      message: 'down_payment_incomplete',
    });
  });

  it('throws down_payment_incomplete when recorded amount is insufficient', async () => {
    const prisma = prismaWithSodMocks({
      application: { findUnique: vi.fn().mockResolvedValue(baseApp) },
      paymentEvent: {
        findMany: vi.fn().mockResolvedValue([{ amount: new Prisma.Decimal(15_000) }]),
      },
      $transaction: vi.fn().mockRejectedValue(new Error('transaction should not run')),
    });
    const service = buildService(prisma);

    await expect(service.activate(opsUser, 'app-1')).rejects.toMatchObject({
      message: 'down_payment_incomplete',
    });
  });

  it('succeeds when down_payment events cover the required amount', async () => {
    const activated = { ...baseApp, status: ApplicationStatus.active };
    const prisma = prismaWithSodMocks({
      application: {
        findUnique: vi.fn().mockResolvedValue(baseApp),
      },
      paymentEvent: {
        findMany: vi.fn().mockResolvedValue([{ amount: new Prisma.Decimal(20_000) }]),
      },
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
    });
    const service = buildService(prisma);

    const result = await service.activate(opsUser, 'app-1');
    expect(result.status).toBe(ApplicationStatus.active);
  });

  it('applies the down-payment check on direct activate too', async () => {
    // Direct activation is an approval out of review, so the credit matrix
    // runs first: QAR 64,000 financed sits at head-of-credit authority, which
    // an admin may sign off — the down-payment guard is then what refuses.
    const directApp = {
      ...baseApp,
      status: ApplicationStatus.under_review,
      pricingSnapshot: { list_price: 80_000, down_payment: 16_000, down_payment_pct: 20, monthly: 2_100, tenor: 36 },
      company: { allowDirectActivate: true, separationOfDutiesEnabled: true },
      contractGenerated: true,
      contractPdfPath: 'app-1/generated/contract.pdf',
      signedContractPath: 'app-1/signed/contract.pdf',
    };
    const prisma = prismaWithSodMocks({
      application: { findUnique: vi.fn().mockResolvedValue(directApp) },
      paymentEvent: { findMany: vi.fn().mockResolvedValue([]) },
      $transaction: vi.fn().mockRejectedValue(new Error('transaction should not run')),
    });
    const service = buildService(prisma);

    await expect(service.activate(opsUser, 'app-1', { direct: true })).rejects.toMatchObject({
      message: 'down_payment_incomplete',
    });
  });

  it('refuses direct activation above the approval matrix before looking at the down payment', async () => {
    // baseApp finances QAR 80,000 on a car → outside the matrix: super admin only.
    const directApp = {
      ...baseApp,
      status: ApplicationStatus.under_review,
      company: { allowDirectActivate: true, separationOfDutiesEnabled: true },
      contractGenerated: true,
      contractPdfPath: 'app-1/generated/contract.pdf',
      signedContractPath: 'app-1/signed/contract.pdf',
    };
    const paymentEventFindMany = vi.fn().mockResolvedValue([]);
    const prisma = prismaWithSodMocks({
      application: { findUnique: vi.fn().mockResolvedValue(directApp) },
      paymentEvent: { findMany: paymentEventFindMany },
      $transaction: vi.fn().mockRejectedValue(new Error('transaction should not run')),
    });
    const service = buildService(prisma);

    await expect(service.activate(opsUser, 'app-1', { direct: true })).rejects.toMatchObject({
      response: { message: 'approval_authority_required', authority: 'above_matrix', required_roles: ['super_admin'] },
    });
    expect(paymentEventFindMany).not.toHaveBeenCalled();
  });
});

describe('ApplicationsLifecycleService.recordDownPayment', () => {
  const financeUser = {
    id: 'fin-1',
    role: UserRole.finance_officer,
    companyId: 'co-1',
    financeScope: 'assigned',
  } as never;

  function buildService(prisma: Partial<PrismaService>) {
    const config = { get: vi.fn().mockReturnValue(undefined) } as unknown as ConfigService;
    return new ApplicationsLifecycleService(
      prisma as PrismaService,
      { log: vi.fn(), notify: vi.fn() } as unknown as ActivityService,
      { track: vi.fn() } as unknown as AnalyticsService,
      {} as StorageService,
      { assertPassedForApproval: vi.fn().mockResolvedValue(undefined) } as unknown as ComplianceService,
      config,
    );
  }

  function companyScopePrisma(extra: Partial<PrismaService> = {}) {
    return {
      company: {
        findMany: vi.fn().mockResolvedValue([{ id: 'co-1', kind: 'dealership' }]),
      },
      financeOfficerCompany: { findMany: vi.fn().mockResolvedValue([{ companyId: 'co-1' }]) },
      ...extra,
    };
  }

  const baseApp = {
    id: 'app-1',
    status: ApplicationStatus.down_payment_required,
    companyId: 'co-1',
    customerUserId: 'cust-1',
  };

  it('writes a down_payment ledger event and advances to down_payment_submitted', async () => {
    const submitted = { ...baseApp, status: ApplicationStatus.down_payment_submitted };
    const paymentEventCreate = vi.fn();
    const applicationFindUniqueOrThrow = vi.fn().mockResolvedValue(submitted);

    const prisma = companyScopePrisma({
      application: {
        findUnique: vi.fn().mockResolvedValue(baseApp),
      },
      $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          paymentEvent: { create: paymentEventCreate },
          application: {
            updateMany: vi.fn().mockResolvedValue({ count: 1 }),
            findUniqueOrThrow: applicationFindUniqueOrThrow,
          },
        }),
      ),
    });

    const service = buildService(prisma);
    const result = await service.recordDownPayment(financeUser, 'app-1', {
      amount: 10_000,
      method: 'bank_transfer',
      reference: 'DP-001',
    });

    expect(paymentEventCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        applicationId: 'app-1',
        type: PaymentEventType.down_payment,
        amount: expect.any(Prisma.Decimal),
        actorUserId: 'fin-1',
        metadata: expect.objectContaining({
          method: 'bank_transfer',
          reference: 'DP-001',
        }),
      }),
    });
    expect(result.status).toBe(ApplicationStatus.down_payment_submitted);
  });

  it('rejects recording when the application is not awaiting down payment', async () => {
    const prisma = companyScopePrisma({
      application: {
        findUnique: vi.fn().mockResolvedValue({
          ...baseApp,
          status: ApplicationStatus.pending_finance_activation,
        }),
      },
      $transaction: vi.fn(),
    });
    const service = buildService(prisma);

    await expect(
      service.recordDownPayment(financeUser, 'app-1', { amount: 10_000 }),
    ).rejects.toMatchObject({ message: 'invalid_status_transition' });
  });
});
