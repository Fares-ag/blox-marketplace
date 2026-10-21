import { EmailOutboxStatus } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MailService } from './mail.service';
import { sendPostmarkEmail } from './postmark-mail';

vi.mock('./postmark-mail', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./postmark-mail')>();
  return {
    ...actual,
    sendPostmarkEmail: vi.fn().mockResolvedValue(undefined),
  };
});

const outboxRow = {
  id: 'ob-1',
  to: 'credit@qauto.local',
  subject: 'New financing application',
  template: 'notification',
  payload: {},
  status: EmailOutboxStatus.pending,
  attempts: 0,
  lastError: null,
  sentAt: null,
  nextAttemptAt: null,
  createdAt: new Date(),
};

function config(values: Record<string, string | undefined>) {
  return { get: (key: string) => values[key] };
}

function prisma(row = outboxRow) {
  return {
    emailOutbox: {
      create: vi.fn().mockResolvedValue(row),
      update: vi.fn().mockResolvedValue({ ...row, status: EmailOutboxStatus.sent }),
      updateMany: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
  };
}

describe('MailService.sendNotificationEmail', () => {
  beforeEach(() => {
    vi.mocked(sendPostmarkEmail).mockReset().mockResolvedValue(undefined);
  });

  it('queues and delivers the credit-queue notice through Postmark', async () => {
    const db = prisma();
    const mail = new MailService(
      config({
        POSTMARK_SERVER_TOKEN: 'pm-test-token',
        SMTP_FROM: 'Blox <no-reply@blox.market>',
      }) as never,
      db as never,
    );

    expect(mail.enabled).toBe(true);

    await mail.sendNotificationEmail({
      to: 'credit@qauto.local',
      name: 'Credit Reviewer',
      title: 'New financing application',
      body: 'A customer submitted a financing application.',
      url: 'https://credit.blox.market/applications/app-1',
      category: 'application',
    });

    expect(db.emailOutbox.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        to: 'credit@qauto.local',
        subject: 'New financing application',
        template: 'notification',
        status: EmailOutboxStatus.pending,
      }),
    });
    const created = db.emailOutbox.create.mock.calls[0]![0].data;
    expect(created.payload.text).toContain('A customer submitted a financing application.');
    expect(created.payload.text).toContain('https://credit.blox.market/applications/app-1');
    expect(created.payload.html).toContain('href="https://credit.blox.market/applications/app-1"');

    expect(sendPostmarkEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        token: 'pm-test-token',
        from: 'Blox <no-reply@blox.market>',
        to: 'credit@qauto.local',
        subject: 'New financing application',
      }),
    );
    expect(db.emailOutbox.update).toHaveBeenCalledWith({
      where: { id: 'ob-1' },
      data: expect.objectContaining({
        status: EmailOutboxStatus.sent,
        lastError: null,
      }),
    });
  });

  it('does not call Postmark when mail is not configured', async () => {
    const db = prisma();
    const mail = new MailService(config({}) as never, db as never);

    expect(mail.enabled).toBe(false);

    await mail.sendNotificationEmail({
      to: 'credit@qauto.local',
      name: 'Credit Reviewer',
      title: 'New financing application',
      body: 'A customer submitted a financing application.',
      url: 'https://credit.blox.market/applications/app-1',
      category: 'application',
    });

    expect(db.emailOutbox.create).toHaveBeenCalled();
    expect(sendPostmarkEmail).not.toHaveBeenCalled();
    expect(db.emailOutbox.update).not.toHaveBeenCalled();
  });

  it('records a delivery failure on the outbox and does not throw for notification mail', async () => {
    vi.mocked(sendPostmarkEmail).mockRejectedValueOnce(new Error('postmark_422'));
    const db = prisma();
    const mail = new MailService(
      config({ POSTMARK_SERVER_TOKEN: 'pm-test-token' }) as never,
      db as never,
    );

    await expect(
      mail.sendNotificationEmail({
        to: 'credit@qauto.local',
        name: 'Credit Reviewer',
        title: 'New financing application',
        body: 'A customer submitted a financing application.',
        url: 'https://credit.blox.market/applications/app-1',
        category: 'application',
      }),
    ).resolves.toBeUndefined();

    expect(db.emailOutbox.update).toHaveBeenCalledWith({
      where: { id: 'ob-1' },
      data: expect.objectContaining({
        attempts: 1,
        lastError: 'postmark_422',
        status: EmailOutboxStatus.pending,
      }),
    });
  });
});
