"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DevRecordedComplianceProvider = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const SYNTHETIC_NOTE = 'Synthetic provider — records an ops-triggered pass. Use only until a real KYC/AML vendor is wired.';
let DevRecordedComplianceProvider = class DevRecordedComplianceProvider {
    name = 'synthetic';
    verifyIdentity(qid, applicantName) {
        return Promise.resolve({
            status: client_1.ComplianceCheckStatus.pass,
            raw: { synthetic: true, qid, applicantName, note: SYNTHETIC_NOTE },
        });
    }
    screenSanctions(applicantName) {
        return Promise.resolve({
            status: client_1.ComplianceCheckStatus.pass,
            raw: { synthetic: true, applicantName, note: SYNTHETIC_NOTE },
        });
    }
};
exports.DevRecordedComplianceProvider = DevRecordedComplianceProvider;
exports.DevRecordedComplianceProvider = DevRecordedComplianceProvider = __decorate([
    (0, common_1.Injectable)()
], DevRecordedComplianceProvider);
//# sourceMappingURL=compliance-provider.dev.js.map