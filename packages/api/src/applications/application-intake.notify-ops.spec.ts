import { UserRole } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { ApplicationIntakeService } from './application-intake.service';

function buildService(
  targets: Array<{ id: string; role: UserRole }>,
  company: { id: string; parentCompanyId: string | null } = { id: 'company-1', parentCompanyId: null },
) {
  const prisma = {
    user: {
      findMany: vi.fn().mockResolvedValue(targets),
    },
    company: {
      findUnique: vi.fn().mockImplementation(({ where }: { where: { id: string } }) =>
        Promise.resolve(
          where.id === company.id ? company : { id: where.id, parentCompanyId: null },
        ),
      ),
    },
  };
  const activity = {
    log: vi.fn().mockResolvedValue(undefined),
    notify: vi.fn().mockResolvedValue(undefined),
  };
  const service = new ApplicationIntakeService(
    prisma as never,
    activity as never,
    {} as never,
    {} as never,
    { get: vi.fn() } as never,
  );
  return { service, prisma, activity };
}

describe('ApplicationIntakeService.notifyOps', () => {
  it('emails in-scope credit officers when a BloX application enters the queue', async () => {
    const { service, prisma, activity } = buildService([
      { id: 'credit-all', role: UserRole.credit_officer },
      { id: 'credit-assigned', role: UserRole.credit_officer },
    ]);

    await service.notifyOps(
      'company-1',
      [UserRole.credit_officer],
      (role) => (role === UserRole.dealer_agent ? 'New lead on your stock' : 'New financing application'),
      'A customer submitted a financing application.',
      '/applications/app-1',
    );

    expect(prisma.user.findMany).toHaveBeenCalledWith({
      where: {
        isActive: true,
        OR: [
          { role: UserRole.credit_officer, creditScope: 'all' },
          { role: UserRole.credit_officer, creditCompanies: { some: { companyId: { in: ['company-1'] } } } },
        ],
      },
      select: { id: true, role: true },
    });
    expect(activity.notify).toHaveBeenCalledTimes(2);
    expect(activity.notify).toHaveBeenCalledWith(
      'credit-all',
      'New financing application',
      'A customer submitted a financing application.',
      '/applications/app-1',
      { forceEmail: true },
    );
    expect(activity.notify).toHaveBeenCalledWith(
      'credit-assigned',
      'New financing application',
      'A customer submitted a financing application.',
      '/applications/app-1',
      { forceEmail: true },
    );
  });

  it('does not notify credit officers for a company they cannot see', async () => {
    const { service, activity } = buildService([]);

    await service.notifyOps(
      'other-company',
      [UserRole.credit_officer],
      'New financing application',
      'A customer submitted a financing application.',
      '/applications/app-2',
    );

    expect(activity.notify).not.toHaveBeenCalled();
  });

  it('notifies credit officers assigned to the holding parent of a dealership', async () => {
    const { service, prisma, activity } = buildService(
      [{ id: 'qauto-credit', role: UserRole.credit_officer }],
      { id: 'qauto-audi', parentCompanyId: 'qauto' },
    );

    await service.notifyOpsOnSubmit('qauto-audi', 'app-3');

    expect(prisma.user.findMany).toHaveBeenCalledWith({
      where: {
        isActive: true,
        OR: expect.arrayContaining([
          { role: UserRole.credit_officer, creditScope: 'all' },
          {
            role: UserRole.credit_officer,
            creditCompanies: { some: { companyId: { in: ['qauto-audi', 'qauto'] } } },
          },
        ]),
      },
      select: { id: true, role: true },
    });
    expect(activity.notify).toHaveBeenCalledWith(
      'qauto-credit',
      'New financing application',
      'A customer submitted a financing application.',
      '/applications/app-3',
      { forceEmail: true },
    );
  });

  it('notifies credit officers about an identity hold', async () => {
    const { service, prisma, activity } = buildService([
      { id: 'credit-1', role: UserRole.credit_officer },
      { id: 'admin-1', role: UserRole.admin },
    ]);

    await service.recordHold({
      applicationId: 'app-hold',
      companyId: 'company-1',
      actorUserId: 'system',
      decision: {
        reason: 'qid_identity_mismatch',
        conflicts: [
          {
            userId: 'other-user',
            source: 'user',
            nameMismatch: true,
            birthYearMismatch: false,
          },
        ],
      },
    });

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isActive: true,
          OR: expect.arrayContaining([
            { role: UserRole.credit_officer, creditScope: 'all' },
            { role: UserRole.credit_officer, creditCompanies: { some: { companyId: { in: ['company-1'] } } } },
            { role: { in: [UserRole.admin, UserRole.super_admin] } },
          ]),
        }),
      }),
    );
    expect(activity.notify).toHaveBeenCalledWith(
      'credit-1',
      'Identity hold on an application',
      'The Qatar ID on a new application is already on file under a different name or date of birth. Review and clear the hold.',
      '/applications/app-hold',
      { forceEmail: true },
    );
  });
});
