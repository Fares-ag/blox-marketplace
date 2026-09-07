import type { GuarantorSessionStatus, Prisma } from '@prisma/client';
import { CONSENT_CATALOG, isConsentCode, maskPhone } from '@drivemarket/shared/domain-rules';
import type {
  GuarantorSessionDto,
  GuarantorSessionPublicDto,
} from '../../../shared/src/types/customer-platform';
import { consentTextHash, normalizeConsentLocale, type ConsentLocale } from '../consents/consent-logic';

/**
 * Guarantor consent sessions (pure rules). A guarantor is not a platform user:
 * they open a link on their own phone, verify an OTP, accept their own
 * consents (credit bureau, terms, AML — biometric KYC is optional for them)
 * and may complete identity verification. Acceptances live on the session row.
 */

/** Header carrying the browser proof issued after the OTP (same header the assisted journey uses). */
export const GUARANTOR_PROOF_HEADER = 'x-assist-proof';

export const GUARANTOR_CONSENT_CODES = ['credit_bureau', 'terms', 'aml'] as const;
export type GuarantorConsentCode = (typeof GUARANTOR_CONSENT_CODES)[number];

export function isGuarantorConsentCode(value: unknown): value is GuarantorConsentCode {
  return typeof value === 'string' && (GUARANTOR_CONSENT_CODES as readonly string[]).includes(value);
}

/** Forward-only ordering of the guarantor steps; terminal states rank below everything. */
export const GUARANTOR_STATUS_RANK: Record<GuarantorSessionStatus, number> = {
  pending: 0,
  otp_verified: 1,
  consents_done: 2,
  completed: 3,
  expired: -1,
  cancelled: -1,
};

export const OPEN_GUARANTOR_STATUSES: readonly GuarantorSessionStatus[] = ['pending', 'otp_verified', 'consents_done'];

export function isGuarantorSessionOpen(status: GuarantorSessionStatus): boolean {
  return OPEN_GUARANTOR_STATUSES.includes(status);
}

/** An open session past its expiry reads as `expired`; the service persists that lazily. */
export function effectiveGuarantorStatus(
  session: { status: GuarantorSessionStatus; expiresAt: Date },
  now: Date = new Date(),
): GuarantorSessionStatus {
  if (isGuarantorSessionOpen(session.status) && session.expiresAt.getTime() <= now.getTime()) return 'expired';
  return session.status;
}

/** Steps only move forward: re-verifying the OTP after the consents never drops the session back. */
export function advanceGuarantorStatus(
  current: GuarantorSessionStatus,
  next: GuarantorSessionStatus,
): GuarantorSessionStatus {
  if (!isGuarantorSessionOpen(current)) return current;
  return GUARANTOR_STATUS_RANK[next] > GUARANTOR_STATUS_RANK[current] ? next : current;
}

function cleanString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function numberOrNull(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim()) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export type SnapshotGuarantor = {
  fullName: string;
  phone: string;
  qid: string | null;
  email: string | null;
  relationship: string | null;
  monthlyIncome: number | null;
};

/**
 * Guarantor block of the customer snapshot (`{ hasGuarantor, guarantor: { fullName, qid, phone,
 * relationship, monthlyIncome } }`, camelCase inside the JSON as the apply flow stores it).
 * Null when no guarantor was declared or the block lacks a name or phone.
 */
export function guarantorFromSnapshot(snapshot: unknown): SnapshotGuarantor | null {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return null;
  const snap = snapshot as Record<string, unknown>;
  if (snap.hasGuarantor === false) return null;
  const raw = snap.guarantor;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const g = raw as Record<string, unknown>;
  const fullName = cleanString(g.fullName ?? g.full_name ?? g.name);
  const phone = cleanString(g.phone);
  if (!fullName || !phone) return null;
  return {
    fullName,
    phone,
    qid: cleanString(g.qid),
    email: cleanString(g.email)?.toLowerCase() ?? null,
    relationship: cleanString(g.relationship),
    monthlyIncome: numberOrNull(g.monthlyIncome ?? g.monthly_income),
  };
}

/** First word of a full name — all the other party ever needs to see on the public page. */
export function firstNameOf(fullName: string | null | undefined): string | null {
  const first = String(fullName ?? '').trim().split(/\s+/)[0];
  return first || null;
}

export type GuarantorAcceptanceInput = { code: string; version: string };

export type GuarantorAcceptanceRecord = {
  code: GuarantorConsentCode;
  version: string;
  textHash: string;
  locale: ConsentLocale;
  acceptedAt: string;
};

export type GuarantorAcceptanceValidation =
  | { ok: true; accepted: { code: GuarantorConsentCode; version: string }[] }
  | { ok: false; error: 'consent_code_invalid' | 'consent_version_outdated'; code: string }
  | { ok: false; error: 'guarantor_consents_incomplete'; missing: GuarantorConsentCode[] };

/**
 * The guarantor accepts all three of their consents in one go: unknown or
 * non-guarantor codes are rejected, outdated versions are refused (the
 * guarantor saw old wording), and a partial set is incomplete.
 */
