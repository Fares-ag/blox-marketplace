import { ComplianceCheckStatus, UserRole } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { ComplianceService } from './compliance.service';

function buildService(
  create: ReturnType<typeof vi.fn>,
  findFirst: ReturnType<typeof vi.fn> = vi.fn().mockResolvedValue(null),
) {
  const log = vi.fn().mockResolvedValue(undefined);
  const prisma = {
    application: {
      findUnique: vi.fn().mockResolvedValue({
        id: 'app-1',
        companyId: 'co-1',
        customerSnapshot: { qid: '29063400001', full_name: 'Sara Ali' },
      }),
    },
    complianceCheck: { create, findFirst },
  };
  const provider = {
    name: 'test',
    verifyIdentity: vi.fn().mockResolvedValue({ status: ComplianceCheckStatus.pass, raw: {} }),
    screenSanctions: vi.fn().mockResolvedValue({ status: ComplianceCheckStatus.pass, raw: {} }),
  };
  const service = new ComplianceService(prisma as never, { log } as never, provider as never);
  return { service, log, provider };
}

const user = { id: 'credit-1', role: UserRole.credit_officer, creditScope: 'all' } as never;

const row = {
  id: 'chk-1',
  applicationId: 'app-1',
  provider: 'test',
  identityStatus: ComplianceCheckStatus.pass,
  sanctionsStatus: ComplianceCheckStatus.pass,
  overallStatus: ComplianceCheckStatus.pass,
  identityResult: {},
  sanctionsResult: {},
  verifiedByUserId: 'credit-1',
  qidScreened: '29063400001',
  applicantName: 'Sara Ali',
  createdAt: new Date('2026-11-03T00:00:00.000Z'),
};

describe('ComplianceService.runCheck', () => {
  it('shares one in-flight check across repeated clicks', async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const create = vi.fn().mockImplementation(async () => {
      await gate;
      return row;
    });
    const { service } = buildService(create);
    const first = service.runCheck(user, 'app-1');
    const second = service.runCheck(user, 'app-1');
    release();
    const [a, b] = await Promise.all([first, second]);
    expect(create).toHaveBeenCalledTimes(1);
    expect(a.id).toBe(b.id);
  });

  it('returns the latest matching pass without writing another row', async () => {
    const create = vi.fn().mockResolvedValue(row);
    const findFirst = vi.fn().mockResolvedValueOnce(null).mockResolvedValue(row);
    const { service, log } = buildService(create, findFirst);
    await service.runCheck(user, 'app-1');
    const again = await service.runCheck(user, 'app-1');
    expect(create).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledTimes(1);
    expect(again.id).toBe(row.id);
  });

  it('runs again when the latest pass is for a different person', async () => {
    const create = vi.fn().mockResolvedValue({ ...row, id: 'chk-2' });
    const findFirst = vi.fn().mockResolvedValue({ ...row, applicantName: 'Other Name' });
    const { service, provider } = buildService(create, findFirst);
    await service.runCheck(user, 'app-1');
    expect(create).toHaveBeenCalledTimes(1);
    expect(provider.verifyIdentity).toHaveBeenCalledTimes(1);
  });

  it('runs again when the latest check failed', async () => {
    const create = vi.fn().mockResolvedValue({ ...row, id: 'chk-3' });
    const findFirst = vi.fn().mockResolvedValue({ ...row, overallStatus: ComplianceCheckStatus.fail });
    const { service } = buildService(create, findFirst);
    await service.runCheck(user, 'app-1');
    expect(create).toHaveBeenCalledTimes(1);
  });
});
