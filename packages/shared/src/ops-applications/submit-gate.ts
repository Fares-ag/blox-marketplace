import { ApiError } from '../lib/api';
import type { IntakeTranslate } from './customer-info';

/**
 * Machine codes the API returns from the submit gates and intake validation
 * (`identity_hold`, `consents_required`, …). `parseApiErrorBody` keeps the code
 * on `ApiError.code` but replaces the message with a generic line, so every
 * screen that submits an application maps the code back to real guidance here.
 */
export const SUBMIT_GATE_CODES = [
  'identity_hold',
  'consents_required',
  'documents_missing',
  'vehicle_identity_incomplete',
  'vehicle_age_rule',
  'blocking_application',
  'product_rule_violation',
  'dob_qid_mismatch',
] as const;

export type SubmitGateCode = (typeof SUBMIT_GATE_CODES)[number];

export function submitGateCode(error: unknown): SubmitGateCode | null {
  const code: string =
    error instanceof ApiError
      ? error.code ?? ''
      : error && typeof error === 'object' && 'code' in error
        ? String((error as { code?: unknown }).code ?? '')
        : '';
  return (SUBMIT_GATE_CODES as readonly string[]).includes(code) ? (code as SubmitGateCode) : null;
}

/** Structured extras the API attaches to gate errors (`missing`, `application_id`, …). */
function errorDetails(error: unknown): Record<string, unknown> {
  const details = error && typeof error === 'object' ? (error as { details?: unknown }).details : undefined;
  return details && typeof details === 'object' ? (details as Record<string, unknown>) : {};
}

/** Translated guidance for a gate error, or null when the error is not a known gate. */
export function submitGateMessage(error: unknown, t: IntakeTranslate): string | null {
  const code = submitGateCode(error);
  if (!code) return null;
  const base = t(`dealerOps.submitGate.${code}`, { defaultValue: code.replace(/_/g, ' ') });
  const missing = errorDetails(error).missing;
  if (code === 'documents_missing' && Array.isArray(missing) && missing.length) {
    const labels = missing
      .map((category) =>
        t(`ops.wizard.doc.${String(category)}`, { defaultValue: String(category).replace(/_/g, ' ') }),
      )
      .join(', ');
    return `${base} (${labels})`;
  }
  return base;
}
