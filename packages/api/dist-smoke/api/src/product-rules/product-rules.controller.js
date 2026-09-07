"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProductRulesController = void 0;
const common_1 = require("@nestjs/common");
const domain_rules_1 = require("@drivemarket/shared/domain-rules");
const guards_1 = require("../auth/guards");
let ProductRulesController = class ProductRulesController {
    rules() {
        return {
            version: '2026-09-07',
            currency: domain_rules_1.PRODUCT_RULES.currency,
            individuals_only: domain_rules_1.PRODUCT_RULES.individualsOnly,
            tenure: {
                min_months: domain_rules_1.PRODUCT_RULES.tenure.minMonths,
                options: domain_rules_1.PRODUCT_RULES.tenure.options,
                max_months: domain_rules_1.PRODUCT_RULES.tenure.maxMonths,
            },
            down_payment: {
                min_pct_by_condition: domain_rules_1.PRODUCT_RULES.downPayment.minPctByCondition,
                max_pct: domain_rules_1.PRODUCT_RULES.downPayment.maxPct,
            },
            premium_car_price_threshold: domain_rules_1.PRODUCT_RULES.premiumCarPriceThreshold,
            financing_cap: domain_rules_1.PRODUCT_RULES.financingCap,
            vehicle_age: {
                max_years_at_tenure_end: domain_rules_1.PRODUCT_RULES.vehicleAge.maxYearsAtTenureEnd,
                max_used_years_at_application: domain_rules_1.PRODUCT_RULES.vehicleAge.maxUsedYearsAtApplication,
            },
            applicant: {
                age_at_contract_end: domain_rules_1.PRODUCT_RULES.applicant.ageAtContractEnd,
                min_net_monthly_income: domain_rules_1.PRODUCT_RULES.applicant.minNetMonthlyIncome,
                min_residency_months_expat: domain_rules_1.PRODUCT_RULES.applicant.minResidencyMonthsExpat,
            },
            dbr: {
                caps: domain_rules_1.PRODUCT_RULES.dbr.caps,
                hard_cap: domain_rules_1.PRODUCT_RULES.dbr.hardCap,
                exception_tiers: domain_rules_1.PRODUCT_RULES.dbr.exceptionTiers,
            },
            residence_duration_options: domain_rules_1.RESIDENCE_DURATION_OPTIONS.map((o) => ({ value: o.value, min_months: o.minMonths })),
            consents: {
                catalog_version: domain_rules_1.CONSENT_CATALOG_VERSION,
                items: Object.values(domain_rules_1.CONSENT_CATALOG).map((c) => ({
                    code: c.code,
                    version: c.version,
                    title: c.title,
                    summary: c.summary,
                    body: c.body,
                })),
            },
        };
    }
};
exports.ProductRulesController = ProductRulesController;
__decorate([
    (0, guards_1.Public)(),
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ProductRulesController.prototype, "rules", null);
exports.ProductRulesController = ProductRulesController = __decorate([
    (0, common_1.Controller)('product-rules')
], ProductRulesController);
//# sourceMappingURL=product-rules.controller.js.map