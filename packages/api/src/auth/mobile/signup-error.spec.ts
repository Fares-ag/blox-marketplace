import { describe, expect, it } from 'vitest';
import { mapSignupFailure } from './signup-error';

describe('mapSignupFailure', () => {
  it('maps better-auth duplicate accounts to user_already_exists', () => {
    expect(mapSignupFailure('User already exists. Use another email.')).toBe(
      'user_already_exists',
    );
    expect(mapSignupFailure('Email already registered')).toBe('user_already_exists');
  });

  it('maps unknown failures to signup_failed', () => {
    expect(mapSignupFailure('password too weak')).toBe('signup_failed');
    expect(mapSignupFailure(undefined)).toBe('signup_failed');
  });
});
