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
exports.CustomersController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const client_1 = require("@prisma/client");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const guards_1 = require("../auth/guards");
const multer_options_1 = require("../common/multer-options");
const customer_documents_service_1 = require("./customer-documents.service");
const customers_service_1 = require("./customers.service");
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DATE_MESSAGE = 'dates must be YYYY-MM-DD';
class NotificationChannelsDto {
    email;
    sms;
    push;
    whatsapp;
}
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], NotificationChannelsDto.prototype, "email", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], NotificationChannelsDto.prototype, "sms", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], NotificationChannelsDto.prototype, "push", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], NotificationChannelsDto.prototype, "whatsapp", void 0);
class NotificationRemindersDto {
    payments;
    documents;
    takaful;
}
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], NotificationRemindersDto.prototype, "payments", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], NotificationRemindersDto.prototype, "documents", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], NotificationRemindersDto.prototype, "takaful", void 0);
class NotificationPreferencesPatchDto {
    channels;
    reminders;
}
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => NotificationChannelsDto),
    __metadata("design:type", NotificationChannelsDto)
], NotificationPreferencesPatchDto.prototype, "channels", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => NotificationRemindersDto),
    __metadata("design:type", NotificationRemindersDto)
], NotificationPreferencesPatchDto.prototype, "reminders", void 0);
class CustomerAddressPatchDto {
    line1;
    area;
    city;
    zone;
    po_box;
}
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(160),
    __metadata("design:type", Object)
], CustomerAddressPatchDto.prototype, "line1", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(80),
    __metadata("design:type", Object)
], CustomerAddressPatchDto.prototype, "area", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(80),
    __metadata("design:type", Object)
], CustomerAddressPatchDto.prototype, "city", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(20),
    __metadata("design:type", Object)
], CustomerAddressPatchDto.prototype, "zone", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(20),
    __metadata("design:type", Object)
], CustomerAddressPatchDto.prototype, "po_box", void 0);
class UpdateCustomerProfileDto {
    first_name;
    last_name;
    gender;
    date_of_birth;
    nationality;
    phone;
    preferred_language;
    notification_preferences;
    address;
}
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(80),
    __metadata("design:type", Object)
], UpdateCustomerProfileDto.prototype, "first_name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(80),
    __metadata("design:type", Object)
], UpdateCustomerProfileDto.prototype, "last_name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(Object.values(client_1.Gender)),
    __metadata("design:type", Object)
], UpdateCustomerProfileDto.prototype, "gender", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(10),
    __metadata("design:type", Object)
], UpdateCustomerProfileDto.prototype, "date_of_birth", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(80),
    __metadata("design:type", Object)
], UpdateCustomerProfileDto.prototype, "nationality", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(24),
    __metadata("design:type", Object)
], UpdateCustomerProfileDto.prototype, "phone", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['en', 'ar']),
    __metadata("design:type", String)
], UpdateCustomerProfileDto.prototype, "preferred_language", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => NotificationPreferencesPatchDto),
    __metadata("design:type", NotificationPreferencesPatchDto)
], UpdateCustomerProfileDto.prototype, "notification_preferences", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => CustomerAddressPatchDto),
    __metadata("design:type", CustomerAddressPatchDto)
], UpdateCustomerProfileDto.prototype, "address", void 0);
class UploadCustomerDocumentDto {
    category;
    document_number;
    issued_at;
    expires_at;
}
__decorate([
    (0, class_validator_1.IsIn)(Object.values(client_1.CustomerDocumentCategory)),
    __metadata("design:type", String)
], UploadCustomerDocumentDto.prototype, "category", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(40),
    __metadata("design:type", String)
], UploadCustomerDocumentDto.prototype, "document_number", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Matches)(ISO_DATE_PATTERN, { message: ISO_DATE_MESSAGE }),
    __metadata("design:type", String)
], UploadCustomerDocumentDto.prototype, "issued_at", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Matches)(ISO_DATE_PATTERN, { message: ISO_DATE_MESSAGE }),
    __metadata("design:type", String)
], UploadCustomerDocumentDto.prototype, "expires_at", void 0);
function sendFile(res, file) {
    const safeName = file.filename.replace(/[^\w.\-() ]+/g, '_');
    res.setHeader('Content-Type', file.contentType);
    res.setHeader('Content-Disposition', `inline; filename="${safeName}"`);
    res.send(file.buffer);
}
let CustomersController = class CustomersController {
    customers;
    documents;
    constructor(customers, documents) {
        this.customers = customers;
        this.documents = documents;
    }
    profile(user) {
        return this.customers.profile(user);
    }
    updateProfile(user, dto) {
        return this.customers.updateProfile(user, dto);
    }
    listDocuments(user) {
        return this.documents.list(user.id);
    }
    uploadDocument(user, dto, file) {
        return this.documents.upload(user, dto, file);
    }
    async downloadDocument(user, id, res) {
        sendFile(res, await this.documents.download(user, id));
    }
    deleteDocument(user, id) {
        return this.documents.softDelete(user, id);
    }
    opsListDocuments(user, userId) {
        return this.documents.listForOps(user, userId);
    }
    async opsDownloadDocument(user, userId, id, res) {
        sendFile(res, await this.documents.downloadForOps(user, userId, id));
    }
    opsVerifyDocument(user, userId, id) {
        return this.documents.verify(user, userId, id);
    }
};
exports.CustomersController = CustomersController;
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.customer),
    (0, common_1.Get)('me/profile'),
    __param(0, (0, guards_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], CustomersController.prototype, "profile", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.customer),
    (0, common_1.Patch)('me/profile'),
    __param(0, (0, guards_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, UpdateCustomerProfileDto]),
    __metadata("design:returntype", void 0)
], CustomersController.prototype, "updateProfile", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.customer),
    (0, common_1.Get)('me/documents'),
    __param(0, (0, guards_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], CustomersController.prototype, "listDocuments", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.customer),
    (0, common_1.Post)('me/documents'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', (0, multer_options_1.multerUploadOptions)())),
    __param(0, (0, guards_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, UploadCustomerDocumentDto, Object]),
    __metadata("design:returntype", void 0)
], CustomersController.prototype, "uploadDocument", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.customer),
    (0, common_1.Get)('me/documents/:id/file'),
    __param(0, (0, guards_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], CustomersController.prototype, "downloadDocument", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.customer),
    (0, common_1.Delete)('me/documents/:id'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, guards_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], CustomersController.prototype, "deleteDocument", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.credit_officer, client_1.UserRole.admin, client_1.UserRole.super_admin),
    (0, common_1.Get)('ops/customers/:userId/documents'),
    __param(0, (0, guards_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('userId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], CustomersController.prototype, "opsListDocuments", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.credit_officer, client_1.UserRole.admin, client_1.UserRole.super_admin),
    (0, common_1.Get)('ops/customers/:userId/documents/:id/file'),
    __param(0, (0, guards_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('userId')),
    __param(2, (0, common_1.Param)('id')),
    __param(3, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, Object]),
    __metadata("design:returntype", Promise)
], CustomersController.prototype, "opsDownloadDocument", null);
__decorate([
    (0, guards_1.Roles)(client_1.UserRole.credit_officer, client_1.UserRole.admin, client_1.UserRole.super_admin),
    (0, common_1.Post)('ops/customers/:userId/documents/:id/verify'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, guards_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('userId')),
    __param(2, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], CustomersController.prototype, "opsVerifyDocument", null);
exports.CustomersController = CustomersController = __decorate([
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [customers_service_1.CustomersService,
        customer_documents_service_1.CustomerDocumentsService])
], CustomersController);
//# sourceMappingURL=customers.controller.js.map