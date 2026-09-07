"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dbrCapFor = dbrCapFor;
exports.assessAffordability = assessAffordability;
exports.maxFinancingForInstallment = maxFinancingForInstallment;
exports.preCheckEligibility = preCheckEligibility;
const pricing_1 = require("./pricing");
const product_rules_1 = require("./product-rules");
function dbrCapFor(residency, employer) {
    return product_rules_1.PRODUCT_RULES.dbr.caps[`${residency}_${employer}`] ?? 0.5;
}
function round4(n) {
    return Math.round(n * 10_000) / 10_000;
}
function assessAffordability(input) {
    const income = Math.max(0, Number(input.monthlyIncome) || 0);
    const liabilities = Math.max(0, Number(input.monthlyLiabilities) || 0);
    const installment = Math.max(0, Number(input.proposedInstallment) || 0);
    const cap = dbrCapFor(input.residency, input.employerCategory);
    const hardCap = product_rules_1.PRODUCT_RULES.dbr.hardCap;
    const dbr = income > 0 ? round4((liabilities + installment) / income) : Number.POSITIVE_INFINITY;
    let status = 'within_cap';
    let exceptionTier = 0;
    if (!Number.isFinite(dbr) || dbr > hardCap) {
        status = 'above_hard_cap';
        exceptionTier = 3;
    }
    else if (dbr > cap) {
        const excess = dbr - cap;
        const tier = product_rules_1.PRODUCT_RULES.dbr.exceptionTiers.find((t) => excess <= t.maxExcess)?.tier ?? 3;
        exceptionTier = tier;
        status = tier === 1 ? 'exception_tier_1' : tier === 2 ? 'exception_tier_2' : 'exception_tier_3';
    }
    const maxInstallmentWithinCap = Math.max(0, Math.round(cap * income - liabilities));
    const headroom = Math.round(cap * income - liabilities - installment);
    const result = { dbr, cap, hardCap, status, exceptionTier, maxInstallmentWithinCap, headroom };
    const financed = Number(input.financedAmount ?? 0);
    if (financed > product_rules_1.PRODUCT_RULES.dbr.stress.highTicketThreshold && income > 0) {
        const stressedInstallment = installment * (1 + product_rules_1.PRODUCT_RULES.dbr.stress.rentalIncrease);
        const stressedIncome = income * (1 - product_rules_1.PRODUCT_RULES.dbr.stress.incomeReduction);
        const stressedDbr = round4((liabilities + stressedInstallment) / stressedIncome);
        result.stressed = { dbr: stressedDbr, withinLimit: stressedDbr <= product_rules_1.PRODUCT_RULES.dbr.stress.maxStressedDbr };
    }
    return result;
}
function maxFinancingForInstallment(maxInstallment, annualRatePercent, tenureMonths) {
    if (maxInstallment <= 0 || tenureMonths <= 0)
        return 0;
    const r = annualRatePercent / 100 / 12;
    if (r <= 0)
        return Math.floor(maxInstallment * tenureMonths);
    const pv = (maxInstallment * (1 - Math.pow(1 + r, -tenureMonths))) / r;
    return Math.floor(pv);
}
function ageAtDate(dob, at) {
    let age = at.getFullYear() - dob.getFullYear();
    const m = at.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && at.getDate() < dob.getDate()))
        age -= 1;
    return age;
}
function preCheckEligibility(input) {
    const now = input.now ?? new Date();
    const checks = [];
    const price = Number(input.financing.vehicle.price) || 0;
    const downPct = Math.min(Math.max(Number(input.financing.downPaymentPct) || 0, 0), 100);
    const financedAmount = Math.max(0, price - (price * downPct) / 100);
    const tenure = Number(input.financing.tenureMonths) || 0;
    const installment = input.proposedInstallment != null && input.proposedInstallment > 0
        ? Number(input.proposedInstallment)
        : financedAmount > 0 && tenure > 0
            ? (0, pricing_1.computeExactMonthlyPayment)({
                price,
                downPayment: price - financedAmount,
                annualRatePercent: input.annualRatePercent,
                tenureMonths: tenure,
            })
            : 0;
    const violations = (0, product_rules_1.validateFinancingRequest)({ ...input.financing, now });
    const hard = violations.filter((v) => v.severity === 'hard');
    checks.push({
        code: 'product_rules',
        status: hard.length ? 'fail' : violations.length ? 'warn' : 'pass',
        params: { hard: hard.length, soft: violations.length - hard.length },
    });
    if (input.financing.applicantType === 'corporate') {
        checks.push({ code: 'applicant_type', status: 'fail', params: {} });
    }
    else {
        checks.push({ code: 'applicant_type', status: 'pass', params: {} });
    }
    const residency = input.residency;
    if (!residency) {
        checks.push({ code: 'age_band', status: 'unknown', params: {} });
        checks.push({ code: 'income_floor', status: 'unknown', params: {} });
        checks.push({ code: 'residency_duration', status: 'unknown', params: {} });
    }
    else {
        const band = product_rules_1.PRODUCT_RULES.applicant.ageAtContractEnd[residency];
        if (input.dateOfBirth) {
            const dob = new Date(input.dateOfBirth);
            if (Number.isNaN(dob.getTime())) {
                checks.push({ code: 'age_band', status: 'unknown', params: {} });
            }
            else {
                const end = new Date(now);
                end.setMonth(end.getMonth() + tenure);
                const ageAtEnd = ageAtDate(dob, end);
                const ok = ageAtEnd >= band.min && ageAtEnd <= band.max;
                checks.push({
                    code: 'age_band',
                    status: ok ? 'pass' : 'fail',
                    params: { ageAtEnd, min: band.min, max: band.max },
                });
            }
        }
        else {
            checks.push({ code: 'age_band', status: 'unknown', params: { min: band.min, max: band.max } });
        }
        const floor = product_rules_1.PRODUCT_RULES.applicant.minNetMonthlyIncome[residency];
        const income = Number(input.monthlyIncome) || 0;
        checks.push({
            code: 'income_floor',
            status: income <= 0 ? 'unknown' : income >= floor ? 'pass' : residency === 'expat' ? 'warn' : 'fail',
            params: { floor, income },
        });
        if (residency === 'expat') {
            const months = input.residencyMonths;
            const min = product_rules_1.PRODUCT_RULES.applicant.minResidencyMonthsExpat;
            checks.push({
                code: 'residency_duration',
                status: months == null ? 'unknown' : months >= min ? 'pass' : 'fail',
                params: { min, months: months ?? '' },
            });
        }
        else {
            checks.push({ code: 'residency_duration', status: 'pass', params: {} });
        }
    }
    let affordability = null;
    if (residency && Number(input.monthlyIncome) > 0 && installment > 0) {
        affordability = assessAffordability({
            monthlyIncome: input.monthlyIncome,
            monthlyLiabilities: input.monthlyLiabilities,
            proposedInstallment: installment,
            residency,
            employerCategory: input.employerCategory,
            financedAmount,
        });
        checks.push({
            code: 'dbr',
            status: affordability.status === 'within_cap'
                ? 'pass'
                : affordability.status === 'above_hard_cap'
                    ? 'fail'
                    : 'warn',
            params: {
                dbr: Math.round(affordability.dbr * 1000) / 10,
                cap: Math.round(affordability.cap * 100),
                hardCap: Math.round(affordability.hardCap * 100),
                tier: affordability.exceptionTier,
            },
        });
        if (affordability.stressed) {
            checks.push({
                code: 'stress_test',
                status: affordability.stressed.withinLimit ? 'pass' : 'warn',
                params: { dbr: Math.round(affordability.stressed.dbr * 1000) / 10 },
            });
        }
    }
    else {
        checks.push({ code: 'dbr', status: 'unknown', params: {} });
    }
    const statuses = checks.map((c) => c.status);
    const outcome = statuses.includes('fail')
        ? 'not_eligible'
        : statuses.includes('warn')
            ? 'needs_review'
            : statuses.includes('unknown')
                ? 'incomplete'
                : 'likely_eligible';
    const maxFinancingWithinCap = affordability
        ? maxFinancingForInstallment(affordability.maxInstallmentWithinCap, input.annualRatePercent, tenure)
        : 0;
    return {
        outcome,
        checks,
        affordability,
        violations,
        installment: Math.round(installment * 100) / 100,
        financedAmount: Math.round(financedAmount * 100) / 100,
        maxFinancingWithinCap,
    };
}
//# sourceMappingURL=affordability.js.map