import { ApplicationStatus, Prisma, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityService } from '../common/activity.service';
import { IdentityService } from '../common/identity.service';
import { PaginationQueryDto } from '../common/pagination.dto';
import { AnalyticsService } from '../analytics/analytics.service';
import { StorageService } from '../storage/storage.service';
import { ZohoCrmService } from '../integrations/zoho/zoho-crm.service';
import { type ApplicationDocCategory } from './application-documents';
import { ApplicationsLifecycleService } from './applications-lifecycle.service';
import { ApplicationIntakeService } from './application-intake.service';
import { KycBridgeService } from '../kyc/kyc-bridge.service';
import { type InstallmentPlan } from "@drivemarket/shared/installment-plan";
import { type CustomerSnapshotInput } from './customer-snapshot';
import { AppConfigService } from '../config/app-config.service';
import { type CreditAssessmentDto } from './credit-assessment';
export type CreateApplicationInput = {
    productId: string;
    offerId: string;
    customerSnapshot: CustomerSnapshotInput;
    pricingSnapshot: Record<string, unknown>;
    quoteToken?: string;
};
export type UpdateDraftInput = {
    customerSnapshot?: CustomerSnapshotInput;
    pricingSnapshot?: Record<string, unknown>;
    offerId?: string;
};
export type UnmaskField = 'qid' | 'phone';
export declare class ApplicationsService {
    private readonly prisma;
    private readonly activity;
    private readonly analytics;
    private readonly storage;
    private readonly lifecycle;
    private readonly zoho;
    private readonly kycBridge;
    private readonly intake;
    private readonly identity;
    private readonly appConfig;
    constructor(prisma: PrismaService, activity: ActivityService, analytics: AnalyticsService, storage: StorageService, lifecycle: ApplicationsLifecycleService, zoho: ZohoCrmService, kycBridge: KycBridgeService, intake: ApplicationIntakeService, identity: IdentityService, appConfig: AppConfigService);
    private identityPolicy;
    hasBlocking(userId: string, productId?: string): Promise<{
        blocking: boolean;
        application_id: string | null;
        status: import(".prisma/client").$Enums.ApplicationStatus | null;
        draft_application_id: string | null;
    }>;
    private loadDedupCandidates;
    create(user: User, dto: CreateApplicationInput): Promise<{
        financing_source: string;
        finance_partner_name: string | null;
        branch_name: string | null;
        takaful_policies?: {
            id: string;
            application_id: string;
            provider: string | null;
            policy_number: string | null;
            coverage_type: string | null;
            coverage_amount: number | null;
            premium_amount: number | null;
            issued_at: string | null;
            effective_from: string | null;
            expires_at: string | null;
            days_to_expiry: number | null;
            riders: string[];
            status: string;
            declaration_accepted_at: string | null;
            declaration_version: string | null;
            has_document: boolean;
            verified_at: string | null;
            created_at: string;
        }[] | undefined;
        payment_schedules?: {
            id: string;
            sequence: number;
            due_date: Date;
            amount: number | null;
            paid_amount: number | null;
            remaining_amount: number | null;
            status: string;
            paid_at: Date | null;
            pending_waive_reason: string | null;
            pending_waive_requested_by_id: string | null;
        }[] | undefined;
        offer?: {
            is_default?: boolean | undefined;
            id: string;
            name: string;
            annual_rent_rate: number | null;
            tenure_options: Prisma.JsonValue;
            min_down_payment_pct: number | null;
            finance_partner_id: string | null;
            finance_partner_name: string | null;
            crm_adapter: string | null;
        } | undefined;
        customer?: {
            name: string | null;
            email: string;
            phone: string | null;
        } | undefined;
        company?: {
            id: string;
            name: string;
        } | undefined;
        documents?: {
            id: string;
            category: string;
            mime_type: string | null;
            created_at: Date;
            original_name: string | null;
            kyc_document_type: string | null;
            verification_status: string | null;
        }[] | undefined;
        product?: {
            id: string;
            slug: string;
            make: string;
            model: string;
            trim: string | null;
            model_year: number;
            condition: string | null;
            engine: string | null;
            transmission: string | null;
            cylinders: number | null;
            drivetrain: string | null;
            body_type: string | null;
            color: string | null;
            mileage: number | null;
            description: string | null;
            price: number | null;
            finance_eligible: boolean | null;
            warranty_months: number | null;
            warranty_notes: string | null;
            listing_status: string | null;
            company_id: string | null;
            published_at: Date | null;
            default_offer_id: string | null;
        } | undefined;
    } | {
        id: string;
        resumed: true;
    }>;
    updateDraft(user: User, id: string, body: UpdateDraftInput): Promise<Record<string, unknown>>;
    documentSlots(user: User, id: string): Promise<import("./application-documents").ApplicationDocumentSlotsDto>;
    creditAssessment(user: User, id: string): Promise<CreditAssessmentDto>;
    private loadDocumentsForSubmit;
    submit(user: User, id: string): Promise<{
        financing_source: string;
        finance_partner_name: string | null;
        branch_name: string | null;
        takaful_policies?: {
            id: string;
            application_id: string;
            provider: string | null;
            policy_number: string | null;
            coverage_type: string | null;
            coverage_amount: number | null;
            premium_amount: number | null;
            issued_at: string | null;
            effective_from: string | null;
            expires_at: string | null;
            days_to_expiry: number | null;
            riders: string[];
            status: string;
            declaration_accepted_at: string | null;
            declaration_version: string | null;
            has_document: boolean;
            verified_at: string | null;
            created_at: string;
        }[] | undefined;
        payment_schedules?: {
            id: string;
            sequence: number;
            due_date: Date;
            amount: number | null;
            paid_amount: number | null;
            remaining_amount: number | null;
            status: string;
            paid_at: Date | null;
            pending_waive_reason: string | null;
            pending_waive_requested_by_id: string | null;
        }[] | undefined;
        offer?: {
            is_default?: boolean | undefined;
            id: string;
            name: string;
            annual_rent_rate: number | null;
            tenure_options: Prisma.JsonValue;
            min_down_payment_pct: number | null;
            finance_partner_id: string | null;
            finance_partner_name: string | null;
            crm_adapter: string | null;
        } | undefined;
        customer?: {
            name: string | null;
            email: string;
            phone: string | null;
        } | undefined;
        company?: {
            id: string;
            name: string;
        } | undefined;
        documents?: {
            id: string;
            category: string;
            mime_type: string | null;
            created_at: Date;
            original_name: string | null;
            kyc_document_type: string | null;
            verification_status: string | null;
        }[] | undefined;
        product?: {
            id: string;
            slug: string;
            make: string;
            model: string;
            trim: string | null;
            model_year: number;
            condition: string | null;
            engine: string | null;
            transmission: string | null;
            cylinders: number | null;
            drivetrain: string | null;
            body_type: string | null;
            color: string | null;
            mileage: number | null;
            description: string | null;
            price: number | null;
            finance_eligible: boolean | null;
            warranty_months: number | null;
            warranty_notes: string | null;
            listing_status: string | null;
            company_id: string | null;
            published_at: Date | null;
            default_offer_id: string | null;
        } | undefined;
    }>;
    listMine(user: User, query?: PaginationQueryDto): Promise<{
        total: number;
        limit: number;
        offset: number;
        items: {
            product?: {
                make: string;
                model: string;
                model_year: number;
                slug: string;
                price: number | null;
            } | undefined;
            identity_hold_reason: string | null;
            identity_hold_at: Date | null;
            identity_hold_cleared_at: Date | null;
            identity_hold_cleared_by_name: string | null;
            consents_completed_at: Date | null;
            id: string;
            status: import(".prisma/client").$Enums.ApplicationStatus;
            created_at: Date;
            submitted_at: Date | null;
            activated_at: Date | null;
            contract_generated: boolean;
            resubmission_comment: string | null;
            pricing_snapshot: {} | null;
        }[];
    }>;
    getOne(user: User, id: string): Promise<Record<string, unknown>>;
    private identityHoldClearedByName;
    opsQueue(user: User, query?: PaginationQueryDto & {
        status?: ApplicationStatus;
        statusIn?: string;
        q?: string;
        companyId?: string;
        financePartnerId?: string;
        scheduleHealth?: string;
        createdFrom?: string;
        createdTo?: string;
    }): Promise<{
        metrics: {
            loan_value: number;
            receivable: number;
            avg_payment: number;
        };
        total: number;
        limit: number;
        offset: number;
        items: ({
            financing_source: string;
            finance_partner_id: string | null;
            finance_partner_name: string | null;
            branch_id: string | null;
            branch_name: string | null;
            agent: {
                id: string;
                name: string | null;
                email: string;
            };
            customer?: {
                name: string | null;
                email: string;
            } | undefined;
            company?: {
                name: string;
            } | undefined;
            product?: {
                make: string;
                model: string;
                model_year: number;
                slug: string;
                price: number | null;
            } | undefined;
            deal_summary: {
                selling_price: number;
                monthly: number;
                rate: number;
            };
            payment_health: "none" | "overdue" | "paid" | "on_track";
            risk_level: "medium" | "high" | "low";
            identity_hold_reason: string | null;
            identity_hold_at: Date | null;
            identity_hold_cleared_at: Date | null;
            identity_hold_cleared_by_name: string | null;
            consents_completed_at: Date | null;
            id: string;
            status: import(".prisma/client").$Enums.ApplicationStatus;
            created_at: Date;
            submitted_at: Date | null;
            customer_snapshot: unknown;
            pricing_snapshot: {} | null;
            installment_plan: {} | null;
            rule_flags: import("./application-rules").RuleFlag[];
        } | {
            financing_source: string;
            finance_partner_id: string | null;
            finance_partner_name: string | null;
            branch_id: string | null;
            branch_name: string | null;
            agent: null;
            customer?: {
                name: string | null;
                email: string;
            } | undefined;
            company?: {
                name: string;
            } | undefined;
            product?: {
                make: string;
                model: string;
                model_year: number;
                slug: string;
                price: number | null;
            } | undefined;
            deal_summary: {
                selling_price: number;
                monthly: number;
                rate: number;
            };
            payment_health: "none" | "overdue" | "paid" | "on_track";
            risk_level: "medium" | "high" | "low";
            identity_hold_reason: string | null;
            identity_hold_at: Date | null;
            identity_hold_cleared_at: Date | null;
            identity_hold_cleared_by_name: string | null;
            consents_completed_at: Date | null;
            id: string;
            status: import(".prisma/client").$Enums.ApplicationStatus;
            created_at: Date;
            submitted_at: Date | null;
            customer_snapshot: unknown;
            pricing_snapshot: {} | null;
            installment_plan: {} | null;
            rule_flags: import("./application-rules").RuleFlag[];
        })[];
    }>;
    dealerLeads(user: User, query?: PaginationQueryDto & {
        status?: ApplicationStatus;
        q?: string;
        tab?: string;
    }): Promise<{
        total: number;
        limit: number;
        offset: number;
        items: ({
            finance_partner_id: string | null;
            finance_partner_name: string | null;
            branch_id: string | null;
            branch_name: string | null;
            agent: {
                id: string;
                name: string | null;
                email: string;
            };
            customer?: {
                name: string | null;
                email: string;
                phone: string | null;
            } | undefined;
            product?: {
                make: string;
                model: string;
                model_year: number;
                slug: string;
            } | undefined;
            identity_hold_reason: string | null;
            identity_hold_at: Date | null;
            identity_hold_cleared_at: Date | null;
            identity_hold_cleared_by_name: string | null;
            consents_completed_at: Date | null;
            id: string;
            status: import(".prisma/client").$Enums.ApplicationStatus;
            created_at: Date;
            customer_snapshot: unknown;
            rule_flags: import("./application-rules").RuleFlag[];
        } | {
            finance_partner_id: string | null;
            finance_partner_name: string | null;
            branch_id: string | null;
            branch_name: string | null;
            agent: null;
            customer?: {
                name: string | null;
                email: string;
                phone: string | null;
            } | undefined;
            product?: {
                make: string;
                model: string;
                model_year: number;
                slug: string;
            } | undefined;
            identity_hold_reason: string | null;
            identity_hold_at: Date | null;
            identity_hold_cleared_at: Date | null;
            identity_hold_cleared_by_name: string | null;
            consents_completed_at: Date | null;
            id: string;
            status: import(".prisma/client").$Enums.ApplicationStatus;
            created_at: Date;
            customer_snapshot: unknown;
            rule_flags: import("./application-rules").RuleFlag[];
        })[];
    }>;
    patchOps(user: User, id: string, body: {
        agentUserId?: string | null;
        companyId?: string;
        comment?: string;
        customerSnapshot?: Record<string, unknown>;
        hideInterest?: boolean;
    }): Promise<Record<string, unknown>>;
    clearIdentityHold(user: User, id: string, note?: string): Promise<Record<string, unknown>>;
    unmask(user: User, id: string, field: UnmaskField, reason: string): Promise<{
        field: UnmaskField;
        value: string | null;
    }>;
    tagLender(user: User, id: string, body: {
        financePartnerId: string;
        financePartnerBranchId?: string | null;
    }): Promise<Record<string, unknown>>;
    private parseStatusIn;
    transition(user: User, id: string, toStatus: ApplicationStatus, reason?: string, overrideReason?: string): Promise<{
        financing_source: string;
        finance_partner_name: string | null;
        branch_name: string | null;
        takaful_policies?: {
            id: string;
            application_id: string;
            provider: string | null;
            policy_number: string | null;
            coverage_type: string | null;
            coverage_amount: number | null;
            premium_amount: number | null;
            issued_at: string | null;
            effective_from: string | null;
            expires_at: string | null;
            days_to_expiry: number | null;
            riders: string[];
            status: string;
            declaration_accepted_at: string | null;
            declaration_version: string | null;
            has_document: boolean;
            verified_at: string | null;
            created_at: string;
        }[] | undefined;
        payment_schedules?: {
            id: string;
            sequence: number;
            due_date: Date;
            amount: number | null;
            paid_amount: number | null;
            remaining_amount: number | null;
            status: string;
            paid_at: Date | null;
            pending_waive_reason: string | null;
            pending_waive_requested_by_id: string | null;
        }[] | undefined;
        offer?: {
            is_default?: boolean | undefined;
            id: string;
            name: string;
            annual_rent_rate: number | null;
            tenure_options: Prisma.JsonValue;
            min_down_payment_pct: number | null;
            finance_partner_id: string | null;
            finance_partner_name: string | null;
            crm_adapter: string | null;
        } | undefined;
        customer?: {
            name: string | null;
            email: string;
            phone: string | null;
        } | undefined;
        company?: {
            id: string;
            name: string;
        } | undefined;
        documents?: {
            id: string;
            category: string;
            mime_type: string | null;
            created_at: Date;
            original_name: string | null;
            kyc_document_type: string | null;
            verification_status: string | null;
        }[] | undefined;
        product?: {
            id: string;
            slug: string;
            make: string;
            model: string;
            trim: string | null;
            model_year: number;
            condition: string | null;
            engine: string | null;
            transmission: string | null;
            cylinders: number | null;
            drivetrain: string | null;
            body_type: string | null;
            color: string | null;
            mileage: number | null;
            description: string | null;
            price: number | null;
            finance_eligible: boolean | null;
            warranty_months: number | null;
            warranty_notes: string | null;
            listing_status: string | null;
            company_id: string | null;
            published_at: Date | null;
            default_offer_id: string | null;
        } | undefined;
    }>;
    resubmit(user: User, id: string): Promise<{
        financing_source: string;
        finance_partner_name: string | null;
        branch_name: string | null;
        takaful_policies?: {
            id: string;
            application_id: string;
            provider: string | null;
            policy_number: string | null;
            coverage_type: string | null;
            coverage_amount: number | null;
            premium_amount: number | null;
            issued_at: string | null;
            effective_from: string | null;
            expires_at: string | null;
            days_to_expiry: number | null;
            riders: string[];
            status: string;
            declaration_accepted_at: string | null;
            declaration_version: string | null;
            has_document: boolean;
            verified_at: string | null;
            created_at: string;
        }[] | undefined;
        payment_schedules?: {
            id: string;
            sequence: number;
            due_date: Date;
            amount: number | null;
            paid_amount: number | null;
            remaining_amount: number | null;
            status: string;
            paid_at: Date | null;
            pending_waive_reason: string | null;
            pending_waive_requested_by_id: string | null;
        }[] | undefined;
        offer?: {
            is_default?: boolean | undefined;
            id: string;
            name: string;
            annual_rent_rate: number | null;
            tenure_options: Prisma.JsonValue;
            min_down_payment_pct: number | null;
            finance_partner_id: string | null;
            finance_partner_name: string | null;
            crm_adapter: string | null;
        } | undefined;
        customer?: {
            name: string | null;
            email: string;
            phone: string | null;
        } | undefined;
        company?: {
            id: string;
            name: string;
        } | undefined;
        documents?: {
            id: string;
            category: string;
            mime_type: string | null;
            created_at: Date;
            original_name: string | null;
            kyc_document_type: string | null;
            verification_status: string | null;
        }[] | undefined;
        product?: {
            id: string;
            slug: string;
            make: string;
            model: string;
            trim: string | null;
            model_year: number;
            condition: string | null;
            engine: string | null;
            transmission: string | null;
            cylinders: number | null;
            drivetrain: string | null;
            body_type: string | null;
            color: string | null;
            mileage: number | null;
            description: string | null;
            price: number | null;
            finance_eligible: boolean | null;
            warranty_months: number | null;
            warranty_notes: string | null;
            listing_status: string | null;
            company_id: string | null;
            published_at: Date | null;
            default_offer_id: string | null;
        } | undefined;
    }>;
    cancel(user: User, id: string, reason?: string): Promise<{
        financing_source: string;
        finance_partner_name: string | null;
        branch_name: string | null;
        takaful_policies?: {
            id: string;
            application_id: string;
            provider: string | null;
            policy_number: string | null;
            coverage_type: string | null;
            coverage_amount: number | null;
            premium_amount: number | null;
            issued_at: string | null;
            effective_from: string | null;
            expires_at: string | null;
            days_to_expiry: number | null;
            riders: string[];
            status: string;
            declaration_accepted_at: string | null;
            declaration_version: string | null;
            has_document: boolean;
            verified_at: string | null;
            created_at: string;
        }[] | undefined;
        payment_schedules?: {
            id: string;
            sequence: number;
            due_date: Date;
            amount: number | null;
            paid_amount: number | null;
            remaining_amount: number | null;
            status: string;
            paid_at: Date | null;
            pending_waive_reason: string | null;
            pending_waive_requested_by_id: string | null;
        }[] | undefined;
        offer?: {
            is_default?: boolean | undefined;
            id: string;
            name: string;
            annual_rent_rate: number | null;
            tenure_options: Prisma.JsonValue;
            min_down_payment_pct: number | null;
            finance_partner_id: string | null;
            finance_partner_name: string | null;
            crm_adapter: string | null;
        } | undefined;
        customer?: {
            name: string | null;
            email: string;
            phone: string | null;
        } | undefined;
        company?: {
            id: string;
            name: string;
        } | undefined;
        documents?: {
            id: string;
            category: string;
            mime_type: string | null;
            created_at: Date;
            original_name: string | null;
            kyc_document_type: string | null;
            verification_status: string | null;
        }[] | undefined;
        product?: {
            id: string;
            slug: string;
            make: string;
            model: string;
            trim: string | null;
            model_year: number;
            condition: string | null;
            engine: string | null;
            transmission: string | null;
            cylinders: number | null;
            drivetrain: string | null;
            body_type: string | null;
            color: string | null;
            mileage: number | null;
            description: string | null;
            price: number | null;
            finance_eligible: boolean | null;
            warranty_months: number | null;
            warranty_notes: string | null;
            listing_status: string | null;
            company_id: string | null;
            published_at: Date | null;
            default_offer_id: string | null;
        } | undefined;
    }>;
    uploadDoc(user: User, id: string, category: ApplicationDocCategory, file: Express.Multer.File): Promise<{
        id: string;
        category: string;
        mime_type: string | null;
        created_at: Date;
        original_name: string | null;
        kyc_document_type: string | null;
        verification_status: string | null;
    }>;
    downloadDocument(user: User, appId: string, docId: string): Promise<{
        buffer: Buffer;
        contentType: string;
        filename: string;
    }>;
    private notifyOpsOnSubmit;
    private syncToCrmIfNeeded;
    deleteOps(user: User, id: string): Promise<{
        ok: boolean;
    }>;
    rebuildSchedule(user: User, id: string, dto: {
        tenureMonths?: number;
        downPaymentPct?: number;
        sellingPrice?: number;
        installmentPlan?: InstallmentPlan;
    }): Promise<Record<string, unknown>>;
    convertDailyToMonthly(user: User, id: string): Promise<Record<string, unknown>>;
    syncSchedulesFromPlan(user: User, id: string): Promise<Record<string, unknown>>;
    private audienceForUser;
}
