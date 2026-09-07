import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailOutbox, EmailOutboxStatus, Prisma } from '@prisma/client';
import nodemailer, { type Transporter } from 'nodemailer';
import {
  escapeHtml,
  finalizeText,
  formatQatarDate,
  formatQatarDateTime,
  isolateLtr,
  notificationTexts,
  wrapHtml,
  type NotificationLocale,
} from '../notifications/notification-texts';
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
  | 'notification'
  | 'transactional';

export const MAIL_TEMPLATES: readonly MailTemplate[] = [
  'password_reset',
  'email_verification',
  'walk_in_invite',
  'staff_account_created',
  'assisted_session',
  'document_expiry',
  'takaful_renewal',
  'notification',
  'transactional',
];

export function isMailTemplate(value: unknown): value is MailTemplate {
  return typeof value === 'string' && (MAIL_TEMPLATES as readonly string[]).includes(value);
}

/** Subject/text/html of a templated email, rendered without sending (the notification router gates delivery). */
export type RenderedEmail = { subject: string; text: string; html: string };

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

/** A URL on its own line inside Arabic plain text is isolated so it keeps its left-to-right shape. */
function plainUrl(url: string, locale: NotificationLocale): string {
  return locale === 'ar' ? isolateLtr(url) : url;
}

const FOOTER_STYLE = 'color:#64748b;font-size:14px;';

export type DocumentExpiryEmailInput = {
  name: string;
  /** `CustomerDocumentCategory`; the label is rendered per language. */
  documentCategory: string;
  expiresAt: Date;
  daysToExpiry: number;
  url: string;
};

/** Document vault reminder copy (60/30/7 days before expiry, and once when expired). */
export function renderDocumentExpiryEmail(input: DocumentExpiryEmailInput, locale: NotificationLocale = 'en'): RenderedEmail {
  const t = notificationTexts(locale, 'text');
  const h = notificationTexts(locale, 'html');
  const values = { category: input.documentCategory, days: input.daysToExpiry, date: formatQatarDate(input.expiresAt, locale) };
  const subject = finalizeText(t.documentEmailSubject(values), locale);
  const text = finalizeText(
    [t.greeting(input.name), '', t.documentEmailLead(values), '', t.documentEmailCta, plainUrl(input.url, locale), '', t.documentEmailFooter].join(
      '\n',
    ),
    locale,
  );
  const html = wrapHtml(
    `<p>${h.greeting(input.name)}</p>` +
      `<p>${h.documentEmailLead(values)}</p>` +
      `<p><a href="${escapeHtml(input.url)}">${h.documentEmailLink}</a></p>` +
      `<p style="${FOOTER_STYLE}">${h.documentEmailFooter}</p>`,
    locale,
  );
  return { subject, text, html };
}

export type TakafulRenewalEmailInput = {
  name: string;
  vehicleLabel: string;
  provider: string | null;
  expiresAt: Date;
  daysToExpiry: number;
  url: string;
};

/** Takaful renewal reminder copy (30/14/3 days before the policy lapses, and once when it has). */
export function renderTakafulRenewalEmail(input: TakafulRenewalEmailInput, locale: NotificationLocale = 'en'): RenderedEmail {
  const t = notificationTexts(locale, 'text');
  const h = notificationTexts(locale, 'html');
  const values = {
    vehicle: input.vehicleLabel,
    provider: input.provider,
    days: input.daysToExpiry,
    date: formatQatarDate(input.expiresAt, locale),
  };
  const subject = finalizeText(t.takafulEmailSubject(values), locale);
  const text = finalizeText(
    [
      t.greeting(input.name),
      '',
      t.takafulEmailLead(values),
      '',
      `${t.takafulEmailRequirement} ${t.takafulEmailCta}`,
      plainUrl(input.url, locale),
      '',
      t.takafulEmailFooter,
    ].join('\n'),
    locale,
  );
  const html = wrapHtml(
    `<p>${h.greeting(input.name)}</p>` +
      `<p>${h.takafulEmailLead(values)}</p>` +
      `<p>${h.takafulEmailRequirement}</p>` +
      `<p><a href="${escapeHtml(input.url)}">${h.takafulEmailLink}</a></p>` +
      `<p style="${FOOTER_STYLE}">${h.takafulEmailFooter}</p>`,
    locale,
  );
  return { subject, text, html };
}

export type NotificationEmailInput = {
  name: string;
  title: string;
  body: string | null;
  url: string | null;
  category: string;
};