export function validateGuarantorAcceptances(acceptances: GuarantorAcceptanceInput[]): GuarantorAcceptanceValidation {
  const seen = new Map<GuarantorConsentCode, string>();
  for (const acceptance of acceptances) {
    const code = String(acceptance.code ?? '').trim();
    if (!isConsentCode(code) || !isGuarantorConsentCode(code)) {
      return { ok: false, error: 'consent_code_invalid', code };
    }
    const current = CONSENT_CATALOG[code].version;
    if (String(acceptance.version ?? '').trim() !== current) {
      return { ok: false, error: 'consent_version_outdated', code };
    }
    seen.set(code, current);
  }
  const missing = GUARANTOR_CONSENT_CODES.filter((code) => !seen.has(code));
  if (missing.length) return { ok: false, error: 'guarantor_consents_incomplete', missing };
  return { ok: true, accepted: [...seen].map(([code, version]) => ({ code, version })) };
}

/** Acceptance rows stored on the session: hash of the exact catalog text in the locale shown. */
export function buildGuarantorAcceptances(
  accepted: { code: GuarantorConsentCode; version: string }[],
  locale: string,
  now: Date = new Date(),
): GuarantorAcceptanceRecord[] {
  const normalized = normalizeConsentLocale(locale);
  const acceptedAt = now.toISOString();
  return accepted.map(({ code, version }) => ({
    code,
    version,
    textHash: consentTextHash(code, normalized),
    locale: normalized,
    acceptedAt,
  }));
}

/** Codes present in the stored acceptances JSON (tolerant of malformed rows). */
export function acceptedGuarantorCodes(raw: Prisma.JsonValue | null | undefined): GuarantorConsentCode[] {
  if (!Array.isArray(raw)) return [];
  const codes = new Set<GuarantorConsentCode>();
  for (const row of raw) {
    if (row && typeof row === 'object' && !Array.isArray(row)) {
      const code = (row as Record<string, unknown>).code;
      if (isGuarantorConsentCode(code)) codes.add(code);
    }
  }
  return GUARANTOR_CONSENT_CODES.filter((code) => codes.has(code));
}

export type GuarantorSmsKind = 'link' | 'otp';

/** Text of the SMS carrying the link and code (initial) or a fresh code (resend). The code never goes anywhere else. */
export function guarantorSmsBody(
  kind: GuarantorSmsKind,
  input: { applicantName: string | null; link: string; code: string },
): string {
  const applicant = firstNameOf(input.applicantName) ?? 'An applicant';
  if (kind === 'link') {
    return (
      `${applicant} named you as guarantor on their Blox vehicle financing application. ` +
      `Open ${input.link} and enter code ${input.code} (valid 5 minutes) to review and accept the guarantor consents. ` +
      'Do not share this code.'
    );
  }
  return `Your Blox guarantor verification code is ${input.code} (valid 5 minutes). Continue here: ${input.link}`;
}

export type GuarantorSessionLike = {
  id: string;
  applicationId: string;
  status: GuarantorSessionStatus;
  fullName: string;
  phone: string;
  relationship: string | null;
  consentsCompletedAt: Date | null;
  kycStatus: string | null;
  expiresAt: Date;
  lastOpenedAt: Date | null;
  createdAt: Date;
};

/** Applicant/staff view: the guarantor's phone is masked and the token is never echoed except as `link` on create/resend. */
export function toGuarantorSessionDto(
  session: GuarantorSessionLike,
  link?: string,
  now: Date = new Date(),
): GuarantorSessionDto {
  return {
    id: session.id,
    application_id: session.applicationId,
    status: effectiveGuarantorStatus(session, now),
    guarantor_name: session.fullName,
    phone_masked: maskPhone(session.phone),
    relationship: session.relationship ?? null,
    consents_completed_at: session.consentsCompletedAt?.toISOString() ?? null,
    kyc_status: session.kycStatus ?? null,
    expires_at: session.expiresAt.toISOString(),
    last_opened_at: session.lastOpenedAt?.toISOString() ?? null,
    ...(link ? { link } : {}),
    created_at: session.createdAt.toISOString(),
  };
}

export type GuarantorPublicViewInput = {
  session: { fullName: string; expiresAt: Date; kycInviteUrl: string | null; kycStatus: string | null };
  status: GuarantorSessionStatus;
  applicantName: string | null;
  dealerName: string | null;
  vehicle: { make: string; model: string; modelYear: number | null } | null;
  /** The applicant's preferred language is the best default we have for the guarantor. */
  locale: string | null | undefined;
};

/** What the guarantor sees when opening the link: first names only, no phone, no QID. */
export function toGuarantorSessionPublicDto(input: GuarantorPublicViewInput): GuarantorSessionPublicDto {
  return {
    status: input.status,
    guarantor_first_name: firstNameOf(input.session.fullName) ?? input.session.fullName,
    applicant_first_name: firstNameOf(input.applicantName),
    dealer_name: input.dealerName ?? null,
    vehicle: input.vehicle
      ? { make: input.vehicle.make, model: input.vehicle.model, model_year: input.vehicle.modelYear ?? null }
      : null,
    consent_codes: [...GUARANTOR_CONSENT_CODES],
    consent_locale: normalizeConsentLocale(input.locale),
    expires_at: input.session.expiresAt.toISOString(),
    kyc_url: input.session.kycInviteUrl ?? null,
  };
}
