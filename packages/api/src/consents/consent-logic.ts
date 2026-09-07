import { createHash } from 'node:crypto';
import {
  CONSENT_CATALOG,
  CONSENT_CATALOG_VERSION,
  CONSENT_CODES,
  consentFullText,
  isConsentCode,
  missingConsents,
  type ConsentCodeValue,
} from '@drivemarket/shared/domain-rules';
import type { ConsentRecordDto, ConsentStatusDto } from '../../../shared/src/types/customer-platform';

export type ConsentLocale = 'en' | 'ar';

export function normalizeConsentLocale(raw: string | null | undefined): ConsentLocale {
  return raw === 'ar' ? 'ar' : 'en';
}

/** SHA-256 of the exact catalog text the customer accepted (title + summary + body in their locale). */
export function consentTextHash(code: ConsentCodeValue, locale: ConsentLocale): string {
  return createHash('sha256').update(consentFullText(CONSENT_CATALOG[code], locale), 'utf8').digest('hex');
}

/** `x-blox-channel: mobile` marks acceptances captured in the native app; everything else is web. */
export function consentChannelFromHeader(header: string | string[] | undefined): 'web' | 'mobile' {
  const value = Array.isArray(header) ? header[0] : header;
  return value?.trim().toLowerCase() === 'mobile' ? 'mobile' : 'web';
}

export type ConsentAcceptanceInput = { code: string; version: string };

export type AcceptanceValidation =
  | { ok: true; accepted: { code: ConsentCodeValue; version: string }[] }
  | { ok: false; error: 'consent_code_invalid' | 'consent_version_outdated'; code: string };

/**
 * Unknown codes are rejected and a version other than the catalog's current one
 * is outdated (the customer saw old wording). Repeated codes collapse to one.
 */
export function validateAcceptances(acceptances: ConsentAcceptanceInput[]): AcceptanceValidation {
  const seen = new Map<ConsentCodeValue, string>();
  for (const acceptance of acceptances) {
    const code = String(acceptance.code ?? '').trim();
    if (!isConsentCode(code)) return { ok: false, error: 'consent_code_invalid', code };
    const current = CONSENT_CATALOG[code].version;
    if (String(acceptance.version ?? '').trim() !== current) {
      return { ok: false, error: 'consent_version_outdated', code };
    }
    seen.set(code, current);
  }
  return { ok: true, accepted: [...seen].map(([code, version]) => ({ code, version })) };
}

export type ConsentRecordLike = {
  id: string;
  code: string;
  version: string;
  locale: string;
  channel: string;
  acceptedAt: Date;
  applicationId: string | null;
  actor?: { name: string | null } | null;
  /** Set when the customer withdrew this acceptance (PDPPL right to withdraw). */
  withdrawnAt?: Date | null;
};

/** True when the catalog carries newer wording than the version this record accepted. */
export function consentOutdated(record: Pick<ConsentRecordLike, 'code' | 'version'>): boolean {
  const def = isConsentCode(record.code) ? CONSENT_CATALOG[record.code] : null;
  return !def || def.version !== record.version;
}

export function toConsentRecordDto(record: ConsentRecordLike): ConsentRecordDto {
  return {
    id: record.id,
    code: record.code as ConsentRecordDto['code'],
    version: record.version,
    locale: normalizeConsentLocale(record.locale),
    channel: record.channel as ConsentRecordDto['channel'],
    accepted_at: record.acceptedAt.toISOString(),
    application_id: record.applicationId ?? null,
    actor_name: record.actor?.name ?? null,
    outdated: consentOutdated(record),
    withdrawn_at: record.withdrawnAt?.toISOString() ?? null,
  };
}

/**
 * Account-level status: every live acceptance the customer ever gave (newest
 * first, so the page can show history) plus what is still missing or
 * outdated. Withdrawn acceptances leave `accepted` — they no longer cover
 * anything — and are listed under `withdrawn` for the customer's history.
 */
export function buildConsentStatus(records: ConsentRecordLike[]): ConsentStatusDto {
  const sorted = [...records].sort((a, b) => b.acceptedAt.getTime() - a.acceptedAt.getTime());
  const live = sorted.filter((r) => !r.withdrawnAt);
  const withdrawn = sorted.filter((r) => Boolean(r.withdrawnAt));
  const missing = missingConsents(live.map((r) => ({ code: r.code, version: r.version })));
  return {
    catalog_version: CONSENT_CATALOG_VERSION,
    required: [...CONSENT_CODES],
    accepted: live.map(toConsentRecordDto),
    missing,
    complete: missing.length === 0,
    withdrawn: withdrawn.map(toConsentRecordDto),
  };
}
