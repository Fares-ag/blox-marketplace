import { ApiError } from '@drivemarket/shared';

/**
 * Machine code of a failed request, whatever client raised it (`apiFetch`,
 * multipart uploads, public-session calls). The API puts the code in the
 * envelope (`error.code`); older paths put it in `message`.
 */
export function apiErrorCode(error: unknown): string {
  if (!error || typeof error !== 'object') return '';
  const withCode = error as { code?: unknown; message?: unknown };
  const code = typeof withCode.code === 'string' ? withCode.code.trim() : '';
  if (code && code !== 'request_failed' && code !== 'conflict' && code !== 'bad_request') return code;
  const message = typeof withCode.message === 'string' ? withCode.message.trim() : '';
  if (/^[a-z][a-z0-9_]*$/.test(message)) return message;
  return code;
}

/** True when the failure carries the given machine code (exact or embedded in the message). */
export function hasErrorCode(error: unknown, code: string): boolean {
  if (apiErrorCode(error) === code) return true;
  if (error instanceof ApiError) return error.message.includes(code) || error.code === code;
  return error instanceof Error && error.message.includes(code);
}

export function errorStatus(error: unknown): number | null {
  const status = (error as { status?: unknown } | null)?.status;
  return typeof status === 'number' ? status : null;
}
