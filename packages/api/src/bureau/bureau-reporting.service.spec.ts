import { describe, expect, it, vi } from 'vitest';
import { BureauReportingService } from './bureau-reporting.service';

function buildService(over: { apps?: unknown[]; includeAll?: boolean } = {}) {
  const created: unknown[] = [];
  const prisma = {
    application: {
      findMany: vi.fn().mockResolvedValue(over.apps ?? []),
    },
    bureauSubmission: {
      create: vi.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
        const row = { id: 'sub-1', status: data.status, ...data };
        created.push(row);
        return row;
      }),
      update: vi.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
        id: 'sub-1',
        status: data.status,
      })),
    },
    user: { findMany: vi.fn().mockResolvedValue([]) },
  };
  const identity = { readQid: vi.fn().mockReturnValue('28912345678') };
  const activity = { log: vi.fn(), notify: vi.fn() };
  const appConfig = {
    bureauCompanyIds: ['co-1'],
    bureauIncludeAllCompanies: over.includeAll ?? false,
    bureauIncludeCorporate: false,
    bureauTransport: 'local',
    bureauSftpEnabled: false,
    bureauReportingEnabled: true,
    bureauCronAnyDay: true,
    bureauAutoSend: false,
  };
  return {
    service: new BureauReportingService(prisma as never, appConfig as never, identity as never, activity as never),
    prisma,
    activity,
    created,
  };
}

function liveApp(over: Record<string, unknown> = {}) {
  return {
    id: 'app-1',
    referenceSeq: 7,
    status: 'active',
    activatedAt: new Date('2026-03-01'),
    completedAt: null,
    kycStatus: 'verified',
    identityHoldReason: null,
    identityHoldClearedAt: null,
    companyId: 'co-1',
    defaultClassification: 'performing',
    customerSnapshot: { full_name: 'Sara Al Thani', phone: '97450000000', qid: '28912345678', applicantType: 'individual' },
    pricingSnapshot: { financed_amount: 80000, monthly: 2000 },
    customer: { qid: '28912345678', qidEnc: null },
    financePartner: { crmAdapter: 'none' },
    ownershipRegister: { bloxUnits: 40, customerUnits: 60, totalUnits: 100, unitNominalValue: 1000 },
    paymentSchedules: [],
    rentPoolEntries: [],
    ...over,
  };
}

describe('BureauReportingService.run', () => {
  it('stores a dry-run file awaiting Finance approval', async () => {
    const { service, prisma, activity } = buildService({ apps: [liveApp()] });
    const result = await service.run({ triggeredBy: 'manual', actorUserId: 'finance-1' });

    expect(result.status).toBe('generated');
    expect(result.record_count).toBe(1);
    expect(result.excluded_count).toBe(0);
    expect(prisma.bureauSubmission.create).toHaveBeenCalledTimes(1);
    expect(prisma.bureauSubmission.update).not.toHaveBeenCalled();
    const created = prisma.bureauSubmission.create.mock.calls[0]![0].data;
    expect(created.unsigned).toBe(true);
    expect(created.transport).toBe('local');
    expect(created.fileBody).toContain('HDR|HYPOTHESIS-UNSIGNED');
    expect(created.fileBody).toContain('BLOX-0007');
    expect(created.fileBody).not.toMatch(/interest/i);
    expect(activity.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'bureau_generated' }));
  });

  it('sends immediately when BUREAU_AUTO_SEND is on', async () => {
    const { service, prisma, activity } = buildService({ apps: [liveApp()] });
    (service as unknown as { appConfig: { bureauAutoSend: boolean } }).appConfig.bureauAutoSend = true;
    const result = await service.run({ triggeredBy: 'manual', actorUserId: 'finance-1' });
    expect(result.status).toBe('sent');
    expect(prisma.bureauSubmission.update).toHaveBeenCalled();
    expect(activity.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'bureau_sent' }));
  });

  it('keeps a draft out of the DLT even if it was loaded as a candidate', async () => {
    const { service } = buildService({
      apps: [liveApp({ id: 'draft-1', status: 'draft', referenceSeq: 8 })],
    });
    const result = await service.run({ triggeredBy: 'manual', actorUserId: 'finance-1' });
    expect(result.record_count).toBe(0);
    expect(result.excluded_count).toBe(1);
  });

  it('skips the cron when reporting is disabled', async () => {
    const { service } = buildService();
    (service as unknown as { appConfig: { bureauReportingEnabled: boolean } }).appConfig.bureauReportingEnabled = false;
    const result = await service.runMonthEndJob();
    expect(result).toEqual({ skipped: 'disabled' });
  });
});
