import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { resolveHttpTimeoutMs } from '../common/fetch-with-timeout';
import { DEFAULT_TWILIO_TIMEOUT_MS, sendTwilioMessage, TwilioError, type TwilioCredentials } from './twilio';

export type SmsKind =
  | 'assist_otp'
  | 'assist_link'
  | 'guarantor_otp'
  | 'guarantor_link'
  | 'reminder'
  | 'notification'
  | 'generic';

export type SmsMessage = {
  to: string;
  body: string;
  kind: SmsKind;
};

export type SmsProvider = 'log' | 'http' | 'twilio';

export type SmsSendResult = {
  /** False when the message only went to the log (no live provider). */
  delivered: boolean;
  provider: SmsProvider;
  /** Provider message id when one was returned (Twilio SID). */
  id?: string;
};

/** `SMS_PROVIDER` → provider; anything unknown or empty means log-only. */
export function resolveSmsProvider(raw: string | undefined): SmsProvider {
  const value = (raw ?? '').trim().toLowerCase();
  if (value === 'http') return 'http';
  if (value === 'twilio') return 'twilio';
  return 'log';
}

/**
 * Outbound SMS with a swappable provider.
 *
 *   SMS_PROVIDER=log    (default outside production) — writes the message to the
 *                       API log so OTPs can be read during local QA.
 *   SMS_PROVIDER=http   — POSTs `{ to, body, sender, kind }` as JSON to SMS_HTTP_URL
 *                       with `Authorization: Bearer SMS_HTTP_TOKEN`. Works with
 *                       Ooredoo/Vodafone Qatar gateway adapters and Twilio-style
 *                       relays without a vendor SDK in this repo.
 *   SMS_PROVIDER=twilio — basic-auth POST to the Twilio Messages endpoint using
 *                       TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN and TWILIO_FROM
 *                       (or TWILIO_MESSAGING_SERVICE_SID).
 */
@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private readonly provider: SmsProvider;
  private readonly httpUrl: string | null;
  private readonly httpToken: string | null;
  private readonly sender: string;
  private readonly twilio: TwilioCredentials | null;
  private readonly twilioFrom: string | null;
  private readonly twilioMessagingServiceSid: string | null;
  private readonly twilioTimeoutMs: number;

  constructor(config: ConfigService) {
    const isProduction = process.env.NODE_ENV === 'production';
    this.provider = resolveSmsProvider(config.get<string>('SMS_PROVIDER'));
    this.httpUrl = config.get<string>('SMS_HTTP_URL')?.trim() || null;
    this.httpToken = config.get<string>('SMS_HTTP_TOKEN')?.trim() || null;
    this.sender = config.get<string>('SMS_SENDER_ID')?.trim() || 'Blox';

    const accountSid = config.get<string>('TWILIO_ACCOUNT_SID')?.trim() || null;
    const authToken = config.get<string>('TWILIO_AUTH_TOKEN')?.trim() || null;
    this.twilio = accountSid && authToken ? { accountSid, authToken } : null;
    this.twilioFrom = config.get<string>('TWILIO_FROM')?.trim() || null;
    this.twilioMessagingServiceSid = config.get<string>('TWILIO_MESSAGING_SERVICE_SID')?.trim() || null;
    this.twilioTimeoutMs = resolveHttpTimeoutMs(config.get<string>('TWILIO_HTTP_TIMEOUT_MS'), DEFAULT_TWILIO_TIMEOUT_MS);

    if (this.provider === 'http' && !this.httpUrl) {
      throw new Error('SMS_HTTP_URL is required when SMS_PROVIDER=http');
    }
    if (this.provider === 'twilio') {
      if (!this.twilio) throw new Error('TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN are required when SMS_PROVIDER=twilio');
      if (!this.twilioFrom && !this.twilioMessagingServiceSid) {
        throw new Error('TWILIO_FROM or TWILIO_MESSAGING_SERVICE_SID is required when SMS_PROVIDER=twilio');
      }
    }
    if (isProduction && this.provider === 'log') {
      this.logger.warn('SMS_PROVIDER is not configured — OTPs and SMS notifications will only be logged');
    }
  }

  get isLive(): boolean {
    return this.provider !== 'log';
  }

  get providerName(): SmsProvider {
    return this.provider;
  }

  async send(message: SmsMessage): Promise<SmsSendResult> {
    const to = normalizePhone(message.to);
    if (!to) throw new Error('sms_invalid_recipient');

    switch (this.provider) {
      case 'log':
        this.logger.log(`[sms:${message.kind}] to=${to} body=${JSON.stringify(message.body)}`);
        return { delivered: false, provider: 'log' };
      case 'twilio':
        return this.sendViaTwilio(to, message);
      case 'http':
        return this.sendViaHttp(to, message);
    }
  }

  private async sendViaHttp(to: string, message: SmsMessage): Promise<SmsSendResult> {
    const res = await fetch(this.httpUrl!, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(this.httpToken ? { authorization: `Bearer ${this.httpToken}` } : {}),
      },
      body: JSON.stringify({ to, body: message.body, sender: this.sender, kind: message.kind }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      this.logger.error(`SMS gateway responded ${res.status} for kind=${message.kind}`);
      throw new Error('sms_gateway_error');
    }
    return { delivered: true, provider: 'http' };
  }

  private async sendViaTwilio(to: string, message: SmsMessage): Promise<SmsSendResult> {
    try {
      const result = await sendTwilioMessage(
        this.twilio!,
        { to, body: message.body, from: this.twilioFrom, messagingServiceSid: this.twilioMessagingServiceSid },
        this.twilioTimeoutMs,
      );
      return { delivered: true, provider: 'twilio', id: result.sid };
    } catch (err) {
      if (err instanceof TwilioError) {
        this.logger.error(`Twilio SMS failed kind=${message.kind} http=${err.httpStatus} code=${err.code ?? 'n/a'}: ${err.message}`);
        throw new Error(err.invalidRecipient ? 'sms_invalid_recipient' : 'sms_gateway_error');
      }
      const detail = err instanceof Error ? err.message : String(err);
      this.logger.error(`Twilio SMS request failed kind=${message.kind}: ${detail}`);
      throw new Error('sms_gateway_error');
    }
  }
}

/** E.164-ish normalisation; bare 8-digit Qatar numbers get +974. */
export function normalizePhone(raw: string | null | undefined): string | null {
  const digits = String(raw ?? '').replace(/[^\d+]/g, '');
  if (!digits) return null;
  if (digits.startsWith('+')) return digits.length >= 9 ? digits : null;
  if (digits.startsWith('00')) return `+${digits.slice(2)}`;
  if (digits.length === 8) return `+974${digits}`;
  if (digits.startsWith('974') && digits.length === 11) return `+${digits}`;
  return digits.length >= 9 ? `+${digits}` : null;
}
