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
exports.PartnerService = void 0;
const node_path_1 = __importDefault(require("node:path"));
const common_1 = require("@nestjs/common");
const activity_service_1 = require("../common/activity.service");
const kyc_bridge_service_1 = require("../kyc/kyc-bridge.service");
const prisma_service_1 = require("../prisma/prisma.service");
const storage_service_1 = require("../storage/storage.service");
const partner_logic_1 = require("./partner-logic");
const PARTNER_INCLUDE = {
    company: { select: { name: true } },
    branch: { select: { name: true } },
    product: { select: { make: true, model: true, modelYear: true, price: true } },
    customer: { select: { name: true } },
    documents: {
        where: { category: { in: partner_logic_1.PARTNER_DOCUMENT_CATEGORIES } },
        select: { id: true, category: true, originalName: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
    },
};
let PartnerService = class PartnerService {
    prisma;
    activity;
    storage;
    kycBridge;
    constructor(prisma, activity, storage, kycBridge) {
        this.prisma = prisma;
        this.activity = activity;
        this.storage = storage;
        this.kycBridge = kycBridge;
    }
    async list(user, query) {
        const where = (0, partner_logic_1.partnerApplicationWhere)(this.partnerIdOf(user), query.status ?? null);
        const [rows, total] = await Promise.all([
            this.prisma.application.findMany({
                where,
                include: PARTNER_INCLUDE,
                orderBy: [{ submittedAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
                take: query.limit,
                skip: query.offset,
            }),
            this.prisma.application.count({ where }),
        ]);
        return {
            total,
            limit: query.limit,
            offset: query.offset,
            items: rows.map((row) => (0, partner_logic_1.toPartnerApplicationDto)(row, user.role)),
        };
    }
    async detail(user, id) {
        const row = await this.prisma.application.findFirst({
            where: { id, ...(0, partner_logic_1.partnerApplicationWhere)(this.partnerIdOf(user)) },
            include: PARTNER_INCLUDE,
        });
        if (!row)
            throw new common_1.NotFoundException('application_not_found');
        return (0, partner_logic_1.toPartnerApplicationDto)(row, user.role);
    }
    async documentFile(user, id, docId) {
        const partnerId = this.partnerIdOf(user);
        const app = await this.prisma.application.findFirst({
            where: { id, ...(0, partner_logic_1.partnerApplicationWhere)(partnerId) },
            select: { id: true },
        });
        if (!app)
            throw new common_1.NotFoundException('application_not_found');
        const doc = await this.prisma.applicationDocument.findFirst({ where: { id: docId, applicationId: app.id } });
        if (!doc || !(0, partner_logic_1.isPartnerVisibleDocument)(doc.category))
            throw new common_1.NotFoundException('document_not_found');
        const file = doc.storagePath.startsWith('kyc://')
            ? await this.kycBridge.readApplicationDocumentBytes(app.id, doc)
            : await this.readStored(doc);
        await this.activity.log({
            actorUserId: user.id,
            entityType: 'application',
            entityId: app.id,
            action: 'partner_document_viewed',
            metadata: { document_id: doc.id, category: doc.category, finance_partner_id: partnerId },
        });
        return file;
    }
    async summary(user) {
        const groups = await this.prisma.application.groupBy({
            by: ['status'],
            where: (0, partner_logic_1.partnerApplicationWhere)(this.partnerIdOf(user)),
            _count: { _all: true },
        });
        return (0, partner_logic_1.partnerSummary)(groups.map((group) => ({ status: group.status, count: group._count._all })));
    }
    partnerIdOf(user) {
        if (!user.financePartnerId)
            throw new common_1.ForbiddenException('partner_not_assigned');
        return user.financePartnerId;
    }
    async readStored(doc) {
        const file = await this.storage.readKyc(doc.storagePath);
        const ext = node_path_1.default.extname(doc.storagePath) || '.pdf';
        return {
            buffer: file.buffer,
            contentType: doc.mimeType ?? file.contentType,
            filename: doc.originalName?.trim() || `${doc.category}${ext}`,
        };
    }
};
exports.PartnerService = PartnerService;
exports.PartnerService = PartnerService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        activity_service_1.ActivityService,
        storage_service_1.StorageService,
        kyc_bridge_service_1.KycBridgeService])
], PartnerService);
//# sourceMappingURL=partner.service.js.map