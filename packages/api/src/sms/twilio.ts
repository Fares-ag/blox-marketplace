import { fetchWithTimeout } from '../common/fetch-with-timeout';

/**
 * Minimal Twilio Messages API client (SMS and WhatsApp) — a basic-auth POST to
 * `/2010-04-01/Accounts/{sid}/Messages.json`, no vendor SDK.
 */

export const TWILIO_API_BASE = 'https://api.twilio.com/2010-04-01';
export const DEFAULT_TWILIO_TIMEOUT_MS = 10_000;

export type TwilioCredentials = { accountSid: string; authToken: string };

export type TwilioMessageInput = {
  to: string;
  body: string;
  /** Sender number (E.164, or `whatsapp:+…`); alternatively a Messaging Service SID. */
  from?: string | null;
  messagingServiceSid?: string | null;
};

export type TwilioSendResult = { sid: string; status: string };

/** Error codes that mean the destination can never receive this message (do not retry). */
export const TWILIO_INVALID_RECIPIENT_CODES: ReadonlySet<number> = new Set([
  21211, // invalid 'To' number
  21214, // 'To' number cannot be reached
  21217, // phone number not currently reachable via SMS
  21408, // permission to send to this region not enabled
  21610, // recipient unsubscribed (STOP)
  21614, // 'To' is not a mobile number
  63003, // WhatsApp channel could not find the To address
]);

export class TwilioError extends Error {
  constructor(
    public readonly httpStatus: number,
    public readonly code: number | null,
    message: string,
  ) {
    super(message);
    this.name = 'TwilioError';
  }

  get invalidRecipient(): boolean {
    return this.code !== null && TWILIO_INVALID_RECIPIENT_CODES.has(this.code);
  }
}

export function twilioMessagesUrl(accountSid: string): string {
  return `${TWILIO_API_BASE}/Accounts/${encodeURIComponent(accountSid)}/Messages.json`;
}

export function twilioAuthorizationHeader(creds: TwilioCredentials): string {
  return `Basic ${Buffer.from(`${creds.accountSid}:${creds.authToken}`, 'utf8').toString('base64')}`;
}

/** Form body for the Messages endpoint; exactly one of `from` / `messagingServiceSid` must be set. */
export function buildTwilioMessageForm(input: TwilioMessageInput): URLSearchParams {
  const form = new URLSearchParams();
  form.set('To', input.to);
  form.set('Body', input.body);
  const from = input.from?.trim();
  const service = input.messagingServiceSid?.trim();
  if (service) form.set('MessagingServiceSid', service);
  else if (from) form.set('From', from);
  else throw new Error('twilio_sender_required');
  return form;
}

/** `+97455550001` → `whatsapp:+97455550001` (idempotent). */
export function whatsappAddress(value: string): string {
  const trimmed = value.trim();
  return trimmed.toLowerCase().startsWith('whatsapp:') ? `whatsapp:${trimmed.slice('whatsapp:'.length).trim()}` : `whatsapp:${trimmed}`;
}

export async function sendTwilioMessage(
  creds: TwilioCredentials,
  input: TwilioMessageInput,
  timeoutMs: number = DEFAULT_TWILIO_TIMEOUT_MS,
): Promise<TwilioSendResult> {
  const form = buildTwilioMessageForm(input);
  const res = await fetchWithTimeout(
    twilioMessagesUrl(creds.accountSid),
    {
      method: 'POST',
      headers: {
        authorization: twilioAuthorizationHeader(creds),
        'content-type': 'application/x-www-form-urlencoded',
        accept: 'application/json',
      },
      body: form.toString(),
    },
    timeoutMs,
  );

  const body = (await res.json().catch(() => ({}))) as {
    sid?: string;
    status?: string;
    code?: number;
    message?: string;
  };
  if (!res.ok) {
    throw new TwilioError(
      res.status,
      typeof body.code === 'number' ? body.code : null,
      body.message ?? `twilio_http_${res.status}`,
    );
  }
  if (!body.sid) throw new TwilioError(res.status, null, 'twilio_response_missing_sid');
  return { sid: body.sid, status: body.status ?? 'queued' };
}
