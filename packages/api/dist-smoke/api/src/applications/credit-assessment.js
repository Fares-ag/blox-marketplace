"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.financedAmountOf = financedAmountOf;
exports.monthlyInstallmentOf = monthlyInstallmentOf;
exports.monthlyIncomeOf = monthlyIncomeOf;
exports.monthlyLiabilitiesOf = monthlyLiabilitiesOf;
exports.guarantorMonthlyIncomeOf = guarantorMonthlyIncomeOf;
exports.ruleViolationsOf = ruleViolationsOf;
exports.creditAssessmentInputFor = creditAssessmentInputFor;
exports.assessApplicationCredit = assessApplicationCredit;
exports.toAffordabilityDto = toAffordabilityDto;
exports.approverFor = approverFor;
exports.toCreditAssessmentDto = toCreditAssessmentDto;
exports.creditAssessmentColumns = creditAssessmentColumns;
exports.creditAssessmentData = creditAssessmentData;
exports.creditAssessedLogMetadata = creditAssessedLogMetadata;
const domain_rules_1 = require("@drivemarket/shared/domain-rules");
const application_rules_1 = require("./application-rules");
const customer_snapshot_1 = require("./customer-snapshot");
function isRecord(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}
function num(value) {
    if (value == null || value === '')
        return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}
function pricingOf(raw) {
    return isRecord(raw) ? raw : {};
}
function financedAmountOf(pricingRaw) {
    const pricing = pricingOf(pricingRaw);
    const explicit = num(pricing.financed_amount ?? pricing.financedAmount ?? pricing.loan_amount);
    if (explicit != null && explicit > 0)
        return explicit;
    const price = num(pricing.selling_price ?? pricing.list_price) ?? 0;
    const down = num(pricing.down_payment) ?? 0;
    return Math.max(0, Math.round((price - down) * 100) / 100);
}
function monthlyInstallmentOf(pricingRaw) {
    const pricing = pricingOf(pricingRaw);
    return num(pricing.monthly ?? pricing.monthly_payment) ?? 0;
}
function monthlyIncomeOf(snapshotRaw) {
    const snapshot = (0, customer_snapshot_1.readCustomerSnapshot)(snapshotRaw);
    const employment = isRecord(snapshot.employment) ? snapshot.employment : null;
    for (const candidate of [snapshot.monthlyIncome, snapshot.income, employment?.salary]) {
        const n = num(candidate);
        if (n != null && n > 0)
            return n;
    }
    return null;
}
function monthlyLiabilitiesOf(snapshotRaw) {
    const snapshot = (0, customer_snapshot_1.readCustomerSnapshot)(snapshotRaw);
    return Math.max(0, num(snapshot.monthlyLiabilities) ?? 0);
}
function guarantorMonthlyIncomeOf(snapshotRaw) {
    const snapshot = (0, customer_snapshot_1.readCustomerSnapshot)(snapshotRaw);
    if (!(0, customer_snapshot_1.hasGuarantorOf)(snapshot) || !isRecord(snapshot.guarantor))
        return null;
    const n = num(snapshot.guarantor.monthlyIncome);
    return n != null && n > 0 ? n : null;
}
function ruleViolationsOf(pricingRaw) {
    return (0, application_rules_1.ruleFlagsOf)(pricingRaw).map((flag) => ({
        code: flag.code,
        severity: 'soft',
        params: { ...flag.params },
    }));
}
function creditAssessmentInputFor(source) {
    const financedAmount = financedAmountOf(source.pricingSnapshot);
    const monthlyInstallment = monthlyInstallmentOf(source.pricingSnapshot);
    const snapshot = (0, customer_snapshot_1.readCustomerSnapshot)(source.customerSnapshot);
    const income = monthlyIncomeOf(snapshot);
    const residency = (0, customer_snapshot_1.residencyOf)(snapshot);
    const affordability = income != null && residency
        ? {
            monthlyIncome: income,
            monthlyLiabilities: monthlyLiabilitiesOf(snapshot),
            proposedInstallment: monthlyInstallment,
            residency,
            employerCategory: (0, domain_rules_1.employerCategoryFromEmploymentType)((0, customer_snapshot_1.employmentTypeOf)(snapshot)),
            financedAmount,
        }
        : null;
    return {
        input: {
            affordability,
            financedAmount,
            vehicleCategory: source.product ? (0, application_rules_1.vehicleCategoryFor)(source.product) : 'car',
            ruleFlags: ruleViolationsOf(source.pricingSnapshot),
            guarantorMonthlyIncome: guarantorMonthlyIncomeOf(snapshot),
        },
        financedAmount,
        monthlyInstallment,
    };
}
function assessApplicationCredit(source, now = new Date()) {
    const { input, financedAmount, monthlyInstallment } = creditAssessmentInputFor(source);
    return { assessment: (0, domain_rules_1.assessCredit)(input, now), financedAmount, monthlyInstallment };
}
function toAffordabilityDto(result) {
    if (!result)
        return null;
    return {
        dbr: Number.isFinite(result.dbr) ? result.dbr : 99,
        cap: result.cap,
        hard_cap: result.hardCap,
        status: result.status,
        exception_tier: result.exceptionTier,
        max_installment_within_cap: result.maxInstallmentWithinCap,
        headroom: result.headroom,
        stressed: result.stressed ? { dbr: result.stressed.dbr, within_limit: result.stressed.withinLimit } : null,
    };
}
function approverFor(role, authority) {
    return {
        role_may_approve: role ? (0, domain_rules_1.roleMayApprove)(role, authority) : false,
        required_roles: [...domain_rules_1.APPROVAL_AUTHORITY_ROLES[authority]],
        max_tier_for_role: role ? (domain_rules_1.MAX_EXCEPTION_TIER_BY_ROLE[role] ?? 0) : 0,
    };
}
function toCreditAssessmentDto(assessed, role) {
    const { assessment } = assessed;
    return {
        affordability: toAffordabilityDto(assessment.affordability),
        affordability_with_guarantor: toAffordabilityDto(assessment.affordabilityWithGuarantor),
        approval_authority: assessment.approvalAuthority,
        path: assessment.path,
        reasons: [...assessment.reasons],
        rule_flags: assessment.ruleFlags.map((flag) => ({
            code: flag.code,
            severity: flag.severity,
            params: { ...flag.params },
        })),
        assessed_at: assessment.assessedAt,
        financed_amount: assessed.financedAmount,
        monthly_installment: assessed.monthlyInstallment,
        approver: approverFor(role, assessment.approvalAuthority),
    };
}
function creditAssessmentColumns(assessed) {
    return {
        creditAssessment: toCreditAssessmentDto(assessed, null),
        approvalAuthority: assessed.assessment.approvalAuthority,
    };
}
function creditAssessmentData(assessed) {
    const columns = creditAssessmentColumns(assessed);
    return {
        creditAssessment: columns.creditAssessment,
        approvalAuthority: columns.approvalAuthority,
    };
}
function creditAssessedLogMetadata(assessed, stage) {
    const effective = assessed.assessment.affordabilityWithGuarantor ?? assessed.assessment.affordability;
    return {
        stage,
        path: assessed.assessment.path,
        authority: assessed.assessment.approvalAuthority,
        reasons: assessed.assessment.reasons,
        financed_amount: assessed.financedAmount,
        monthly_installment: assessed.monthlyInstallment,
        dbr: assessed.assessment.affordability?.dbr ?? null,
        exception_tier: effective?.exceptionTier ?? null,
    };
}
//# sourceMappingURL=credit-assessment.js.map