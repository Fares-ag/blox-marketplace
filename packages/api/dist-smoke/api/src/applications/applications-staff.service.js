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
exports.ApplicationsStaffService = void 0;
const node_crypto_1 = require("node:crypto");
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const auth_constants_1 = require("../auth/auth.constants");
const app_config_service_1 = require("../config/app-config.service");
const activity_service_1 = require("../common/activity.service");
const mail_service_1 = require("../mail/mail.service");
const prisma_service_1 = require("../prisma/prisma.service");
const application_pricing_1 = require("./application-pricing");
const installment_plan_1 = require("@drivemarket/shared/installment-plan");
const application_response_dto_1 = require("./application-response.dto");
const guarded_transitions_1 = require("./guarded-transitions");
const partner_finance_1 = require("./partner-finance");
const zoho_crm_service_1 = require("../integrations/zoho/zoho-crm.service");
const zoho_sync_policy_1 = require("../integrations/zoho/zoho-sync-policy");
const application_intake_service_1 = require("./application-intake.service");
const application_rules_1 = require("./application-rules");
const customer_snapshot_1 = require("./customer-snapshot");
const submit_gates_1 = require("./submit-gates");
const credit_assessment_1 = require("./credit-assessment");
function asJson(value) {
    return value;
}
let ApplicationsStaffService = class ApplicationsStaffService {
    prisma;
    activity;
    mail;
    appConfig;
    auth;
    zoho;
    intake;
    constructor(prisma, activity, mail, appConfig, auth, zoho, intake) {
        this.prisma = prisma;
        this.activity = activity;
        this.mail = mail;
        this.appConfig = appConfig;
        this.auth = auth;
        this.zoho = zoho;
        this.intake = intake;
    }
    audienceFor(actor) {
        return actor.role === client_1.UserRole.dealer_agent ? 'dealer' : 'ops';
    }
    async resolveBranchId(actor, agentUserId) {
        if (actor.homeBranchId)
            return actor.homeBranchId;
        if (agentUserId && agentUserId !== actor.id) {
            const agent = await this.prisma.user.findUnique({
                where: { id: agentUserId },
                select: { homeBranchId: true },
            });
            return agent?.homeBranchId ?? null;
        }
        return null;
    }
    async create(actor, dto) {
        const isDealer = actor.role === client_1.UserRole.dealer_agent;
        const isAdmin = actor.role === client_1.UserRole.admin || actor.role === client_1.UserRole.super_admin;
        if (!isDealer && !isAdmin)
            throw new common_1.ForbiddenException('forbidden_role');
        if (isDealer && !actor.companyId)
            throw new common_1.ForbiddenException('forbidden_role');
        const productIds = (dto.productIds?.length ? dto.productIds : dto.productId ? [dto.productId] : [])
            .map((id) => id.trim())
            .filter(Boolean);
        if (productIds.length === 0)
            throw new common_1.BadRequestException('validation_failed');
        const snap = dto.customerSnapshot;
        const email = String(snap.email ?? '').trim().toLowerCase();
        const phone = String(snap.phone ?? '').trim();
        const qid = String(snap.qid ?? '').trim();
        const full_name = String(snap.full_name ?? '').trim();
        if (!email || !phone || !qid || !full_name) {
            throw new common_1.BadRequestException('validation_failed');
        }
        const normalized = (0, customer_snapshot_1.normalizeCustomerSnapshot)({ ...snap, email, phone, qid, full_name });
        const customer = await this.findOrCreateWalkInCustomer(actor, {
            email,
            name: full_name,
            phone,
            qid: normalized.snapshot.qid,
            normalized,
        });
        const offer = await this.prisma.offer.findFirst({
            where: { id: dto.offerId, status: 'active' },
            include: { financePartner: { select: { crmAdapter: true } } },
        });
        if (!offer)
            throw new common_1.BadRequestException('validation_failed');
        const bulkBatchId = productIds.length > 1
            ? typeof crypto !== 'undefined' && crypto.randomUUID
                ? crypto.randomUUID()
                : `bulk-${Date.now()}`
            : undefined;
        const initialStatus = isDealer || dto.submit
            ? (0, partner_finance_1.submittedStatusForPartner)(offer.financePartner?.crmAdapter)
            : client_1.ApplicationStatus.draft;
        const agentUserId = dto.agentUserId || (isDealer ? actor.id : undefined);
        const branchId = await this.resolveBranchId(actor, agentUserId);
        const defaultLenderId = !offer.financePartnerId && initialStatus !== client_1.ApplicationStatus.draft
            ? await this.intake.defaultLenderId()
            : null;
        const lenderId = offer.financePartnerId ?? defaultLenderId;
        const qidHash = this.intake.qidHash(normalized.snapshot.qid);
        const identity = await this.intake.evaluateIdentity({
            userId: customer.id,
            qid: normalized.snapshot.qid,
            name: normalized.snapshot.full_name,
            birthYear: normalized.birthYear,
        });
        const enforcement = this.intake.ruleEnforcement();
        const firstProduct = await this.prisma.product.findUnique({ where: { id: productIds[0] } });
        if (!firstProduct)
            throw new common_1.BadRequestException('listing_not_available');
        const templateSellingPrice = Number(dto.sellingPrice ?? dto.listPrice ?? firstProduct.price);
        const templatePlan = dto.installmentPlan ??
            (0, installment_plan_1.buildPlanFromPricingSnapshot)({
                pricingSnapshot: dto.pricingSnapshot,
                vehiclePrice: templateSellingPrice,
            });
        const downPct = (0, installment_plan_1.resolveDownPaymentPercent)(templatePlan, templateSellingPrice);
        const createdIds = [];
        for (const productId of productIds) {
            const product = await this.prisma.product.findUnique({ where: { id: productId } });
            if (!product)
                throw new common_1.BadRequestException('listing_not_available');
            if (isDealer && product.companyId !== actor.companyId) {
                throw new common_1.ForbiddenException('forbidden_role');
            }
            if (isAdmin && dto.companyId && dto.companyId !== product.companyId) {
                throw new common_1.BadRequestException('company_mismatch');
            }
            if (product.listingStatus === client_1.ListingStatus.sold ||
                product.listingStatus === client_1.ListingStatus.archived) {
                throw new common_1.BadRequestException('listing_not_available');
            }
            if (initialStatus !== client_1.ApplicationStatus.draft) {
                if (product.listingStatus === client_1.ListingStatus.reserved) {
                    throw new common_1.ConflictException('vehicle_unavailable');
                }
                if (product.listingStatus !== client_1.ListingStatus.published) {
                    throw new common_1.BadRequestException('listing_not_available');
                }
                if (!(0, submit_gates_1.vehicleIdentityComplete)(product)) {
                    throw new common_1.ConflictException('vehicle_identity_incomplete');
                }
            }
            const listPrice = Number(dto.listPrice ?? product.price);
            const sellingPriceForProduct = Number(productIds.length === 1 ? templateSellingPrice : product.price);
            const pricingSnapshot = {
                ...(0, application_pricing_1.buildApplicationPricingSnapshot)({
                    listPrice: sellingPriceForProduct,
                    offer,
                    pricingSnapshot: dto.pricingSnapshot,
                }),
                list_price: listPrice,
                selling_price: sellingPriceForProduct,
                hide_interest: !!dto.hideInterest,
            };
            const violations = (0, application_rules_1.evaluateProductRules)({
                product,
                offer,
                pricingSnapshot,
                applicantType: normalized.snapshot.applicantType,
                residency: normalized.residency,
                enforcement,
            });
            (0, application_rules_1.assertNoHardViolations)(violations);
            const pricingWithFlags = (0, application_rules_1.withRuleFlags)(pricingSnapshot, violations);
            const installmentPlan = (0, installment_plan_1.planForVehicle)(templatePlan, sellingPriceForProduct, downPct) ?? templatePlan;
            const customerSnapshot = {
                ...normalized.snapshot,
                email,
                phone,
                qid: normalized.snapshot.qid,
                full_name,
                applicantType: normalized.snapshot.applicantType,
            };
            if (bulkBatchId)
                customerSnapshot.bulkBatchId = bulkBatchId;
            const assessed = initialStatus !== client_1.ApplicationStatus.draft
                ? (0, credit_assessment_1.assessApplicationCredit)({ customerSnapshot, pricingSnapshot: pricingWithFlags, product })
                : null;
            const now = new Date();
            const app = await this.prisma.$transaction(async (tx) => {
                const created = await tx.application.create({
                    data: {
                        customerUserId: customer.id,
                        customerEmail: customer.email,
                        customerSnapshot: asJson(customerSnapshot),
                        productId: product.id,
                        companyId: product.companyId,
                        offerId: offer.id,
                        financePartnerId: lenderId,
                        leadSource: 'walk_in',
                        pricingSnapshot: asJson(pricingWithFlags),
                        installmentPlan: asJson(installmentPlan),
                        status: initialStatus,
                        agentUserId: agentUserId ?? null,
                        branchId,
                        qidHash,
                        submittedAt: initialStatus !== client_1.ApplicationStatus.draft ? now : null,
                        ...this.intake.holdColumns(identity, now),
                        ...(assessed ? (0, credit_assessment_1.creditAssessmentData)(assessed) : {}),
                    },
                });
                if (initialStatus !== client_1.ApplicationStatus.draft) {
                    const reserved = await tx.product.updateMany({
                        where: { id: product.id, listingStatus: client_1.ListingStatus.published },
                        data: { listingStatus: client_1.ListingStatus.reserved },
                    });
                    if (reserved.count === 0 && product.listingStatus === client_1.ListingStatus.published) {
                        (0, guarded_transitions_1.assertRowsUpdated)(reserved.count, 'vehicle_unavailable');
                    }
                }
                return created;
            });
            await this.activity.log({
                actorUserId: actor.id,
                entityType: 'application',
                entityId: app.id,
                action: 'application_created',
                toValue: initialStatus,
                metadata: { staff: true, walk_in: true, branch_id: branchId },
            });
            if (assessed) {
                await this.activity.log({
                    actorUserId: actor.id,
                    entityType: 'application',
                    entityId: app.id,
                    action: 'credit_assessed',
                    toValue: assessed.assessment.path,
                    metadata: (0, credit_assessment_1.creditAssessedLogMetadata)(assessed, 'submit'),
                });
            }
            if (identity) {
                await this.intake.recordHold({
                    applicationId: app.id,
                    companyId: app.companyId,
                    actorUserId: actor.id,
                    decision: identity,
                });
            }
            if (defaultLenderId) {
                await this.activity.log({
                    actorUserId: actor.id,
                    entityType: 'application',
                    entityId: app.id,
                    action: 'lender_tagged',
                    toValue: defaultLenderId,
                    metadata: { source: 'default_lender' },
                });
            }
            createdIds.push(app.id);
            if (initialStatus !== client_1.ApplicationStatus.draft && (0, zoho_sync_policy_1.shouldSyncStatusToCrm)(initialStatus)) {
                void this.zoho.syncApplicationToZoho(app.id, actor.id);
            }
        }
        const first = await this.prisma.application.findUniqueOrThrow({
            where: { id: createdIds[0] },
        });
        return {
            ...(0, application_response_dto_1.mapApplicationDto)(first, this.audienceFor(actor)),
            created_ids: createdIds,
        };
    }
    async submitDraft(actor, id) {
        const isDealer = actor.role === client_1.UserRole.dealer_agent;
        const isAdmin = actor.role === client_1.UserRole.admin || actor.role === client_1.UserRole.super_admin;
        if (!isDealer && !isAdmin)
            throw new common_1.ForbiddenException('forbidden_role');
        const app = await this.prisma.application.findUnique({
            where: { id },
            include: {
                documents: { include: { uploadedBy: { select: { role: true } } } },
                product: true,
                financePartner: true,
            },
        });
        if (!app)
            throw new common_1.NotFoundException();
        if (isDealer && app.companyId !== actor.companyId)
            throw new common_1.ForbiddenException('forbidden_role');
        if (app.status !== client_1.ApplicationStatus.draft && app.status !== client_1.ApplicationStatus.resubmission_required) {
            throw new common_1.BadRequestException('invalid_status_transition');
        }
        const fromStatus = app.status;
        (0, submit_gates_1.assertSubmitGates)({
            application: app,
            documents: app.documents.map(({ uploadedBy, ...doc }) => ({ ...doc, uploadedByRole: uploadedBy?.role ?? null })),
            product: app.product,
            requireVehicleIdentity: fromStatus === client_1.ApplicationStatus.draft,
            guarantorConsentCompleted: await this.intake.guarantorConsentCompleted(id),
            identityPolicy: {
                ekycRequired: this.appConfig.kycEkycRequired,
                allowStaffManualIdentity: this.appConfig.kycAllowStaffManualIdentity,
            },
            now: new Date(),
        });
        const assessed = (0, credit_assessment_1.assessApplicationCredit)({
            customerSnapshot: app.customerSnapshot,
            pricingSnapshot: app.pricingSnapshot,
            product: app.product,
        });
        const nextStatus = (0, partner_finance_1.submittedStatusForPartner)(app.financePartner?.crmAdapter);
        const lenderId = app.financePartnerId ?? (await this.intake.defaultLenderId());
        const autoTagged = !app.financePartnerId && !!lenderId;
        const branchId = app.branchId ?? (await this.resolveBranchId(actor, app.agentUserId));
        const updated = await this.prisma.$transaction(async (tx) => {
            await (0, guarded_transitions_1.transitionApplication)(tx, id, fromStatus, {
                status: nextStatus,
                submittedAt: app.submittedAt ?? new Date(),
                ...(0, credit_assessment_1.creditAssessmentData)(assessed),
            });
            if (autoTagged || (branchId && branchId !== app.branchId)) {
                await tx.application.update({
                    where: { id },
                    data: {
                        ...(autoTagged ? { financePartnerId: lenderId } : {}),
                        ...(branchId && branchId !== app.branchId ? { branchId } : {}),
                    },
                });
            }
            if (fromStatus === client_1.ApplicationStatus.draft) {
                await tx.product.updateMany({
                    where: { id: app.productId, listingStatus: client_1.ListingStatus.published },
                    data: { listingStatus: client_1.ListingStatus.reserved },
                });
            }
            return tx.application.findUniqueOrThrow({ where: { id } });
        });
        await this.activity.log({
            actorUserId: actor.id,
            entityType: 'application',
            entityId: id,
            action: 'status_transition',
            fromValue: fromStatus,
            toValue: nextStatus,
        });
        await this.activity.log({
            actorUserId: actor.id,
            entityType: 'application',
            entityId: id,
            action: 'credit_assessed',
            toValue: assessed.assessment.path,
            metadata: (0, credit_assessment_1.creditAssessedLogMetadata)(assessed, 'submit'),
        });
        if (autoTagged) {
            await this.activity.log({
                actorUserId: actor.id,
                entityType: 'application',
                entityId: id,
                action: 'lender_tagged',
                toValue: lenderId,
                metadata: { source: 'default_lender' },
            });
        }
        if ((0, zoho_sync_policy_1.shouldSyncStatusToCrm)(nextStatus)) {
            void this.zoho.syncApplicationToZoho(id, actor.id);
        }
        return (0, application_response_dto_1.mapApplicationDto)(updated, this.audienceFor(actor));
    }
    async uploadDoc(actor, id, category, file, storage) {
        const app = await this.prisma.application.findUnique({ where: { id } });
        if (!app)
            throw new common_1.NotFoundException();
        const isDealer = actor.role === client_1.UserRole.dealer_agent && actor.companyId === app.companyId;
        const isOps = actor.role === client_1.UserRole.admin ||
            actor.role === client_1.UserRole.super_admin ||
            actor.role === client_1.UserRole.credit_officer;
        if (!isDealer && !isOps)
            throw new common_1.ForbiddenException('forbidden_role');
        if (!['draft', 'under_review', 'partner_processing', 'resubmission_required', 'contract_signing_required'].includes(app.status)) {
            throw new common_1.BadRequestException('validation_failed');
        }
        storage.assertKycFile(file);
        const key = await storage.uploadKyc(file, id, category);
        const doc = await this.prisma.applicationDocument.create({
            data: {
                applicationId: id,
                category: category,
                storagePath: key,
                mimeType: file.mimetype,
                originalName: file.originalname,
                uploadedById: actor.id,
            },
        });
        if ((0, zoho_sync_policy_1.shouldSyncStatusToCrm)(app.status)) {
            await this.zoho.syncApplicationToZoho(id, actor.id);
        }
        return {
            id: doc.id,
            category: doc.category,
            mime_type: doc.mimeType,
            created_at: doc.createdAt,
        };
    }
    async findOrCreateWalkInCustomer(actor, input) {
        const existing = await this.prisma.user.findUnique({ where: { email: input.email } });
        if (existing) {
            if (existing.role !== client_1.UserRole.customer) {
                throw new common_1.BadRequestException('email_not_customer');
            }
            await this.prisma.user.update({
                where: { id: existing.id },
                data: this.intake.userProfileData(existing, input.normalized),
            });
            return this.prisma.user.findUniqueOrThrow({ where: { id: existing.id } });
        }
        const password = `Tmp!${(0, node_crypto_1.randomBytes)(18).toString('base64url')}`;
        try {
            await this.auth.api.signUpEmail({
                body: { email: input.email, password, name: input.name },
            });
        }
        catch {
            const raced = await this.prisma.user.findUnique({ where: { email: input.email } });
            if (raced)
                return raced;
            throw new common_1.BadRequestException('walk_in_create_failed');
        }
        const created = await this.prisma.user.findUnique({ where: { email: input.email } });
        if (!created)
            throw new common_1.BadRequestException('walk_in_create_failed');
        await this.prisma.user.update({
            where: { id: created.id },
            data: {
                role: client_1.UserRole.customer,
                emailVerified: false,
                ...this.intake.userProfileData({ name: input.name, phone: input.phone, qid: input.qid }, input.normalized),
            },
        });
        const dealerName = actor.role === client_1.UserRole.dealer_agent && actor.companyId
            ? ((await this.prisma.company.findUnique({ where: { id: actor.companyId } }))?.name ?? actor.name)
            : actor.name;
        const resetUrl = this.appConfig.marketplacePath('/auth/forgot-password');
        try {
            await this.auth.api.requestPasswordReset({
                body: { email: input.email, redirectTo: this.appConfig.marketplacePath('/auth/reset-password') },
            });
        }
        catch {
        }
        await this.mail.sendWalkInInviteEmail(input.email, resetUrl, dealerName);
        return this.prisma.user.findUniqueOrThrow({ where: { id: created.id } });
    }
};
exports.ApplicationsStaffService = ApplicationsStaffService;
exports.ApplicationsStaffService = ApplicationsStaffService = __decorate([
    (0, common_1.Injectable)(),
    __param(4, (0, common_1.Inject)(auth_constants_1.AUTH_INSTANCE)),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        activity_service_1.ActivityService,
        mail_service_1.MailService,
        app_config_service_1.AppConfigService, Object, zoho_crm_service_1.ZohoCrmService,
        application_intake_service_1.ApplicationIntakeService])
], ApplicationsStaffService);
//# sourceMappingURL=applications-staff.service.js.map