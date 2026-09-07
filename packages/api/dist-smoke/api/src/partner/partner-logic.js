"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PARTNER_DOCUMENT_CATEGORIES = exports.PARTNER_VISIBLE_STATUSES = void 0;
exports.isPartnerVisibleStatus = isPartnerVisibleStatus;
exports.isPartnerVisibleDocument = isPartnerVisibleDocument;
exports.partnerApplicationWhere = partnerApplicationWhere;
exports.financingFromPricing = financingFromPricing;
exports.customerFromSnapshot = customerFromSnapshot;
exports.normalizeAffordability = normalizeAffordability;
exports.approverFor = approverFor;
exports.creditAssessmentForRole = creditAssessmentForRole;
exports.toPartnerApplicationDto = toPartnerApplicationDto;
exports.partnerSummary = partnerSummary;
const client_1 = require("@prisma/client");
const domain_rules_1 = require("@drivemarket/shared/domain-rules");
exports.PARTNER_VISIBLE_STATUSES = Object.values(client_1.ApplicationStatus).filter((status) => status !== client_1.ApplicationStatus.draft);
exports.PARTNER_DOCUMENT_CATEGORIES = [
    client_1.DocumentCategory.qid,
    client_1.DocumentCategory.id,
    client_1.DocumentCategory.passport,
    client_1.DocumentCategory.salary,
    client_1.DocumentCategory.bank,
    client_1.DocumentCategory.credit_bureau,
    client_1.DocumentCategory.residence_proof,
    client_1.DocumentCategory.employment_contract,
    client_1.DocumentCategory.trade_license,
    client_1.DocumentCategory.audited_financials,
    client_1.DocumentCategory.tax_card,
    client_1.DocumentCategory.business_bank,
    client_1.DocumentCategory.guarantor_qid,
    client_1.DocumentCategory.guarantor_salary,
    client_1.DocumentCategory.guarantor_bank,
    client_1.DocumentCategory.cr,
    client_1.DocumentCategory.computer_card,
    client_1.DocumentCategory.signatory_id,
];
function isPartnerVisibleStatus(status) {
    return exports.PARTNER_VISIBLE_STATUSES.includes(status);
}
function isPartnerVisibleDocument(category) {
    return exports.PARTNER_DOCUMENT_CATEGORIES.includes(category);
}
function partnerApplicationWhere(financePartnerId, status) {
    if (status) {
        return { financePartnerId, status: isPartnerVisibleStatus(status) ? status : { in: [] } };
    }
    return { financePartnerId, status: { in: exports.PARTNER_VISIBLE_STATUSES } };
}
function asRecord(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}
function numberOrNull(value) {
    if (value === null || value === undefined || value === '')
        return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}
