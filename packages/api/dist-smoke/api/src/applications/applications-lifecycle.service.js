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
exports.ApplicationsLifecycleService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../prisma/prisma.service");
const activity_service_1 = require("../common/activity.service");
const analytics_service_1 = require("../analytics/analytics.service");
const compliance_service_1 = require("../compliance/compliance.service");
const storage_service_1 = require("../storage/storage.service");
const application_transitions_1 = require("./application-transitions");
const contract_pdf_1 = require("./contract-pdf");
const down_payment_1 = require("./down-payment");
const payment_schedules_1 = require("./payment-schedules");
const installment_plan_sync_1 = require("./installment-plan-sync");
const lender_of_record_1 = require("../finance-partners/lender-of-record");
const company_scope_1 = require("./company-scope");
const application_access_1 = require("./application-access");
const guarded_transitions_1 = require("./guarded-transitions");
const application_response_dto_1 = require("./application-response.dto");
const credit_assessment_1 = require("./credit-assessment");
const credit_decision_1 = require("./credit-decision");
const customer_notifications_1 = require("./customer-notifications");
const OPS_ROLES = [client_1.UserRole.credit_officer, client_1.UserRole.admin, client_1.UserRole.super_admin];
const DECISION_ROLES = [
    client_1.UserRole.credit_officer,
    client_1.UserRole.finance_officer,
    client_1.UserRole.admin,
    client_1.UserRole.super_admin,
];
const DOWN_PAYMENT_ROLES = [
    client_1.UserRole.credit_officer,
    client_1.UserRole.finance_officer,
    client_1.UserRole.admin,
    client_1.UserRole.super_admin,
];
function asJson(value) {
    return value;
}
function expectedContractContentSha256(contractData) {
    if (!contractData || typeof contractData !== 'object' || Array.isArray(contractData)) {
        return null;
    }
    const hash = contractData.generatedContentSha256;
    return typeof hash === 'string' && /^[a-f0-9]{64}$/.test(hash) ? hash : null;
}
let ApplicationsLifecycleService = class ApplicationsLifecycleService {
    prisma;
    activity;
    analytics;
    storage;
    compliance;
    config;
    constructor(prisma, activity, analytics, storage, compliance, config) {
        this.prisma = prisma;
        this.activity = activity;
        this.analytics = analytics;
        this.storage = storage;
        this.compliance = compliance;
        this.config = config;
    }
    assertOps(user) {
        if (!OPS_ROLES.includes(user.role)) {
            throw new common_1.ForbiddenException('forbidden_role');
        }
    }
    assertDecisionRole(user) {
        if (!DECISION_ROLES.includes(user.role)) {
            throw new common_1.ForbiddenException('forbidden_role');
        }
    }
    assertDownPaymentRole(user) {
        if (!DOWN_PAYMENT_ROLES.includes(user.role)) {
            throw new common_1.ForbiddenException('forbidden_role');
        }
    }
    evaluateCreditApproval(user, app, overrideReason) {
        const assessed = (0, credit_assessment_1.assessApplicationCredit)(app);
        const decision = (0, credit_decision_1.assertApprovalAuthorized)({
            role: user.role,
            assessment: assessed.assessment,
            overrideReason,
        });
        return { assessed, decision, columns: (0, credit_assessment_1.creditAssessmentData)(assessed) };
    }
    async logCreditDecision(user, applicationId, credit, overrideReason) {
        await this.activity.log({
            actorUserId: user.id,
            entityType: 'application',
            entityId: applicationId,
            action: 'credit_assessed',
            toValue: credit.assessed.assessment.path,
            metadata: {
                ...(0, credit_assessment_1.creditAssessedLogMetadata)(credit.assessed, 'approval'),
                approver_role: user.role,
                tier: credit.decision.tier,
            },
        });
        if (credit.decision.overridden) {
            await this.activity.log({
                actorUserId: user.id,
                entityType: 'application',
                entityId: applicationId,
                action: 'credit_override',
                fromValue: 'dbr_above_hard_cap',
                toValue: 'approved',
                metadata: {
                    reason: overrideReason?.trim() ?? null,
                    authority: credit.decision.authority,
                    tier: credit.decision.tier,
                    approver_role: user.role,
                },
            });
        }
    }
    async approveWithContract(user, id, opts) {
        this.assertDecisionRole(user);
        const app = await this.prisma.application.findUnique({
            where: { id },
            include: {
                product: { select: { make: true, model: true, modelYear: true, attributes: true, bodyType: true } },
                company: { select: { name: true } },
                financePartner: { select: { name: true } },
                offer: { include: { financePartner: { select: { name: true } } } },
            },
        });
        if (!app)
            throw new common_1.NotFoundException();
        await (0, company_scope_1.assertCompanyScope)(this.prisma, user, app.companyId);
        if (app.status !== 'under_review') {
            throw new common_1.BadRequestException('invalid_status_transition');
        }
        await this.compliance.assertPassedForApproval(id);
        const credit = this.evaluateCreditApproval(user, app, opts?.overrideReason);
        const snap = app.customerSnapshot;
        const pricing = app.pricingSnapshot;
        const approvedAt = new Date();
        const defaultLender = app.financePartner || app.offer?.financePartner
            ? null
            : await this.prisma.financePartner.findFirst({
                where: { isDefaultLender: true, active: true },
                select: { name: true },
            });
        const lenderName = (0, lender_of_record_1.resolveLenderOfRecord)({
            taggedPartnerName: app.financePartner?.name,
            offerPartnerName: app.offer?.financePartner?.name,
            defaultLenderName: defaultLender?.name,
            configuredName: this.config.get('CONTRACT_LENDER_NAME'),
        });
        const schedule = (0, contract_pdf_1.buildContractAmortizationSchedule)(pricing, approvedAt);
        const contractData = {
            applicationId: app.id,
            customer: snap,
            pricing,
            vehicle: {
                make: app.product.make,
                model: app.product.model,
                year: app.product.modelYear,
            },
            dealer: app.company.name,
            approvedAt: approvedAt.toISOString(),
            lenderName,
            schedule,
        };
        const { buffer: pdf, contentSha256 } = await (0, contract_pdf_1.buildContractPdf)({
            applicationId: app.id,
            approvedAt: approvedAt.toISOString(),
            customerName: String(snap.full_name ?? ''),
            customerEmail: app.customerEmail,
            customerPhone: String(snap.phone ?? ''),
            customerQid: String(snap.qid ?? ''),
            vehicleLabel: `${app.product.make} ${app.product.model} ${app.product.modelYear ?? ''}`.trim(),
            dealerName: app.company.name,
            listPrice: Number(pricing.list_price ?? 0),
            downPayment: Number(pricing.down_payment ?? 0),
            downPaymentPct: Number(pricing.down_payment_pct ?? 0),
            monthly: Number(pricing.monthly ?? 0),
            tenor: Number(pricing.tenor ?? pricing.tenure ?? 0),
            annualRate: Number(pricing.rate ?? 0),
            financedTotal: (0, contract_pdf_1.resolveFinancedTotal)(pricing),
            lenderName,
            schedule,
        });
        const contractPdfPath = await this.storage.storeContractPdf(app.id, pdf);
        const updated = await this.prisma.application.update({
            where: { id },
            data: {
                status: 'contract_signing_required',
                contractGenerated: true,
                contractData: asJson({
                    ...contractData,
                    generatedContentSha256: contentSha256,
                }),
                contractPdfPath,
                ...credit.columns,
            },
        });
        await this.activity.log({
            actorUserId: user.id,
            entityType: 'application',
            entityId: id,
            action: 'status_transition',
            fromValue: 'under_review',
            toValue: 'contract_signing_required',
        });
        await this.logCreditDecision(user, id, credit, opts?.overrideReason);
        await this.activity.notify(app.customerUserId, 'Contract ready to sign', 'Download your financing contract, sign it, and upload the signed PDF.', `/app/applications/${id}`);
        this.analytics.track('approval', {
            application_id: id,
            from_status: 'under_review',
            to_status: 'contract_signing_required',
            actor_role: user.role,
        });
        return (0, application_response_dto_1.toOpsApplicationDto)(updated);
    }
    async downloadContract(user, id) {
        const app = await this.prisma.application.findUnique({ where: { id } });
        if (!app)
            throw new common_1.NotFoundException();
        await (0, application_access_1.assertApplicationCanView)(this.prisma, user, app);
        if (!app.contractPdfPath)
            throw new common_1.NotFoundException();
        const file = await this.storage.readContract(app.contractPdfPath);
        return { ...file, filename: 'financing-contract.pdf' };
    }
    async assertSignedContractMatchesGenerated(app, file) {
        const expectedHash = expectedContractContentSha256(app.contractData);
        if (!expectedHash) {
            throw new common_1.BadRequestException('contract_not_fingerprinted');
        }
        if (!(await (0, contract_pdf_1.verifySignedContractReferencesOriginal)(file.buffer, expectedHash, app.id))) {
            throw new common_1.BadRequestException('contract_hash_mismatch');
        }
    }
    async submitSignedContract(user, id, file) {
        if (user.role !== client_1.UserRole.customer)
            throw new common_1.ForbiddenException('forbidden_role');
        const app = await this.prisma.application.findUnique({ where: { id } });
        if (!app || app.customerUserId !== user.id)
            throw new common_1.ForbiddenException('forbidden_role');
        if (app.status !== 'contract_signing_required') {
            throw new common_1.BadRequestException('invalid_status_transition');
        }
        this.storage.assertSignedContractFile(file);
        await this.assertSignedContractMatchesGenerated(app, file);
        const signedContractPath = await this.storage.uploadSignedContract(file, id);
        const updated = await this.prisma.application.update({
            where: { id },
            data: {
                status: 'contracts_submitted',
                signedContractPath,
            },
        });
        await this.activity.log({
            actorUserId: user.id,
            entityType: 'application',
            entityId: id,
            action: 'status_transition',
            fromValue: 'contract_signing_required',
            toValue: 'contracts_submitted',
        });
        return (0, application_response_dto_1.toApplicationDto)(updated);
    }
    async submitSignedContractOps(user, id, file) {
        this.assertDecisionRole(user);
        const app = await this.prisma.application.findUnique({ where: { id } });
        if (!app)
            throw new common_1.NotFoundException();
        await (0, company_scope_1.assertCompanyScope)(this.prisma, user, app.companyId);
        if (app.status !== 'contract_signing_required') {
            throw new common_1.BadRequestException('invalid_status_transition');
        }
        this.storage.assertSignedContractFile(file);
        await this.assertSignedContractMatchesGenerated(app, file);
        const signedContractPath = await this.storage.uploadSignedContract(file, id);
        const updated = await this.prisma.application.update({
            where: { id },
            data: {
                status: 'contracts_submitted',
                signedContractPath,
            },
        });
        await this.activity.log({
            actorUserId: user.id,
            entityType: 'application',
            entityId: id,
            action: 'status_transition',
            fromValue: 'contract_signing_required',
            toValue: 'contracts_submitted',
            metadata: { uploadedBy: 'ops', onBehalfOfCustomer: app.customerUserId },
        });
        await this.activity.notify(app.customerUserId, 'Signed contract received', 'Your signed contract was filed by our team and is now under review.', `/app/applications/${id}`);
        return (0, application_response_dto_1.toOpsApplicationDto)(updated);
    }
    async opsTransition(user, id, toStatus, reason, overrideReason) {
        this.assertDecisionRole(user);
        const app = await this.prisma.application.findUnique({
            where: { id },
            include: {
                financePartner: { select: { crmAdapter: true } },
                product: { select: { attributes: true, bodyType: true } },
            },
        });
        if (!app)
            throw new common_1.NotFoundException();
        await (0, company_scope_1.assertCompanyScope)(this.prisma, user, app.companyId);
        if (app.status === client_1.ApplicationStatus.partner_processing) {
            throw new common_1.BadRequestException('partner_application_readonly');
        }
        try {
            (0, application_transitions_1.assertOpsTransitionAllowed)(app.status, toStatus, user.role);
        }
        catch (e) {
            if (e instanceof Error && e.message === 'invalid_status_transition') {
                throw new common_1.BadRequestException('invalid_status_transition');
            }
            throw e;
        }
        if ((0, application_transitions_1.opsTransitionRequiresReason)(app.status, toStatus) && !reason?.trim()) {
            throw new common_1.BadRequestException('validation_failed');
        }
        let credit = null;
        if (toStatus === client_1.ApplicationStatus.pending_finance_activation &&
            (app.status === client_1.ApplicationStatus.under_review || app.status === client_1.ApplicationStatus.draft)) {
            await this.compliance.assertPassedForApproval(id);
            credit = this.evaluateCreditApproval(user, app, overrideReason);
        }
        if (app.status === client_1.ApplicationStatus.contract_under_review &&
            toStatus === client_1.ApplicationStatus.pending_finance_activation) {
            await (0, down_payment_1.assertDownPaymentRecordedForDirectActivation)(this.prisma, id, app.pricingSnapshot);
        }
        const releasesListing = toStatus === 'rejected' ||
            (toStatus === 'submission_cancelled' && app.status !== client_1.ApplicationStatus.active);
        const reopensListing = toStatus === 'under_review' &&
            (app.status === client_1.ApplicationStatus.rejected || app.status === client_1.ApplicationStatus.submission_cancelled);
        const updated = await this.prisma.$transaction(async (tx) => {
            if (reopensListing) {
                const product = await tx.product.findUniqueOrThrow({
                    where: { id: app.productId },
                    select: { listingStatus: true },
                });
                if (product.listingStatus === client_1.ListingStatus.sold) {
                    throw new common_1.ConflictException('vehicle_unavailable');
                }
                if (product.listingStatus === client_1.ListingStatus.published) {
                    await tx.product.update({
                        where: { id: app.productId },
                        data: { listingStatus: client_1.ListingStatus.reserved },
                    });
                }
            }
            const next = await tx.application.update({
                where: { id },
                data: {
                    status: toStatus,
                    statusReason: reason,
                    rejectionReason: toStatus === 'rejected' ? reason : app.rejectionReason,
                    resubmissionComment: toStatus === 'contract_signing_required' || toStatus === 'resubmission_required'
                        ? reason
                        : app.resubmissionComment,
                    ...(credit ? credit.columns : {}),
                },
            });
            if (releasesListing) {
                await this.unreserveIfNeeded(tx, app.productId, id);
            }
            return next;
        });
        await this.activity.log({
            actorUserId: user.id,
            entityType: 'application',
            entityId: id,
            action: 'status_transition',
            fromValue: app.status,
            toValue: toStatus,
            metadata: { reason },
        });
        if (credit)
            await this.logCreditDecision(user, id, credit, overrideReason);
        const notifyTitle = toStatus === 'rejected'
            ? 'Application rejected'
            : toStatus === 'submission_cancelled'
                ? 'Application cancelled'
                : toStatus === 'contract_signing_required'
                    ? 'Contract needs re-signing'
                    : toStatus === 'pending_finance_activation'
                        ? app.status === client_1.ApplicationStatus.under_review
                            ? 'Application approved'
                            : 'Contract approved'
                        : reopensListing
                            ? 'Application reopened'
                            : 'Application update';
        await this.activity.notify(app.customerUserId, notifyTitle, (0, customer_notifications_1.customerNotificationBody)(toStatus, reason), `/app/applications/${id}`);
        if (toStatus === 'rejected') {
            this.analytics.track('rejection', {
                application_id: id,
                from_status: app.status,
                actor_role: user.role,
            });
        }
        else if (toStatus === 'pending_finance_activation') {
            this.analytics.track('approval', {
                application_id: id,
                from_status: app.status,
                to_status: toStatus,
                actor_role: user.role,
            });
        }
        return (0, application_response_dto_1.toOpsApplicationDto)(updated);
    }
    async recordDownPayment(user, id, body) {
        this.assertDownPaymentRole(user);
        if (!Number.isFinite(body.amount) || body.amount <= 0) {
            throw new common_1.BadRequestException('validation_failed');
        }
        const app = await this.prisma.application.findUnique({
            where: { id },
            select: { id: true, status: true, companyId: true, customerUserId: true },
        });
        if (!app)
            throw new common_1.NotFoundException();
        await (0, company_scope_1.assertCompanyScope)(this.prisma, user, app.companyId);
        if (app.status !== client_1.ApplicationStatus.down_payment_required) {
            throw new common_1.BadRequestException('invalid_status_transition');
        }
        const amount = new client_1.Prisma.Decimal(String(body.amount));
        const paidAtRaw = body.paidAt?.trim();
        const paidAt = paidAtRaw ? new Date(paidAtRaw) : null;
        if (paidAtRaw && (!paidAt || Number.isNaN(paidAt.getTime()))) {
            throw new common_1.BadRequestException('validation_failed');
        }
        const updated = await this.prisma.$transaction(async (tx) => {
            await tx.paymentEvent.create({
                data: {
                    applicationId: id,
                    type: client_1.PaymentEventType.down_payment,
                    amount,
                    currency: 'QAR',
                    actorUserId: user.id,
                    metadata: asJson({
                        method: body.method?.trim() ?? null,
                        reference: body.reference?.trim() ?? null,
                        paidAt: paidAt?.toISOString() ?? null,
                    }),
                },
            });
            await (0, guarded_transitions_1.transitionApplication)(tx, id, client_1.ApplicationStatus.down_payment_required, {
                status: client_1.ApplicationStatus.down_payment_submitted,
            });
            return tx.application.findUniqueOrThrow({ where: { id } });
        });
        await this.activity.log({
            actorUserId: user.id,
            entityType: 'application',
            entityId: id,
            action: 'down_payment_recorded',
            fromValue: client_1.ApplicationStatus.down_payment_required,
            toValue: client_1.ApplicationStatus.down_payment_submitted,
            metadata: {
                amount: amount.toNumber(),
                method: body.method ?? null,
                reference: body.reference ?? null,
            },
        });
        await this.activity.notify(app.customerUserId, 'Down payment recorded', 'Your down payment receipt was recorded and is pending confirmation.', `/app/applications/${id}`);
        return (0, application_response_dto_1.toOpsApplicationDto)(updated);
    }
    async activate(user, id, opts) {
        this.assertOps(user);
        if (user.role === client_1.UserRole.finance_officer) {
            throw new common_1.ForbiddenException('forbidden_role');
        }
        const app = await this.prisma.application.findUnique({
            where: { id },
            include: {
                company: { select: { allowDirectActivate: true } },
                product: { select: { attributes: true, bodyType: true } },
            },
        });
        if (!app)
            throw new common_1.NotFoundException();
        await (0, company_scope_1.assertCompanyScope)(this.prisma, user, app.companyId);
        if (app.status === client_1.ApplicationStatus.partner_processing) {
            throw new common_1.BadRequestException('partner_application_readonly');
        }
        if (app.status === 'active') {
            return (0, application_response_dto_1.toOpsApplicationDto)(app);
        }
        let expectedFromStatus;
        let adminOverride = false;
        let credit = null;
        if (opts?.direct) {
            if (app.status !== 'under_review') {
                throw new common_1.BadRequestException('invalid_status_transition');
            }
            if (!app.company.allowDirectActivate) {
                throw new common_1.BadRequestException('direct_activate_disabled');
            }
            await this.compliance.assertPassedForApproval(id);
            if (!app.contractGenerated || !app.contractPdfPath) {
                throw new common_1.BadRequestException('contract_not_generated');
            }
            if (!app.signedContractPath) {
                throw new common_1.BadRequestException('signed_contract_required');
            }
            credit = this.evaluateCreditApproval(user, app, opts.overrideReason);
            expectedFromStatus = client_1.ApplicationStatus.under_review;
        }
        else if (application_transitions_1.ACTIVATE_FROM_STATUSES.includes(app.status)) {
            expectedFromStatus = app.status;
        }
        else if ((0, application_transitions_1.roleToActor)(user.role) === 'admin' &&
            application_transitions_1.ADMIN_ACTIVATE_FROM_STATUSES.includes(app.status)) {
            await this.compliance.assertPassedForApproval(id);
            credit = this.evaluateCreditApproval(user, app, opts?.overrideReason);
            expectedFromStatus = app.status;
            adminOverride = true;
        }
        else {
            throw new common_1.BadRequestException('invalid_status_transition');
        }
        const pricing = app.pricingSnapshot;
        const installmentPlan = app.installmentPlan;
        const requiredDown = (0, down_payment_1.requiredDownPaymentAmount)(pricing);
        const recordedDown = await (0, down_payment_1.sumDownPaymentRecorded)(this.prisma, id);
        (0, down_payment_1.assertDownPaymentSatisfied)(requiredDown, recordedDown);
        const scheduleDrafts = (0, payment_schedules_1.buildScheduleDrafts)(pricing, new Date(), installmentPlan);
        const updated = await this.prisma.$transaction(async (tx) => {
            await tx.$queryRaw `SELECT id FROM applications WHERE id = ${id} FOR UPDATE`;
            const existingScheduleCount = await tx.paymentSchedule.count({
                where: { applicationId: id },
            });
            if (existingScheduleCount === 0) {
                await tx.paymentSchedule.createMany({
                    data: scheduleDrafts.map((s) => ({
                        applicationId: id,
                        sequence: s.sequence,
                        dueDate: s.dueDate,
                        amount: s.amount,
                        paidAmount: 0,
                        remainingAmount: s.amount,
                        status: 'pending',
                    })),
                });
            }
            else if (installmentPlan?.schedule?.length) {
                await (0, installment_plan_sync_1.syncPaymentSchedulesFromInstallmentPlan)(tx, id, pricing, installmentPlan);
            }
            await (0, guarded_transitions_1.transitionApplication)(tx, id, expectedFromStatus, {
                status: client_1.ApplicationStatus.active,
                activatedAt: new Date(),
                ...(credit ? credit.columns : {}),
            });
            await tx.product.update({
                where: { id: app.productId },
                data: { listingStatus: client_1.ListingStatus.sold },
            });
            return tx.application.findUniqueOrThrow({ where: { id } });
        });
        await this.activity.log({
            actorUserId: user.id,
            entityType: 'application',
            entityId: id,
            action: 'status_transition',
            fromValue: app.status,
            toValue: 'active',
            metadata: opts?.direct ? { direct: true } : adminOverride ? { admin_override: true } : undefined,
        });
        if (credit)
            await this.logCreditDecision(user, id, credit, opts?.overrideReason);
        await this.activity.notify(app.customerUserId, 'Financing activated', 'Your payment schedule is now available in your application.', `/app/applications/${id}`);
        return (0, application_response_dto_1.toOpsApplicationDto)(updated);
    }
    async unreserveIfNeeded(tx, productId, excludeAppId) {
        const stillBlocking = await tx.application.findFirst({
            where: {
                productId,
                id: { not: excludeAppId },
                status: { in: application_access_1.BLOCKING_APPLICATION_STATUSES },
            },
        });
        if (!stillBlocking) {
            await tx.product.update({
                where: { id: productId },
                data: { listingStatus: client_1.ListingStatus.published },
            });
        }
    }
};
exports.ApplicationsLifecycleService = ApplicationsLifecycleService;
exports.ApplicationsLifecycleService = ApplicationsLifecycleService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        activity_service_1.ActivityService,
        analytics_service_1.AnalyticsService,
        storage_service_1.StorageService,
        compliance_service_1.ComplianceService,
        config_1.ConfigService])
], ApplicationsLifecycleService);
//# sourceMappingURL=applications-lifecycle.service.js.map