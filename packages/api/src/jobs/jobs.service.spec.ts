import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { HTTP_REQUEST_TIMEOUT_CODE } from '../common/fetch-with-timeout';
import { JobsService } from './jobs.service';

type BuildDeps = {
  syncApplicationToZoho?: ReturnType<typeof vi.fn>;
  prisma?: Record<string, unknown>;
  router?: { dispatch: ReturnType<typeof vi.fn> };
  activity?: { log: ReturnType<typeof vi.fn>; notify: ReturnType<typeof vi.fn> };
};

function buildService(deps: BuildDeps = {}) {
  const health = { recordSuccess: vi.fn(), checkStale: vi.fn(), registerJob: vi.fn() };
  const router = deps.router ?? {
    dispatch: vi.fn().mockResolvedValue({
      notification_id: 'n1',
      channels: {
        in_app: { outcome: 'sent' },
        email: { outcome: 'sent' },
        sms: { outcome: 'skipped', reason: 'preference_off' },
        whatsapp: { outcome: 'skipped', reason: 'preference_off' },
        push: { outcome: 'logged', reason: 'log' },
      },
    }),
  };
  const activity = deps.activity ?? { log: vi.fn().mockResolvedValue(undefined), notify: vi.fn() };
  const mail = { enabled: true, send: vi.fn(), processOutbox: vi.fn() };
  return {
    service: new JobsService(
      { get: () => undefined } as never,
      { addCronJob: vi.fn() } as never,
      health as never,
      {} as never,
      {} as never,
      mail as never,
      { syncApplicationToZoho: deps.syncApplicationToZoho ?? vi.fn() } as never,
      activity as never,
      (deps.prisma ?? {}) as never,
      { marketplacePath: (path: string) => `https://blox.market${path}` } as never,
      router as never,
    ),
    health,
    router,
    activity,
    mail,
  };
}

describe('JobsService.runZohoRetry', () => {
  it('continues the batch when one item times out and the next succeeds', async () => {
    const syncApplicationToZoho = vi
      .fn()
      .mockResolvedValueOnce({ zohoLeadId: null, error: HTTP_REQUEST_TIMEOUT_CODE })
      .mockResolvedValueOnce({ zohoLeadId: 'lead-2' });
    const findMany = vi.fn().mockResolvedValue([{ id: 'app-1' }, { id: 'app-2' }]);

    const { service, health } = buildService({ syncApplicationToZoho, prisma: { application: { findMany } } });
    const result = await service.runZohoRetry();

    expect(result).toEqual({ attempted: 2, succeeded: 1, failed: 1 });
    expect(syncApplicationToZoho).toHaveBeenCalledTimes(2);
    expect(health.recordSuccess).toHaveBeenCalledWith('zoho-retry');
  });

  it('continues the batch when one item throws unexpectedly', async () => {
    const syncApplicationToZoho = vi
      .fn()
      .mockRejectedValueOnce(new Error('unexpected'))
      .mockResolvedValueOnce({ zohoLeadId: 'lead-2' });
    const findMany = vi.fn().mockResolvedValue([{ id: 'app-1' }, { id: 'app-2' }]);

    const { service } = buildService({ syncApplicationToZoho, prisma: { application: { findMany } } });
    const result = await service.runZohoRetry();

    expect(result).toEqual({ attempted: 2, succeeded: 1, failed: 1 });
    expect(syncApplicationToZoho).toHaveBeenCalledTimes(2);
  });
});

describe('JobsService.runPaymentReminders', () => {
  const inDays = (days: number) => {
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    d.setUTCDate(d.getUTCDate() + days);
    return d;
  };

  const schedule = (over: Record<string, unknown>) => ({
    id: 's1',
    status: 'pending',
    dueDate: inDays(2),
    remainingAmount: 1200,
    application: {
      id: 'a1',
      customerUserId: 'u1',
      customerEmail: 'sara@example.com',
      product: { make: 'Chery', model: 'Tiggo 7', modelYear: 2026 },
    },
    ...over,
  });

  it('routes reminders through the notification router with the payments category', async () => {
    const findMany = vi.fn().mockResolvedValue([
      schedule({}),
      schedule({ id: 's2', status: 'overdue', dueDate: inDays(-5) }),
    ]);
    const create = vi.fn().mockResolvedValue({});
    const { service, router, activity, mail, health } = buildService({
      prisma: { paymentSchedule: { findMany }, paymentReminderSent: { create } },
    });

    const result = await service.runPaymentReminders();

    expect(result).toEqual({ due_soon: 1, overdue: 1, skipped: 0 });
    expect(router.dispatch).toHaveBeenCalledTimes(2);
    expect(router.dispatch.mock.calls[0]![0]).toMatchObject({
      userId: 'u1',
      category: 'payments',
      title: { en: 'Installment due soon', ar: expect.stringContaining('قسط مستحق قريبًا') },
      body: {
        en: 'Your Chery Tiggo 7 2026 installment of QAR 1200.00 is due on 2026-09-09.'.replace('2026-09-09', inDays(2).toISOString().slice(0, 10)),
        ar: expect.stringContaining('ريال قطري'),
      },
      linkPath: '/app/applications/a1',
      data: { schedule_id: 's1', application_id: 'a1', kind: 'due_soon', amount: '1200.00' },
    });
    expect(router.dispatch.mock.calls[1]![0]).toMatchObject({
      category: 'payments',
      title: { en: 'Installment overdue', ar: expect.stringContaining('قسط متأخر') },
    });
    // The router owns email now — the cron no longer mails directly.
    expect(mail.send).not.toHaveBeenCalled();
    expect(activity.notify).not.toHaveBeenCalled();
    expect(activity.log.mock.calls[0]![0]).toMatchObject({
      entityType: 'payment_schedule',
      entityId: 's1',
      metadata: { kind: 'due_soon', channels: { in_app: 'sent', email: 'sent', sms: 'skipped:preference_off' } },
    });
    expect(health.recordSuccess).toHaveBeenCalledWith('payment-reminders');
  });

  it('skips schedules already reminded today (unique-constraint dedup) before dispatching', async () => {
    const findMany = vi.fn().mockResolvedValue([schedule({})]);
    const duplicate = new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: 'test' });
    const create = vi.fn().mockRejectedValue(duplicate);
    const { service, router } = buildService({
      prisma: { paymentSchedule: { findMany }, paymentReminderSent: { create } },
    });

    const result = await service.runPaymentReminders();

    expect(result).toEqual({ due_soon: 0, overdue: 0, skipped: 1 });
    expect(router.dispatch).not.toHaveBeenCalled();
  });
});
