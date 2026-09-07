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
  'documents_stale',
  'guarantor_consent_required',
  'vehicle_identity_incomplete',
  'vehicle_age_rule',
  'blocking_application',
  'product_rule_violation',
  'dob_qid_mismatch',
] as const;

export type SubmitGateCode = (typeof SUBMIT_GATE_CODES)[number];

/** Machine code carried by an API error (`ApiError.code` or a `code` property), else ''. */
export function apiErrorCodeOf(error: unknown): string {
  if (error instanceof ApiError) return error.code ?? '';
  if (error && typeof error === 'object' && 'code' in error) {
    return String((error as { code?: unknown }).code ?? '');
  }
  return '';
}

/** Structured extras the API attaches to gate errors (`missing`, `stale`, `application_id`, …). */
export function apiErrorDetails(error: unknown): Record<string, unknown> {
  const details = error && typeof error === 'object' ? (error as { details?: unknown }).details : undefined;
  return details && typeof details === 'object' ? (details as Record<string, unknown>) : {};
}

export function submitGateCode(error: unknown): SubmitGateCode | null {
  const code = apiErrorCodeOf(error);
  return (SUBMIT_GATE_CODES as readonly string[]).includes(code) ? (code as SubmitGateCode) : null;
}

function categoryLabels(categories: unknown, t: IntakeTranslate): string {
  if (!Array.isArray(categories) || categories.length === 0) return '';
  return categories
    .map((category) =>
      t(`applyFlow.docs.${String(category)}`, {
        defaultValue: t(`ops.wizard.doc.${String(category)}`, { defaultValue: String(category).replace(/_/g, ' ') }),
      }),
    )
    .join(', ');
}

/** Translated guidance for a gate error, or null when the error is not a known gate. */
export function submitGateMessage(error: unknown, t: IntakeTranslate): string | null {
  const code = submitGateCode(error);
  if (!code) return null;
  const base = t(`dealerOps.submitGate.${code}`, { defaultValue: code.replace(/_/g, ' ') });
  const details = apiErrorDetails(error);
  if (code === 'documents_missing') {
    const labels = categoryLabels(details.missing, t);
    return labels ? `${base} (${labels})` : base;
  }
  if (code === 'documents_stale') {
    const labels = categoryLabels(details.stale, t);
    return labels ? `${base} (${labels})` : base;
  }
  return base;
}
