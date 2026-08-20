import { describe, expect, it, afterEach } from 'vitest';
import { sanitizeAnalyticsProps } from '../../../shared/src/analytics/events';
import { emitProductEvent } from './emit-product-event';

describe('sanitizeAnalyticsProps', () => {
  it('drops common PII keys', () => {
    expect(
      sanitizeAnalyticsProps({
        application_id: 'app_1',
        email: 'user@example.com',
        phone: '+97412345678',
        reason: 'secret',
      }),
    ).toEqual({ application_id: 'app_1' });
  });
});

describe('emitProductEvent', () => {
  const original = process.env.PRODUCT_ANALYTICS_ENABLED;

  afterEach(() => {
    if (original === undefined) delete process.env.PRODUCT_ANALYTICS_ENABLED;
    else process.env.PRODUCT_ANALYTICS_ENABLED = original;
  });

  it('no-ops when disabled', () => {
    process.env.PRODUCT_ANALYTICS_ENABLED = 'false';
    expect(() =>
      emitProductEvent('signup_completed', { role: 'customer' }),
    ).not.toThrow();
  });
});
