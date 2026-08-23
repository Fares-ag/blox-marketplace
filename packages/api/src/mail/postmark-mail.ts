import type { ConfigService } from '@nestjs/config';
import { fetchWithTimeout, resolveHttpTimeoutMs } from '../common/fetch-with-timeout';

const POSTMARK_API_URL = 'https://api.postmarkapp.com/email';
const DEFAULT_POSTMARK_HTTP_TIMEOUT_MS = 30_000;

/** Prefer POSTMARK_SERVER_TOKEN; fall back to SMTP_USER when host is Postmark. */
export function resolvePostmarkServerToken(config: ConfigService): string | null {
  const explicit = config.get<string>('POSTMARK_SERVER_TOKEN')?.trim();
  if (explicit) return explicit;

  const host = config.get<string>('SMTP_HOST')?.trim().toLowerCase() ?? '';
  const user = config.get<string>('SMTP_USER')?.trim();
  if (host.includes('postmarkapp.com') && user) return user;

  return null;
}

export function resolvePostmarkHttpTimeoutMs(config: ConfigService): number {
  return resolveHttpTimeoutMs(config.get<string>('POSTMARK_HTTP_TIMEOUT_MS'), DEFAULT_POSTMARK_HTTP_TIMEOUT_MS);
}

export async function sendPostmarkEmail(input: {
  token: string;
  from: string;
  to: string;
  subject: string;
  text: string;
  html?: string;
  timeoutMs?: number;
}): Promise<void> {
  const timeoutMs = input.timeoutMs ?? DEFAULT_POSTMARK_HTTP_TIMEOUT_MS;
  const res = await fetchWithTimeout(
    POSTMARK_API_URL,
    {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-Postmark-Server-Token': input.token,
      },
      body: JSON.stringify({
        From: input.from,
        To: input.to,
        Subject: input.subject,
        TextBody: input.text,
        ...(input.html ? { HtmlBody: input.html } : {}),
        MessageStream: 'outbound',
      }),
    },
    timeoutMs,
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Postmark HTTP ${res.status}: ${body.slice(0, 300)}`);
  }
}
