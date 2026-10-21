import { describe, expect, it } from 'vitest';
import { composeName, splitDisplayName } from './customer-profile';

describe('splitDisplayName', () => {
  it('splits first token and remainder', () => {
    expect(splitDisplayName('Ahmed Hassan Ali')).toEqual({
      firstName: 'Ahmed',
      lastName: 'Hassan Ali',
    });
  });

  it('handles single-token names', () => {
    expect(splitDisplayName('Madonna')).toEqual({ firstName: 'Madonna', lastName: '' });
  });

  it('round-trips with composeName when both parts exist', () => {
    const parts = splitDisplayName('Sara Ali');
    expect(composeName(parts.firstName, parts.lastName)).toBe('Sara Ali');
  });
});
