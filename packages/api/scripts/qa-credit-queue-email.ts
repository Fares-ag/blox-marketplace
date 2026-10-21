/**
 * Live SMTP check for the credit-queue notice.
 * Run: npx tsx scripts/qa-credit-queue-email.ts
 *
 * Starts a local SMTP sink, sends through MailService, and asserts the
 * delivered message. Does not load production Postmark/SMTP secrets.
 */
import net from 'node:net';
import { EmailOutboxStatus } from '@prisma/client';
import { MailService } from '../src/mail/mail.service';

const TO = 'credit@qauto.local';
const NAME = 'QAuto Credit';
const TITLE = 'New financing application';
const BODY = 'A customer submitted a financing application.';
const URL = 'https://credit.blox.market/applications/app-live-check';
const SMTP_PORT = Number(process.env.QA_SMTP_PORT ?? 1125);

type Captured = { raw: string; resolve: (raw: string) => void };
const pending: Captured = {
  raw: '',
  resolve: () => undefined,
};

function smtpReply(socket: net.Socket, code: number, message: string) {
  socket.write(`${code} ${message}\r\n`);
}

async function startSink(port: number): Promise<net.Server> {
  return new Promise((resolve, startErr) => {
    const server = net.createServer((socket) => {
      let buffer = '';
      let inData = false;
      let message = '';
      smtpReply(socket, 220, 'blox-qa ESMTP');
      socket.on('data', (chunk) => {
        buffer += chunk.toString('utf8');
        if (inData) {
          const end = buffer.indexOf('\r\n.\r\n');
          if (end === -1) return;
          message += buffer.slice(0, end);
          buffer = buffer.slice(end + 5);
          inData = false;
          pending.raw = message;
          pending.resolve(message);
          smtpReply(socket, 250, 'queued');
          return;
        }
        while (buffer.includes('\r\n')) {
          const idx = buffer.indexOf('\r\n');
          const line = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          const verb = line.split(' ')[0]?.toUpperCase() ?? '';
          if (verb === 'EHLO' || verb === 'HELO') {
            socket.write('250-blox-qa\r\n250 PIPELINING\r\n');
          } else if (verb === 'MAIL' || verb === 'RCPT' || verb === 'RSET' || verb === 'NOOP') {
            smtpReply(socket, 250, 'ok');
          } else if (verb === 'DATA') {
            inData = true;
            smtpReply(socket, 354, 'end with .');
            message = buffer;
            buffer = '';
            break;
          } else if (verb === 'QUIT') {
            smtpReply(socket, 221, 'bye');
            socket.end();
          } else {
            smtpReply(socket, 250, 'ok');
          }
        }
      });
    });
    server.once('error', startErr);
    server.listen(port, '127.0.0.1', () => resolve(server));
  });
}

function mockPrisma() {
  return {
    emailOutbox: {
      create: async ({ data }: { data: Record<string, unknown> }) => ({
        id: 'qa-outbox-1',
        to: data.to,
        subject: data.subject,
        template: data.template,
        payload: data.payload,
        status: EmailOutboxStatus.pending,
        attempts: 0,
        lastError: null,
        sentAt: null,
        nextAttemptAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
      update: async () => ({}),
    },
  };
}

function header(raw: string, name: string): string | null {
  const match = raw.match(new RegExp(`^${name}:\\s*(.+)$`, 'im'));
  return match?.[1]?.trim() ?? null;
}

async function main() {
  const captured = new Promise<string>((resolve) => {
    pending.resolve = resolve;
  });
  const server = await startSink(SMTP_PORT);

  const mail = new MailService(
    {
      get: (key: string) =>
        ({
          SMTP_HOST: '127.0.0.1',
          SMTP_PORT: String(SMTP_PORT),
          SMTP_SECURE: 'false',
          SMTP_FROM: 'Blox <no-reply@blox.market>',
        })[key],
    } as never,
    mockPrisma() as never,
  );

  if (!mail.enabled) {
    throw new Error('MailService did not enable SMTP for the local sink');
  }

  await mail.sendNotificationEmail({
    to: TO,
    name: NAME,
    title: TITLE,
    body: BODY,
    url: URL,
    category: 'application',
  });

  const raw = await Promise.race([
    captured,
    new Promise<string>((_, reject) =>
      setTimeout(() => reject(new Error('SMTP sink did not receive a message')), 10_000),
    ),
  ]);

  server.close();

  const subject = header(raw, 'Subject');
  const to = header(raw, 'To');
  const from = header(raw, 'From');
  const decoded = raw.replace(/=\r?\n/g, '').replace(/=3D/g, '=');

  const checks = [
    ['from', from?.includes('no-reply@blox.market')],
    ['to', to?.includes(TO)],
    ['subject', subject === TITLE || decoded.includes(TITLE)],
    ['greeting', decoded.includes(`Hi ${NAME}`)],
    ['body', decoded.includes(BODY)],
    ['link', decoded.includes(URL)],
  ] as const;

  console.log('Credit-queue live SMTP check');
  console.log(`From: ${from}`);
  console.log(`To:   ${to}`);
  console.log(`Subj: ${subject}`);
  console.log('');
  for (const [name, ok] of checks) {
    console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${name}`);
  }
  console.log('');
  console.log('--- delivered text ---');
  console.log(decoded.split('\r\n\r\n').slice(1).join('\r\n\r\n').slice(0, 1200));

  if (checks.some(([, ok]) => !ok)) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
