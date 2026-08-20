import { describe, expect, it } from 'vitest';
import { resolveRequestId } from './request-id';

describe('resolveRequestId', () => {
  it('uses a trimmed client id when provided', () => {
    expect(resolveRequestId('  abc-123  ')).toBe('abc-123');
  });

  it('uses the first value when the header is repeated', () => {
    expect(resolveRequestId(['first-id', 'second-id'])).toBe('first-id');
  });

  it('generates a uuid when the header is missing or blank', () => {
    const id = resolveRequestId(undefined);
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });
});
