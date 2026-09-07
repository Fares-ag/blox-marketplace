"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OPEN_GUARANTOR_STATUSES = exports.GUARANTOR_STATUS_RANK = exports.GUARANTOR_CONSENT_CODES = exports.GUARANTOR_PROOF_HEADER = void 0;
exports.isGuarantorConsentCode = isGuarantorConsentCode;
exports.isGuarantorSessionOpen = isGuarantorSessionOpen;
exports.effectiveGuarantorStatus = effectiveGuarantorStatus;
exports.advanceGuarantorStatus = advanceGuarantorStatus;
exports.guarantorFromSnapshot = guarantorFromSnapshot;
exports.firstNameOf = firstNameOf;
exports.validateGuarantorAcceptances = validateGuarantorAcceptances;
exports.buildGuarantorAcceptances = buildGuarantorAcceptances;
exports.acceptedGuarantorCodes = acceptedGuarantorCodes;
exports.guarantorSmsBody = guarantorSmsBody;
exports.toGuarantorSessionDto = toGuarantorSessionDto;
exports.toGuarantorSessionPublicDto = toGuarantorSessionPublicDto;
const domain_rules_1 = require("@drivemarket/shared/domain-rules");
const consent_logic_1 = require("../consents/consent-logic");
exports.GUARANTOR_PROOF_HEADER = 'x-assist-proof';
exports.GUARANTOR_CONSENT_CODES = ['credit_bureau', 'terms', 'aml'];
function isGuarantorConsentCode(value) {
    return typeof value === 'string' && exports.GUARANTOR_CONSENT_CODES.includes(value);
}
exports.GUARANTOR_STATUS_RANK = {
    pending: 0,
    otp_verified: 1,
    consents_done: 2,
    completed: 3,
    expired: -1,
    cancelled: -1,
};
exports.OPEN_GUARANTOR_STATUSES = ['pending', 'otp_verified', 'consents_done'];
function isGuarantorSessionOpen(status) {
    return exports.OPEN_GUARANTOR_STATUSES.includes(status);
}
function effectiveGuarantorStatus(session, now = new Date()) {
    if (isGuarantorSessionOpen(session.status) && session.expiresAt.getTime() <= now.getTime())
        return 'expired';
    return session.status;
}
function advanceGuarantorStatus(current, next) {
    if (!isGuarantorSessionOpen(current))
        return current;
    return exports.GUARANTOR_STATUS_RANK[next] > exports.GUARANTOR_STATUS_RANK[current] ? next : current;
}
function cleanString(value) {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
}
function numberOrNull(value) {
    if (typeof value === 'number')
        return Number.isFinite(value) ? value : null;
    if (typeof value === 'string' && value.trim()) {
        const n = Number(value);
        return Number.isFinite(n) ? n : null;
    }
    return null;
}
function guarantorFromSnapshot(snapshot) {
    if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot))
        return null;
    const snap = snapshot;
    if (snap.hasGuarantor === false)
        return null;
    const raw = snap.guarantor;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw))
        return null;
    const g = raw;
    const fullName = cleanString(g.fullName ?? g.full_name ?? g.name);
    const phone = cleanString(g.phone);
    if (!fullName || !phone)
        return null;
    return {
        fullName,
        phone,
        qid: cleanString(g.qid),
        email: cleanString(g.email)?.toLowerCase() ?? null,
        relationship: cleanString(g.relationship),
        monthlyIncome: numberOrNull(g.monthlyIncome ?? g.monthly_income),
    };
}
function firstNameOf(fullName) {
    const first = String(fullName ?? '').trim().split(/\s+/)[0];
    return first || null;
}
function validateGuarantorAcceptances(acceptances) {
    const seen = new Map();
    for (const acceptance of acceptances) {
        const code = String(acceptance.code ?? '').trim();
        if (!(0, domain_rules_1.isConsentCode)(code) || !isGuarantorConsentCode(code)) {
            return { ok: false, error: 'consent_code_invalid', code };
        }
        const current = domain_rules_1.CONSENT_CATALOG[code].version;
        if (String(acceptance.version ?? '').trim() !== current) {
            return { ok: false, error: 'consent_version_outdated', code };
        }
        seen.set(code, current);
    }
    const missing = exports.GUARANTOR_CONSENT_CODES.filter((code) => !seen.has(code));
    if (missing.length)
        return { ok: false, error: 'guarantor_consents_incomplete', missing };
    return { ok: true, accepted: [...seen].map(([code, version]) => ({ code, version })) };
}
function buildGuarantorAcceptances(accepted, locale, now = new Date()) {
    const normalized = (0, consent_logic_1.normalizeConsentLocale)(locale);
    const acceptedAt = now.toISOString();
    return accepted.map(({ code, version }) => ({
        code,
        version,
        textHash: (0, consent_logic_1.consentTextHash)(code, normalized),
        locale: normalized,
        acceptedAt,
    }));
}
function acceptedGuarantorCodes(raw) {
    if (!Array.isArray(raw))
        return [];
    const codes = new Set();
    for (const row of raw) {
        if (row && typeof row === 'object' && !Array.isArray(row)) {
            const code = row.code;
            if (isGuarantorConsentCode(code))
                codes.add(code);
        }
    }
    return exports.GUARANTOR_CONSENT_CODES.filter((code) => codes.has(code));
}
function guarantorSmsBody(kind, input) {
    const applicant = firstNameOf(input.applicantName) ?? 'An applicant';
    if (kind === 'link') {
        return (`${applicant} named you as guarantor on their Blox vehicle financing application. ` +
            `Open ${input.link} and enter code ${input.code} (valid 5 minutes) to review and accept the guarantor consents. ` +
            'Do not share this code.');
    }
    return `Your Blox guarantor verification code is ${input.code} (valid 5 minutes). Continue here: ${input.link}`;
}
function toGuarantorSessionDto(session, link, now = new Date()) {
    return {
        id: session.id,
        application_id: session.applicationId,
        status: effectiveGuarantorStatus(session, now),
        guarantor_name: session.fullName,
        phone_masked: (0, domain_rules_1.maskPhone)(session.phone),
        relationship: session.relationship ?? null,
        consents_completed_at: session.consentsCompletedAt?.toISOString() ?? null,
        kyc_status: session.kycStatus ?? null,
        expires_at: session.expiresAt.toISOString(),
        last_opened_at: session.lastOpenedAt?.toISOString() ?? null,
        ...(link ? { link } : {}),
        created_at: session.createdAt.toISOString(),
    };
}
function toGuarantorSessionPublicDto(input) {
    return {
        status: input.status,
        guarantor_first_name: firstNameOf(input.session.fullName) ?? input.session.fullName,
        applicant_first_name: firstNameOf(input.applicantName),
        dealer_name: input.dealerName ?? null,
        vehicle: input.vehicle
            ? { make: input.vehicle.make, model: input.vehicle.model, model_year: input.vehicle.modelYear ?? null }
            : null,
        consent_codes: [...exports.GUARANTOR_CONSENT_CODES],
        consent_locale: (0, consent_logic_1.normalizeConsentLocale)(input.locale),
        expires_at: input.session.expiresAt.toISOString(),
        kyc_url: input.session.kycInviteUrl ?? null,
    };
}
//# sourceMappingURL=guarantor-logic.js.map