"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RESIDENCE_DURATION_OPTIONS = exports.PRODUCT_RULES = void 0;
exports.resolveProductVariant = resolveProductVariant;
exports.financingCapFor = financingCapFor;
exports.maxTenureFor = maxTenureFor;
exports.allowedTenureOptions = allowedTenureOptions;
exports.minDownPaymentPctFor = minDownPaymentPctFor;
exports.vehicleAgeAtTenureEnd = vehicleAgeAtTenureEnd;
exports.validateFinancingRequest = validateFinancingRequest;
exports.hasHardViolation = hasHardViolation;
exports.requiredApprovalAuthority = requiredApprovalAuthority;
exports.employerCategoryFromEmploymentType = employerCategoryFromEmploymentType;
exports.residencyFromNationality = residencyFromNationality;
exports.residenceMonthsFromOption = residenceMonthsFromOption;
exports.PRODUCT_RULES = {
    currency: 'QAR',
    individualsOnly: true,
    tenure: {
        minMonths: 3,
        options: [12, 24, 36, 48, 60],
        maxMonths: { qatari: 60, expat: 48 },
    },
    downPayment: {
        minPctByCondition: { new: 20, used: 15 },
        maxPct: 80,
    },
    premiumCarPriceThreshold: 90_000,
    financingCap: {
        car_new_standard: 50_000,
        car_new_premium: 70_000,
        car_used: 50_000,
        motorcycle: 15_000,
    },
    approvalAuthority: {
        car: { seniorManager: 50_000, headOfCredit: 70_000 },
        motorcycle: { seniorManager: 10_000, headOfCredit: 15_000 },
    },
    vehicleAge: {
        maxYearsAtTenureEnd: 10,
        maxUsedYearsAtApplication: 5,
    },
    applicant: {
        ageAtContractEnd: {
            qatari: { min: 18, max: 65 },
            expat: { min: 21, max: 60 },
        },
        minNetMonthlyIncome: { qatari: 5_000, expat: 7_000 },
        minResidencyMonthsExpat: 6,
    },
    dbr: {
        caps: {
            qatari_government: 0.7,
            qatari_private_approved: 0.6,
            qatari_private_unlisted: 0.6,
            qatari_self_employed: 0.6,
            expat_government: 0.5,
            expat_private_approved: 0.5,
            expat_private_unlisted: 0.5,
            expat_self_employed: 0.5,
        },
        exceptionTiers: [
            { maxExcess: 0.03, tier: 1 },
            { maxExcess: 0.05, tier: 2 },
        ],
        hardCap: 0.75,
        stress: { rentalIncrease: 0.02, incomeReduction: 0.1, highTicketThreshold: 50_000, maxStressedDbr: 0.6 },
    },
};
function resolveProductVariant(vehicle) {
    if (vehicle.category === 'motorcycle')
        return 'motorcycle';
    if (vehicle.condition === 'used')
        return 'car_used';
    return vehicle.price > exports.PRODUCT_RULES.premiumCarPriceThreshold ? 'car_new_premium' : 'car_new_standard';
}
function financingCapFor(variant) {
    return exports.PRODUCT_RULES.financingCap[variant];
}
function maxTenureFor(residency) {
    return residency ? exports.PRODUCT_RULES.tenure.maxMonths[residency] : Math.max(...Object.values(exports.PRODUCT_RULES.tenure.maxMonths));
}
function allowedTenureOptions(residency, offerTenureOptions) {
    const max = maxTenureFor(residency);
    const base = offerTenureOptions?.length
        ? [...offerTenureOptions]
        : [...exports.PRODUCT_RULES.tenure.options];
    return base
        .filter((m) => Number.isFinite(m) && m >= exports.PRODUCT_RULES.tenure.minMonths && m <= max)
        .sort((a, b) => a - b);
}
function minDownPaymentPctFor(condition, offerMinDownPaymentPct) {
    const product = exports.PRODUCT_RULES.downPayment.minPctByCondition[condition];
    return Math.max(product, Number(offerMinDownPaymentPct ?? 0));
}
function vehicleAgeAtTenureEnd(modelYear, tenureMonths, now = new Date()) {
    const endYear = now.getFullYear() + tenureMonths / 12;
    return Math.max(0, endYear - modelYear);
}
function validateFinancingRequest(req) {
    const out = [];
    const now = req.now ?? new Date();
    const price = Number(req.vehicle.price);
    if (exports.PRODUCT_RULES.individualsOnly && req.applicantType === 'corporate') {
        out.push({ code: 'corporate_not_eligible', severity: req.enforceIndividualsOnly ? 'hard' : 'soft', params: {} });
    }
    if (!Number.isFinite(price) || price <= 0) {
        out.push({ code: 'price_not_positive', severity: 'hard', params: {} });
        return out;
    }
    const tenure = Number(req.tenureMonths);
    const maxTenure = maxTenureFor(req.residency);
    if (tenure < exports.PRODUCT_RULES.tenure.minMonths) {
        out.push({ code: 'tenure_below_min', severity: 'hard', params: { min: exports.PRODUCT_RULES.tenure.minMonths } });
    }
    if (tenure > maxTenure) {
        out.push({ code: 'tenure_above_max', severity: 'hard', params: { max: maxTenure, residency: req.residency ?? '' } });
    }
    if (req.offerTenureOptions?.length && !req.offerTenureOptions.includes(tenure)) {
        out.push({ code: 'tenure_not_offered', severity: 'hard', params: { options: req.offerTenureOptions.join(', ') } });
    }
    const minDown = minDownPaymentPctFor(req.vehicle.condition, req.offerMinDownPaymentPct);
    const downPct = Number(req.downPaymentPct);
    if (downPct < minDown) {
        out.push({ code: 'down_payment_below_min', severity: 'hard', params: { min: minDown } });
    }
    if (downPct > exports.PRODUCT_RULES.downPayment.maxPct) {
        out.push({ code: 'down_payment_above_max', severity: 'hard', params: { max: exports.PRODUCT_RULES.downPayment.maxPct } });
    }
    const variant = resolveProductVariant(req.vehicle);
    const financed = Math.max(0, price - (price * Math.min(Math.max(downPct, 0), 100)) / 100);
    const cap = financingCapFor(variant);
    if (financed > cap) {
        out.push({
            code: 'financing_amount_exceeds_cap',
            severity: req.enforceFinancingCaps ? 'hard' : 'soft',
            params: { cap, financed: Math.round(financed), variant },
        });
    }
    if (req.vehicle.modelYear) {
        const ageAtEnd = vehicleAgeAtTenureEnd(req.vehicle.modelYear, tenure, now);
        if (ageAtEnd > exports.PRODUCT_RULES.vehicleAge.maxYearsAtTenureEnd) {
            out.push({
                code: 'vehicle_age_at_tenure_end',
                severity: 'hard',
                params: { max: exports.PRODUCT_RULES.vehicleAge.maxYearsAtTenureEnd, ageAtEnd: Math.round(ageAtEnd * 10) / 10 },
            });
        }
        if (req.vehicle.condition === 'used') {
            const ageNow = now.getFullYear() - req.vehicle.modelYear;
            if (ageNow > exports.PRODUCT_RULES.vehicleAge.maxUsedYearsAtApplication) {
                out.push({
                    code: 'used_vehicle_too_old',
                    severity: 'hard',
                    params: { max: exports.PRODUCT_RULES.vehicleAge.maxUsedYearsAtApplication, age: ageNow },
                });
            }
        }
    }
    return out;
}
function hasHardViolation(violations) {
    return violations.some((v) => v.severity === 'hard');
}
function requiredApprovalAuthority(category, financedAmount) {
    const matrix = exports.PRODUCT_RULES.approvalAuthority[category];
    if (financedAmount <= matrix.seniorManager)
        return 'senior_manager';
    if (financedAmount <= matrix.headOfCredit)
        return 'head_of_credit';
    return 'above_matrix';
}
function employerCategoryFromEmploymentType(value) {
    switch ((value ?? '').trim()) {
        case 'gov-or-semi-gov':
            return 'government';
        case 'private-international':
            return 'private_approved';
        case 'self-employed':
            return 'self_employed';
        case 'private-local':
        default:
            return 'private_unlisted';
    }
}
function residencyFromNationality(nationality) {
    const value = (nationality ?? '').trim().toLowerCase();
    if (!value)
        return null;
    if (value === 'qa' || value === 'qat' || value === 'qatar' || value === 'qatari' || value.includes('قطر')) {
        return 'qatari';
    }
    return 'expat';
}
exports.RESIDENCE_DURATION_OPTIONS = [
    { value: 'less-than-6-months', minMonths: 0, labelKey: 'applyFlow.residence.lt6' },
    { value: '6-12-months', minMonths: 6, labelKey: 'applyFlow.residence.m6_12' },
    { value: '1-3-years', minMonths: 12, labelKey: 'applyFlow.residence.y1_3' },
    { value: '3-5-years', minMonths: 36, labelKey: 'applyFlow.residence.y3_5' },
    { value: 'more-than-5-years', minMonths: 60, labelKey: 'applyFlow.residence.gt5' },
];
function residenceMonthsFromOption(value) {
    const hit = exports.RESIDENCE_DURATION_OPTIONS.find((o) => o.value === value);
    return hit ? hit.minMonths : null;
}
//# sourceMappingURL=product-rules.js.map