/** Maps better-auth / provider signup failures onto machine codes. */
export function mapSignupFailure(message: string | undefined): string {
  const lower = (message ?? '').toLowerCase();
  if (lower.includes('already exists') || lower.includes('already registered')) {
    return 'user_already_exists';
  }
  return 'signup_failed';
}
