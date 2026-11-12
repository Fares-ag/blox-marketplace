import { UserRole } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { ApplicationIntakeService, creditQueueNoticeBody } from './application-intake.service';

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
    application: {
      findUnique: vi.fn().mockResolvedValue({
        customerEmail: 'sara@example.com',
        customerSnapshot: { full_name: 'Sara Ali' },
        referenceSeq: 17,
        company: { name: company.id === 'qauto-audi' ? 'QAuto Audi' : 'Chery Elite Motors' },
        customer: { name: 'Sara Ali' },
      }),
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

describe('creditQueueNoticeBody', () => {
  it('never embeds a company UUID when the dealer name is missing', () => {
    const companyId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    const body = creditQueueNoticeBody(
      { customerSnapshot: { full_name: 'Sara Ali' }, company: { name: null } },
      companyId,
    );
    expect(body).toBe('Sara Ali at a dealer submitted a financing application.');
    expect(body).not.toContain(companyId);
  });
});

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
          {
            role: UserRole.dealer_agent,
            companyId: 'qauto-audi',
            OR: [{ dealerScope: 'all' }],
          },
        ]),
      },
      select: { id: true, role: true },
    });
    expect(activity.notify).toHaveBeenCalledWith(
      'qauto-credit',
      'New financing application — Sara Ali at QAuto Audi',
      'Sara Ali at QAuto Audi submitted a financing application (BLOX-0017).',
      '/applications/app-3',
      { forceEmail: true },
    );
  });

  it('notifies the assigned sales executive and sales managers, not every agent at the dealership', async () => {
    const { service, prisma } = buildService([]);
    prisma.application.findUnique.mockResolvedValue({
      agentUserId: 'sofian',
      customerEmail: 'sara@example.com',
      customerSnapshot: { full_name: 'Sara Ali' },
      referenceSeq: 17,
      company: { name: 'Chery Elite Motors' },
      customer: { name: 'Sara Ali' },
    });

    await service.notifyOpsOnSubmit('company-1', 'app-sofian');

    const where = prisma.user.findMany.mock.calls[0]?.[0]?.where as {
      OR: Array<{ role?: string; companyId?: string; OR?: unknown }>;
    };
    const dealerClause = where.OR.find((clause) => clause.role === UserRole.dealer_agent);
    expect(dealerClause).toEqual({
      role: UserRole.dealer_agent,
      companyId: 'company-1',
      OR: [{ dealerScope: 'all' }, { id: 'sofian' }],
    });
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
            {
              role: UserRole.dealer_agent,
              companyId: 'company-1',
              OR: [{ dealerScope: 'all' }],
            },
          ]),
        }),
      }),
    );
    expect(activity.notify).toHaveBeenCalledWith(
      'credit-1',
      'Identity hold — Sara Ali at Chery Elite Motors',
      'Sara Ali at Chery Elite Motors: the Qatar ID on this application is already on file under a different name or date of birth. Review and clear the hold.',
      '/applications/app-hold',
      { forceEmail: true },
    );
  });

  it('emails the assigned agent and sales managers when credit sends a deal back', async () => {
    const { service, prisma, activity } = buildService([
      { id: 'sofian', role: UserRole.dealer_agent },
      { id: 'manager', role: UserRole.dealer_agent },
    ]);
    prisma.application.findUnique.mockResolvedValue({
      companyId: 'company-1',
      agentUserId: 'sofian',
      customerEmail: 'sara@example.com',
      customerSnapshot: { full_name: 'Sara Ali' },
      referenceSeq: 17,
      company: { name: 'Chery Elite Motors' },
      customer: { name: 'Sara Ali' },
    });

    await service.notifyDealersOnStatus('app-sofian', 'resubmission_required', {
      reason: 'Upload a recent salary certificate',
    });

    const where = prisma.user.findMany.mock.calls[0]?.[0]?.where as {
      OR: Array<{ role?: string; companyId?: string; OR?: unknown }>;
    };
    expect(where.OR).toEqual([
      {
        role: UserRole.dealer_agent,
        companyId: 'company-1',
        OR: [{ dealerScope: 'all' }, { id: 'sofian' }],
      },
    ]);
    expect(activity.notify).toHaveBeenCalledTimes(2);
    expect(activity.notify).toHaveBeenCalledWith(
      'sofian',
      'Resubmission needed — BLOX-0017',
      'Sara Ali at Chery Elite Motors (BLOX-0017) was sent back for updates. Open the application to see what to correct. Upload a recent salary certificate',
      '/applications/app-sofian',
      { forceEmail: true },
    );
  });

  it('does not email dealers for partner_processing (they created the walk-in)', async () => {
    const { service, activity } = buildService([{ id: 'sofian', role: UserRole.dealer_agent }]);
    await service.notifyDealersOnStatus('app-1', 'partner_processing');
    expect(activity.notify).not.toHaveBeenCalled();
  });
});
