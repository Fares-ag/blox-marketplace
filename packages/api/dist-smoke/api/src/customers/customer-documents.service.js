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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomerDocumentsService = void 0;
const node_path_1 = __importDefault(require("node:path"));
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const company_scope_1 = require("../applications/company-scope");
const activity_service_1 = require("../common/activity.service");
const encryption_service_1 = require("../common/encryption.service");
const prisma_service_1 = require("../prisma/prisma.service");
const storage_service_1 = require("../storage/storage.service");
const customer_profile_1 = require("./customer-profile");
const vault_logic_1 = require("./vault-logic");
let CustomerDocumentsService = class CustomerDocumentsService {
    prisma;
    storage;
    encryption;
    activity;
    constructor(prisma, storage, encryption, activity) {
        this.prisma = prisma;
        this.storage = storage;
        this.encryption = encryption;
        this.activity = activity;
    }
    async list(userId) {
        const docs = await this.prisma.customerDocument.findMany({
            where: { userId, deletedAt: null },
            orderBy: { createdAt: 'desc' },
        });
        return docs.map((doc) => this.toDto(doc));
    }
    async upload(user, input, file) {
        this.storage.assertCustomerUploadFile(file);
        const upload = file;
        const issuedAt = input.issued_at ? (0, customer_profile_1.parseIsoDate)(input.issued_at) : null;
        if (input.issued_at && !issuedAt)
            throw new common_1.BadRequestException('issued_at_invalid');
        const expiresAt = input.expires_at ? (0, customer_profile_1.parseIsoDate)(input.expires_at) : null;
        if (input.expires_at && !expiresAt)
            throw new common_1.BadRequestException('expires_at_invalid');
        if (issuedAt && expiresAt && expiresAt.getTime() < issuedAt.getTime()) {
            throw new common_1.BadRequestException('expires_before_issued');
        }
        const number = input.document_number?.trim() || null;
        const storagePath = await this.storage.uploadVaultDocument(upload, user.id, input.category);
        const doc = await this.prisma.customerDocument.create({
            data: {
                userId: user.id,
                category: input.category,
                storagePath,
                mimeType: upload.mimetype,
                originalName: upload.originalname?.slice(0, 200) || null,
                sizeBytes: upload.size ?? upload.buffer.length,
                documentNumberEnc: number ? this.encryption.encrypt(number) : null,
                issuedAt,
                expiresAt,
            },
        });
        await this.activity.log({
            actorUserId: user.id,
            entityType: 'customer_document',
            entityId: doc.id,
            action: 'vault_document_uploaded',
            metadata: { category: doc.category, has_expiry: Boolean(expiresAt), has_number: Boolean(number) },
        });
        return this.toDto(doc);
    }
    async download(user, id) {
        const doc = await this.findOwned(user.id, id);
        return this.readFile(doc);
    }
    async softDelete(user, id) {
        const doc = await this.findOwned(user.id, id);
        await this.prisma.customerDocument.update({ where: { id: doc.id }, data: { deletedAt: new Date() } });
        await this.activity.log({
            actorUserId: user.id,
            entityType: 'customer_document',
            entityId: doc.id,
            action: 'vault_document_deleted',
            metadata: { category: doc.category },
        });
        return { status: true };
    }
    async listForOps(actor, userId) {
        await this.assertOpsAccess(actor, userId);
        return this.list(userId);
    }
    async downloadForOps(actor, userId, id) {
        await this.assertOpsAccess(actor, userId);
        const doc = await this.findLive(userId, id);
        await this.activity.log({
            actorUserId: actor.id,
            entityType: 'customer_document',
            entityId: doc.id,
            action: 'vault_document_viewed',
            metadata: { user_id: userId, category: doc.category },
        });
        return this.readFile(doc);
    }
    async verify(actor, userId, id) {
        await this.assertOpsAccess(actor, userId);
        const doc = await this.findLive(userId, id);
        const updated = await this.prisma.customerDocument.update({
            where: { id: doc.id },
            data: { verifiedAt: new Date(), verifiedById: actor.id },
        });
        await this.activity.log({
            actorUserId: actor.id,
            entityType: 'customer_document',
            entityId: doc.id,
            action: 'vault_document_verified',
            fromValue: doc.verifiedAt ? 'verified' : 'unverified',
            toValue: 'verified',
            metadata: { user_id: userId, category: doc.category },
        });
        await this.activity.notify(userId, 'Document verified', `Your ${vault_logic_1.CUSTOMER_DOCUMENT_LABELS[doc.category]} has been verified by Blox.`, '/app/profile');
        return this.toDto(updated);
    }
    async assertOpsAccess(actor, userId) {
        const customer = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, role: true },
        });
        if (!customer || customer.role !== client_1.UserRole.customer)
            throw new common_1.NotFoundException('customer_not_found');
        if (actor.role === client_1.UserRole.admin || actor.role === client_1.UserRole.super_admin)
            return;
        const allowed = await (0, company_scope_1.opsCompanyFilter)(this.prisma, actor);
        if (allowed === null)
            return;
        const inScope = await this.prisma.application.count({
            where: { customerUserId: userId, companyId: { in: allowed } },
        });
        if (!inScope)
            throw new common_1.NotFoundException('customer_not_found');
    }
    async findOwned(userId, id) {
        return this.findLive(userId, id);
    }
    async findLive(userId, id) {
        const doc = await this.prisma.customerDocument.findFirst({ where: { id, userId, deletedAt: null } });
        if (!doc)
            throw new common_1.NotFoundException('document_not_found');
        return doc;
    }
    toDto(doc) {
        let number = null;
        if (doc.documentNumberEnc) {
            try {
                number = this.encryption.decrypt(doc.documentNumberEnc);
            }
            catch {
                number = null;
            }
        }
        return (0, vault_logic_1.toCustomerDocumentDto)(doc, number);
    }
    async readFile(doc) {
        const file = await this.storage.readKyc(doc.storagePath);
        const ext = node_path_1.default.extname(doc.storagePath) || '';
        const filename = doc.originalName?.trim() || `${doc.category}${ext}`;
        return { buffer: file.buffer, contentType: doc.mimeType ?? file.contentType, filename };
    }
};
exports.CustomerDocumentsService = CustomerDocumentsService;
exports.CustomerDocumentsService = CustomerDocumentsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        storage_service_1.StorageService,
        encryption_service_1.EncryptionService,
        activity_service_1.ActivityService])
], CustomerDocumentsService);
//# sourceMappingURL=customer-documents.service.js.map