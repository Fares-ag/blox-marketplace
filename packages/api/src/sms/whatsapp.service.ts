import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { resolveHttpTimeoutMs } from '../common/fetch-with-timeout';
import { normalizePhone } from './sms.service';
import {
  DEFAULT_TWILIO_TIMEOUT_MS,
  sendTwilioMessage,
  TwilioError,
  whatsappAddress,
  type TwilioCredentials,
} from './twilio';

export type WhatsAppKind = 'notification' | 'reminder' | 'generic';

export type WhatsAppMessage = {
  to: string;
  body: string;
  kind: WhatsAppKind;
};

export type WhatsAppProvider = 'log' | 'twilio' | 'http';

export type WhatsAppSendResult = {
  delivered: boolean;
  provider: WhatsAppProvider;
  id?: string;
};

/** `WHATSAPP_PROVIDER` → provider; anything unknown or empty means log-only. */
export function resolveWhatsAppProvider(raw: string | undefined): WhatsAppProvider {
  const value = (raw ?? '').trim().toLowerCase();
  if (value === 'twilio') return 'twilio';
  if (value === 'http') return 'http';
  return 'log';
}

/**
 * Outbound WhatsApp messages (customer notifications only — OTPs stay on SMS).
 *
 *   WHATSAPP_PROVIDER=log     (default) — logs the message.
 *   WHATSAPP_PROVIDER=twilio  — Twilio WhatsApp channel: TWILIO_ACCOUNT_SID /
 *                             TWILIO_AUTH_TOKEN and TWILIO_WHATSAPP_FROM
 *                             (`whatsapp:+1415…`, prefix added if missing).
 *   WHATSAPP_PROVIDER=http    — POSTs `{ to, body, kind, channel: 'whatsapp' }`
 *                             to WHATSAPP_HTTP_URL with `Bearer WHATSAPP_HTTP_TOKEN`.
 */
@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);
  private readonly provider: WhatsAppProvider;
  private readonly twilio: TwilioCredentials | null;
  private readonly twilioFrom: string | null;
  private readonly twilioTimeoutMs: number;
  private readonly httpUrl: string | null;
  private readonly httpToken: string | null;

  constructor(config: ConfigService) {
    this.provider = resolveWhatsAppProvider(config.get<string>('WHATSAPP_PROVIDER'));

    const accountSid = config.get<string>('TWILIO_ACCOUNT_SID')?.trim() || null;
    const authToken = config.get<string>('TWILIO_AUTH_TOKEN')?.trim() || null;
    this.twilio = accountSid && authToken ? { accountSid, authToken } : null;
    const from = config.get<string>('TWILIO_WHATSAPP_FROM')?.trim() || null;
    this.twilioFrom = from ? whatsappAddress(from) : null;
    this.twilioTimeoutMs = resolveHttpTimeoutMs(config.get<string>('TWILIO_HTTP_TIMEOUT_MS'), DEFAULT_TWILIO_TIMEOUT_MS);

    this.httpUrl = config.get<string>('WHATSAPP_HTTP_URL')?.trim() || null;
    this.httpToken = config.get<string>('WHATSAPP_HTTP_TOKEN')?.trim() || null;

    if (this.provider === 'twilio') {
      if (!this.twilio) throw new Error('TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN are required when WHATSAPP_PROVIDER=twilio');
      if (!this.twilioFrom) throw new Error('TWILIO_WHATSAPP_FROM is required when WHATSAPP_PROVIDER=twilio');
    }
    if (this.provider === 'http' && !this.httpUrl) {
      throw new Error('WHATSAPP_HTTP_URL is required when WHATSAPP_PROVIDER=http');
    }
  }

  get isLive(): boolean {
    return this.provider !== 'log';
  }

  get providerName(): WhatsAppProvider {
    return this.provider;
  }

  async send(message: WhatsAppMessage): Promise<WhatsAppSendResult> {
    const to = normalizePhone(message.to);
    if (!to) throw new Error('whatsapp_invalid_recipient');

    switch (this.provider) {
      case 'log':
        this.logger.log(`[whatsapp:${message.kind}] to=${to} body=${JSON.stringify(message.body)}`);
        return { delivered: false, provider: 'log' };
      case 'twilio':
        return this.sendViaTwilio(to, message);
      case 'http':
        return this.sendViaHttp(to, message);
    }
  }

  private async sendViaTwilio(to: string, message: WhatsAppMessage): Promise<WhatsAppSendResult> {
    try {
      const result = await sendTwilioMessage(
        this.twilio!,
        { to: whatsappAddress(to), body: message.body, from: this.twilioFrom },
        this.twilioTimeoutMs,
      );
      return { delivered: true, provider: 'twilio', id: result.sid };
    } catch (err) {
      if (err instanceof TwilioError) {
        this.logger.error(
          `Twilio WhatsApp failed kind=${message.kind} http=${err.httpStatus} code=${err.code ?? 'n/a'}: ${err.message}`,
        );
        throw new Error(err.invalidRecipient ? 'whatsapp_invalid_recipient' : 'whatsapp_gateway_error');
      }
      const detail = err instanceof Error ? err.message : String(err);
      this.logger.error(`Twilio WhatsApp request failed kind=${message.kind}: ${detail}`);
      throw new Error('whatsapp_gateway_error');
    }
  }

  private async sendViaHttp(to: string, message: WhatsAppMessage): Promise<WhatsAppSendResult> {
    const res = await fetch(this.httpUrl!, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(this.httpToken ? { authorization: `Bearer ${this.httpToken}` } : {}),
      },
      body: JSON.stringify({ to, body: message.body, kind: message.kind, channel: 'whatsapp' }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      this.logger.error(`WhatsApp gateway responded ${res.status} for kind=${message.kind}`);
      throw new Error('whatsapp_gateway_error');
    }
    return { delivered: true, provider: 'http' };
  }
}
