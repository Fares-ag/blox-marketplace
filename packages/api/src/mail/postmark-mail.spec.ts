import { describe, expect, it, vi, afterEach } from 'vitest';
import { resolvePostmarkServerToken, sendPostmarkEmail } from './postmark-mail';

describe('resolvePostmarkServerToken', () => {
  it('prefers POSTMARK_SERVER_TOKEN', () => {
    const token = resolvePostmarkServerToken({
      get: (key: string) =>
        key === 'POSTMARK_SERVER_TOKEN'
          ? 'pm-token'
          : key === 'SMTP_HOST'
            ? 'smtp.postmarkapp.com'
            : undefined,
    } as never);
    expect(token).toBe('pm-token');
  });

  it('falls back to SMTP_USER when host is Postmark', () => {
    const token = resolvePostmarkServerToken({
      get: (key: string) => {
        if (key === 'SMTP_HOST') return 'smtp.postmarkapp.com';
        if (key === 'SMTP_USER') return 'pm-from-smtp-user';
        return undefined;
      },
    } as never);
    expect(token).toBe('pm-from-smtp-user');
  });

  it('returns null when no Postmark config', () => {
    expect(
      resolvePostmarkServerToken({
        get: () => undefined,
      } as never),
    ).toBeNull();
  });
});

describe('sendPostmarkEmail', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('posts to Postmark and succeeds on 200', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => '' });
    vi.stubGlobal('fetch', fetchMock);

    await sendPostmarkEmail({
      token: 'secret',
      from: 'Blox <no-reply@blox.market>',
      to: 'user@example.com',
      subject: 'Hi',
      text: 'Hello',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.postmarkapp.com/email',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'X-Postmark-Server-Token': 'secret',
        }),
      }),
    );
  });

  it('throws with Postmark error body on failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 422,
        text: async () => '{"Message":"Invalid"}',
      }),
    );

    await expect(
      sendPostmarkEmail({
        token: 'secret',
        from: 'Blox <no-reply@blox.market>',
        to: 'user@example.com',
        subject: 'Hi',
        text: 'Hello',
      }),
    ).rejects.toThrow(/Postmark HTTP 422/);
  });
});
