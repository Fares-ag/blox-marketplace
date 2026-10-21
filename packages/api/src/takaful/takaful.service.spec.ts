import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { assertTakafulPolicyDateRange } from './takaful.service';

describe('takaful policy dates', () => {
  it('rejects dates far outside a sensible horizon', () => {
    expect(() => assertTakafulPolicyDateRange(new Date('1999-01-01T00:00:00Z'), null)).toThrow(
      BadRequestException,
    );
    expect(() =>
      assertTakafulPolicyDateRange(new Date(`${new Date().getUTCFullYear() + 20}-01-01T00:00:00Z`), null),
    ).toThrow(BadRequestException);
  });

  it('rejects an expiry before the effective date', () => {
    expect(() =>
      assertTakafulPolicyDateRange(new Date('2026-06-01T00:00:00Z'), new Date('2026-05-01T00:00:00Z')),
    ).toThrow(BadRequestException);
  });

  it('accepts a normal cover window', () => {
    expect(() =>
      assertTakafulPolicyDateRange(new Date('2026-01-01T00:00:00Z'), new Date('2027-01-01T00:00:00Z')),
    ).not.toThrow();
  });
});
