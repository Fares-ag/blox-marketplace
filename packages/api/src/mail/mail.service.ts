import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailOutbox, EmailOutboxStatus, Prisma } from '@prisma/client';
import nodemailer, { type Transporter } from 'nodemailer';
import { PrismaService } from '../prisma/prisma.service';
import { resolvePostmarkHttpTimeoutMs, resolvePostmarkServerToken, sendPostmarkEmail } from './postmark-mail';

export type MailTemplate =
  | 'password_reset'
  | 'email_verification'
  | 'walk_in_invite'
  | 'staff_account_created'
  | 'assisted_session'
  | 'document_expiry'
  | 'takaful_renewal'
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

const LOCAL_SMTP_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

/**
 * STARTTLS policy for plain SMTP. `SMTP_REQUIRE_TLS=true|false` wins; otherwise
 * TLS is required on submission ports against remote hosts, but not on port 25
 * or against a local sink (Mailpit/MailHog) that speaks plain SMTP only.
 */
export function resolveSmtpRequireTls(
  raw: string | undefined,
  opts: { host: string; port: number; secure: boolean },
): boolean {
  const flag = raw?.trim().toLowerCase();
  if (flag === 'true' || flag === '1') return true;
  if (flag === 'false' || flag === '0') return false;
  if (opts.secure) return false;
  if (opts.port === 25) return false;
  return !LOCAL_SMTP_HOSTS.has(opts.host.trim().toLowerCase());
}

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
  'staff_account_created',
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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatQatarDate(date: Date): string {
  return date.toLocaleDateString('en-QA', { dateStyle: 'medium', timeZone: 'Asia/Qatar' });
}

