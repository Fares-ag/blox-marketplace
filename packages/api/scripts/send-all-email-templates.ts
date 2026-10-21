/**
 * Send one example of every Blox transactional / notification email (for QA).
 *
 *   npx tsx scripts/send-all-email-templates.ts
 *   QA_EMAIL_TO=you@example.com npx tsx scripts/send-all-email-templates.ts
 *
 * Uses POSTMARK_SERVER_TOKEN or SMTP_* from env (loads secrets/api.env when present).
 * Requires DATABASE_URL for the email outbox.
 */
import { join } from 'node:path';
import { ConfigService } from '@nestjs/config';
import { EmailOutboxStatus, PrismaClient } from '@prisma/client';
import { applyEnvFiles } from '../src/scripts/qid-encryption-rollout';
import { MailService } from '../src/mail/mail.service';

function mockOutboxPrisma() {
  const row = {
    id: 'qa-outbox',
    attempts: 0,
    status: EmailOutboxStatus.pending,
    lastError: null,
    sentAt: null,
    nextAttemptAt: null,
  };
  return {
    emailOutbox: {
      create: async ({ data }: { data: Record<string, unknown> }) => ({ ...row, ...data, id: `qa-${Date.now()}` }),
      update: async () => ({}),
      updateMany: async () => ({ count: 0 }),
      findMany: async () => [],
      findUnique: async () => null,
    },
  };
}

const TO = (process.env.QA_EMAIL_TO ?? 'faroos4848@gmail.com').trim().toLowerCase();
const NAME = 'Faroos (template test)';
const BASE = (process.env.MARKETPLACE_URL ?? 'https://blox.market').replace(/\/$/, '');
const CREDIT = (process.env.CREDIT_URL ?? 'https://credit.blox.market').replace(/\/$/, '');
const DEALER = (process.env.DEALER_URL ?? 'https://dealer.blox.market').replace(/\/$/, '');

type Step = { label: string; run: (mail: MailService) => Promise<void> };

const steps: Step[] = [
  {
    label: 'email_verification',
    run: (m) => m.sendVerificationEmail(TO, `${BASE}/auth/verify-email?token=test-template`),
  },
  {
    label: 'password_reset',
    run: (m) => m.sendPasswordResetEmail(TO, `${BASE}/reset-password?token=test-template`),
  },
  {
    label: 'walk_in_invite',
    run: (m) => m.sendWalkInInviteEmail(TO, `${BASE}/walk-in/set-password?token=test-template`, 'QAuto Motors (test)'),
  },
  {
    label: 'staff_account_created',
    run: (m) => m.sendStaffAccountCreatedEmail(TO, NAME, `${CREDIT}/login`),
  },
  {
    label: 'transactional — dealer agent welcome',
    run: (m) =>
      m.sendDealerAgentWelcomeEmail({
        to: TO,
        name: NAME,
        loginUrl: `${DEALER}/login`,
        temporaryPassword: 'TestTemp-ChangeMe!',
        dealerName: 'QAuto Motors (test)',
      }),
  },
  {
    label: 'transactional — admin password reset',
    run: (m) =>
      m.sendAdminPasswordResetEmail({
        to: TO,
        name: NAME,
        loginUrl: `${CREDIT}/login`,
        temporaryPassword: 'TestTemp-ChangeMe!',
      }),
  },
  {
    label: 'transactional — dealer quote',
    run: (m) =>
      m.sendDealerQuoteEmail({
        to: TO,
        url: `${BASE}/quotes/test-template`,
        dealerName: 'QAuto Motors (test)',
        vehicleLabel: 'Chery Tiggo 7 2026',
        negotiatedPrice: 89_000,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      }),
  },
  {
    label: 'assisted_session (en)',
    run: (m) =>
      m.sendAssistedSessionEmail({
        to: TO,
        url: `${BASE}/assist/test-template`,
        dealerName: 'QAuto Motors (test)',
        agentName: 'Omar',
        expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
        locale: 'en',
      }),
  },
  {
    label: 'assisted_session (ar)',
    run: (m) =>
      m.sendAssistedSessionEmail({
        to: TO,
        url: `${BASE}/assist/test-template`,
        dealerName: 'QAuto Motors (test)',
        agentName: 'Omar',
        expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
        locale: 'ar',
      }),
  },
  {
    label: 'document_expiry (en)',
    run: (m) =>
      m.sendDocumentExpiryEmail({
        to: TO,
        name: NAME,
        documentCategory: 'qid_front',
        expiresAt: new Date('2026-10-01T00:00:00.000Z'),
        daysToExpiry: 7,
        url: `${BASE}/app/profile`,
        locale: 'en',
      }),
  },
  {
    label: 'document_expiry (ar)',
    run: (m) =>
      m.sendDocumentExpiryEmail({
        to: TO,
        name: NAME,
        documentCategory: 'qid_front',
        expiresAt: new Date('2026-10-01T00:00:00.000Z'),
        daysToExpiry: 7,
        url: `${BASE}/app/profile`,
        locale: 'ar',
      }),
  },
  {
    label: 'takaful_renewal (en)',
    run: (m) =>
      m.sendTakafulRenewalEmail({
        to: TO,
        name: NAME,
        vehicleLabel: 'Chery Tiggo 7 2026',
        provider: 'QIC Takaful',
        expiresAt: new Date('2026-10-01T00:00:00.000Z'),
        daysToExpiry: 14,
        url: `${BASE}/app/applications/test-template`,
        locale: 'en',
      }),
  },
  {
    label: 'takaful_renewal (ar)',
    run: (m) =>
      m.sendTakafulRenewalEmail({
        to: TO,
        name: NAME,
        vehicleLabel: 'Chery Tiggo 7 2026',
        provider: 'QIC Takaful',
        expiresAt: new Date('2026-10-01T00:00:00.000Z'),
        daysToExpiry: 14,
        url: `${BASE}/app/applications/test-template`,
        locale: 'ar',
      }),
  },
  {
    label: 'notification — credit queue',
    run: (m) =>
      m.sendNotificationEmail({
        to: TO,
        name: NAME,
        title: 'New financing application',
        body: 'A customer submitted a financing application. (Template test — not a real application.)',
        url: `${CREDIT}/applications/test-template`,
        category: 'application',
        locale: 'en',
      }),
  },
  {
    label: 'notification — application approved (sample)',
    run: (m) =>
      m.sendNotificationEmail({
        to: TO,
        name: NAME,
        title: 'Application approved',
        body: 'Your contract is ready to sign. (Template test.)',
        url: `${BASE}/app/applications/test-template`,
        category: 'application',
        locale: 'en',
      }),
  },
];

