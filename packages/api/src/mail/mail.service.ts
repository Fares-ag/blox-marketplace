import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailOutbox, EmailOutboxStatus, Prisma } from '@prisma/client';
import nodemailer, { type Transporter } from 'nodemailer';
import { PrismaService } from '../prisma/prisma.service';
import { resolvePostmarkServerToken, sendPostmarkEmail } from './postmark-mail';

export type MailTemplate =
  | 'password_reset'
  | 'email_verification'
  | 'walk_in_invite'
  | 'transactional';

export type MailInput = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  template: MailTemplate;
  payload?: Record<string, unknown>;
  /** When true, immediate delivery failure propagates to the caller. */
  authCritical?: boolean;
};

export class MailDeliveryError extends Error {
  constructor(
    message: string,
    public readonly outboxId: string,
  ) {
    super(message);
    this.name = 'MailDeliveryError';
  }
}

const AUTH_CRITICAL_TEMPLATES = new Set<MailTemplate>([
  'password_reset',
  'email_verification',
  'walk_in_invite',
]);

const MAX_OUTBOX_ATTEMPTS = 5;
const BACKOFF_MS = [60_000, 300_000, 900_000, 3_600_000] as const;

function backoffMs(attemptNumber: number): number {
  const idx = Math.max(0, Math.min(attemptNumber - 1, BACKOFF_MS.length - 1));
  return BACKOFF_MS[idx];
}

type OutboxPayload = {
  text?: string;
  html?: string;
  url?: string;
  dealerName?: string;
  [key: string]: unknown;
};

type MailTransport = 'postmark' | 'smtp' | 'none';

