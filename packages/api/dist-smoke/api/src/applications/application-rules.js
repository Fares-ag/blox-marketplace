"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PRODUCT_RULE_ENV_KEYS = void 0;
exports.parseBooleanFlag = parseBooleanFlag;
exports.productRuleEnforcementFrom = productRuleEnforcementFrom;
exports.productRuleEnforcementFromEnv = productRuleEnforcementFromEnv;
exports.vehicleCategoryFor = vehicleCategoryFor;
exports.offerTenureOptionsOf = offerTenureOptionsOf;
exports.evaluateProductRules = evaluateProductRules;
exports.softRuleFlags = softRuleFlags;
exports.assertNoHardViolations = assertNoHardViolations;
exports.withRuleFlags = withRuleFlags;
exports.ruleFlagsOf = ruleFlagsOf;
const common_1 = require("@nestjs/common");
const domain_rules_1 = require("@drivemarket/shared/domain-rules");
const application_pricing_1 = require("./application-pricing");
exports.PRODUCT_RULE_ENV_KEYS = {
    enforceFinancingCaps: 'PRODUCT_RULES_ENFORCE_FINANCING_CAPS',
    enforceIndividualsOnly: 'PRODUCT_RULES_ENFORCE_INDIVIDUALS_ONLY',
};
function parseBooleanFlag(value, fallback = false) {
    if (value == null)
        return fallback;
    if (typeof value === 'boolean')
        return value;
    const v = String(value).trim().toLowerCase();
    if (!v)
        return fallback;
    if (['1', 'true', 'yes', 'on'].includes(v))
        return true;
    if (['0', 'false', 'no', 'off'].includes(v))
        return false;
    return fallback;
}
function productRuleEnforcementFrom(read) {
    return {
        enforceFinancingCaps: parseBooleanFlag(read(exports.PRODUCT_RULE_ENV_KEYS.enforceFinancingCaps)),
        enforceIndividualsOnly: parseBooleanFlag(read(exports.PRODUCT_RULE_ENV_KEYS.enforceIndividualsOnly)),
    };
}
function productRuleEnforcementFromEnv(env = process.env) {
    return productRuleEnforcementFrom((key) => env[key]);
}
function vehicleCategoryFor(product) {
    const haystack = [];
    if (product.attributes != null) {
        try {
            haystack.push(JSON.stringify(product.attributes));
        }
        catch {
        }
    }
    if (product.bodyType)
        haystack.push(String(product.bodyType));
    return haystack.some((text) => /motor\s?(cycle|bike)/i.test(text)) ? 'motorcycle' : 'car';
}
function offerTenureOptionsOf(raw) {
    if (!Array.isArray(raw))
        return null;
    const parsed = raw.map((v) => Number(v)).filter((n) => Number.isFinite(n) && n > 0);
    return parsed.length > 0 ? parsed : null;
}
function evaluateProductRules(input) {
    const pricing = input.pricingSnapshot ?? {};
    const price = Number(pricing.selling_price ?? pricing.list_price ?? input.product.price);
    const tenureMonths = (0, application_pricing_1.resolveTenureMonths)(pricing);
    const downPaymentPct = Number(pricing.down_payment_pct ?? input.offer.minDownPaymentPct ?? 0);
    return (0, domain_rules_1.validateFinancingRequest)({
        applicantType: input.applicantType ?? 'individual',
        residency: input.residency ?? null,
        vehicle: {
            price,
            condition: input.product.condition === 'new' ? 'new' : 'used',
            category: vehicleCategoryFor(input.product),
            modelYear: input.product.modelYear ?? null,
        },
        tenureMonths,
        downPaymentPct,
        offerTenureOptions: offerTenureOptionsOf(input.offer.tenureOptions),
        offerMinDownPaymentPct: input.offer.minDownPaymentPct == null ? null : Number(input.offer.minDownPaymentPct),
        enforceFinancingCaps: !!input.enforcement?.enforceFinancingCaps,
        enforceIndividualsOnly: !!input.enforcement?.enforceIndividualsOnly,
        now: input.now,
    });
}
function softRuleFlags(violations) {
    return violations
        .filter((v) => v.severity === 'soft')
        .map((v) => ({ code: v.code, params: { ...v.params } }));
}
function assertNoHardViolations(violations) {
    if ((0, domain_rules_1.hasHardViolation)(violations)) {
        throw new common_1.BadRequestException({ message: 'product_rule_violation', violations });
    }
}
function withRuleFlags(pricing, violations) {
    const { rule_flags: _previous, ...rest } = pricing;
    void _previous;
    const flags = softRuleFlags(violations);
    return flags.length > 0 ? { ...rest, rule_flags: flags } : rest;
}
function ruleFlagsOf(pricing) {
    if (!pricing || typeof pricing !== 'object')
        return [];
    const raw = pricing.rule_flags;
    if (!Array.isArray(raw))
        return [];
    return raw
        .filter((f) => !!f && typeof f === 'object')
        .map((f) => ({
        code: String(f.code ?? ''),
        params: f.params && typeof f.params === 'object' ? f.params : {},
    }))
        .filter((f) => f.code);
}
//# sourceMappingURL=application-rules.js.map