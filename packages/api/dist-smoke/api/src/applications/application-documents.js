"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.REQUIRED_APPLICATION_DOC_CATEGORIES = exports.APPLICATION_DOC_CATEGORIES = void 0;
exports.hasQidRequirement = hasQidRequirement;
exports.missingRequiredDocumentCategories = missingRequiredDocumentCategories;
exports.hasAllRequiredDocuments = hasAllRequiredDocuments;
exports.documentProfileFromSnapshot = documentProfileFromSnapshot;
exports.uploadedDocumentCategories = uploadedDocumentCategories;
exports.missingDocumentsForApplication = missingDocumentsForApplication;
exports.hasAllDocumentsForApplication = hasAllDocumentsForApplication;
exports.applicationDocumentSlots = applicationDocumentSlots;
exports.newestUploadByCategory = newestUploadByCategory;
exports.isSlotStale = isSlotStale;
exports.staleDocumentCategories = staleDocumentCategories;
exports.documentSlotsForApplication = documentSlotsForApplication;
const domain_rules_1 = require("@drivemarket/shared/domain-rules");
const customer_snapshot_1 = require("./customer-snapshot");
exports.APPLICATION_DOC_CATEGORIES = [
    'qid',
    'id',
    'passport',
    'license',
    'salary',
    'bank',
    'other',
    'cr',
    'computer_card',
    'rental_agreement',
    'signatory_id',
    'credit_bureau',
    'residence_proof',
    'employment_contract',
    'trade_license',
    'audited_financials',
    'tax_card',
    'business_bank',
    'guarantor_qid',
    'guarantor_salary',
    'guarantor_bank',
    'vehicle_quotation',
    'takaful_policy',
];
exports.REQUIRED_APPLICATION_DOC_CATEGORIES = ['qid', 'salary', 'bank'];
function isVerifiedKycSlot(doc, type) {
    return doc.kycDocumentType === type && doc.verificationStatus === 'verified';
}
function isManualIdentityUpload(doc) {
    return (doc.category === 'qid' || doc.category === 'id') && !doc.kycDocumentType;
}
function manualIdentityAccepted(doc, policy) {
    if (!policy.ekycRequired)
        return true;
    if (policy.allowStaffManualIdentity === false)
        return false;
    return !!doc.uploadedByRole && doc.uploadedByRole !== 'customer';
}
function hasQidRequirement(documents, policy = {}) {
    if (documents.some((d) => isManualIdentityUpload(d) && manualIdentityAccepted(d, policy)))
        return true;
    const hasFront = documents.some((d) => isVerifiedKycSlot(d, 'qid_front'));
    const hasBack = documents.some((d) => isVerifiedKycSlot(d, 'qid_back'));
    if (hasFront && hasBack)
        return true;
    if (hasFront && !documents.some((d) => d.kycDocumentType === 'qid_back'))
        return true;
    return false;
}
function missingRequiredDocumentCategories(documents, policy = {}) {
    const present = new Set(documents.map((d) => d.category));
    present.delete('qid');
    present.delete('id');
    if (hasQidRequirement(documents, policy)) {
        present.add('qid');
    }
    return exports.REQUIRED_APPLICATION_DOC_CATEGORIES.filter((c) => !present.has(c));
}
function hasAllRequiredDocuments(documents, policy = {}) {
    return missingRequiredDocumentCategories(documents, policy).length === 0;
}
const CORPORATE_DOCUMENT_SLOTS = [
    { category: 'qid', required: true, group: 'identity', labelKey: 'applyFlow.docs.qid' },
    { category: 'signatory_id', required: false, group: 'identity', labelKey: 'ops.wizard.doc.signatory_id' },
    { category: 'salary', required: true, group: 'income', labelKey: 'applyFlow.docs.salary', maxAgeDays: 30 },
    { category: 'bank', required: true, group: 'income', labelKey: 'applyFlow.docs.bank', maxAgeDays: 30 },
    { category: 'cr', required: false, group: 'business', labelKey: 'applyFlow.docs.cr' },
    { category: 'computer_card', required: false, group: 'business', labelKey: 'ops.wizard.doc.computer_card' },
    { category: 'rental_agreement', required: false, group: 'business', labelKey: 'ops.wizard.doc.rental_agreement' },
    { category: 'vehicle_quotation', required: false, group: 'supporting', labelKey: 'applyFlow.docs.vehicleQuotation' },
    { category: 'other', required: false, group: 'supporting', labelKey: 'applyFlow.docs.other' },
];
function documentProfileFromSnapshot(snapshotRaw) {
    const snapshot = (0, customer_snapshot_1.readCustomerSnapshot)(snapshotRaw);
    return {
        residency: (0, customer_snapshot_1.residencyOf)(snapshot),
        employmentType: (0, customer_snapshot_1.employmentTypeOf)(snapshot),
        hasGuarantor: (0, customer_snapshot_1.hasGuarantorOf)(snapshot),
        applicantType: snapshot.applicantType,
    };
}
function uploadedDocumentCategories(documents, policy = {}) {
    const present = new Set(documents.map((d) => d.category));
    present.delete('qid');
    present.delete('id');
    if (hasQidRequirement(documents, policy))
        present.add('qid');
    return [...present].sort();
}
function missingDocumentsForApplication(snapshotRaw, documents, policy = {}) {
    const profile = documentProfileFromSnapshot(snapshotRaw);
    if (profile.applicantType === 'corporate') {
        return [...missingRequiredDocumentCategories(documents, policy)];
    }
    return [...(0, domain_rules_1.missingDocumentCategories)(profile, uploadedDocumentCategories(documents, policy))];
}
function hasAllDocumentsForApplication(snapshotRaw, documents, policy = {}) {
    return missingDocumentsForApplication(snapshotRaw, documents, policy).length === 0;
}
function applicationDocumentSlots(snapshotRaw) {
    const profile = documentProfileFromSnapshot(snapshotRaw);
    return profile.applicantType === 'corporate'
        ? CORPORATE_DOCUMENT_SLOTS.map((slot) => ({ ...slot }))
        : (0, domain_rules_1.documentSlotsFor)(profile).map((slot) => ({ ...slot }));
}
const DAY_MS = 86_400_000;
function uploadTimeOf(doc) {
    if (!doc.createdAt)
        return null;
    const time = doc.createdAt instanceof Date ? doc.createdAt.getTime() : new Date(doc.createdAt).getTime();
    return Number.isFinite(time) ? time : null;
}
function newestUploadByCategory(documents) {
    const newest = new Map();
    const note = (category, time) => {
        const current = newest.get(category);
        if (current == null || time > current)
            newest.set(category, time);
    };
    for (const doc of documents) {
        const time = uploadTimeOf(doc);
        if (time == null)
            continue;
        note(doc.category, time);
        if (doc.category === 'id')
            note('qid', time);
    }
    return newest;
}
function isSlotStale(slot, newestUploadMs, now = new Date()) {
    if (!slot.maxAgeDays || newestUploadMs == null)
        return false;
    return now.getTime() - newestUploadMs > slot.maxAgeDays * DAY_MS;
}
function staleDocumentCategories(snapshotRaw, documents, now = new Date()) {
    const newest = newestUploadByCategory(documents);
    return applicationDocumentSlots(snapshotRaw)
        .filter((slot) => isSlotStale(slot, newest.get(slot.category), now))
        .map((slot) => slot.category);
}
function documentSlotsForApplication(snapshotRaw, documents, now = new Date(), policy = {}) {
    const newest = newestUploadByCategory(documents);
    const slots = applicationDocumentSlots(snapshotRaw).map((slot) => {
        const uploadedAt = newest.get(slot.category);
        return { ...slot, uploaded_at: uploadedAt == null ? null : new Date(uploadedAt).toISOString() };
    });
    return {
        slots,
        uploaded: uploadedDocumentCategories(documents, policy),
        missing: missingDocumentsForApplication(snapshotRaw, documents, policy),
        stale: slots.filter((slot) => isSlotStale(slot, newest.get(slot.category), now)).map((slot) => slot.category),
    };
}
//# sourceMappingURL=application-documents.js.map