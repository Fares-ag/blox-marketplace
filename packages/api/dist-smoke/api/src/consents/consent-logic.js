"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeConsentLocale = normalizeConsentLocale;
exports.consentTextHash = consentTextHash;
exports.consentChannelFromHeader = consentChannelFromHeader;
exports.validateAcceptances = validateAcceptances;
exports.consentOutdated = consentOutdated;
exports.toConsentRecordDto = toConsentRecordDto;
exports.buildConsentStatus = buildConsentStatus;
const node_crypto_1 = require("node:crypto");
const domain_rules_1 = require("@drivemarket/shared/domain-rules");
function normalizeConsentLocale(raw) {
    return raw === 'ar' ? 'ar' : 'en';
}
function consentTextHash(code, locale) {
    return (0, node_crypto_1.createHash)('sha256').update((0, domain_rules_1.consentFullText)(domain_rules_1.CONSENT_CATALOG[code], locale), 'utf8').digest('hex');
}
function consentChannelFromHeader(header) {
    const value = Array.isArray(header) ? header[0] : header;
    return value?.trim().toLowerCase() === 'mobile' ? 'mobile' : 'web';
}
function validateAcceptances(acceptances) {
    const seen = new Map();
    for (const acceptance of acceptances) {
        const code = String(acceptance.code ?? '').trim();
        if (!(0, domain_rules_1.isConsentCode)(code))
            return { ok: false, error: 'consent_code_invalid', code };
        const current = domain_rules_1.CONSENT_CATALOG[code].version;
        if (String(acceptance.version ?? '').trim() !== current) {
            return { ok: false, error: 'consent_version_outdated', code };
        }
        seen.set(code, current);
    }
    return { ok: true, accepted: [...seen].map(([code, version]) => ({ code, version })) };
}
function consentOutdated(record) {
    const def = (0, domain_rules_1.isConsentCode)(record.code) ? domain_rules_1.CONSENT_CATALOG[record.code] : null;
    return !def || def.version !== record.version;
}
function toConsentRecordDto(record) {
    return {
        id: record.id,
        code: record.code,
        version: record.version,
        locale: normalizeConsentLocale(record.locale),
        channel: record.channel,
        accepted_at: record.acceptedAt.toISOString(),
        application_id: record.applicationId ?? null,
        actor_name: record.actor?.name ?? null,
        outdated: consentOutdated(record),
        withdrawn_at: record.withdrawnAt?.toISOString() ?? null,
    };
}
function buildConsentStatus(records) {
    const sorted = [...records].sort((a, b) => b.acceptedAt.getTime() - a.acceptedAt.getTime());
    const live = sorted.filter((r) => !r.withdrawnAt);
    const withdrawn = sorted.filter((r) => Boolean(r.withdrawnAt));
    const missing = (0, domain_rules_1.missingConsents)(live.map((r) => ({ code: r.code, version: r.version })));
    return {
        catalog_version: domain_rules_1.CONSENT_CATALOG_VERSION,
        required: [...domain_rules_1.CONSENT_CODES],
        accepted: live.map(toConsentRecordDto),
        missing,
        complete: missing.length === 0,
        withdrawn: withdrawn.map(toConsentRecordDto),
    };
}
//# sourceMappingURL=consent-logic.js.map