function formatQatarDateTime(date: Date): string {
  return date.toLocaleString('en-QA', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Qatar' });
}

function daysPhrase(days: number): string {
  if (days < 0) return 'has expired';
  if (days === 0) return 'expires today';
  return `expires in ${days} day${days === 1 ? '' : 's'}`;
}

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
  private readonly postmarkHttpTimeoutMs: number;
  private readonly from: string;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.from =
      this.config.get<string>('SMTP_FROM') ?? 'Blox <no-reply@blox.market>';
    this.postmarkToken = resolvePostmarkServerToken(config);
    this.postmarkHttpTimeoutMs = resolvePostmarkHttpTimeoutMs(config);

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
          requireTLS: resolveSmtpRequireTls(this.config.get<string>('SMTP_REQUIRE_TLS'), {
            host,
            port,
            secure,
          }),
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

    if (this.transport === 'none') {
      const url = typeof payload.url === 'string' ? payload.url : undefined;
      this.logger.warn(
        url
          ? `Mail not configured — dev verification link for ${input.to}: ${url}`
          : `Mail not configured — queued outbox=${row.id} to=${input.to} template=${input.template}`,
      );
      return;
    }

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
        timeoutMs: this.postmarkHttpTimeoutMs,
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
    await this.send({
      to,
      subject: 'Verify your Blox email address',
      text: `Welcome to Blox.\n\nVerify your email address to activate your account:\n${url}\n\nIf you did not create this account, ignore this email.`,
      template: 'email_verification',
      payload: { url },
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

  async sendDealerAgentWelcomeEmail(input: {
    to: string;
    name: string;
    loginUrl: string;
    temporaryPassword: string;
    dealerName: string;
  }): Promise<void> {
    const subject = `You're invited to ${input.dealerName} on Blox`;
    const text =
      `Hi ${input.name},\n\n` +
      `${input.dealerName} invited you to the Blox dealer portal to create vehicle financing applications.\n\n` +
      `Sign in with:\n` +
      `Email: ${input.to}\n` +
      `Temporary password: ${input.temporaryPassword}\n\n` +
      `Dealer portal: ${input.loginUrl}\n\n` +
      `Change your password after your first sign-in.\n\n` +
      `If you were not expecting this invitation, contact ${input.dealerName} or ignore this email.`;
    const html =
      `<p>Hi ${input.name},</p>` +
      `<p><strong>${input.dealerName}</strong> invited you to the Blox dealer portal to create vehicle financing applications.</p>` +
      `<p><strong>Email:</strong> ${input.to}<br>` +
      `<strong>Temporary password:</strong> <code>${input.temporaryPassword}</code></p>` +
      `<p><a href="${input.loginUrl}">Open the dealer portal</a></p>` +
      `<p style="color:#64748b;font-size:14px;">Change your password after your first sign-in. ` +
      `If you were not expecting this invitation, contact ${input.dealerName} or ignore this email.</p>`;

    await this.send({
      to: input.to,
      subject,
      text,
      html,
      template: 'transactional',
      payload: {
        loginUrl: input.loginUrl,
        dealerName: input.dealerName,
        temporaryPassword: input.temporaryPassword,
      },
    });
  }

  async sendAdminPasswordResetEmail(input: {
    to: string;
    name: string;
    loginUrl: string;
    temporaryPassword: string;
  }): Promise<void> {
    const subject = 'Your Blox password was reset';
    const text =
      `Hi ${input.name},\n\n` +
      `An administrator reset your Blox account password.\n\n` +
      `Sign in with:\n` +
      `Email: ${input.to}\n` +
      `Temporary password: ${input.temporaryPassword}\n\n` +
      `Sign-in URL: ${input.loginUrl}\n\n` +
      `Change your password after signing in.\n\n` +
      `If you did not expect this change, contact your administrator immediately.`;
    const html =
      `<p>Hi ${input.name},</p>` +
      `<p>An administrator reset your Blox account password.</p>` +
      `<p><strong>Email:</strong> ${input.to}<br>` +
      `<strong>Temporary password:</strong> <code>${input.temporaryPassword}</code></p>` +
      `<p><a href="${input.loginUrl}">Sign in to Blox</a></p>` +
      `<p style="color:#64748b;font-size:14px;">Change your password after signing in. ` +
      `If you did not expect this change, contact your administrator immediately.</p>`;

    await this.send({
      to: input.to,
      subject,
      text,
      html,
      template: 'transactional',
      payload: {
        loginUrl: input.loginUrl,
        temporaryPassword: input.temporaryPassword,
      },
    });
  }

  async sendStaffAccountCreatedEmail(to: string, name: string, loginUrl: string): Promise<void> {
    await this.send({
      to,
      subject: 'Your Blox account is ready',
      text:
        `Hi ${name},\n\n` +
        `An administrator created your Blox account. Sign in here:\n${loginUrl}\n\n` +
        `Use the email and temporary password shared with you by your administrator. ` +
        `Change your password after your first sign-in.\n\n` +
        `If you were not expecting this account, contact your administrator.`,
      template: 'staff_account_created',
      payload: { name, loginUrl },
      authCritical: true,
    });
  }

  async sendDealerQuoteEmail(input: {
    to: string;
    url: string;
    dealerName: string;
    vehicleLabel: string;
    negotiatedPrice: number;
    expiresAt: Date;
  }): Promise<void> {
    const price = `QAR ${Math.round(input.negotiatedPrice).toLocaleString('en-QA')}`;
    const expires = input.expiresAt.toLocaleString('en-QA', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'Asia/Qatar',
    });
    const subject = `Your vehicle financing quote from ${input.dealerName}`;
    const text =
      `${input.dealerName} prepared a financing quote for you on Blox.\n\n` +
      `Vehicle: ${input.vehicleLabel}\n` +
      `Quoted price: ${price}\n` +
      `Valid until: ${expires}\n\n` +
      `Review the quote and start your application here:\n${input.url}\n\n` +
      `This link is tied to your email address and expires on the date above. ` +
      `If you were not expecting this quote, contact the dealer or ignore this email.`;
    const html =
      `<p>${input.dealerName} prepared a financing quote for you on Blox.</p>` +
      `<ul>` +
      `<li><strong>Vehicle:</strong> ${input.vehicleLabel}</li>` +
      `<li><strong>Quoted price:</strong> ${price}</li>` +
      `<li><strong>Valid until:</strong> ${expires}</li>` +
      `</ul>` +
      `<p><a href="${input.url}">Review your quote</a></p>` +
      `<p style="color:#64748b;font-size:14px;">This link is tied to your email address. ` +
      `If you were not expecting this quote, contact the dealer or ignore this email.</p>`;

    await this.send({
      to: input.to,
      subject,
      text,
      html,
      template: 'transactional',
      payload: {
        url: input.url,
        dealerName: input.dealerName,
        vehicleLabel: input.vehicleLabel,
        negotiatedPrice: input.negotiatedPrice,
        expiresAt: input.expiresAt.toISOString(),
      },
    });
  }

  /**
   * Assisted journey: the customer link. The one-time code travels by SMS only —
   * it is never included here, so a compromised mailbox cannot complete the flow.
   */
  async sendAssistedSessionEmail(input: {
    to: string;
    url: string;
    dealerName: string;
    agentName?: string | null;
    expiresAt: Date;
  }): Promise<void> {
    const expires = formatQatarDateTime(input.expiresAt);
    const startedBy = input.agentName ? `${input.agentName} at ${input.dealerName}` : input.dealerName;
    const subject = `Continue your Blox financing application with ${input.dealerName}`;
    const text =
      `${startedBy} started a vehicle financing application for you on Blox.\n\n` +
      `Open this link on your phone, enter the one-time code we sent you by SMS, review the consents and verify your identity:\n${input.url}\n\n` +
      `The link expires on ${expires}. The code is never sent by email — if you did not receive it, ask ${input.dealerName} to resend it.\n\n` +
      `If you were not expecting this, ignore this email.`;
    const html =
      `<p><strong>${escapeHtml(startedBy)}</strong> started a vehicle financing application for you on Blox.</p>` +
      `<p>Open the link on your phone, enter the one-time code we sent you by SMS, review the consents and verify your identity.</p>` +
      `<p><a href="${escapeHtml(input.url)}">Continue your application</a></p>` +
      `<p style="color:#64748b;font-size:14px;">The link expires on ${escapeHtml(expires)}. The code is never sent by email — ` +
      `if you did not receive it, ask ${escapeHtml(input.dealerName)} to resend it. If you were not expecting this, ignore this email.</p>`;

    await this.send({
      to: input.to,
      subject,
      text,
      html,
      template: 'assisted_session',
      payload: {
        url: input.url,
        dealerName: input.dealerName,
        agentName: input.agentName ?? null,
        expiresAt: input.expiresAt.toISOString(),
      },
    });
  }

  /** Document vault reminder (60/30/7 days before expiry, and once when expired). */
  async sendDocumentExpiryEmail(input: {
    to: string;
    name: string;
    documentLabel: string;
    expiresAt: Date;
    daysToExpiry: number;
    url: string;
  }): Promise<void> {
    const expires = formatQatarDate(input.expiresAt);
    const phrase = daysPhrase(input.daysToExpiry);
    const subject = `Your ${input.documentLabel} ${phrase}`;
    const lead = `The ${input.documentLabel} in your Blox document vault ${phrase} (${expires}).`;
    const text =
      `Hi ${input.name},\n\n${lead}\n\n` +
      `Upload the renewed document so your financing applications are not delayed:\n${input.url}\n\n` +
      `You can switch document reminders off in your profile preferences.`;
    const html =
      `<p>Hi ${escapeHtml(input.name)},</p>` +
      `<p>${escapeHtml(lead)}</p>` +
      `<p><a href="${escapeHtml(input.url)}">Upload the renewed document</a></p>` +
      `<p style="color:#64748b;font-size:14px;">You can switch document reminders off in your profile preferences.</p>`;

    await this.send({
      to: input.to,
      subject,
      text,
      html,
      template: 'document_expiry',
      payload: {
        url: input.url,
        documentLabel: input.documentLabel,
        expiresAt: input.expiresAt.toISOString(),
        daysToExpiry: input.daysToExpiry,
      },
    });
  }

  /** Takaful renewal reminder (30/14/3 days before the policy lapses, and once when it has). */
  async sendTakafulRenewalEmail(input: {
    to: string;
    name: string;
    vehicleLabel: string;
    provider: string | null;
    expiresAt: Date;
    daysToExpiry: number;
    url: string;
  }): Promise<void> {
    const expires = formatQatarDate(input.expiresAt);
    const phrase = daysPhrase(input.daysToExpiry);
    const withProvider = input.provider ? ` with ${input.provider}` : '';
    const subject = `Takaful cover for your ${input.vehicleLabel} ${phrase}`;
    const lead = `The takaful policy${withProvider} covering your ${input.vehicleLabel} ${phrase} (${expires}).`;
    const text =
      `Hi ${input.name},\n\n${lead}\n\n` +
      `Your Diminishing Musharakah agreement requires the vehicle to stay insured for the whole financing term. ` +
      `Renew the policy and record the new details here:\n${input.url}\n\n` +
      `You can switch takaful reminders off in your profile preferences.`;
    const html =
      `<p>Hi ${escapeHtml(input.name)},</p>` +
      `<p>${escapeHtml(lead)}</p>` +
      `<p>Your Diminishing Musharakah agreement requires the vehicle to stay insured for the whole financing term.</p>` +
      `<p><a href="${escapeHtml(input.url)}">Record the renewed policy</a></p>` +
      `<p style="color:#64748b;font-size:14px;">You can switch takaful reminders off in your profile preferences.</p>`;

    await this.send({
      to: input.to,
      subject,
      text,
      html,
      template: 'takaful_renewal',
      payload: {
        url: input.url,
        vehicleLabel: input.vehicleLabel,
        provider: input.provider,
        expiresAt: input.expiresAt.toISOString(),
        daysToExpiry: input.daysToExpiry,
      },
    });
  }
}
