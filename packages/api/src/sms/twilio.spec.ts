import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveSmsProvider } from './sms.service';
import {
  buildTwilioMessageForm,
  sendTwilioMessage,
  TwilioError,
  twilioAuthorizationHeader,
  twilioMessagesUrl,
  whatsappAddress,
} from './twilio';
import { resolveWhatsAppProvider } from './whatsapp.service';

const creds = { accountSid: 'ACxxx', authToken: 'secret' };

describe('provider resolution', () => {
  it('defaults to log and recognises the live providers case-insensitively', () => {
    expect(resolveSmsProvider(undefined)).toBe('log');
    expect(resolveSmsProvider('')).toBe('log');
    expect(resolveSmsProvider('nonsense')).toBe('log');
    expect(resolveSmsProvider(' Twilio ')).toBe('twilio');
    expect(resolveSmsProvider('http')).toBe('http');
    expect(resolveWhatsAppProvider(undefined)).toBe('log');
    expect(resolveWhatsAppProvider('TWILIO')).toBe('twilio');
    expect(resolveWhatsAppProvider('http')).toBe('http');
  });
});

describe('twilio helpers', () => {
  it('builds the Messages endpoint and basic-auth header', () => {
    expect(twilioMessagesUrl('ACxxx')).toBe('https://api.twilio.com/2010-04-01/Accounts/ACxxx/Messages.json');
    expect(twilioAuthorizationHeader(creds)).toBe(`Basic ${Buffer.from('ACxxx:secret').toString('base64')}`);
  });

  it('prefers a Messaging Service over a From number and refuses to send without either', () => {
    expect(Object.fromEntries(buildTwilioMessageForm({ to: '+97455550001', body: 'hi', from: '+97400000000' }))).toEqual({
      To: '+97455550001',
      Body: 'hi',
      From: '+97400000000',
    });
    expect(
      Object.fromEntries(
        buildTwilioMessageForm({ to: '+97455550001', body: 'hi', from: '+97400000000', messagingServiceSid: 'MGabc' }),
      ),
    ).toEqual({ To: '+97455550001', Body: 'hi', MessagingServiceSid: 'MGabc' });
    expect(() => buildTwilioMessageForm({ to: '+97455550001', body: 'hi' })).toThrow('twilio_sender_required');
  });

  it('prefixes WhatsApp addresses exactly once', () => {
    expect(whatsappAddress('+97455550001')).toBe('whatsapp:+97455550001');
    expect(whatsappAddress('whatsapp:+97455550001')).toBe('whatsapp:+97455550001');
    expect(whatsappAddress(' WhatsApp:+14155238886 ')).toBe('whatsapp:+14155238886');
  });
});

describe('sendTwilioMessage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('posts form-encoded fields with basic auth and returns the SID', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ sid: 'SM123', status: 'queued' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await sendTwilioMessage(creds, { to: '+97455550001', body: 'Your code is 123456', from: '+97400000000' });
    expect(result).toEqual({ sid: 'SM123', status: 'queued' });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(twilioMessagesUrl('ACxxx'));
    expect(init.method).toBe('POST');
    const headers = init.headers as Record<string, string>;
    expect(headers.authorization).toBe(twilioAuthorizationHeader(creds));
    expect(headers['content-type']).toBe('application/x-www-form-urlencoded');
    expect(String(init.body)).toBe('To=%2B97455550001&Body=Your+code+is+123456&From=%2B97400000000');
  });

  it('turns Twilio error bodies into TwilioError and flags dead recipients', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ code: 21211, message: "The 'To' number is not a valid phone number." }),
      }),
    );
    const err = await sendTwilioMessage(creds, { to: 'bad', body: 'x', from: '+97400000000' }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(TwilioError);
    expect((err as TwilioError).code).toBe(21211);
    expect((err as TwilioError).httpStatus).toBe(400);
    expect((err as TwilioError).invalidRecipient).toBe(true);

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503, json: async () => ({}) }));
    const outage = await sendTwilioMessage(creds, { to: '+97455550001', body: 'x', from: '+97400000000' }).catch((e: unknown) => e);
    expect((outage as TwilioError).invalidRecipient).toBe(false);
    expect((outage as TwilioError).message).toBe('twilio_http_503');
  });
});
