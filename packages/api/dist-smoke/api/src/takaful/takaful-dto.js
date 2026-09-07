"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TAKAFUL_COVERAGE_TYPES = exports.TAKAFUL_DECLARATION_VERSION = void 0;
exports.ridersFromJson = ridersFromJson;
exports.toTakafulPolicyDto = toTakafulPolicyDto;
const vault_logic_1 = require("../customers/vault-logic");
exports.TAKAFUL_DECLARATION_VERSION = 'takaful-2026-09-v1';
exports.TAKAFUL_COVERAGE_TYPES = ['comprehensive', 'third_party'];
function ridersFromJson(raw) {
    return Array.isArray(raw)
        ? raw.filter((r) => typeof r === 'string' && r.trim().length > 0).map((r) => r.trim())
        : [];
}
function decimalToNumber(value) {
    if (value === null || value === undefined)
        return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}
function isoDate(value) {
    return value ? value.toISOString().slice(0, 10) : null;
}
function toTakafulPolicyDto(policy, now = new Date()) {
    const coverage = policy.coverageType === 'comprehensive' || policy.coverageType === 'third_party' ? policy.coverageType : null;
    return {
        id: policy.id,
        application_id: policy.applicationId,
        provider: policy.provider || null,
        policy_number: policy.policyNumber ?? null,
        coverage_type: coverage,
        coverage_amount: decimalToNumber(policy.coverageAmount),
        premium_amount: decimalToNumber(policy.premiumAmount),
        issued_at: isoDate(policy.issuedAt),
        effective_from: isoDate(policy.effectiveFrom),
        expires_at: isoDate(policy.expiresAt),
        days_to_expiry: (0, vault_logic_1.daysToExpiry)(policy.expiresAt, now),
        riders: ridersFromJson(policy.riders),
        status: policy.status,
        declaration_accepted_at: policy.declarationAcceptedAt?.toISOString() ?? null,
        declaration_version: policy.declarationVersion ?? null,
        has_document: Boolean(policy.documentPath),
        verified_at: policy.verifiedAt?.toISOString() ?? null,
        created_at: policy.createdAt.toISOString(),
    };
}
//# sourceMappingURL=takaful-dto.js.map