async function main() {
  const apiRoot = join(__dirname, '..');
  const loaded = applyEnvFiles([
    join(apiRoot, '.env'),
    join(apiRoot, '.env.local'),
    join(apiRoot, '../../.env'),
    join(apiRoot, '../../secrets/api.env'),
  ]);
  console.log('Env files loaded:', loaded.length ? loaded.join(', ') : '(none — using process env only)');
  console.log('Recipient:', TO);
  console.log('');

  const config = new ConfigService(process.env);
  let prisma: PrismaClient | null = new PrismaClient();
  let useMockOutbox = process.env.QA_MAIL_SKIP_DB === '1';
  if (!useMockOutbox) {
    try {
      await prisma.$connect();
      await prisma.$queryRaw`SELECT 1`;
      console.log('Database: connected (outbox rows will be written).');
    } catch {
      useMockOutbox = true;
      await prisma.$disconnect().catch(() => undefined);
      prisma = null;
      console.log('Database: unavailable — sending with in-memory outbox mock (QA_MAIL_SKIP_DB behaviour).');
    }
  } else {
    await prisma.$disconnect().catch(() => undefined);
    prisma = null;
    console.log('Database: skipped (QA_MAIL_SKIP_DB=1).');
  }

  const mail = new MailService(config, (useMockOutbox ? mockOutboxPrisma() : prisma) as never);

  if (!mail.enabled) {
    console.error(
      'Mail is not configured. Add POSTMARK_SERVER_TOKEN (recommended) or SMTP_HOST + SMTP_FROM to secrets/api.env, then re-run:\n' +
        '  npx tsx scripts/send-all-email-templates.ts',
    );
    if (prisma) await prisma.$disconnect();
    process.exit(1);
  }

  console.log('Mail transport enabled.\n');

  let ok = 0;
  let failed = 0;
  for (const step of steps) {
    process.stdout.write(`Sending ${step.label}… `);
    try {
      await step.run(mail);
      console.log('OK');
      ok += 1;
      await sleep(400);
    } catch (err) {
      failed += 1;
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`FAILED — ${msg}`);
    }
  }

  if (prisma) await prisma.$disconnect();
  console.log('');
  console.log(`Done: ${ok} sent, ${failed} failed (${steps.length} total).`);
  if (failed > 0) process.exit(1);
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

main().catch(async (err) => {
  console.error(err);
  process.exit(1);
});
