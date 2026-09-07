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
exports.ApplicationsService = void 0;
const common_1 = require("@nestjs/common");
const node_path_1 = __importDefault(require("node:path"));
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../prisma/prisma.service");
const activity_service_1 = require("../common/activity.service");
const identity_service_1 = require("../common/identity.service");
const pagination_dto_1 = require("../common/pagination.dto");
const application_transitions_1 = require("./application-transitions");
const partner_finance_1 = require("./partner-finance");
const analytics_service_1 = require("../analytics/analytics.service");
const storage_service_1 = require("../storage/storage.service");
const zoho_crm_service_1 = require("../integrations/zoho/zoho-crm.service");
const zoho_sync_policy_1 = require("../integrations/zoho/zoho-sync-policy");
const application_pricing_1 = require("./application-pricing");
const application_documents_1 = require("./application-documents");
const application_access_1 = require("./application-access");
const applications_lifecycle_service_1 = require("./applications-lifecycle.service");
const application_intake_service_1 = require("./application-intake.service");
const kyc_bridge_service_1 = require("../kyc/kyc-bridge.service");
const company_scope_1 = require("./company-scope");
const guarded_transitions_1 = require("./guarded-transitions");
const separation_of_duties_1 = require("./separation-of-duties");
const installment_plan_sync_1 = require("./installment-plan-sync");
const installment_plan_1 = require("@drivemarket/shared/installment-plan");
const application_response_dto_1 = require("./application-response.dto");
const application_dedup_1 = require("./application-dedup");
const application_rules_1 = require("./application-rules");
const customer_snapshot_1 = require("./customer-snapshot");
const submit_gates_1 = require("./submit-gates");
const app_config_service_1 = require("../config/app-config.service");
const credit_assessment_1 = require("./credit-assessment");
function asJson(value) {
    return value;
}
let ApplicationsService = class ApplicationsService {
    prisma;
    activity;
    analytics;
    storage;
    lifecycle;
    zoho;
    kycBridge;
    intake;
    identity;
    appConfig;
    constructor(prisma, activity, analytics, storage, lifecycle, zoho, kycBridge, intake, identity, appConfig) {
        this.prisma = prisma;
        this.activity = activity;
        this.analytics = analytics;
        this.storage = storage;
        this.lifecycle = lifecycle;
        this.zoho = zoho;
        this.kycBridge = kycBridge;
        this.intake = intake;
        this.identity = identity;
        this.appConfig = appConfig;
    }
    identityPolicy() {
        return {
            ekycRequired: this.appConfig.kycEkycRequired,
            allowStaffManualIdentity: this.appConfig.kycAllowStaffManualIdentity,
        };
    }
    async hasBlocking(userId, productId) {
        const existing = await this.loadDedupCandidates(userId);
        return (0, application_response_dto_1.toApplicationBlockingDto)((0, application_dedup_1.summarizeBlocking)(existing, productId));
    }
    async loadDedupCandidates(userId) {
        return this.prisma.application.findMany({
            where: { customerUserId: userId, status: { in: application_access_1.BLOCKING_APPLICATION_STATUSES } },
            select: { id: true, status: true, productId: true, createdAt: true },
            orderBy: { createdAt: 'desc' },
        });
    }
    async create(user, dto) {
        if (user.role !== client_1.UserRole.customer)
            throw new common_1.ForbiddenException('forbidden_role');
        const product = await this.prisma.product.findUnique({
            where: { id: dto.productId },
            include: { defaultOffer: true },
        });
        if (!product ||
            product.listingStatus !== client_1.ListingStatus.published ||
            !product.financeEligible) {
            throw new common_1.BadRequestException('listing_not_available');
        }
        const resolvedOfferId = product.defaultOfferId ?? dto.offerId;
        (0, application_pricing_1.assertOfferMatchesProduct)(dto.offerId, resolvedOfferId);
        const offer = await this.prisma.offer.findFirst({
            where: { id: resolvedOfferId, status: 'active' },
        });
        if (!offer)
            throw new common_1.BadRequestException('validation_failed');
        const normalized = (0, customer_snapshot_1.normalizeCustomerSnapshot)(dto.customerSnapshot);
        const decision = (0, application_dedup_1.decideDuplicateApplication)(await this.loadDedupCandidates(user.id), product.id);
        if (decision.kind === 'blocked') {
            throw new common_1.ConflictException({ message: 'blocking_application', application_id: decision.applicationId });
        }
        if (decision.kind === 'resume') {
            return { id: decision.applicationId, resumed: true };
        }
        let listPrice = Number(product.price);
        let leadSource;
        if (dto.quoteToken) {
            const quote = await this.prisma.dealerQuote.findUnique({
                where: { token: dto.quoteToken },
            });
            if (!quote ||
                quote.productId !== product.id ||
                quote.usedAt ||
                quote.revokedAt ||
                quote.expiresAt.getTime() <= Date.now() ||
                quote.customerEmail.toLowerCase() !== user.email.toLowerCase()) {
                throw new common_1.BadRequestException('validation_failed');
            }
            listPrice = Number(quote.negotiatedPrice);
            leadSource = 'dealer_quote';
        }
        const pricingSnapshot = (0, application_pricing_1.buildApplicationPricingSnapshot)({
            listPrice,
            offer,
            pricingSnapshot: dto.pricingSnapshot,
        });
        const violations = (0, application_rules_1.evaluateProductRules)({
            product,
            offer,
            pricingSnapshot,
            applicantType: normalized.snapshot.applicantType,
            residency: normalized.residency,
            enforcement: this.intake.ruleEnforcement(),
        });
        (0, application_rules_1.assertNoHardViolations)(violations);
        const pricingWithFlags = (0, application_rules_1.withRuleFlags)(pricingSnapshot, violations);
        const qidHash = this.intake.qidHash(normalized.snapshot.qid);
        const identity = await this.intake.evaluateIdentity({
            userId: user.id,
            qid: normalized.snapshot.qid,
            name: normalized.snapshot.full_name,
            birthYear: normalized.birthYear,
        });
        const app = await this.prisma.$transaction(async (tx) => {
            const created = await tx.application.create({
                data: {
                    customerUserId: user.id,
                    customerEmail: user.email,
                    customerSnapshot: asJson(normalized.snapshot),
                    productId: product.id,
                    companyId: product.companyId,
                    offerId: offer.id,
                    financePartnerId: offer.financePartnerId,
                    leadSource,
                    pricingSnapshot: asJson(pricingWithFlags),
                    status: client_1.ApplicationStatus.draft,
                    qidHash,
                    ...this.intake.holdColumns(identity),
                },
            });
            if (dto.quoteToken) {
                const now = new Date();
                const redeemed = await tx.dealerQuote.updateMany({
                    where: {
                        token: dto.quoteToken,
                        usedAt: null,
                        revokedAt: null,
                        expiresAt: { gt: now },
                    },
                    data: { usedAt: now, usedByApplicationId: created.id },
                });
                (0, guarded_transitions_1.assertRowsUpdated)(redeemed.count, 'stale_transition');
            }
            await tx.user.update({
                where: { id: user.id },
                data: this.intake.userProfileData(user, normalized),
            });
            return created;
        });
        await this.activity.log({
            actorUserId: user.id,
            entityType: 'application',
            entityId: app.id,
            action: 'application_created',
            toValue: 'draft',
        });
        if (identity) {
            await this.intake.recordHold({
                applicationId: app.id,
                companyId: app.companyId,
                actorUserId: user.id,
                decision: identity,
            });
        }
        this.analytics.track('application_started', {
            application_id: app.id,
            product_id: app.productId,
            company_id: app.companyId,
        });
        return (0, application_response_dto_1.toApplicationDto)(app);
    }
    async updateDraft(user, id, body) {
        const app = await this.prisma.application.findUnique({
            where: { id },
            include: { product: true, offer: true },
        });
        if (!app || app.customerUserId !== user.id)
            throw new common_1.ForbiddenException('forbidden_role');
        if (app.status !== client_1.ApplicationStatus.draft) {
            throw new common_1.BadRequestException('invalid_status_transition');
        }
        let offer = app.offer;
        const offerChanged = !!body.offerId && body.offerId !== app.offerId;
        if (offerChanged) {
            const resolvedOfferId = app.product.defaultOfferId ?? body.offerId;
            (0, application_pricing_1.assertOfferMatchesProduct)(body.offerId, resolvedOfferId);
            const next = await this.prisma.offer.findFirst({
                where: { id: resolvedOfferId, status: 'active' },
            });
            if (!next)
                throw new common_1.BadRequestException('validation_failed');
            offer = next;
        }
        const currentSnapshot = app.customerSnapshot ?? {};
        const normalized = (0, customer_snapshot_1.normalizeCustomerSnapshot)({
            ...currentSnapshot,
            ...(body.customerSnapshot ?? {}),
        });
        const currentPricing = app.pricingSnapshot ?? {};
        const listPrice = Number(currentPricing.list_price ?? app.product.price);
        const pricingSnapshot = (0, application_pricing_1.buildApplicationPricingSnapshot)({
            listPrice,
            offer,
            pricingSnapshot: { ...currentPricing, ...(body.pricingSnapshot ?? {}) },
        });
        if (currentPricing.hide_interest !== undefined) {
            pricingSnapshot.hide_interest = currentPricing.hide_interest;
        }
        const violations = (0, application_rules_1.evaluateProductRules)({
            product: app.product,
            offer,
            pricingSnapshot,
            applicantType: normalized.snapshot.applicantType,
            residency: normalized.residency,
            enforcement: this.intake.ruleEnforcement(),
        });
        (0, application_rules_1.assertNoHardViolations)(violations);
        const pricingWithFlags = (0, application_rules_1.withRuleFlags)(pricingSnapshot, violations);
        const qidHash = this.intake.qidHash(normalized.snapshot.qid);
        const qidChanged = qidHash !== app.qidHash;
        const holdActive = (0, submit_gates_1.identityHoldActive)(app);
        const identity = !holdActive && (qidChanged || !app.identityHoldAt)
            ? await this.intake.evaluateIdentity({
                userId: user.id,
                qid: normalized.snapshot.qid,
                name: normalized.snapshot.full_name,
                birthYear: normalized.birthYear,
            })
            : null;
        await this.prisma.$transaction(async (tx) => {
            await tx.application.update({
                where: { id },
                data: {
                    customerSnapshot: asJson(normalized.snapshot),
                    pricingSnapshot: asJson(pricingWithFlags),
                    qidHash,
                    ...(offerChanged
                        ? {
                            offer: { connect: { id: offer.id } },
                            financePartner: offer.financePartnerId
                                ? { connect: { id: offer.financePartnerId } }
                                : { disconnect: true },
                        }
                        : {}),
                    ...this.intake.holdColumns(identity),
                },
            });
            await tx.user.update({
                where: { id: user.id },
                data: this.intake.userProfileData(user, normalized),
            });
        });
        await this.activity.log({
            actorUserId: user.id,
            entityType: 'application',
            entityId: id,
            action: 'application_updated',
            metadata: { draft: true, offer_changed: offerChanged },
        });
        if (identity) {
            await this.intake.recordHold({
                applicationId: id,
                companyId: app.companyId,
                actorUserId: user.id,
                decision: identity,
            });
        }
        return this.getOne(user, id);
    }
    async documentSlots(user, id) {
        const app = await this.prisma.application.findUnique({
            where: { id },
            select: { id: true, customerUserId: true, companyId: true, customerSnapshot: true, kycCaseId: true },
        });
        if (!app)
            throw new common_1.NotFoundException();
        await (0, application_access_1.assertApplicationCanView)(this.prisma, user, app);
        const documents = await this.loadDocumentsForSubmit(id, app.kycCaseId);
        return (0, application_documents_1.documentSlotsForApplication)(app.customerSnapshot, documents, new Date(), this.identityPolicy());
    }
    async creditAssessment(user, id) {
        const allowed = [
            client_1.UserRole.credit_officer,
            client_1.UserRole.finance_officer,
            client_1.UserRole.admin,
            client_1.UserRole.super_admin,
            client_1.UserRole.group_admin,
        ];
        if (!allowed.includes(user.role))
            throw new common_1.ForbiddenException('forbidden_role');
        const app = await this.prisma.application.findUnique({
            where: { id },
            select: {
                id: true,
                customerUserId: true,
                companyId: true,
                customerSnapshot: true,
                pricingSnapshot: true,
                product: { select: { attributes: true, bodyType: true } },
            },
        });
        if (!app)
            throw new common_1.NotFoundException();
        await (0, application_access_1.assertApplicationCanView)(this.prisma, user, app);
        return (0, credit_assessment_1.toCreditAssessmentDto)((0, credit_assessment_1.assessApplicationCredit)(app), user.role);
    }
    async loadDocumentsForSubmit(applicationId, kycCaseId) {
        if (kycCaseId) {
            try {
                await this.kycBridge.syncDocumentsForApplication(applicationId);
            }
            catch {
            }
        }
        const rows = await this.prisma.applicationDocument.findMany({
            where: { applicationId },
            orderBy: { createdAt: 'asc' },
            include: { uploadedBy: { select: { role: true } } },
        });
        return rows.map(({ uploadedBy, ...doc }) => ({ ...doc, uploadedByRole: uploadedBy?.role ?? null }));
    }
    async submit(user, id) {
        const app = await this.prisma.application.findUnique({
            where: { id },
            include: { documents: true, product: true, financePartner: true },
        });
        if (!app || app.customerUserId !== user.id)
            throw new common_1.ForbiddenException('forbidden_role');
        if (app.status !== 'draft' && app.status !== 'resubmission_required') {
            throw new common_1.BadRequestException('invalid_status_transition');
        }
        const documents = await this.loadDocumentsForSubmit(id, app.kycCaseId);
        (0, submit_gates_1.assertSubmitGates)({
            application: app,
            documents,
            product: app.product,
            requireVehicleIdentity: app.status === client_1.ApplicationStatus.draft,
            guarantorConsentCompleted: await this.intake.guarantorConsentCompleted(id),
            identityPolicy: this.identityPolicy(),
            now: new Date(),
        });
        if (app.product.listingStatus !== client_1.ListingStatus.published && app.status === 'draft') {
            throw new common_1.BadRequestException('listing_not_available');
        }
        const fromStatus = app.status;
        const assessed = (0, credit_assessment_1.assessApplicationCredit)({
            customerSnapshot: app.customerSnapshot,
            pricingSnapshot: app.pricingSnapshot,
            product: app.product,
        });
        const nextStatus = (0, partner_finance_1.submittedStatusForPartner)(app.financePartner?.crmAdapter);
        const lenderId = app.financePartnerId ?? (await this.intake.defaultLenderId());
        const autoTagged = !app.financePartnerId && !!lenderId;
        const updated = await this.prisma.$transaction(async (tx) => {
            await (0, guarded_transitions_1.transitionApplication)(tx, id, fromStatus, {
                status: nextStatus,
                submittedAt: app.submittedAt ?? new Date(),
                ...(0, credit_assessment_1.creditAssessmentData)(assessed),
            });
            if (autoTagged) {
                await tx.application.update({ where: { id }, data: { financePartnerId: lenderId } });
            }
            if (fromStatus === client_1.ApplicationStatus.draft) {
                const reserved = await tx.product.updateMany({
                    where: { id: app.productId, listingStatus: client_1.ListingStatus.published },
                    data: { listingStatus: client_1.ListingStatus.reserved },
                });
                (0, guarded_transitions_1.assertRowsUpdated)(reserved.count, 'vehicle_unavailable');
            }
            return tx.application.findUniqueOrThrow({ where: { id } });
        });
        await this.activity.log({
            actorUserId: user.id,
            entityType: 'application',
            entityId: id,
            action: 'status_transition',
            fromValue: app.status,
            toValue: nextStatus,
        });
        await this.activity.log({
            actorUserId: user.id,
            entityType: 'application',
            entityId: id,
            action: 'credit_assessed',
            toValue: assessed.assessment.path,
            metadata: (0, credit_assessment_1.creditAssessedLogMetadata)(assessed, 'submit'),
        });
        if (autoTagged) {
            await this.activity.log({
                actorUserId: user.id,
                entityType: 'application',
                entityId: id,
                action: 'lender_tagged',
                toValue: lenderId,
                metadata: { source: 'default_lender' },
            });
        }
        if (nextStatus === client_1.ApplicationStatus.under_review) {
            await this.notifyOpsOnSubmit(app.companyId, id);
        }
        await this.syncToCrmIfNeeded(id, nextStatus, user.id);
        this.analytics.track('application_submitted', {
            application_id: id,
            product_id: app.productId,
            company_id: app.companyId,
            is_resubmit: fromStatus === client_1.ApplicationStatus.resubmission_required,
        });
        return (0, application_response_dto_1.toApplicationDto)(updated);
    }
    async listMine(user, query = {}) {
        const { limit, offset } = (0, pagination_dto_1.resolvePagination)(query, { defaultLimit: 50, maxLimit: 100 });
        const where = { customerUserId: user.id };
        const [items, total] = await Promise.all([
            this.prisma.application.findMany({
                where,
                include: {
                    product: { select: { make: true, model: true, modelYear: true, slug: true, price: true } },
                },
                orderBy: { createdAt: 'desc' },
                take: limit,
                skip: offset,
            }),
            this.prisma.application.count({ where }),
        ]);
        return (0, pagination_dto_1.toPaginatedResponse)(items.map((item) => (0, application_response_dto_1.toApplicationListItemDto)(item)), total, limit, offset);
    }
    async getOne(user, id) {
        const app = await this.prisma.application.findUnique({
            where: { id },
            include: {
                product: true,
                documents: true,
                company: {
                    select: { id: true, name: true, allowDirectActivate: true, separationOfDutiesEnabled: true },
                },
                customer: { select: { name: true, email: true, phone: true } },
                offer: true,
                financePartner: { select: { id: true, name: true, code: true, crmAdapter: true } },
                branch: { select: { id: true, name: true, code: true } },
                takafulPolicies: { orderBy: { createdAt: 'desc' } },
                agent: { select: { id: true, name: true, email: true } },
                paymentSchedules: { orderBy: { sequence: 'asc' } },
                paymentTransactions: { orderBy: { createdAt: 'desc' }, take: 50 },
                complianceChecks: { orderBy: { createdAt: 'desc' }, take: 5 },
            },
        });
        if (!app)
            throw new common_1.NotFoundException();
        await (0, application_access_1.assertApplicationCanView)(this.prisma, user, app);
        const audience = this.audienceForUser(user, app);
        const identityHoldClearedByName = await this.identityHoldClearedByName(app.identityHoldClearedById);
        let kycVerification = null;
        if ((audience === 'ops' || audience === 'dealer') && app.kycCaseId) {
            try {
                await this.kycBridge.syncDocumentsForApplication(id);
                app.documents = await this.prisma.applicationDocument.findMany({
                    where: { applicationId: id },
                    orderBy: { createdAt: 'asc' },
                });
                kycVerification = await this.kycBridge.getVerificationSummary(id, app.kycCaseId, app.kycStatus);
            }
            catch {
            }
        }
        const dto = (0, application_response_dto_1.mapApplicationDto)({ ...app, identityHoldClearedByName }, audience);
        if (audience === 'ops' || audience === 'dealer') {
            if (kycVerification)
                dto.kyc_verification = kycVerification;
            dto.agent = app.agent
                ? { id: app.agent.id, name: app.agent.name, email: app.agent.email }
                : null;
            dto.allow_direct_activate = app.company?.allowDirectActivate ?? false;
            dto.payment_transactions = app.paymentTransactions.map((txn) => ({
                id: txn.id,
                gateway: txn.gateway,
                amount: Number(txn.amount),
                status: txn.status,
                created_at: txn.createdAt.toISOString(),
                receipt_url: txn.rawPayloadRef ?? null,
            }));
        }
        if (audience === 'ops') {
            const sodEnabled = (0, separation_of_duties_1.separationOfDutiesEnabled)({
                companyFlag: app.company?.separationOfDutiesEnabled,
            });
            const creditApproverId = sodEnabled ? await (0, separation_of_duties_1.resolveCreditApproverId)(this.prisma, id) : null;
            dto.separation_of_duties_blocked = (0, separation_of_duties_1.violatesSeparationOfDuties)(user.id, creditApproverId);
            const logs = await this.prisma.activityLog.findMany({
                where: { entityType: 'application', entityId: id },
                include: { actor: { select: { email: true, name: true, role: true } } },
                orderBy: { createdAt: 'desc' },
                take: 80,
            });
            const isSuper = user.role === client_1.UserRole.super_admin;
            dto.activity_logs = logs
                .filter((l) => (isSuper ? true : l.action !== 'comment'))
                .map((l) => ({
                id: l.id,
                action: l.action,
                from_value: l.fromValue,
                to_value: l.toValue,
                actor_email: l.actor?.email ?? null,
                actor_role: l.actor?.role ?? null,
                metadata: isSuper || user.role === client_1.UserRole.admin ? l.metadata : undefined,
                created_at: l.createdAt.toISOString(),
            }));
            dto.comments = logs
                .filter((l) => l.action === 'comment')
                .map((l) => ({
                id: l.id,
                body: l.toValue,
                actor_email: l.actor?.email ?? null,
                created_at: l.createdAt.toISOString(),
            }));
            dto.compliance_checks = app.complianceChecks.map((c) => ({
                id: c.id,
                overall_status: c.overallStatus,
                created_at: c.createdAt.toISOString(),
            }));
        }
        return dto;
    }
    async identityHoldClearedByName(userId) {
        if (!userId)
            return null;
        const clearedBy = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { name: true, email: true },
        });
        return clearedBy?.name?.trim() || clearedBy?.email || null;
    }
    async opsQueue(user, query = {}) {
        const allowed = [
            client_1.UserRole.credit_officer,
            client_1.UserRole.admin,
            client_1.UserRole.super_admin,
            client_1.UserRole.finance_officer,
            client_1.UserRole.group_admin,
        ];
        if (!allowed.includes(user.role)) {
            throw new common_1.ForbiddenException('forbidden_role');
        }
        const { limit, offset } = (0, pagination_dto_1.resolvePagination)(query, { defaultLimit: 50, maxLimit: 200 });
        const companyFilter = await (0, company_scope_1.opsCompanyFilter)(this.prisma, user);
        const statusIn = this.parseStatusIn(query.status, query.statusIn, user.role);
        const search = query.q?.trim();
        const createdFrom = query.createdFrom ? new Date(query.createdFrom) : undefined;
        const createdTo = query.createdTo ? new Date(query.createdTo) : undefined;
        const requestedCompany = query.companyId?.trim();
        const scopedCompanyIds = companyFilter
            ? requestedCompany
                ? companyFilter.filter((id) => id === requestedCompany)
                : companyFilter
            : requestedCompany
                ? [requestedCompany]
                : undefined;
        const financePartnerId = query.financePartnerId?.trim();
        const where = {
            ...(statusIn ? { status: { in: statusIn } } : {}),
            ...(scopedCompanyIds ? { companyId: { in: scopedCompanyIds } } : {}),
            ...(financePartnerId ? { financePartnerId } : {}),
            ...(createdFrom && !Number.isNaN(createdFrom.getTime()) ? { createdAt: { gte: createdFrom } } : {}),
            ...(createdTo && !Number.isNaN(createdTo.getTime())
                ? { createdAt: { ...(createdFrom ? { gte: createdFrom } : {}), lte: createdTo } }
                : {}),
            ...(query.scheduleHealth === 'overdue'
                ? { paymentSchedules: { some: { status: 'overdue' } } }
                : query.scheduleHealth === 'on_track'
                    ? { paymentSchedules: { some: {}, none: { status: 'overdue' } } }
                    : query.scheduleHealth === 'none'
                        ? { paymentSchedules: { none: {} } }
                        : {}),
            ...(search
                ? {
                    OR: [
                        { customerEmail: { contains: search, mode: 'insensitive' } },
                        { id: { contains: search, mode: 'insensitive' } },
                        { customer: { name: { contains: search, mode: 'insensitive' } } },
                        { company: { name: { contains: search, mode: 'insensitive' } } },
                        { agent: { name: { contains: search, mode: 'insensitive' } } },
                    ],
                }
                : {}),
        };
        const [items, total] = await Promise.all([
            this.prisma.application.findMany({
                where,
                include: {
                    product: { select: { make: true, model: true, modelYear: true, slug: true, price: true } },
                    company: { select: { name: true } },
                    customer: { select: { name: true, email: true } },
                    agent: { select: { id: true, name: true, email: true } },
                    paymentSchedules: { select: { status: true, dueDate: true } },
                    financePartner: { select: { id: true, name: true, code: true, crmAdapter: true } },
                    branch: { select: { id: true, name: true } },
                },
                orderBy: { createdAt: 'asc' },
                take: limit,
                skip: offset,
            }),
            this.prisma.application.count({ where }),
        ]);
        const metricsRows = await this.prisma.application.findMany({
            where,
            select: {
                pricingSnapshot: true,
                paymentSchedules: { select: { remainingAmount: true, amount: true } },
            },
            take: 500,
        });
        let loanValue = 0;
        let receivable = 0;
        let paymentCount = 0;
        let paymentSum = 0;
        for (const row of metricsRows) {
            const pricing = row.pricingSnapshot ?? {};
            loanValue += Number(pricing.financed_total ?? pricing.list_price ?? 0);
            for (const schedule of row.paymentSchedules) {
                receivable += Number(schedule.remainingAmount);
                paymentSum += Number(schedule.amount);
                paymentCount += 1;
            }
        }
        return {
            ...(0, pagination_dto_1.toPaginatedResponse)(items.map((item) => (0, application_response_dto_1.toOpsApplicationQueueItemDto)(item)), total, limit, offset),
            metrics: {
                loan_value: Math.round(loanValue),
                receivable: Math.round(receivable),
                avg_payment: paymentCount ? Math.round(paymentSum / paymentCount) : 0,
            },
        };
    }
    async dealerLeads(user, query = {}) {
        if (user.role !== client_1.UserRole.dealer_agent || !user.companyId) {
            throw new common_1.ForbiddenException('forbidden_role');
        }
        const { limit, offset } = (0, pagination_dto_1.resolvePagination)(query, { defaultLimit: 50, maxLimit: 100 });
        const search = query.q?.trim();
        const tab = query.tab?.trim();
        const where = {
            companyId: user.companyId,
            ...(query.status ? { status: query.status } : {}),
            ...(tab === 'mine' ? { agentUserId: user.id } : {}),
            ...(tab === 'resubmission' ? { status: client_1.ApplicationStatus.resubmission_required } : {}),
            ...(search
                ? {
                    OR: [
                        { customerEmail: { contains: search, mode: 'insensitive' } },
                        { customer: { name: { contains: search, mode: 'insensitive' } } },
                        { id: { contains: search, mode: 'insensitive' } },
                    ],
                }
                : {}),
        };
        const [items, total] = await Promise.all([
            this.prisma.application.findMany({
                where,
                include: {
                    product: { select: { make: true, model: true, modelYear: true, slug: true } },
                    customer: { select: { name: true, email: true, phone: true } },
                    agent: { select: { id: true, name: true, email: true } },
                    financePartner: { select: { id: true, name: true } },
                    branch: { select: { id: true, name: true } },
                },
                orderBy: { createdAt: 'desc' },
                take: limit,
                skip: offset,
            }),
            this.prisma.application.count({ where }),
        ]);
        return (0, pagination_dto_1.toPaginatedResponse)(items.map((item) => (0, application_response_dto_1.toDealerApplicationListItemDto)(item)), total, limit, offset);
    }
    async patchOps(user, id, body) {
        const isAdmin = user.role === client_1.UserRole.admin || user.role === client_1.UserRole.super_admin;
        const isCredit = user.role === client_1.UserRole.credit_officer;
        if (!isAdmin && !isCredit)
            throw new common_1.ForbiddenException('forbidden_role');
        const app = await this.prisma.application.findUnique({ where: { id } });
        if (!app)
            throw new common_1.NotFoundException();
        await (0, application_access_1.assertApplicationCanView)(this.prisma, user, app);
        if (body.comment?.trim()) {
            await this.activity.log({
                actorUserId: user.id,
                entityType: 'application',
                entityId: id,
                action: 'comment',
                toValue: body.comment.trim(),
            });
        }
        const data = {};
        if (isAdmin && body.agentUserId !== undefined) {
            data.agent = body.agentUserId ? { connect: { id: body.agentUserId } } : { disconnect: true };
        }
        if (isAdmin && body.companyId) {
            data.company = { connect: { id: body.companyId } };
        }
        if (body.customerSnapshot && typeof body.customerSnapshot === 'object') {
            const normalized = (0, customer_snapshot_1.normalizeCustomerSnapshot)({
                ...(app.customerSnapshot ?? {}),
                ...body.customerSnapshot,
            }, { requireContact: false });
            data.customerSnapshot = asJson(normalized.snapshot);
            data.qidHash = this.intake.qidHash(normalized.snapshot.qid);
        }
        if (body.hideInterest !== undefined) {
            const pricing = app.pricingSnapshot ?? {};
            data.pricingSnapshot = asJson({ ...pricing, hide_interest: body.hideInterest });
        }
        if (Object.keys(data).length > 0) {
            await this.prisma.application.update({ where: { id }, data });
            await this.activity.log({
                actorUserId: user.id,
                entityType: 'application',
                entityId: id,
                action: 'application_updated',
            });
        }
        return this.getOne(user, id);
    }
    async clearIdentityHold(user, id, note) {
        const allowed = [client_1.UserRole.credit_officer, client_1.UserRole.admin, client_1.UserRole.super_admin];
        if (!allowed.includes(user.role))
            throw new common_1.ForbiddenException('forbidden_role');
        const app = await this.prisma.application.findUnique({ where: { id } });
        if (!app)
            throw new common_1.NotFoundException();
        await (0, application_access_1.assertApplicationCanView)(this.prisma, user, app);
        if (!(0, submit_gates_1.identityHoldActive)(app))
            throw new common_1.BadRequestException('no_identity_hold');
        const now = new Date();
        await this.prisma.application.update({
            where: { id },
            data: { identityHoldClearedAt: now, identityHoldClearedById: user.id },
        });
        await this.activity.log({
            actorUserId: user.id,
            entityType: 'application',
            entityId: id,
            action: 'identity_hold_cleared',
            fromValue: app.identityHoldReason ?? null,
            metadata: { note: note?.trim() || null },
        });
        return this.getOne(user, id);
    }
    async unmask(user, id, field, reason) {
        if (user.role === client_1.UserRole.customer)
            throw new common_1.ForbiddenException('forbidden_role');
        const app = await this.prisma.application.findUnique({
            where: { id },
            include: { customer: { select: { qid: true, qidEnc: true, phone: true } } },
        });
        if (!app)
            throw new common_1.NotFoundException();
        await (0, application_access_1.assertApplicationCanView)(this.prisma, user, app);
        const snapshot = (0, customer_snapshot_1.readCustomerSnapshot)(app.customerSnapshot);
        const value = field === 'qid'
            ? snapshot.qid || this.identity.readQid(app.customer) || null
            : snapshot.phone || app.customer?.phone || null;
        await this.activity.log({
            actorUserId: user.id,
            entityType: 'application',
            entityId: id,
            action: 'pii_unmask',
            toValue: field,
            metadata: { field, reason: reason.trim() },
        });
        return { field, value };
    }
    async tagLender(user, id, body) {
        const allowed = [client_1.UserRole.admin, client_1.UserRole.super_admin, client_1.UserRole.finance_officer];
        if (!allowed.includes(user.role))
            throw new common_1.ForbiddenException('forbidden_role');
        const app = await this.prisma.application.findUnique({ where: { id } });
        if (!app)
            throw new common_1.NotFoundException();
        await (0, application_access_1.assertApplicationCanView)(this.prisma, user, app);
        const partner = await this.prisma.financePartner.findUnique({
            where: { id: body.financePartnerId },
            select: { id: true, name: true, active: true },
        });
        if (!partner || !partner.active)
            throw new common_1.BadRequestException('finance_partner_not_found');
        let branchId = null;
        if (body.financePartnerBranchId) {
            const branch = await this.prisma.financePartnerBranch.findFirst({
                where: { id: body.financePartnerBranchId, partnerId: partner.id },
                select: { id: true },
            });
            if (!branch)
                throw new common_1.BadRequestException('finance_partner_branch_not_found');
            branchId = branch.id;
        }
        await this.prisma.application.update({
            where: { id },
            data: { financePartnerId: partner.id, financePartnerBranchId: branchId },
        });
        await this.activity.log({
            actorUserId: user.id,
            entityType: 'application',
            entityId: id,
            action: 'lender_tagged',
            fromValue: app.financePartnerId ?? null,
            toValue: partner.id,
            metadata: { finance_partner_name: partner.name, finance_partner_branch_id: branchId },
        });
        return this.getOne(user, id);
    }
    parseStatusIn(status, statusIn, role) {
        if (status)
            return [status];
        if (statusIn?.trim()) {
            return statusIn
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean);
        }
        if (role === client_1.UserRole.credit_officer)
            return [...application_transitions_1.CREDIT_QUEUE_STATUSES];
        if (role === client_1.UserRole.finance_officer) {
            return [
                client_1.ApplicationStatus.down_payment_required,
                client_1.ApplicationStatus.down_payment_submitted,
                client_1.ApplicationStatus.pending_finance_activation,
                client_1.ApplicationStatus.active,
            ];
        }
        return undefined;
    }
    async transition(user, id, toStatus, reason, overrideReason) {
        return this.lifecycle.opsTransition(user, id, toStatus, reason, overrideReason);
    }
    async resubmit(user, id) {
        const app = await this.prisma.application.findUnique({
            where: { id },
            include: { documents: true, product: true, financePartner: true },
        });
        if (!app || app.customerUserId !== user.id)
            throw new common_1.ForbiddenException('forbidden_role');
        if (app.status !== 'resubmission_required') {
            throw new common_1.BadRequestException('invalid_status_transition');
        }
        const documents = await this.loadDocumentsForSubmit(id, app.kycCaseId);
        (0, submit_gates_1.assertSubmitGates)({
            application: app,
            documents,
            product: app.product,
            requireVehicleIdentity: false,
            guarantorConsentCompleted: await this.intake.guarantorConsentCompleted(id),
            identityPolicy: this.identityPolicy(),
            now: new Date(),
        });
        const assessed = (0, credit_assessment_1.assessApplicationCredit)({
            customerSnapshot: app.customerSnapshot,
            pricingSnapshot: app.pricingSnapshot,
            product: app.product,
        });
        const nextStatus = (0, partner_finance_1.submittedStatusForPartner)(app.financePartner?.crmAdapter);
        const updated = await this.prisma.$transaction(async (tx) => {
            await (0, guarded_transitions_1.transitionApplication)(tx, id, client_1.ApplicationStatus.resubmission_required, {
                status: nextStatus,
                ...(0, credit_assessment_1.creditAssessmentData)(assessed),
            });
            return tx.application.findUniqueOrThrow({ where: { id } });
        });
        await this.activity.log({
            actorUserId: user.id,
            entityType: 'application',
            entityId: id,
            action: 'status_transition',
            fromValue: 'resubmission_required',
            toValue: nextStatus,
        });
        await this.activity.log({
            actorUserId: user.id,
            entityType: 'application',
            entityId: id,
            action: 'credit_assessed',
            toValue: assessed.assessment.path,
            metadata: (0, credit_assessment_1.creditAssessedLogMetadata)(assessed, 'submit'),
        });
        await this.syncToCrmIfNeeded(id, nextStatus, user.id);
        this.analytics.track('application_submitted', {
            application_id: id,
            product_id: app.productId,
            company_id: app.companyId,
            is_resubmit: true,
        });
        return (0, application_response_dto_1.toApplicationDto)(updated);
    }
    async cancel(user, id, reason) {
        const app = await this.prisma.application.findUnique({ where: { id } });
        if (!app || app.customerUserId !== user.id)
            throw new common_1.ForbiddenException('forbidden_role');
        if (!['draft', 'under_review', 'resubmission_required'].includes(app.status)) {
            throw new common_1.BadRequestException('invalid_status_transition');
        }
        const fromStatus = app.status;
        const updated = await this.prisma.$transaction(async (tx) => {
            await (0, guarded_transitions_1.transitionApplication)(tx, id, fromStatus, {
                status: client_1.ApplicationStatus.submission_cancelled,
                statusReason: reason,
            });
            if (fromStatus !== client_1.ApplicationStatus.draft) {
                const stillBlocking = await tx.application.findFirst({
                    where: {
                        productId: app.productId,
                        id: { not: id },
                        status: { in: application_access_1.BLOCKING_APPLICATION_STATUSES },
                    },
                });
                if (!stillBlocking) {
                    await tx.product.update({
                        where: { id: app.productId },
                        data: { listingStatus: client_1.ListingStatus.published },
                    });
                }
            }
            return tx.application.findUniqueOrThrow({ where: { id } });
        });
        await this.activity.log({
            actorUserId: user.id,
            entityType: 'application',
            entityId: id,
            action: 'status_transition',
            toValue: 'submission_cancelled',
        });
        return (0, application_response_dto_1.toApplicationDto)(updated);
    }
    async uploadDoc(user, id, category, file) {
        const app = await this.prisma.application.findUnique({ where: { id } });
        if (!app || app.customerUserId !== user.id)
            throw new common_1.ForbiddenException('forbidden_role');
        if (!['draft', 'partner_processing', 'resubmission_required'].includes(app.status)) {
            throw new common_1.BadRequestException('validation_failed');
        }
        this.storage.assertKycFile(file);
        const key = await this.storage.uploadKyc(file, id, category);
        const doc = await this.prisma.applicationDocument.create({
            data: {
                applicationId: id,
                category: category,
                storagePath: key,
                mimeType: file.mimetype,
                originalName: file.originalname,
                uploadedById: user.id,
            },
        });
        this.analytics.track('document_uploaded', {
            application_id: id,
            category,
            mime_type: file.mimetype,
        });
        await this.syncToCrmIfNeeded(id, app.status, user.id);
        return (0, application_response_dto_1.toApplicationDocumentDto)(doc);
    }
    async downloadDocument(user, appId, docId) {
        const app = await this.prisma.application.findUnique({ where: { id: appId } });
        if (!app)
            throw new common_1.NotFoundException();
        await (0, application_access_1.assertApplicationCanView)(this.prisma, user, app);
        const doc = await this.prisma.applicationDocument.findFirst({
            where: { id: docId, applicationId: appId },
        });
        if (!doc)
            throw new common_1.NotFoundException();
        if (doc.storagePath.startsWith('kyc://')) {
            const kycFile = await this.kycBridge.readApplicationDocumentBytes(appId, doc);
            return kycFile;
        }
        const file = await this.storage.readKyc(doc.storagePath);
        const ext = node_path_1.default.extname(doc.storagePath) || '.pdf';
        const filename = doc.originalName?.trim() || `${doc.category}${ext}`;
        return { ...file, filename };
    }
    async notifyOpsOnSubmit(companyId, appId) {
        await this.intake.notifyOps(companyId, [
            client_1.UserRole.credit_officer,
            client_1.UserRole.finance_officer,
            client_1.UserRole.dealer_agent,
            client_1.UserRole.admin,
            client_1.UserRole.super_admin,
        ], (role) => (role === client_1.UserRole.dealer_agent ? 'New lead on your stock' : 'New financing application'), 'A customer submitted a financing application.', `/applications/${appId}`);
    }
    async syncToCrmIfNeeded(applicationId, status, actorUserId) {
        if (!(0, zoho_sync_policy_1.shouldSyncStatusToCrm)(status))
            return;
        await this.zoho.syncApplicationToZoho(applicationId, actorUserId);
    }
    async deleteOps(user, id) {
        if (user.role !== client_1.UserRole.admin && user.role !== client_1.UserRole.super_admin) {
            throw new common_1.ForbiddenException('forbidden_role');
        }
        const app = await this.prisma.application.findUnique({
            where: { id },
            include: { paymentSchedules: true },
        });
        if (!app)
            throw new common_1.NotFoundException();
        if (!['draft', 'rejected', 'submission_cancelled'].includes(app.status)) {
            throw new common_1.BadRequestException('cannot_delete_application');
        }
        if (app.paymentSchedules.some((s) => Number(s.paidAmount) > 0)) {
            throw new common_1.BadRequestException('cannot_delete_paid_application');
        }
        await this.prisma.paymentSchedule.deleteMany({ where: { applicationId: id } });
        await this.prisma.application.delete({ where: { id } });
        await this.activity.log({
            actorUserId: user.id,
            entityType: 'application',
            entityId: id,
            action: 'application_deleted',
        });
        return { ok: true };
    }
    async rebuildSchedule(user, id, dto) {
        if (user.role !== client_1.UserRole.admin && user.role !== client_1.UserRole.super_admin) {
            throw new common_1.ForbiddenException('forbidden_role');
        }
        const app = await this.prisma.application.findUnique({
            where: { id },
            include: { offer: true, paymentSchedules: true, product: true },
        });
        if (!app)
            throw new common_1.NotFoundException();
        if (app.status === client_1.ApplicationStatus.partner_processing) {
            throw new common_1.BadRequestException('partner_application_readonly');
        }
        if (app.paymentSchedules.some((s) => Number(s.paidAmount) > 0)) {
            throw new common_1.BadRequestException('cannot_rebuild_paid_schedule');
        }
        const pricing = app.pricingSnapshot ?? {};
        const next = (0, application_pricing_1.buildApplicationPricingSnapshot)({
            listPrice: dto.sellingPrice ?? Number(pricing.list_price ?? pricing.selling_price ?? 0),
            offer: app.offer,
            pricingSnapshot: {
                ...pricing,
                tenor: dto.tenureMonths ?? pricing.tenor ?? pricing.tenure,
                tenure: dto.tenureMonths ?? pricing.tenure ?? pricing.tenor,
                down_payment_pct: dto.downPaymentPct ?? pricing.down_payment_pct,
            },
        });
        const installmentPlan = dto.installmentPlan ??
            (0, installment_plan_1.buildPlanFromPricingSnapshot)({
                pricingSnapshot: next,
                vehiclePrice: Number(next.list_price ?? app.product.price),
            });
        await this.prisma.$transaction(async (tx) => {
            await tx.application.update({
                where: { id },
                data: {
                    pricingSnapshot: next,
                    installmentPlan: installmentPlan,
                },
            });
            if (app.status === client_1.ApplicationStatus.active) {
                await (0, installment_plan_sync_1.syncPaymentSchedulesFromInstallmentPlan)(tx, id, next, installmentPlan);
            }
        });
        return this.getOne(user, id);
    }
    async convertDailyToMonthly(user, id) {
        const allowed = [
            client_1.UserRole.credit_officer,
            client_1.UserRole.admin,
            client_1.UserRole.super_admin,
        ];
        if (!allowed.includes(user.role)) {
            throw new common_1.ForbiddenException('forbidden_role');
        }
        const app = await this.prisma.application.findUnique({
            where: { id },
            include: { paymentSchedules: { orderBy: { dueDate: 'asc' } } },
        });
        if (!app)
            throw new common_1.NotFoundException();
        const plan = app.installmentPlan;
        if (plan?.schedule?.length) {
            const monthlyPlan = (0, installment_plan_sync_1.convertInstallmentPlanDailyToMonthly)(plan);
            await this.prisma.$transaction(async (tx) => {
                await tx.application.update({
                    where: { id },
                    data: {
                        installmentPlan: monthlyPlan,
                    },
                });
                if (app.paymentSchedules.length > 0) {
                    await (0, installment_plan_sync_1.syncPaymentSchedulesFromInstallmentPlan)(tx, id, app.pricingSnapshot, monthlyPlan);
                }
            });
            return this.getOne(user, id);
        }
        const rows = app.paymentSchedules;
        if (rows.length < 2)
            throw new common_1.BadRequestException('not_daily_schedule');
        const firstGap = (rows[1].dueDate.getTime() - rows[0].dueDate.getTime()) / 86400000;
        if (firstGap > 7)
            throw new common_1.BadRequestException('not_daily_schedule');
        const unpaid = rows.filter((r) => Number(r.paidAmount) === 0);
        const groups = new Map();
        for (const row of unpaid) {
            const key = `${row.dueDate.getUTCFullYear()}-${row.dueDate.getUTCMonth()}`;
            const list = groups.get(key) ?? [];
            list.push(row);
            groups.set(key, list);
        }
        await this.prisma.$transaction(async (tx) => {
            await tx.paymentSchedule.deleteMany({ where: { id: { in: unpaid.map((r) => r.id) } } });
            let sequence = rows.filter((r) => Number(r.paidAmount) > 0).length;
            for (const group of groups.values()) {
                sequence += 1;
                const amount = group.reduce((sum, r) => sum + Number(r.amount), 0);
                await tx.paymentSchedule.create({
                    data: {
                        applicationId: id,
                        sequence,
                        dueDate: group[0].dueDate,
                        amount,
                        paidAmount: 0,
                        remainingAmount: amount,
                        status: 'pending',
                    },
                });
            }
        });
        return this.getOne(user, id);
    }
    async syncSchedulesFromPlan(user, id) {
        const allowed = [
            client_1.UserRole.credit_officer,
            client_1.UserRole.finance_officer,
            client_1.UserRole.admin,
            client_1.UserRole.super_admin,
        ];
        if (!allowed.includes(user.role)) {
            throw new common_1.ForbiddenException('forbidden_role');
        }
        const app = await this.prisma.application.findUnique({ where: { id } });
        if (!app)
            throw new common_1.NotFoundException();
        if (app.status === client_1.ApplicationStatus.partner_processing) {
            throw new common_1.BadRequestException('partner_application_readonly');
        }
        const plan = app.installmentPlan;
        if (!plan?.schedule?.length) {
            throw new common_1.BadRequestException('empty_installment_plan');
        }
        await this.prisma.$transaction(async (tx) => {
            await (0, installment_plan_sync_1.syncPaymentSchedulesFromInstallmentPlan)(tx, id, app.pricingSnapshot, plan);
        });
        return this.getOne(user, id);
    }
    audienceForUser(user, app) {
        const ops = [
            client_1.UserRole.credit_officer,
            client_1.UserRole.finance_officer,
            client_1.UserRole.admin,
            client_1.UserRole.super_admin,
            client_1.UserRole.group_admin,
        ];
        if (ops.includes(user.role))
            return 'ops';
        if (user.role === client_1.UserRole.dealer_agent && user.companyId === app.companyId)
            return 'dealer';
        return 'customer';
    }
};
exports.ApplicationsService = ApplicationsService;
exports.ApplicationsService = ApplicationsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        activity_service_1.ActivityService,
        analytics_service_1.AnalyticsService,
        storage_service_1.StorageService,
        applications_lifecycle_service_1.ApplicationsLifecycleService,
        zoho_crm_service_1.ZohoCrmService,
        kyc_bridge_service_1.KycBridgeService,
        application_intake_service_1.ApplicationIntakeService,
        identity_service_1.IdentityService,
        app_config_service_1.AppConfigService])
], ApplicationsService);
//# sourceMappingURL=applications.service.js.map