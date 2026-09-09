/**
 * Email and Qatar phone validation, shared so intake forms, the apply stepper
 * and the ops wizard all accept exactly the same contact details.
 *
 * These run at the point of entry. An address the API will later refuse must
 * fail on the field that collects it, not at submit on the last step.
 */

/**
 * Local part, `@`, then a dotted domain whose last label is at least two
 * characters. Deliberately stricter than "contains an `@`", which passed the
 * single character "@" as a valid address.
 */
const EMAIL_RE = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)*\.[^\s@.]{2,}$/;

/** Longest address the RFCs allow; also stops a pasted blob reaching the API. */
const EMAIL_MAX_LENGTH = 254;

export function isValidEmail(value: string | null | undefined): boolean {
  const email = String(value ?? '').trim();
  if (!email || email.length > EMAIL_MAX_LENGTH) return false;
  return EMAIL_RE.test(email);
}

/** Qatar's country calling code, without the leading `+`. */
export const QATAR_DIAL_CODE = '974';

/** Subscriber numbers are eight digits; 3/5/6/7 are mobile, 4 is landline. */
export const QATAR_PHONE_DIGITS = 8;

const QATAR_PHONE_RE = /^(?:\+974|00974|974)?([3-7]\d{7})$/;

/** Strips the separators people type so `+974 5551 2345` and `55512345` agree. */
export function normalizePhoneInput(value: string | null | undefined): string {
  return String(value ?? '').replace(/[\s\-().]/g, '').trim();
}

/**
 * True for a Qatar subscriber number, with or without the country code.
 * Rejects the free-form digit strings the old "is it non-empty" check allowed.
 */
export function isValidQatarPhone(value: string | null | undefined): boolean {
  return QATAR_PHONE_RE.test(normalizePhoneInput(value));
}

/** The eight subscriber digits, or null when the input is not a Qatar number. */
export function qatarPhoneSubscriberDigits(value: string | null | undefined): string | null {
  const match = QATAR_PHONE_RE.exec(normalizePhoneInput(value));
  return match ? match[1] : null;
}

/** `+974 5551 2345` — the form the API and contracts store. */
export function formatQatarPhone(value: string | null | undefined): string | null {
  const digits = qatarPhoneSubscriberDigits(value);
  if (!digits) return null;
  return `+${QATAR_DIAL_CODE} ${digits.slice(0, 4)} ${digits.slice(4)}`;
}
