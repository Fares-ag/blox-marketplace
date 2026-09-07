import { ApplicationStatus, User } from '@prisma/client';
import { Response } from 'express';
import { IdempotencyService } from '../common/idempotency.service';
import { CustomerPaymentsService } from '../payments/customer-payments.service';
import { ComplianceService } from '../compliance/compliance.service';
import { StorageService } from '../storage/storage.service';
import { ApplicationsService, type UnmaskField } from './applications.service';
import { ApplicationsLifecycleService } from './applications-lifecycle.service';
import { ApplicationsStaffService } from './applications-staff.service';
import { type ApplicationDocCategory } from './application-documents';
import { type ApplicantType, type GenderValue, type GuarantorRelationship } from './customer-snapshot';
import { PaginationQueryDto } from '../common/pagination.dto';
declare class CustomerEmploymentDto {
    company?: string;
    jobTitle?: string;
    position?: string;
    employmentType?: string;
    employmentDuration?: string;
    salary?: number;
}
declare class CustomerAddressDto {
    line1?: string;
    area?: string;
    city?: string;
    zone?: string;
    poBox?: string;
    street?: string;
    country?: string;
    postalCode?: string;
}
declare class CustomerGuarantorDto {
    fullName: string;
    qid: string;
    phone: string;
    relationship: GuarantorRelationship;
    monthlyIncome?: number;
}
declare class CustomerSnapshotDto {
    full_name?: string;
    phone?: string;
    qid?: string;
    email?: string;
    applicantType?: ApplicantType;
    firstName?: string;
    lastName?: string;
    gender?: GenderValue;
    dateOfBirth?: string;
    nationality?: string;
    residency?: 'qatari' | 'expat';
    residenceDuration?: string;
    city?: string;
    address?: CustomerAddressDto;
    employment?: string | CustomerEmploymentDto;
    income?: number;
    monthlyIncome?: number;
    monthlyLiabilities?: number;
    hasGuarantor?: boolean;
    guarantor?: CustomerGuarantorDto;
    corporate?: Record<string, unknown>;
    street?: string;
    country?: string;
    postalCode?: string;
}
declare class CreateApplicationDto {
    productId: string;
    offerId: string;
    customerSnapshot: CustomerSnapshotDto;
    pricingSnapshot: Record<string, unknown>;
    quoteToken?: string;
}
declare class UpdateDraftDto {
    customerSnapshot?: CustomerSnapshotDto;
    pricingSnapshot?: Record<string, unknown>;
    offerId?: string;
}
declare class TransitionDto {
    toStatus: ApplicationStatus;
    reason?: string;
    override_reason?: string;
}
declare class ActivateDto {
    direct?: boolean;
    override_reason?: string;
}
declare class ApproveContractDto {
    override_reason?: string;
}
declare class RecordDownPaymentDto {
    amount: number;
    method?: string;
    reference?: string;
    paidAt?: string;
}
declare class CancelApplicationDto {
    reason?: string;
}
declare class UploadDocumentDto {
    category: ApplicationDocCategory;
}
declare class ClearIdentityHoldDto {
    note?: string;
}
declare class UnmaskDto {
    field: UnmaskField;
    reason: string;
}
declare class TagLenderDto {
    finance_partner_id: string;
    finance_partner_branch_id?: string;
}
declare class StaffCustomerSnapshotDto {
    email: string;
    phone?: string;
    full_name?: string;
    qid?: string;
    employment?: string | Record<string, unknown>;
    income?: number;
    monthlyIncome?: number;
    monthlyLiabilities?: number;
    applicantType?: ApplicantType;
    firstName?: string;
    lastName?: string;
    gender?: GenderValue;
    dateOfBirth?: string;
    nationality?: string;
    residency?: 'qatari' | 'expat';
    residenceDuration?: string;
    street?: string;
    city?: string;
    country?: string;
    postalCode?: string;
    address?: Record<string, unknown>;
    employmentDetails?: Record<string, unknown>;
    hasGuarantor?: boolean;
    guarantor?: Record<string, unknown>;
    corporate?: Record<string, unknown>;
}
declare class StaffCreateApplicationDto {
    productId?: string;
    productIds?: string[];
    offerId: string;
    customerSnapshot: StaffCustomerSnapshotDto;
    pricingSnapshot: Record<string, unknown>;
    installmentPlan?: Record<string, unknown>;
    agentUserId?: string;
    listPrice?: number;
    sellingPrice?: number;
    hideInterest?: boolean;
    companyId?: string;
    submit?: boolean;
}
declare class OpsApplicationsQueryDto extends PaginationQueryDto {
    status?: ApplicationStatus;
    statusIn?: string;
    q?: string;
    companyId?: string;
    financePartnerId?: string;
    scheduleHealth?: string;
    createdFrom?: string;
    createdTo?: string;
}
declare class RebuildScheduleDto {
    tenureMonths?: number;
    downPaymentPct?: number;
    sellingPrice?: number;
    installmentPlan?: Record<string, unknown>;
}
declare class DealerApplicationsQueryDto extends PaginationQueryDto {
    status?: ApplicationStatus;
    q?: string;
    tab?: string;
}
declare class DeferPaymentDto {
    reason?: string;
}
declare class PatchOpsApplicationDto {
    agentUserId?: string | null;
    companyId?: string;
    comment?: string;
    customerSnapshot?: Record<string, unknown>;
    hideInterest?: boolean;
}
export declare class ApplicationsController {
    private readonly apps;
    private readonly lifecycle;
    private readonly compliance;
    private readonly idempotency;
    private readonly staff;
    private readonly storage;
    private readonly customerPayments;
    constructor(apps: ApplicationsService, lifecycle: ApplicationsLifecycleService, compliance: ComplianceService, idempotency: IdempotencyService, staff: ApplicationsStaffService, storage: StorageService, customerPayments: CustomerPaymentsService);
    blocking(user: User, productId?: string): Promise<{
        blocking: boolean;
        application_id: string | null;
        status: import(".prisma/client").$Enums.ApplicationStatus | null;
        draft_application_id: string | null;
    }>;
    mine(user: User, query: PaginationQueryDto): Promise<{
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
    create(user: User, dto: CreateApplicationDto, res: Response, idempotencyKey?: string): Promise<{
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
            tenure_options: import("@prisma/client/runtime/library").JsonValue;
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
    one(user: User, id: string): Promise<Record<string, unknown>>;
    updateDraft(user: User, id: string, dto: UpdateDraftDto): Promise<Record<string, unknown>>;
    documentSlots(user: User, id: string): Promise<import("./application-documents").ApplicationDocumentSlotsDto>;
    documentSlotsOps(user: User, id: string): Promise<import("./application-documents").ApplicationDocumentSlotsDto>;
    creditAssessment(user: User, id: string): Promise<import("./credit-assessment").CreditAssessmentDto>;
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
            tenure_options: import("@prisma/client/runtime/library").JsonValue;
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
            tenure_options: import("@prisma/client/runtime/library").JsonValue;
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
    cancel(user: User, id: string, dto: CancelApplicationDto): Promise<{
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
            tenure_options: import("@prisma/client/runtime/library").JsonValue;
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
    deferPayment(user: User, id: string, scheduleId: string, dto: DeferPaymentDto): Promise<{
        schedule: {
            id: string;
            application_id: string;
            sequence: number;
            due_date: string;
            amount: number;
            remaining_amount: number;
            status: import(".prisma/client").$Enums.ScheduleStatus;
        };
        deferral_status: {
            year: number;
            used: number;
            remaining: number;
            limit: number;
            membership_active: boolean;
        };
    }>;
    uploadDoc(user: User, id: string, dto: UploadDocumentDto, file: Express.Multer.File): Promise<{
        id: string;
        category: string;
        mime_type: string | null;
        created_at: Date;
        original_name: string | null;
        kyc_document_type: string | null;
        verification_status: string | null;
    }>;
    downloadDoc(user: User, id: string, docId: string, res: Response): Promise<void>;
    downloadContract(user: User, id: string, res: Response): Promise<void>;
    uploadSignedContract(user: User, id: string, file: Express.Multer.File): Promise<{
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
            tenure_options: import("@prisma/client/runtime/library").JsonValue;
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
    uploadSignedContractOps(user: User, id: string, file: Express.Multer.File): Promise<{
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
            tenure_options: import("@prisma/client/runtime/library").JsonValue;
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
    createStaff(user: User, dto: StaffCreateApplicationDto, idempotencyKey?: string): Promise<{
        created_ids: string[];
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
            tenure_options: import("@prisma/client/runtime/library").JsonValue;
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
    submitStaff(user: User, id: string): Promise<{
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
            tenure_options: import("@prisma/client/runtime/library").JsonValue;
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
    uploadDocStaff(user: User, id: string, dto: UploadDocumentDto, file: Express.Multer.File): Promise<{
        id: string;
        category: import(".prisma/client").$Enums.DocumentCategory;
        mime_type: string | null;
        created_at: Date;
    }>;
    patchOps(user: User, id: string, dto: PatchOpsApplicationDto): Promise<Record<string, unknown>>;
    clearIdentityHold(user: User, id: string, dto: ClearIdentityHoldDto): Promise<Record<string, unknown>>;
    unmask(user: User, id: string, dto: UnmaskDto): Promise<{
        field: UnmaskField;
        value: string | null;
    }>;
    tagLender(user: User, id: string, dto: TagLenderDto): Promise<Record<string, unknown>>;
    queue(user: User, query: OpsApplicationsQueryDto): Promise<{
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
    transition(user: User, id: string, dto: TransitionDto): Promise<{
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
            tenure_options: import("@prisma/client/runtime/library").JsonValue;
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
    runComplianceCheck(user: User, id: string): Promise<{
        id: string;
        application_id: string;
        provider: string;
        identity_status: import(".prisma/client").$Enums.ComplianceCheckStatus;
        sanctions_status: import(".prisma/client").$Enums.ComplianceCheckStatus;
        overall_status: import(".prisma/client").$Enums.ComplianceCheckStatus;
        verified_by_user_id: string | null;
        qid_screened: string;
        applicant_name: string;
        created_at: Date;
    }>;
    approveContract(user: User, id: string, dto: ApproveContractDto): Promise<{
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
            tenure_options: import("@prisma/client/runtime/library").JsonValue;
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
    activate(user: User, id: string, dto: ActivateDto): Promise<{
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
            tenure_options: import("@prisma/client/runtime/library").JsonValue;
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
    recordDownPayment(user: User, id: string, dto: RecordDownPaymentDto, idempotencyKey?: string): Promise<{
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
            tenure_options: import("@prisma/client/runtime/library").JsonValue;
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
    dealerLeads(user: User, query: DealerApplicationsQueryDto): Promise<{
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
    deleteOps(user: User, id: string): Promise<{
        ok: boolean;
    }>;
    rebuildSchedule(user: User, id: string, dto: RebuildScheduleDto): Promise<Record<string, unknown>>;
    convertDaily(user: User, id: string): Promise<Record<string, unknown>>;
    syncSchedules(user: User, id: string): Promise<Record<string, unknown>>;
}
export {};
