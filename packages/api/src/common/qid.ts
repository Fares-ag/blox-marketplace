/** Qatar national ID: exactly 11 digits. */
export const QID_PATTERN = /^\d{11}$/;

export const QID_VALIDATION_MESSAGE = 'qid must be exactly 11 digits';

export function isValidQid(value: unknown): value is string {
  return typeof value === 'string' && QID_PATTERN.test(value);
}
