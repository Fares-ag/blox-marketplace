"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SUBMIT_GATE_ORDER = void 0;
exports.guarantorConsentRequired = guarantorConsentRequired;
exports.identityHoldActive = identityHoldActive;
exports.vehicleIdentityComplete = vehicleIdentityComplete;
exports.evaluateSubmitGates = evaluateSubmitGates;
exports.assertSubmitGates = assertSubmitGates;
const common_1 = require("@nestjs/common");
const domain_rules_1 = require("@drivemarket/shared/domain-rules");
const application_documents_1 = require("./application-documents");
const application_pricing_1 = require("./application-pricing");
const customer_snapshot_1 = require("./customer-snapshot");
exports.SUBMIT_GATE_ORDER = [
    'identity_hold',
    'consents_required',
    'documents_missing',
    'documents_stale',
    'guarantor_consent_required',
    'vehicle_identity_incomplete',
    'vehicle_age_rule',
];
function guarantorConsentRequired(application, guarantorConsentCompleted) {
    return (0, customer_snapshot_1.hasGuarantorOf)((0, customer_snapshot_1.readCustomerSnapshot)(application.customerSnapshot)) && guarantorConsentCompleted !== true;
}
function identityHoldActive(app) {
    return !!app.identityHoldAt && !app.identityHoldClearedAt;
}
function vehicleIdentityComplete(product) {
    return [product.vin, product.chassisNumber, product.engineNumber].every((value) => typeof value === 'string' && value.trim().length > 0);
}
function evaluateSubmitGates(input) {
    const { application, product } = input;
    if (identityHoldActive(application))
        return { code: 'identity_hold' };
    if (input.requireConsents !== false && !application.consentsCompletedAt) {
        return { code: 'consents_required' };
    }
    const missing = (0, application_documents_1.missingDocumentsForApplication)(application.customerSnapshot, input.documents, input.identityPolicy ?? {});
    if (missing.length > 0)
        return { code: 'documents_missing', missing };
    const stale = (0, application_documents_1.staleDocumentCategories)(application.customerSnapshot, input.documents, input.now);
    if (stale.length > 0)
        return { code: 'documents_stale', stale };
    if (guarantorConsentRequired(application, input.guarantorConsentCompleted)) {
        return { code: 'guarantor_consent_required' };
    }
    if (input.requireVehicleIdentity && !vehicleIdentityComplete(product)) {
        return { code: 'vehicle_identity_incomplete' };
    }
    if (product.modelYear) {
        const pricing = application.pricingSnapshot ?? {};
        const tenureMonths = (0, application_pricing_1.resolveTenureMonths)(pricing);
        const ageAtEnd = (0, domain_rules_1.vehicleAgeAtTenureEnd)(product.modelYear, tenureMonths, input.now);
        if (ageAtEnd > domain_rules_1.PRODUCT_RULES.vehicleAge.maxYearsAtTenureEnd) {
            return {
                code: 'vehicle_age_rule',
                params: {
                    max_years_at_tenure_end: domain_rules_1.PRODUCT_RULES.vehicleAge.maxYearsAtTenureEnd,
                    age_at_tenure_end: Math.round(ageAtEnd * 10) / 10,
                },
            };
        }
    }
    return null;
}
function assertSubmitGates(input) {
    const failure = evaluateSubmitGates(input);
    if (!failure)
        return;
    if (failure.code === 'documents_missing') {
        throw new common_1.ConflictException({ message: 'documents_missing', missing: failure.missing ?? [] });
    }
    if (failure.code === 'documents_stale') {
        throw new common_1.ConflictException({ message: 'documents_stale', stale: failure.stale ?? [] });
    }
    if (failure.code === 'vehicle_age_rule') {
        throw new common_1.ConflictException({ message: 'vehicle_age_rule', ...(failure.params ?? {}) });
    }
    throw new common_1.ConflictException(failure.code);
}
//# sourceMappingURL=submit-gates.js.map