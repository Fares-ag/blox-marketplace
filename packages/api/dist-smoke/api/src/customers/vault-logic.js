"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CUSTOMER_DOCUMENT_LABELS = exports.VAULT_EXPIRING_SOON_DAYS = void 0;
exports.startOfUtcDay = startOfUtcDay;
exports.daysBetweenUtc = daysBetweenUtc;
exports.daysToExpiry = daysToExpiry;
exports.expiryState = expiryState;
exports.maskDocumentNumber = maskDocumentNumber;
exports.toCustomerDocumentDto = toCustomerDocumentDto;
exports.VAULT_EXPIRING_SOON_DAYS = 60;
const DAY_MS = 86_400_000;
function startOfUtcDay(now = new Date()) {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}
function daysBetweenUtc(from, to) {
    return Math.round((startOfUtcDay(to).getTime() - startOfUtcDay(from).getTime()) / DAY_MS);
}
function daysToExpiry(expiresAt, now = new Date()) {
    return expiresAt ? daysBetweenUtc(now, expiresAt) : null;
}
function expiryState(days, soonDays = exports.VAULT_EXPIRING_SOON_DAYS) {
    if (days === null)
        return 'none';
    if (days < 0)
        return 'expired';
    if (days <= soonDays)
        return 'expiring_soon';
    return 'valid';
}
function maskDocumentNumber(plain) {
    const value = String(plain ?? '').replace(/\s+/g, '');
    if (!value)
        return null;
    return `XXXX${value.slice(-4)}`;
}
exports.CUSTOMER_DOCUMENT_LABELS = {
    qid_front: 'Qatar ID (front)',
    qid_back: 'Qatar ID (back)',
    passport: 'passport',
    driving_licence: 'driving licence',
    residence_proof: 'proof of residence',
    salary_certificate: 'salary certificate',
    bank_statement: 'bank statement',
    other: 'document',
};
function toCustomerDocumentDto(doc, documentNumber, now = new Date()) {
    const days = daysToExpiry(doc.expiresAt, now);
    return {
        id: doc.id,
        category: doc.category,
        original_name: doc.originalName ?? null,
        mime_type: doc.mimeType ?? 'application/octet-stream',
        size_bytes: doc.sizeBytes ?? 0,
        document_number_masked: maskDocumentNumber(documentNumber),
        issued_at: doc.issuedAt ? doc.issuedAt.toISOString().slice(0, 10) : null,
        expires_at: doc.expiresAt ? doc.expiresAt.toISOString().slice(0, 10) : null,
        days_to_expiry: days,
        expiry_state: expiryState(days),
        verified_at: doc.verifiedAt?.toISOString() ?? null,
        created_at: doc.createdAt.toISOString(),
    };
}
//# sourceMappingURL=vault-logic.js.map