/**
 * Transactional mail with a durable outbox.
 *
 * Production (Railway): use Postmark HTTP API via POSTMARK_SERVER_TOKEN — SMTP
 * ports are often blocked on PaaS hosts.
 *
 * Local dev: omit POSTMARK_SERVER_TOKEN and SMTP_HOST for log-only mode.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transport: MailTransport;
  private transporter: Transporter | null = null;
  private readonly postmarkToken: string | null;
  private readonly from: string;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.from =
      this.config.get<string>('SMTP_FROM') ?? 'Blox <no-reply@blox.market>';
    this.postmarkToken = resolvePostmarkServerToken(config);

    if (this.postmarkToken) {
      this.transport = 'postmark';
      this.logger.log('Mail transport: Postmark HTTP API');
    } else {
      const host = this.config.get<string>('SMTP_HOST');
      if (host) {
        const port = Number(this.config.get<string>('SMTP_PORT') ?? 587);
        const secure = this.config.get<string>('SMTP_SECURE') === 'true';
        this.transporter = nodemailer.createTransport({
          host,
          port,
          secure,
          requireTLS: !secure && port !== 25,
          auth: this.config.get<string>('SMTP_USER')
            ? {
                user: this.config.get<string>('SMTP_USER'),
                pass: this.config.get<string>('SMTP_PASS'),
              }
            : undefined,
          connectionTimeout: 15_000,
          greetingTimeout: 15_000,
          socketTimeout: 30_000,
        });
        this.transport = 'smtp';
        this.logger.log(`Mail transport: SMTP (${host}:${port})`);
      } else {
        this.transport = 'none';
      }
    }
  }

  get enabled(): boolean {
    return this.transport !== 'none';
  }

  assertProductionReady(_requireEmailVerification?: boolean) {
    void _requireEmailVerification;
    if (process.env.NODE_ENV === 'production' && !this.enabled) {
      throw new Error(
        'Mail is not configured but this deployment sends transactional email ' +
          '(password reset, email verification, walk-in invites). ' +
          'Set POSTMARK_SERVER_TOKEN (recommended on Railway) or SMTP_HOST, SMTP_PORT, ' +
          'SMTP_USER, SMTP_PASS, and SMTP_FROM.',
      );
    }
  }

  async send(input: MailInput): Promise<void> {
    const authCritical = input.authCritical ?? AUTH_CRITICAL_TEMPLATES.has(input.template);
    const payload: OutboxPayload = {
      text: input.text,
      html: input.html,
      ...(input.payload ?? {}),
    };

    const row = await this.prisma.emailOutbox.create({
      data: {
        to: input.to,
        subject: input.subject,
        template: input.template,
        payload: payload as Prisma.InputJsonValue,
        status: EmailOutboxStatus.pending,
      },
    });

    try {
      await this.attemptDelivery(row);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'mail_send_failed';
      if (authCritical) {
        throw new MailDeliveryError(
          `Failed to send ${input.template} email to ${input.to}: ${message}`,
          row.id,
        );
      }
      this.logger.error(`Non-critical mail failed outbox=${row.id} to=${input.to}: ${message}`);
    }
  }

  /**
   * Re-queue a failed row for another delivery attempt (used by the outbox worker).
   */
  async markForRetry(id: string): Promise<void> {
    await this.prisma.emailOutbox.updateMany({
      where: {
        id,
        status: EmailOutboxStatus.failed,
        attempts: { lt: MAX_OUTBOX_ATTEMPTS },
      },
      data: {
        status: EmailOutboxStatus.pending,
        nextAttemptAt: new Date(),
      },
    });
  }

  /**
   * Retry pending/failed outbox rows whose backoff window has elapsed.
   * Called by the email-outbox background job (see JobsModule).
   */
  async processOutbox(limit = 20): Promise<{ processed: number; sent: number; failed: number }> {
    const now = new Date();
    const rows = await this.prisma.emailOutbox.findMany({
      where: {
        status: { in: [EmailOutboxStatus.pending, EmailOutboxStatus.failed] },
        attempts: { lt: MAX_OUTBOX_ATTEMPTS },
        OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
      },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });

    let sent = 0;
    let failed = 0;

    for (const row of rows) {
      let current = row;
      if (row.status === EmailOutboxStatus.failed) {
        await this.markForRetry(row.id);
        const refreshed = await this.prisma.emailOutbox.findUnique({ where: { id: row.id } });
        if (!refreshed || refreshed.status !== EmailOutboxStatus.pending) continue;
        current = refreshed;
      }

      try {
        await this.attemptDelivery(current);
        sent += 1;
      } catch (err) {
        failed += 1;
        const message = err instanceof Error ? err.message : 'mail_send_failed';
        this.logger.warn(`Outbox retry failed id=${row.id} to=${row.to}: ${message}`);
      }
    }

    return { processed: rows.length, sent, failed };
  }

  private async attemptDelivery(row: EmailOutbox): Promise<void> {
    try {
      await this.deliver(row);
      await this.prisma.emailOutbox.update({
        where: { id: row.id },
        data: {
          status: EmailOutboxStatus.sent,
          sentAt: new Date(),
          lastError: null,
          nextAttemptAt: null,
        },
      });
      this.logger.log(`Mail sent outbox=${row.id} to=${row.to} template=${row.template}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'mail_send_failed';
      const nextAttempts = row.attempts + 1;
      const exhausted = nextAttempts >= MAX_OUTBOX_ATTEMPTS;

      await this.prisma.emailOutbox.update({
        where: { id: row.id },
        data: {
          attempts: nextAttempts,
          lastError: message,
          status: exhausted ? EmailOutboxStatus.failed : EmailOutboxStatus.pending,
          nextAttemptAt: exhausted ? null : new Date(Date.now() + backoffMs(nextAttempts)),
        },
      });

      if (this.transport === 'none') {
        this.logger.warn(
          `Mail not configured — NOT sent. outbox=${row.id} to=${row.to} subject="${row.subject}"`,
        );
      } else {
        this.logger.error(`Mail send failed outbox=${row.id} to=${row.to}: ${message}`);
      }

      throw err instanceof Error ? err : new Error(message);
    }
  }

  private async deliver(row: EmailOutbox): Promise<void> {
    const payload = row.payload as OutboxPayload;
    const text = payload.text ?? '';

    if (this.postmarkToken) {
      await sendPostmarkEmail({
        token: this.postmarkToken,
        from: this.from,
        to: row.to,
        subject: row.subject,
        text,
        html: payload.html,
      });
      return;
    }

    if (this.transporter) {
      await this.transporter.sendMail({
        from: this.from,
        to: row.to,
        subject: row.subject,
        text,
        html: payload.html,
      });
      return;
    }

    throw new Error('Mail transport not configured');
  }

  async sendVerificationEmail(to: string, url: string): Promise<void> {
    // Queue-first: sign-up must not 502 when delivery is slow; outbox worker retries.
    await this.send({
      to,
      subject: 'Verify your Blox email address',
      text: `Welcome to Blox.\n\nVerify your email address to activate your account:\n${url}\n\nIf you did not create this account, ignore this email.`,
      template: 'email_verification',
      payload: { url },
      authCritical: false,
    });
  }

  async sendPasswordResetEmail(to: string, url: string): Promise<void> {
    await this.send({
      to,
      subject: 'Reset your Blox password',
      text: `We received a request to reset your Blox password.\n\nSet a new password here (link expires shortly):\n${url}\n\nIf you did not request this, ignore this email — your password is unchanged.`,
      template: 'password_reset',
      payload: { url },
      authCritical: true,
    });
  }

  async sendWalkInInviteEmail(to: string, url: string, dealerName: string): Promise<void> {
    await this.send({
      to,
      subject: 'Your Blox financing application',
      text:
        `${dealerName} started a vehicle financing application for you on Blox.\n\n` +
        `Set a password to access your application, upload documents, and sign your contract:\n${url}\n\n` +
        `If this wasn't you, contact the dealer or ignore this email.`,
      template: 'walk_in_invite',
      payload: { url, dealerName },
      authCritical: true,
    });
  }
}
