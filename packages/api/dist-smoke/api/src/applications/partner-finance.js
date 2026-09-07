"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isPartnerCrmAdapter = isPartnerCrmAdapter;
exports.submittedStatusForPartner = submittedStatusForPartner;
exports.financingSource = financingSource;
const client_1 = require("@prisma/client");
function isPartnerCrmAdapter(adapter) {
    return adapter === 'zoho';
}
function submittedStatusForPartner(adapter) {
    return isPartnerCrmAdapter(adapter)
        ? client_1.ApplicationStatus.partner_processing
        : client_1.ApplicationStatus.under_review;
}
function financingSource(adapter) {
    return isPartnerCrmAdapter(adapter) ? 'partner' : 'blox';
}
//# sourceMappingURL=partner-finance.js.map