function stringOrNull(value) {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
}
function roundMoney(value) {
    return Math.round(value * 100) / 100;
}
function financingFromPricing(pricing) {
    const p = asRecord(pricing) ?? {};
    const price = numberOrNull(p.selling_price ?? p.list_price);
    const down = numberOrNull(p.down_payment);
    const financed = numberOrNull(p.financed_amount) ?? (price !== null && down !== null ? roundMoney(Math.max(price - down, 0)) : null);
    return {
        financed_amount: financed,
        tenure_months: numberOrNull(p.tenor ?? p.tenure),
        monthly: numberOrNull(p.monthly),
        down_payment_pct: numberOrNull(p.down_payment_pct),
    };
}
function customerFromSnapshot(snapshot, fallbackName) {
    const snap = asRecord(snapshot) ?? {};
    const composed = [stringOrNull(snap.firstName), stringOrNull(snap.lastName)].filter(Boolean).join(' ');
    const qid = stringOrNull(snap.qid);
    const parsed = qid ? (0, domain_rules_1.parseQid)(qid) : null;
    const residencyRaw = snap.residency;
    const residency = residencyRaw === 'qatari' || residencyRaw === 'expat' ? residencyRaw : parsed?.valid ? parsed.residency : null;
    return {
        name: stringOrNull(snap.full_name) ?? (composed || null) ?? fallbackName,
        qid_masked: qid ? (0, domain_rules_1.maskQid)(qid) || null : null,
        nationality: stringOrNull(snap.nationality) ?? (parsed?.valid && parsed.nationality ? parsed.nationality.en : null),
        residency,
    };
}
const AFFORDABILITY_STATUSES = [
    'within_cap',
    'exception_tier_1',
    'exception_tier_2',
    'exception_tier_3',
    'above_hard_cap',
];
const APPROVAL_AUTHORITIES = ['senior_manager', 'head_of_credit', 'above_matrix'];
function tierFromStatus(status) {
    switch (status) {
        case 'exception_tier_1':
            return 1;
        case 'exception_tier_2':
            return 2;
        case 'exception_tier_3':
        case 'above_hard_cap':
            return 3;
        default:
            return 0;
    }
}
function normalizeAffordability(raw) {
    const a = asRecord(raw);
    if (!a)
        return null;
    const dbr = numberOrNull(a.dbr);
    const cap = numberOrNull(a.cap);
    const hardCap = numberOrNull(a.hard_cap ?? a.hardCap);
    const status = a.status;
    if (dbr === null || cap === null || hardCap === null)
        return null;
    const safeStatus = AFFORDABILITY_STATUSES.includes(status)
        ? status
        : dbr > hardCap
            ? 'above_hard_cap'
            : dbr > cap
                ? 'exception_tier_1'
                : 'within_cap';
    const tierRaw = numberOrNull(a.exception_tier ?? a.exceptionTier);
    const tier = (tierRaw !== null && [0, 1, 2, 3].includes(tierRaw) ? tierRaw : tierFromStatus(safeStatus));
    const stressed = asRecord(a.stressed);
    return {
        dbr,
        cap,
        hard_cap: hardCap,
        status: safeStatus,
        exception_tier: tier,
        max_installment_within_cap: numberOrNull(a.max_installment_within_cap ?? a.maxInstallmentWithinCap) ?? 0,
        headroom: numberOrNull(a.headroom) ?? 0,
        stressed: stressed
            ? {
                dbr: numberOrNull(stressed.dbr) ?? 0,
                within_limit: Boolean(stressed.within_limit ?? stressed.withinLimit),
            }
            : null,
    };
}
function approverFor(role, authority) {
    return {
        role_may_approve: (0, domain_rules_1.roleMayApprove)(role, authority),
        required_roles: [...domain_rules_1.APPROVAL_AUTHORITY_ROLES[authority]],
        max_tier_for_role: domain_rules_1.MAX_EXCEPTION_TIER_BY_ROLE[role] ?? 0,
    };
}
function creditAssessmentForRole(raw, role) {
    const r = asRecord(raw);
    if (!r)
        return null;
    const authorityRaw = r.approval_authority ?? r.approvalAuthority;
    const authority = APPROVAL_AUTHORITIES.includes(authorityRaw)
        ? authorityRaw
        : null;
    if (!authority)
        return null;
    const pathRaw = r.path;
    const path = pathRaw === 'approve' || pathRaw === 'refer' || pathRaw === 'decline' ? pathRaw : 'refer';
    const reasons = Array.isArray(r.reasons) ? r.reasons.filter((x) => typeof x === 'string') : [];
    const flagsRaw = r.rule_flags ?? r.ruleFlags;
    const rule_flags = Array.isArray(flagsRaw)
        ? flagsRaw
            .map((f) => asRecord(f))
            .filter((f) => !!f && typeof f.code === 'string' && !!f.code)
            .map((f) => ({
            code: String(f.code),
            severity: f.severity === 'hard' ? 'hard' : 'soft',
            params: asRecord(f.params) ?? {},
        }))
        : [];
    const assessedAt = stringOrNull(r.assessed_at ?? r.assessedAt);
    return {
        affordability: normalizeAffordability(r.affordability),
        affordability_with_guarantor: normalizeAffordability(r.affordability_with_guarantor ?? r.affordabilityWithGuarantor),
        approval_authority: authority,
        path,
        reasons,
        rule_flags,
        assessed_at: assessedAt ?? new Date(0).toISOString(),
        financed_amount: numberOrNull(r.financed_amount ?? r.financedAmount) ?? 0,
        monthly_installment: numberOrNull(r.monthly_installment ?? r.monthlyInstallment) ?? 0,
        approver: approverFor(role, authority),
    };
}
function toPartnerApplicationDto(row, role = 'partner_viewer') {
    return {
        id: row.id,
        status: row.status,
        submitted_at: row.submittedAt?.toISOString() ?? null,
        updated_at: row.updatedAt.toISOString(),
        company_name: row.company.name,
        branch_name: row.branch?.name ?? null,
        vehicle: {
            make: row.product.make,
            model: row.product.model,
            model_year: row.product.modelYear,
            price: numberOrNull(row.product.price),
        },
        customer: customerFromSnapshot(row.customerSnapshot, row.customer.name),
        financing: financingFromPricing(row.pricingSnapshot),
        credit_assessment: creditAssessmentForRole(row.creditAssessment, role),
        consents_completed_at: row.consentsCompletedAt?.toISOString() ?? null,
        documents: row.documents
            .filter((doc) => isPartnerVisibleDocument(doc.category))
            .map((doc) => ({
            id: doc.id,
            category: doc.category,
            original_name: doc.originalName ?? null,
            created_at: doc.createdAt.toISOString(),
        })),
    };
}
function partnerSummary(groups) {
    const by_status = {};
    for (const status of exports.PARTNER_VISIBLE_STATUSES)
        by_status[status] = 0;
    let total = 0;
    for (const group of groups) {
        if (!isPartnerVisibleStatus(group.status))
            continue;
        by_status[group.status] = (by_status[group.status] ?? 0) + group.count;
        total += group.count;
    }
    return { total, by_status };
}
//# sourceMappingURL=partner-logic.js.map