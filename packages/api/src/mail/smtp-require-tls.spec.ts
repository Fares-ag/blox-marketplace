import { describe, expect, it } from 'vitest';
import { resolveSmtpRequireTls } from './mail.service';

describe('resolveSmtpRequireTls', () => {
  it('requires STARTTLS on submission ports against remote hosts', () => {
    expect(resolveSmtpRequireTls(undefined, { host: 'smtp.postmarkapp.com', port: 587, secure: false })).toBe(true);
    expect(resolveSmtpRequireTls(undefined, { host: 'smtp.postmarkapp.com', port: 2525, secure: false })).toBe(true);
  });

  it('does not require STARTTLS on port 25 or implicit TLS', () => {
    expect(resolveSmtpRequireTls(undefined, { host: 'smtp.postmarkapp.com', port: 25, secure: false })).toBe(false);
    expect(resolveSmtpRequireTls(undefined, { host: 'smtp.postmarkapp.com', port: 465, secure: true })).toBe(false);
  });

  it('skips STARTTLS for local sinks such as Mailpit on 1025', () => {
    expect(resolveSmtpRequireTls(undefined, { host: 'localhost', port: 1025, secure: false })).toBe(false);
    expect(resolveSmtpRequireTls(undefined, { host: '127.0.0.1', port: 1025, secure: false })).toBe(false);
  });

  it('lets SMTP_REQUIRE_TLS override the heuristic', () => {
    expect(resolveSmtpRequireTls('true', { host: 'localhost', port: 1025, secure: false })).toBe(true);
    expect(resolveSmtpRequireTls('false', { host: 'smtp.example.com', port: 587, secure: false })).toBe(false);
    expect(resolveSmtpRequireTls('0', { host: 'smtp.example.com', port: 587, secure: false })).toBe(false);
  });
});
