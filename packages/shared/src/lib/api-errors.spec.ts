import { describe, expect, it } from 'vitest';
import { humanizeApiErrorCode, parseApiErrorBody } from './api-errors';

describe('parseApiErrorBody', () => {
  it('turns the raw Qatar ID validator into a sentence', () => {
    const parsed = parseApiErrorBody(
      { error: { code: 'validation_failed', message: 'qid must be exactly 11 digits' } },
      400,
    );
    expect(parsed.message).toBe('Qatar ID must be 11 digits starting with 2 or 3.');
    expect(parsed.message).not.toMatch(/_/);
  });

  it('maps leftover machine codes instead of showing the code', () => {
    expect(humanizeApiErrorCode('invalid_file_type')).toMatch(/PDF or image/);
    expect(humanizeApiErrorCode('application_not_found')).toMatch(/could not be found/);
    expect(humanizeApiErrorCode('separation_of_duties')).toMatch(/separation-of-duties/);
    const parsed = parseApiErrorBody({ message: 'invalid_file_type' }, 400);
    expect(parsed.code).toBe('invalid_file_type');
    expect(parsed.message).not.toBe('invalid_file_type');
  });

  it('rewrites empty-field validator text', () => {
    const parsed = parseApiErrorBody({ message: ['name should not be empty'] }, 400);
    expect(parsed.message).toBe('Name is required.');
  });
});
