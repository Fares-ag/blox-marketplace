import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type SmsKind = 'assist_otp' | 'assist_link' | 'reminder' | 'generic';

export type SmsMessage = {
  to: string;
  body: string;
  kind: SmsKind;
};

/**
 * Outbound SMS with a swappable provider.
 *
 *   SMS_PROVIDER=log   (default outside production) — writes the message to the
 *                      API log so OTPs can be read during local QA.
 *   SMS_PROVIDER=http  — POSTs `{ to, body, sender, kind }` as JSON to SMS_HTTP_URL
 *                      with `Authorization: Bearer SMS_HTTP_TOKEN`. Works with
 *                      Ooredoo/Vodafone Qatar gateway adapters and Twilio-style
 *                      relays without a vendor SDK in this repo.
 */
@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private readonly provider: 'log' | 'http';
  private readonly httpUrl: string | null;
  private readonly httpToken: string | null;
  private readonly sender: string;

  constructor(config: ConfigService) {
    const configured = (config.get<string>('SMS_PROVIDER') ?? '').trim().toLowerCase();
    const isProduction = process.env.NODE_ENV === 'production';
    this.provider = configured === 'http' ? 'http' : 'log';
    this.httpUrl = config.get<string>('SMS_HTTP_URL')?.trim() || null;
    this.httpToken = config.get<string>('SMS_HTTP_TOKEN')?.trim() || null;
    this.sender = config.get<string>('SMS_SENDER_ID')?.trim() || 'Blox';
    if (this.provider === 'http' && !this.httpUrl) {
      throw new Error('SMS_HTTP_URL is required when SMS_PROVIDER=http');
    }
    if (isProduction && this.provider === 'log') {
      this.logger.warn('SMS_PROVIDER is not configured — assisted-session OTPs will only be logged');
    }
  }

  get isLive(): boolean {
    return this.provider === 'http';
  }

  async send(message: SmsMessage): Promise<{ delivered: boolean; provider: string }> {
    const to = normalizePhone(message.to);
    if (!to) throw new Error('sms_invalid_recipient');
    if (this.provider === 'log') {
      this.logger.log(`[sms:${message.kind}] to=${to} body=${JSON.stringify(message.body)}`);
      return { delivered: false, provider: 'log' };
    }
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
