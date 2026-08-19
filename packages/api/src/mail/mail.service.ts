import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { type Transporter } from 'nodemailer';

export type MailInput = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

/**
 * SMTP mailer (P0-3). Configured via SMTP_HOST / SMTP_PORT / SMTP_USER /
 * SMTP_PASS / SMTP_FROM. Without SMTP_HOST it runs in "log-only" mode:
 * mails are logged, never sent — acceptable for local dev only.
 *
 * In production, boot fails when email verification is required but no
 * transport is configured (see assertProductionReady).
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null = null;
  private readonly from: string;

  constructor(private readonly config: ConfigService) {
    const host = this.config.get<string>('SMTP_HOST');
    this.from =
      this.config.get<string>('SMTP_FROM') ?? 'Blox <no-reply@blox.market>';
    if (host) {
      this.transporter = nodemailer.createTransport({
        host,
        port: Number(this.config.get<string>('SMTP_PORT') ?? 587),
        secure: this.config.get<string>('SMTP_SECURE') === 'true',
        auth: this.config.get<string>('SMTP_USER')
          ? {
              user: this.config.get<string>('SMTP_USER'),
              pass: this.config.get<string>('SMTP_PASS'),
            }
          : undefined,
      });
    }
  }

  get enabled(): boolean {
    return this.transporter !== null;
  }

  assertProductionReady(requireEmailVerification: boolean) {
    if (process.env.NODE_ENV === 'production' && requireEmailVerification && !this.enabled) {
      throw new Error(
        'Email verification is required but SMTP is not configured. ' +
          'Set SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS/SMTP_FROM, or explicitly set ' +
          'REQUIRE_EMAIL_VERIFICATION=false (not recommended).',
      );
    }
  }

  async send(input: MailInput): Promise<void> {
    if (!this.transporter) {
      this.logger.warn(
        `SMTP not configured — mail NOT sent. to=${input.to} subject="${input.subject}"\n${input.text}`,
      );
      return;
    }
    try {
      await this.transporter.sendMail({
        from: this.from,
        to: input.to,
        subject: input.subject,
        text: input.text,
        html: input.html,
      });
    } catch (err) {
      // Mail failures must never take down the calling flow; they are logged
      // for the operator. (Callers that need delivery guarantees should queue.)
      const message = err instanceof Error ? err.message : 'mail_send_failed';
      this.logger.error(`Mail send failed to=${input.to}: ${message}`);
    }
  }

  async sendVerificationEmail(to: string, url: string): Promise<void> {
    await this.send({
      to,
      subject: 'Verify your Blox email address',
      text: `Welcome to Blox.\n\nVerify your email address to activate your account:\n${url}\n\nIf you did not create this account, ignore this email.`,
    });
  }

  async sendPasswordResetEmail(to: string, url: string): Promise<void> {
    await this.send({
      to,
      subject: 'Reset your Blox password',
      text: `We received a request to reset your Blox password.\n\nSet a new password here (link expires shortly):\n${url}\n\nIf you did not request this, ignore this email — your password is unchanged.`,
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
    });
  }
}
