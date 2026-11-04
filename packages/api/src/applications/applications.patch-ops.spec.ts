import { ForbiddenException } from '@nestjs/common';
import { ApplicationStatus, User, UserRole } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApplicationsService } from './applications.service';

function actor(role: UserRole, extras: Partial<User> = {}): User {
  return {
    id: `${role}-1`,
    role,
    companyId: 'co-1',
    creditScope: 'all',
    ...extras,
  } as User;
}

function app(status: ApplicationStatus) {
  return {
    id: 'app-1',
    status,
    companyId: 'co-1',
    customerUserId: 'cust-1',
    agentUserId: 'dealer_agent-1',
    customerSnapshot: {
      firstName: 'Sara',
      lastName: 'Ali',
      phone: '+97455512345',
      qid: '28563412345',
    },
    pricingSnapshot: {},
  };
}

describe('ApplicationsService.patchOps', () => {
  let service: ApplicationsService;
  let prisma: {
    application: { findUnique: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
  };

  beforeEach(() => {
    prisma = {
      application: {
        findUnique: vi.fn(),
        update: vi.fn().mockResolvedValue({}),
      },
    };
    service = new ApplicationsService(
      prisma as never,
      { log: vi.fn().mockResolvedValue(undefined) } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      { qidHash: vi.fn().mockReturnValue('qid-hash') } as never,
      {} as never,
      {} as never,
    );
    vi.spyOn(service, 'getOne').mockResolvedValue({ id: 'app-1' } as never);
  });

  it('forbids dealer customerSnapshot unless the application is in resubmission_required', async () => {
    prisma.application.findUnique.mockResolvedValue(app(ApplicationStatus.under_review));
    await expect(
      service.patchOps(actor(UserRole.dealer_agent), 'app-1', {
        customerSnapshot: { firstName: 'Sam' },
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.application.update).not.toHaveBeenCalled();
  });

  it('allows dealer customerSnapshot in resubmission_required', async () => {
    prisma.application.findUnique.mockResolvedValue(app(ApplicationStatus.resubmission_required));
    await service.patchOps(actor(UserRole.dealer_agent), 'app-1', {
      customerSnapshot: { firstName: 'Sam' },
    });
    expect(prisma.application.update).toHaveBeenCalled();
  });

  it('forbids credit officers from setting sapNumber', async () => {
    prisma.application.findUnique.mockResolvedValue(app(ApplicationStatus.under_review));
    await expect(
      service.patchOps(actor(UserRole.credit_officer), 'app-1', { sapNumber: 'SAP-1' }),
    ).rejects.toMatchObject({ message: 'forbidden_role' });
  });

  it('forbids dealers from setting contract fields', async () => {
    prisma.application.findUnique.mockResolvedValue(app(ApplicationStatus.under_review));
    await expect(
      service.patchOps(actor(UserRole.dealer_agent), 'app-1', { contractSeries: 'RSK' }),
    ).rejects.toMatchObject({ message: 'forbidden_role' });
  });

  it('stores RU as Ru', async () => {
    prisma.application.findUnique.mockResolvedValue(app(ApplicationStatus.under_review));
    await service.patchOps(actor(UserRole.credit_officer), 'app-1', { contractSeries: 'RU' });
    expect(prisma.application.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ contractSeries: 'Ru' }),
      }),
    );
  });

  it('accepts alphanumeric contract numbers for credit', async () => {
    prisma.application.findUnique.mockResolvedValue(app(ApplicationStatus.under_review));
    await service.patchOps(actor(UserRole.credit_officer), 'app-1', { contractNumber: '3453sdf' });
    expect(prisma.application.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ contractNumber: '3453sdf' }),
      }),
    );
  });

  it('rejects contract numbers that include punctuation', async () => {
    prisma.application.findUnique.mockResolvedValue(app(ApplicationStatus.under_review));
    await expect(
      service.patchOps(actor(UserRole.credit_officer), 'app-1', { contractNumber: 'RSK-3453sdf' }),
    ).rejects.toMatchObject({ message: 'validation_failed' });
    expect(prisma.application.update).not.toHaveBeenCalled();
  });
});
