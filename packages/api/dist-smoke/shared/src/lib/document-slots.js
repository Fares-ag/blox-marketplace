"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DOCUMENT_UPLOAD_MAX_BYTES = exports.DOCUMENT_UPLOAD_ACCEPT = exports.DOCUMENT_SLOT_CATEGORIES = void 0;
exports.isSelfEmployed = isSelfEmployed;
exports.documentSlotsFor = documentSlotsFor;
exports.requiredDocumentCategoriesFor = requiredDocumentCategoriesFor;
exports.missingDocumentCategories = missingDocumentCategories;
exports.documentUploadRejection = documentUploadRejection;
exports.DOCUMENT_SLOT_CATEGORIES = [
    'qid',
    'passport',
    'salary',
    'bank',
    'credit_bureau',
    'residence_proof',
    'license',
    'employment_contract',
    'cr',
    'trade_license',
    'business_bank',
    'audited_financials',
    'tax_card',
    'guarantor_qid',
    'guarantor_salary',
    'guarantor_bank',
    'vehicle_quotation',
    'other',
];
const SALARY_CERT_MAX_AGE_DAYS = 30;
const BANK_STATEMENT_MAX_AGE_DAYS = 30;
function isSelfEmployed(employmentType) {
    return (employmentType ?? '').trim() === 'self-employed';
}
function documentSlotsFor(profile) {
    const selfEmployed = isSelfEmployed(profile.employmentType);
    const expat = profile.residency === 'expat';
    const slots = [];
    slots.push({ category: 'qid', required: true, group: 'identity', labelKey: 'applyFlow.docs.qid' });
    slots.push({ category: 'passport', required: expat, group: 'identity', labelKey: 'applyFlow.docs.passport' });
    slots.push({ category: 'license', required: false, group: 'identity', labelKey: 'applyFlow.docs.license' });
    slots.push({ category: 'residence_proof', required: false, group: 'identity', labelKey: 'applyFlow.docs.residenceProof' });
    if (selfEmployed) {
        slots.push({ category: 'cr', required: true, group: 'business', labelKey: 'applyFlow.docs.cr' });
        slots.push({ category: 'trade_license', required: true, group: 'business', labelKey: 'applyFlow.docs.tradeLicense' });
        slots.push({
            category: 'business_bank',
            required: true,
            group: 'business',
            labelKey: 'applyFlow.docs.businessBank',
            maxAgeDays: BANK_STATEMENT_MAX_AGE_DAYS,
        });
        slots.push({
            category: 'bank',
            required: true,
            group: 'income',
            labelKey: 'applyFlow.docs.personalBank',
            maxAgeDays: BANK_STATEMENT_MAX_AGE_DAYS,
        });
        slots.push({ category: 'audited_financials', required: false, group: 'business', labelKey: 'applyFlow.docs.auditedFinancials' });
        slots.push({ category: 'tax_card', required: false, group: 'business', labelKey: 'applyFlow.docs.taxCard' });
    }
    else {
        slots.push({
            category: 'salary',
            required: true,
            group: 'income',
            labelKey: 'applyFlow.docs.salary',
            maxAgeDays: SALARY_CERT_MAX_AGE_DAYS,
        });
        slots.push({
            category: 'bank',
            required: true,
            group: 'income',
            labelKey: 'applyFlow.docs.bank',
            maxAgeDays: BANK_STATEMENT_MAX_AGE_DAYS,
        });
        slots.push({ category: 'employment_contract', required: false, group: 'income', labelKey: 'applyFlow.docs.employmentContract' });
    }
    slots.push({ category: 'credit_bureau', required: false, group: 'income', labelKey: 'applyFlow.docs.creditBureau' });
    if (profile.hasGuarantor) {
        slots.push({ category: 'guarantor_qid', required: true, group: 'guarantor', labelKey: 'applyFlow.docs.guarantorQid' });
        slots.push({
            category: 'guarantor_salary',
            required: true,
            group: 'guarantor',
            labelKey: 'applyFlow.docs.guarantorSalary',
            maxAgeDays: SALARY_CERT_MAX_AGE_DAYS,
        });
        slots.push({ category: 'guarantor_bank', required: false, group: 'guarantor', labelKey: 'applyFlow.docs.guarantorBank' });
    }
    slots.push({ category: 'vehicle_quotation', required: false, group: 'supporting', labelKey: 'applyFlow.docs.vehicleQuotation' });
    slots.push({ category: 'other', required: false, group: 'supporting', labelKey: 'applyFlow.docs.other' });
    return slots;
}
function requiredDocumentCategoriesFor(profile) {
    return documentSlotsFor(profile)
        .filter((s) => s.required)
        .map((s) => s.category);
}
function missingDocumentCategories(profile, uploadedCategories) {
    const present = new Set(uploadedCategories);
    if (present.has('id'))
        present.add('qid');
    return requiredDocumentCategoriesFor(profile).filter((c) => !present.has(c));
}
exports.DOCUMENT_UPLOAD_ACCEPT = '.pdf,image/jpeg,image/png';
exports.DOCUMENT_UPLOAD_MAX_BYTES = 5 * 1024 * 1024;
const DOCUMENT_UPLOAD_MIME = new Set(['application/pdf', 'image/jpeg', 'image/png']);
function documentUploadRejection(file) {
    if (!DOCUMENT_UPLOAD_MIME.has(file.type)) {
        return { code: 'type', params: { name: file.name, type: file.type || 'unknown' } };
    }
    if (file.size > exports.DOCUMENT_UPLOAD_MAX_BYTES) {
        return { code: 'size', params: { name: file.name, mb: Math.round((file.size / 1024 / 1024) * 10) / 10, limitMb: 5 } };
    }
    return null;
}
//# sourceMappingURL=document-slots.js.map