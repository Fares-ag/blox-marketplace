"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertCompliancePassed = assertCompliancePassed;
exports.deriveOverallComplianceStatus = deriveOverallComplianceStatus;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
function assertCompliancePassed(check) {
    if (!check || check.overallStatus !== client_1.ComplianceCheckStatus.pass) {
        throw new common_1.BadRequestException('compliance_check_required');
    }
}
function deriveOverallComplianceStatus(identityStatus, sanctionsStatus) {
    if (identityStatus === client_1.ComplianceCheckStatus.fail || sanctionsStatus === client_1.ComplianceCheckStatus.fail) {
        return client_1.ComplianceCheckStatus.fail;
    }
    if (identityStatus === client_1.ComplianceCheckStatus.pass && sanctionsStatus === client_1.ComplianceCheckStatus.pass) {
        return client_1.ComplianceCheckStatus.pass;
    }
    return client_1.ComplianceCheckStatus.pending;
}
//# sourceMappingURL=compliance-gate.js.map