/** Generic copy for any in-app notification fanned out by the notification router. */
export function renderNotificationEmail(input: NotificationEmailInput, locale: NotificationLocale = 'en'): RenderedEmail {
  const t = notificationTexts(locale, 'text');
  const h = notificationTexts(locale, 'html');
  const body = input.body?.trim() || '';
  const url = input.url?.trim() || '';
  const text = finalizeText(
    [
      t.greeting(input.name),
      '',
      input.title,
      ...(body ? ['', body] : []),
      ...(url ? ['', t.openInBloxLine(url)] : []),
      '',
      t.notificationFooter,
    ].join('\n'),
    locale,
  );
  const html = wrapHtml(
    `<p>${h.greeting(input.name)}</p>` +
      `<p><strong>${escapeHtml(input.title)}</strong></p>` +
      (body ? `<p>${escapeHtml(body)}</p>` : '') +
      (url ? `<p><a href="${escapeHtml(url)}">${h.openInBloxLabel}</a></p>` : '') +
      `<p style="${FOOTER_STYLE}">${h.notificationFooter}</p>`,
    locale,
  );
  return { subject: input.title, text, html };
}

export type AssistedSessionEmailInput = {
  url: string;
  dealerName: string;
  agentName?: string | null;
  expiresAt: Date;
};

/**
 * Assisted journey: the customer link. The one-time code travels by SMS only —
 * it is never included here, so a compromised mailbox cannot complete the flow.
 */
export function renderAssistedSessionEmail(input: AssistedSessionEmailInput, locale: NotificationLocale = 'en'): RenderedEmail {
  const t = notificationTexts(locale, 'text');
  const h = notificationTexts(locale, 'html');
  const expires = formatQatarDateTime(input.expiresAt, locale);
  const party = { dealerName: input.dealerName, agentName: input.agentName ?? null };
  const subject = finalizeText(t.assistEmailSubject(party), locale);
  const text = finalizeText(
    [
      t.assistEmailIntro(party),
      '',
      t.assistEmailInstructions,
      plainUrl(input.url, locale),
      '',
      t.assistEmailExpiry({ expires, dealerName: input.dealerName }),
      '',
      t.assistEmailIgnore,
    ].join('\n'),
    locale,
  );
  const html = wrapHtml(
    `<p>${h.assistEmailIntro(party)}</p>` +
      `<p>${h.assistEmailInstructions}</p>` +
      `<p><a href="${escapeHtml(input.url)}">${h.assistEmailLink}</a></p>` +
      `<p style="${FOOTER_STYLE}">${h.assistEmailExpiry({ expires, dealerName: input.dealerName })} ${h.assistEmailIgnore}</p>`,
    locale,
  );
  return { subject, text, html };
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

  /** Assisted journey customer link, in the customer's language (see `renderAssistedSessionEmail`). */
  async sendAssistedSessionEmail(
    input: AssistedSessionEmailInput & { to: string; locale?: NotificationLocale },
  ): Promise<void> {
    const locale = input.locale ?? 'en';
    const { subject, text, html } = renderAssistedSessionEmail(input, locale);
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
        locale,
      },
    });
  }

  /** Document vault reminder (60/30/7 days before expiry, and once when expired). */
  async sendDocumentExpiryEmail(
    input: DocumentExpiryEmailInput & { to: string; locale?: NotificationLocale },
  ): Promise<void> {
    const locale = input.locale ?? 'en';
    const { subject, text, html } = renderDocumentExpiryEmail(input, locale);
    await this.send({
      to: input.to,
      subject,
      text,
      html,
      template: 'document_expiry',
      payload: {
        url: input.url,
        documentCategory: input.documentCategory,
        expiresAt: input.expiresAt.toISOString(),
        daysToExpiry: input.daysToExpiry,
        locale,
      },
    });
  }

  /** Takaful renewal reminder (30/14/3 days before the policy lapses, and once when it has). */
  async sendTakafulRenewalEmail(
    input: TakafulRenewalEmailInput & { to: string; locale?: NotificationLocale },
  ): Promise<void> {
    const locale = input.locale ?? 'en';
    const { subject, text, html } = renderTakafulRenewalEmail(input, locale);
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
        locale,
      },
    });
  }

  /**
   * Generic email for an in-app notification (payments, documents, takaful,
   * application progress, security). Used by the notification router; the
   * reminder crons pass their richer templates through the router instead.
   */
  async sendNotificationEmail(
    input: NotificationEmailInput & { to: string; locale?: NotificationLocale },
  ): Promise<void> {
    const locale = input.locale ?? 'en';
    const { subject, text, html } = renderNotificationEmail(input, locale);
    await this.send({
      to: input.to,
      subject,
      text,
      html,
      template: 'notification',
      payload: { url: input.url, category: input.category, locale },
    });
  }
}
