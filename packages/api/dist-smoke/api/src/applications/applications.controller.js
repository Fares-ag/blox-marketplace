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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApplicationsController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const client_1 = require("@prisma/client");
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
const guards_1 = require("../auth/guards");
const qid_1 = require("../common/qid");
const idempotency_constants_1 = require("../common/idempotency.constants");
const idempotency_service_1 = require("../common/idempotency.service");
const multer_options_1 = require("../common/multer-options");
const customer_payments_service_1 = require("../payments/customer-payments.service");
const compliance_service_1 = require("../compliance/compliance.service");
const storage_service_1 = require("../storage/storage.service");
const applications_service_1 = require("./applications.service");
const applications_lifecycle_service_1 = require("./applications-lifecycle.service");
const applications_staff_service_1 = require("./applications-staff.service");
const application_documents_1 = require("./application-documents");
const customer_snapshot_1 = require("./customer-snapshot");
const pagination_dto_1 = require("../common/pagination.dto");
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
class CustomerEmploymentDto {
    company;
    jobTitle;
    position;
    employmentType;
    employmentDuration;
    salary;
}
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CustomerEmploymentDto.prototype, "company", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CustomerEmploymentDto.prototype, "jobTitle", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CustomerEmploymentDto.prototype, "position", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CustomerEmploymentDto.prototype, "employmentType", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CustomerEmploymentDto.prototype, "employmentDuration", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], CustomerEmploymentDto.prototype, "salary", void 0);
class CustomerAddressDto {
    line1;
    area;
    city;
    zone;
    poBox;
    street;
    country;
    postalCode;
}
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CustomerAddressDto.prototype, "line1", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CustomerAddressDto.prototype, "area", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CustomerAddressDto.prototype, "city", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CustomerAddressDto.prototype, "zone", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CustomerAddressDto.prototype, "poBox", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CustomerAddressDto.prototype, "street", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CustomerAddressDto.prototype, "country", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CustomerAddressDto.prototype, "postalCode", void 0);
class CustomerGuarantorDto {
    fullName;
    qid;
    phone;
    relationship;
    monthlyIncome;
}
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CustomerGuarantorDto.prototype, "fullName", void 0);
__decorate([
    (0, class_validator_1.Matches)(qid_1.QID_PATTERN, { message: qid_1.QID_VALIDATION_MESSAGE }),
    __metadata("design:type", String)
], CustomerGuarantorDto.prototype, "qid", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CustomerGuarantorDto.prototype, "phone", void 0);
__decorate([
    (0, class_validator_1.IsIn)(customer_snapshot_1.GUARANTOR_RELATIONSHIPS),
    __metadata("design:type", String)
], CustomerGuarantorDto.prototype, "relationship", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], CustomerGuarantorDto.prototype, "monthlyIncome", void 0);
class CustomerSnapshotDto {
    full_name;
    phone;
    qid;
    email;
    applicantType;
    firstName;
    lastName;
    gender;
    dateOfBirth;
    nationality;
    residency;
    residenceDuration;
    city;
    address;
    employment;
    income;
    monthlyIncome;
    monthlyLiabilities;
    hasGuarantor;
    guarantor;
    corporate;
    street;
    country;
    postalCode;
}
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CustomerSnapshotDto.prototype, "full_name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CustomerSnapshotDto.prototype, "phone", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Matches)(qid_1.QID_PATTERN, { message: qid_1.QID_VALIDATION_MESSAGE }),
    __metadata("design:type", String)
], CustomerSnapshotDto.prototype, "qid", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEmail)(),
    __metadata("design:type", String)
], CustomerSnapshotDto.prototype, "email", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(customer_snapshot_1.APPLICANT_TYPES),
    __metadata("design:type", String)
], CustomerSnapshotDto.prototype, "applicantType", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CustomerSnapshotDto.prototype, "firstName", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CustomerSnapshotDto.prototype, "lastName", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(customer_snapshot_1.GENDER_VALUES),
    __metadata("design:type", String)
], CustomerSnapshotDto.prototype, "gender", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Matches)(ISO_DATE_PATTERN, { message: 'dateOfBirth must be YYYY-MM-DD' }),
    __metadata("design:type", String)
], CustomerSnapshotDto.prototype, "dateOfBirth", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CustomerSnapshotDto.prototype, "nationality", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(customer_snapshot_1.RESIDENCY_VALUES),
    __metadata("design:type", String)
], CustomerSnapshotDto.prototype, "residency", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(customer_snapshot_1.RESIDENCE_DURATION_VALUES),
    __metadata("design:type", String)
], CustomerSnapshotDto.prototype, "residenceDuration", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CustomerSnapshotDto.prototype, "city", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => CustomerAddressDto),
    __metadata("design:type", CustomerAddressDto)
], CustomerSnapshotDto.prototype, "address", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateIf)((o) => typeof o.employment === 'object'),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => CustomerEmploymentDto),
    (0, class_validator_1.ValidateIf)((o) => typeof o.employment === 'string'),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", Object)
], CustomerSnapshotDto.prototype, "employment", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], CustomerSnapshotDto.prototype, "income", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], CustomerSnapshotDto.prototype, "monthlyIncome", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], CustomerSnapshotDto.prototype, "monthlyLiabilities", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CustomerSnapshotDto.prototype, "hasGuarantor", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => CustomerGuarantorDto),
    __metadata("design:type", CustomerGuarantorDto)
], CustomerSnapshotDto.prototype, "guarantor", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], CustomerSnapshotDto.prototype, "corporate", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CustomerSnapshotDto.prototype, "street", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CustomerSnapshotDto.prototype, "country", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CustomerSnapshotDto.prototype, "postalCode", void 0);
class CreateApplicationDto {
    productId;
    offerId;
    customerSnapshot;
    pricingSnapshot;
    quoteToken;
}
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateApplicationDto.prototype, "productId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateApplicationDto.prototype, "offerId", void 0);
__decorate([
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => CustomerSnapshotDto),
    __metadata("design:type", CustomerSnapshotDto)
], CreateApplicationDto.prototype, "customerSnapshot", void 0);
__decorate([
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], CreateApplicationDto.prototype, "pricingSnapshot", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateApplicationDto.prototype, "quoteToken", void 0);
class UpdateDraftDto {
    customerSnapshot;
    pricingSnapshot;
    offerId;
}
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => CustomerSnapshotDto),
    __metadata("design:type", CustomerSnapshotDto)
], UpdateDraftDto.prototype, "customerSnapshot", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], UpdateDraftDto.prototype, "pricingSnapshot", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateDraftDto.prototype, "offerId", void 0);
class TransitionDto {
    toStatus;
    reason;
    override_reason;
}
__decorate([
    (0, class_validator_1.IsEnum)(client_1.ApplicationStatus),
    __metadata("design:type", String)
], TransitionDto.prototype, "toStatus", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], TransitionDto.prototype, "reason", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(2000),
    __metadata("design:type", String)
], TransitionDto.prototype, "override_reason", void 0);
class ActivateDto {
    direct;
    override_reason;
}
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], ActivateDto.prototype, "direct", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(2000),
    __metadata("design:type", String)
], ActivateDto.prototype, "override_reason", void 0);
class ApproveContractDto {
    override_reason;
}
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(2000),
    __metadata("design:type", String)
], ApproveContractDto.prototype, "override_reason", void 0);
class RecordDownPaymentDto {
    amount;
    method;
    reference;
    paidAt;
}
__decorate([
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], RecordDownPaymentDto.prototype, "amount", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], RecordDownPaymentDto.prototype, "method", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], RecordDownPaymentDto.prototype, "reference", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], RecordDownPaymentDto.prototype, "paidAt", void 0);
class CancelApplicationDto {
    reason;
}
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CancelApplicationDto.prototype, "reason", void 0);
class UploadDocumentDto {
    category;
}
__decorate([
    (0, class_validator_1.IsIn)(application_documents_1.APPLICATION_DOC_CATEGORIES),
    __metadata("design:type", String)
], UploadDocumentDto.prototype, "category", void 0);
class ClearIdentityHoldDto {
    note;
}
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(2000),
    __metadata("design:type", String)
], ClearIdentityHoldDto.prototype, "note", void 0);
class UnmaskDto {
    field;
    reason;
}
__decorate([
    (0, class_validator_1.IsIn)(['qid', 'phone']),
    __metadata("design:type", String)
], UnmaskDto.prototype, "field", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(3),
    (0, class_validator_1.MaxLength)(500),
    __metadata("design:type", String)
], UnmaskDto.prototype, "reason", void 0);
class TagLenderDto {
    finance_partner_id;
    finance_partner_branch_id;
}
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], TagLenderDto.prototype, "finance_partner_id", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], TagLenderDto.prototype, "finance_partner_branch_id", void 0);
class StaffCustomerSnapshotDto {
    email;
    phone;
    full_name;
    qid;
    employment;
    income;
    monthlyIncome;
    monthlyLiabilities;
    applicantType;
    firstName;
    lastName;
    gender;
    dateOfBirth;
    nationality;
    residency;
    residenceDuration;
    street;
    city;
    country;
    postalCode;
    address;
    employmentDetails;
    hasGuarantor;
    guarantor;
    corporate;
}
__decorate([
    (0, class_validator_1.IsEmail)(),
    __metadata("design:type", String)
], StaffCustomerSnapshotDto.prototype, "email", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], StaffCustomerSnapshotDto.prototype, "phone", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], StaffCustomerSnapshotDto.prototype, "full_name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], StaffCustomerSnapshotDto.prototype, "qid", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateIf)((o) => o.employment != null && typeof o.employment === 'string'),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.ValidateIf)((o) => o.employment != null && typeof o.employment === 'object'),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], StaffCustomerSnapshotDto.prototype, "employment", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], StaffCustomerSnapshotDto.prototype, "income", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], StaffCustomerSnapshotDto.prototype, "monthlyIncome", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], StaffCustomerSnapshotDto.prototype, "monthlyLiabilities", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(customer_snapshot_1.APPLICANT_TYPES),
    __metadata("design:type", String)
], StaffCustomerSnapshotDto.prototype, "applicantType", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], StaffCustomerSnapshotDto.prototype, "firstName", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], StaffCustomerSnapshotDto.prototype, "lastName", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(customer_snapshot_1.GENDER_VALUES),
    __metadata("design:type", String)
], StaffCustomerSnapshotDto.prototype, "gender", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], StaffCustomerSnapshotDto.prototype, "dateOfBirth", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], StaffCustomerSnapshotDto.prototype, "nationality", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(customer_snapshot_1.RESIDENCY_VALUES),
    __metadata("design:type", String)
], StaffCustomerSnapshotDto.prototype, "residency", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(customer_snapshot_1.RESIDENCE_DURATION_VALUES),
    __metadata("design:type", String)
], StaffCustomerSnapshotDto.prototype, "residenceDuration", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], StaffCustomerSnapshotDto.prototype, "street", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], StaffCustomerSnapshotDto.prototype, "city", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], StaffCustomerSnapshotDto.prototype, "country", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], StaffCustomerSnapshotDto.prototype, "postalCode", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], StaffCustomerSnapshotDto.prototype, "address", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], StaffCustomerSnapshotDto.prototype, "employmentDetails", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], StaffCustomerSnapshotDto.prototype, "hasGuarantor", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], StaffCustomerSnapshotDto.prototype, "guarantor", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], StaffCustomerSnapshotDto.prototype, "corporate", void 0);
class StaffCreateApplicationDto {
    productId;
    productIds;
    offerId;
    customerSnapshot;
    pricingSnapshot;
    installmentPlan;
    agentUserId;
    listPrice;
    sellingPrice;
    hideInterest;
    companyId;
    submit;
}
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], StaffCreateApplicationDto.prototype, "productId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], StaffCreateApplicationDto.prototype, "productIds", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], StaffCreateApplicationDto.prototype, "offerId", void 0);
__decorate([
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => StaffCustomerSnapshotDto),
    __metadata("design:type", StaffCustomerSnapshotDto)
], StaffCreateApplicationDto.prototype, "customerSnapshot", void 0);
__decorate([
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], StaffCreateApplicationDto.prototype, "pricingSnapshot", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], StaffCreateApplicationDto.prototype, "installmentPlan", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], StaffCreateApplicationDto.prototype, "agentUserId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], StaffCreateApplicationDto.prototype, "listPrice", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], StaffCreateApplicationDto.prototype, "sellingPrice", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], StaffCreateApplicationDto.prototype, "hideInterest", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], StaffCreateApplicationDto.prototype, "companyId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], StaffCreateApplicationDto.prototype, "submit", void 0);
class OpsApplicationsQueryDto extends pagination_dto_1.PaginationQueryDto {
    status;
    statusIn;
    q;
    companyId;
    financePartnerId;
    scheduleHealth;
    createdFrom;
    createdTo;
}
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.ApplicationStatus),
    __metadata("design:type", String)
], OpsApplicationsQueryDto.prototype, "status", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], OpsApplicationsQueryDto.prototype, "statusIn", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], OpsApplicationsQueryDto.prototype, "q", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], OpsApplicationsQueryDto.prototype, "companyId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], OpsApplicationsQueryDto.prototype, "financePartnerId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], OpsApplicationsQueryDto.prototype, "scheduleHealth", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], OpsApplicationsQueryDto.prototype, "createdFrom", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], OpsApplicationsQueryDto.prototype, "createdTo", void 0);
class RebuildScheduleDto {
    tenureMonths;
    downPaymentPct;
    sellingPrice;
    installmentPlan;
}
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], RebuildScheduleDto.prototype, "tenureMonths", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], RebuildScheduleDto.prototype, "downPaymentPct", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], RebuildScheduleDto.prototype, "sellingPrice", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], RebuildScheduleDto.prototype, "installmentPlan", void 0);
class DealerApplicationsQueryDto extends pagination_dto_1.PaginationQueryDto {
    status;
    q;
    tab;
}
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.ApplicationStatus),
    __metadata("design:type", String)
], DealerApplicationsQueryDto.prototype, "status", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], DealerApplicationsQueryDto.prototype, "q", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], DealerApplicationsQueryDto.prototype, "tab", void 0);
class DeferPaymentDto {
    reason;
}
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], DeferPaymentDto.prototype, "reason", void 0);
class PatchOpsApplicationDto {
    agentUserId;
    companyId;
    comment;
    customerSnapshot;
    hideInterest;
}
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", Object)
], PatchOpsApplicationDto.prototype, "agentUserId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], PatchOpsApplicationDto.prototype, "companyId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], PatchOpsApplicationDto.prototype, "comment", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], PatchOpsApplicationDto.prototype, "customerSnapshot", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], PatchOpsApplicationDto.prototype, "hideInterest", void 0);
const OPS_READ_ROLES = [
    client_1.UserRole.credit_officer,
    client_1.UserRole.finance_officer,
    client_1.UserRole.admin,
    client_1.UserRole.super_admin,
    client_1.UserRole.group_admin,
    client_1.UserRole.dealer_agent,
];
let ApplicationsController = class ApplicationsController {
    apps;
    lifecycle;
    compliance;
    idempotency;
    staff;
    storage;
    customerPayments;
    constructor(apps, lifecycle, compliance, idempotency, staff, storage, customerPayments) {
        this.apps = apps;
        this.lifecycle = lifecycle;
        this.compliance = compliance;
        this.idempotency = idempotency;
        this.staff = staff;
        this.storage = storage;
        this.customerPayments = customerPayments;
    }
    blocking(user, productId) {
        const scopedProductId = productId?.trim() || undefined;
        return this.apps.hasBlocking(user.id, scopedProductId);
    }
    mine(user, query) {
        return this.apps.listMine(user, query);
    }
    async create(user, dto, res, idempotencyKey) {
        const result = await this.idempotency.run({
            userId: user.id,
            scope: idempotency_constants_1.IDEMPOTENCY_SCOPES.applicationCreate,
            idempotencyKey,
            handler: () => this.apps.create(user, { ...dto, customerSnapshot: { ...dto.customerSnapshot } }),
        });
        if (result.resumed)
            res.status(200);
        return result;
    }
    one(user, id) {
        return this.apps.getOne(user, id);
    }
    updateDraft(user, id, dto) {
        return this.apps.updateDraft(user, id, {
            ...dto,
            customerSnapshot: dto.customerSnapshot ? { ...dto.customerSnapshot } : undefined,
        });
    }
    documentSlots(user, id) {
        return this.apps.documentSlots(user, id);
    }
    documentSlotsOps(user, id) {
        return this.apps.documentSlots(user, id);
    }
    creditAssessment(user, id) {
        return this.apps.creditAssessment(user, id);
    }
    submit(user, id) {
        return this.apps.submit(user, id);
    }
    resubmit(user, id) {
        return this.apps.resubmit(user, id);
    }
    cancel(user, id, dto) {
        return this.apps.cancel(user, id, dto.reason);
    }
    deferPayment(user, id, scheduleId, dto) {
        return this.customerPayments.deferPayment(user, id, scheduleId, dto.reason);
    }
    uploadDoc(user, id, dto, file) {
        return this.apps.uploadDoc(user, id, dto.category, file);
    }
    async downloadDoc(user, id, docId, res) {
        const file = await this.apps.downloadDocument(user, id, docId);
        res.setHeader('Content-Type', file.contentType);
        res.setHeader('Content-Disposition', `inline; filename="${file.filename}"`);
        res.send(file.buffer);
    }
    async downloadContract(user, id, res) {
        const file = await this.lifecycle.downloadContract(user, id);
        res.setHeader('Content-Type', file.contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
        res.send(file.buffer);
    }
    uploadSignedContract(user, id, file) {
        return this.lifecycle.submitSignedContract(user, id, file);
    }
    uploadSignedContractOps(user, id, file) {
        return this.lifecycle.submitSignedContractOps(user, id, file);
    }
    createStaff(user, dto, idempotencyKey) {
        return this.idempotency.run({
            userId: user.id,
            scope: idempotency_constants_1.IDEMPOTENCY_SCOPES.opsApplicationCreate,
            idempotencyKey,
            handler: () => this.staff.create(user, {
                ...dto,
                customerSnapshot: { ...dto.customerSnapshot },
                installmentPlan: dto.installmentPlan,
            }),
        });
    }
    submitStaff(user, id) {
        return this.staff.submitDraft(user, id);
    }
    uploadDocStaff(user, id, dto, file) {
        return this.staff.uploadDoc(user, id, dto.category, file, this.storage);
    }
    patchOps(user, id, dto) {
        return this.apps.patchOps(user, id, dto);
    }
    clearIdentityHold(user, id, dto) {
        return this.apps.clearIdentityHold(user, id, dto.note);
    }
    unmask(user, id, dto) {
        return this.apps.unmask(user, id, dto.field, dto.reason);
    }
    tagLender(user, id, dto) {
        return this.apps.tagLender(user, id, {
            financePartnerId: dto.finance_partner_id,
            financePartnerBranchId: dto.finance_partner_branch_id ?? null,
        });
    }
    queue(user, query) {
        return this.apps.opsQueue(user, query);
    }
    transition(user, id, dto) {
        return this.apps.transition(user, id, dto.toStatus, dto.reason, dto.override_reason);
    }
    runComplianceCheck(user, id) {
        return this.compliance.runCheck(user, id);
    }
    approveContract(user, id, dto) {
        return this.lifecycle.approveWithContract(user, id, { overrideReason: dto?.override_reason });
    }
    activate(user, id, dto) {
        return this.lifecycle.activate(user, id, { direct: dto.direct, overrideReason: dto.override_reason });
    }
    recordDownPayment(user, id, dto, idempotencyKey) {
        return this.idempotency.run({
            userId: user.id,
            scope: idempotency_constants_1.IDEMPOTENCY_SCOPES.opsDownPayment(id),
            idempotencyKey,
            handler: () => this.lifecycle.recordDownPayment(user, id, dto),
        });
    }
    dealerLeads(user, query) {
        return this.apps.dealerLeads(user, query);
    }
    deleteOps(user, id) {
        return this.apps.deleteOps(user, id);
    }
    rebuildSchedule(user, id, dto) {
        return this.apps.rebuildSchedule(user, id, {
            ...dto,
            installmentPlan: dto.installmentPlan,
        });
    }
    convertDaily(user, id) {
        return this.apps.convertDailyToMonthly(user, id);
    }
    syncSchedules(user, id) {
        return this.apps.syncSchedulesFromPlan(user, id);
    }
};
exports.ApplicationsController = ApplicationsController;
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.customer),
    (0, common_1.Get)('applications/blocking'),
    __param(0, (0, guards_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('productId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ApplicationsController.prototype, "blocking", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.customer),
    (0, common_1.Get)('applications/mine'),
    __param(0, (0, guards_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, pagination_dto_1.PaginationQueryDto]),
    __metadata("design:returntype", void 0)
], ApplicationsController.prototype, "mine", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.customer),
    (0, common_1.Post)('applications'),
    __param(0, (0, guards_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Res)({ passthrough: true })),
    __param(3, (0, common_1.Headers)(idempotency_constants_1.IDEMPOTENCY_KEY_HEADER)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, CreateApplicationDto, Object, String]),
    __metadata("design:returntype", Promise)
], ApplicationsController.prototype, "create", null);
__decorate([
    (0, common_1.Get)('applications/:id'),
    __param(0, (0, guards_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ApplicationsController.prototype, "one", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.customer),
    (0, common_1.Patch)('applications/:id/draft'),
    __param(0, (0, guards_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, UpdateDraftDto]),
    __metadata("design:returntype", void 0)
], ApplicationsController.prototype, "updateDraft", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.customer),
    (0, common_1.Get)('applications/:id/document-slots'),
    __param(0, (0, guards_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ApplicationsController.prototype, "documentSlots", null);
__decorate([
    (0, guards_1.Roles)(...OPS_READ_ROLES),
    (0, common_1.Get)('ops/applications/:id/document-slots'),
    __param(0, (0, guards_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ApplicationsController.prototype, "documentSlotsOps", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.credit_officer, client_1.UserRole.finance_officer, client_1.UserRole.admin, client_1.UserRole.super_admin, client_1.UserRole.group_admin),
    (0, common_1.Get)('ops/applications/:id/credit-assessment'),
    __param(0, (0, guards_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ApplicationsController.prototype, "creditAssessment", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.customer),
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('applications/:id/submit'),
    __param(0, (0, guards_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ApplicationsController.prototype, "submit", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.customer),
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('applications/:id/resubmit'),
    __param(0, (0, guards_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ApplicationsController.prototype, "resubmit", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.customer),
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('applications/:id/cancel'),
    __param(0, (0, guards_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, CancelApplicationDto]),
    __metadata("design:returntype", void 0)
], ApplicationsController.prototype, "cancel", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.customer),
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('applications/:id/schedules/:scheduleId/defer'),
    __param(0, (0, guards_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Param)('scheduleId')),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, DeferPaymentDto]),
    __metadata("design:returntype", void 0)
], ApplicationsController.prototype, "deferPayment", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.customer),
    (0, common_1.Post)('applications/:id/documents'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', (0, multer_options_1.multerUploadOptions)())),
    __param(0, (0, guards_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, UploadDocumentDto, Object]),
    __metadata("design:returntype", void 0)
], ApplicationsController.prototype, "uploadDoc", null);
__decorate([
    (0, common_1.Get)('applications/:id/documents/:docId/file'),
    __param(0, (0, guards_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Param)('docId')),
    __param(3, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, Object]),
    __metadata("design:returntype", Promise)
], ApplicationsController.prototype, "downloadDoc", null);
__decorate([
    (0, common_1.Get)('applications/:id/contract/file'),
    __param(0, (0, guards_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], ApplicationsController.prototype, "downloadContract", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.customer),
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('applications/:id/contract/signed'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', (0, multer_options_1.multerUploadOptions)())),
    __param(0, (0, guards_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], ApplicationsController.prototype, "uploadSignedContract", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.credit_officer, client_1.UserRole.finance_officer, client_1.UserRole.admin, client_1.UserRole.super_admin),
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('ops/applications/:id/contract/signed'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', (0, multer_options_1.multerUploadOptions)())),
    __param(0, (0, guards_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], ApplicationsController.prototype, "uploadSignedContractOps", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.dealer_agent, client_1.UserRole.admin, client_1.UserRole.super_admin),
    (0, common_1.Post)('ops/applications'),
    __param(0, (0, guards_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)(idempotency_constants_1.IDEMPOTENCY_KEY_HEADER)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, StaffCreateApplicationDto, String]),
    __metadata("design:returntype", void 0)
], ApplicationsController.prototype, "createStaff", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.dealer_agent, client_1.UserRole.admin, client_1.UserRole.super_admin),
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('ops/applications/:id/submit'),
    __param(0, (0, guards_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ApplicationsController.prototype, "submitStaff", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.dealer_agent, client_1.UserRole.admin, client_1.UserRole.super_admin, client_1.UserRole.credit_officer),
    (0, common_1.Post)('ops/applications/:id/documents'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', (0, multer_options_1.multerUploadOptions)())),
    __param(0, (0, guards_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, UploadDocumentDto, Object]),
    __metadata("design:returntype", void 0)
], ApplicationsController.prototype, "uploadDocStaff", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.credit_officer, client_1.UserRole.admin, client_1.UserRole.super_admin),
    (0, common_1.Patch)('ops/applications/:id'),
    __param(0, (0, guards_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, PatchOpsApplicationDto]),
    __metadata("design:returntype", void 0)
], ApplicationsController.prototype, "patchOps", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.credit_officer, client_1.UserRole.admin, client_1.UserRole.super_admin),
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('ops/applications/:id/identity-hold/clear'),
    __param(0, (0, guards_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, ClearIdentityHoldDto]),
    __metadata("design:returntype", void 0)
], ApplicationsController.prototype, "clearIdentityHold", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.credit_officer, client_1.UserRole.finance_officer, client_1.UserRole.admin, client_1.UserRole.super_admin, client_1.UserRole.dealer_agent),
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('ops/applications/:id/unmask'),
    __param(0, (0, guards_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, UnmaskDto]),
    __metadata("design:returntype", void 0)
], ApplicationsController.prototype, "unmask", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.admin, client_1.UserRole.super_admin, client_1.UserRole.finance_officer),
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('ops/applications/:id/lender'),
    __param(0, (0, guards_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, TagLenderDto]),
    __metadata("design:returntype", void 0)
], ApplicationsController.prototype, "tagLender", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.credit_officer, client_1.UserRole.admin, client_1.UserRole.super_admin, client_1.UserRole.finance_officer),
    (0, common_1.Get)('ops/applications'),
    __param(0, (0, guards_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, OpsApplicationsQueryDto]),
    __metadata("design:returntype", void 0)
], ApplicationsController.prototype, "queue", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.credit_officer, client_1.UserRole.admin, client_1.UserRole.super_admin, client_1.UserRole.finance_officer),
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('ops/applications/:id/transition'),
    __param(0, (0, guards_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, TransitionDto]),
    __metadata("design:returntype", void 0)
], ApplicationsController.prototype, "transition", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.credit_officer, client_1.UserRole.finance_officer, client_1.UserRole.admin, client_1.UserRole.super_admin),
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('ops/applications/:id/compliance-check'),
    __param(0, (0, guards_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ApplicationsController.prototype, "runComplianceCheck", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.credit_officer, client_1.UserRole.finance_officer, client_1.UserRole.admin, client_1.UserRole.super_admin),
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('ops/applications/:id/approve-contract'),
    __param(0, (0, guards_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, ApproveContractDto]),
    __metadata("design:returntype", void 0)
], ApplicationsController.prototype, "approveContract", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.credit_officer, client_1.UserRole.admin, client_1.UserRole.super_admin),
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('ops/applications/:id/activate'),
    __param(0, (0, guards_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, ActivateDto]),
    __metadata("design:returntype", void 0)
], ApplicationsController.prototype, "activate", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.credit_officer, client_1.UserRole.finance_officer, client_1.UserRole.admin, client_1.UserRole.super_admin),
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('ops/applications/:id/down-payment'),
    __param(0, (0, guards_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, common_1.Headers)(idempotency_constants_1.IDEMPOTENCY_KEY_HEADER)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, RecordDownPaymentDto, String]),
    __metadata("design:returntype", void 0)
], ApplicationsController.prototype, "recordDownPayment", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.dealer_agent),
    (0, common_1.Get)('dealer/applications'),
    __param(0, (0, guards_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, DealerApplicationsQueryDto]),
    __metadata("design:returntype", void 0)
], ApplicationsController.prototype, "dealerLeads", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.admin, client_1.UserRole.super_admin),
    (0, common_1.Delete)('ops/applications/:id'),
    __param(0, (0, guards_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ApplicationsController.prototype, "deleteOps", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.admin, client_1.UserRole.super_admin),
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('ops/applications/:id/rebuild-schedule'),
    __param(0, (0, guards_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, RebuildScheduleDto]),
    __metadata("design:returntype", void 0)
], ApplicationsController.prototype, "rebuildSchedule", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.credit_officer, client_1.UserRole.admin, client_1.UserRole.super_admin),
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('ops/applications/:id/convert-daily-to-monthly'),
    __param(0, (0, guards_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ApplicationsController.prototype, "convertDaily", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.credit_officer, client_1.UserRole.finance_officer, client_1.UserRole.admin, client_1.UserRole.super_admin),
    (0, common_1.HttpCode)(200),
    (0, common_1.Post)('ops/applications/:id/sync-schedules'),
    __param(0, (0, guards_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ApplicationsController.prototype, "syncSchedules", null);
exports.ApplicationsController = ApplicationsController = __decorate([
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [applications_service_1.ApplicationsService,
        applications_lifecycle_service_1.ApplicationsLifecycleService,
        compliance_service_1.ComplianceService,
        idempotency_service_1.IdempotencyService,
        applications_staff_service_1.ApplicationsStaffService,
        storage_service_1.StorageService,
        customer_payments_service_1.CustomerPaymentsService])
], ApplicationsController);
//# sourceMappingURL=applications.controller.js.map