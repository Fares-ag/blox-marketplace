import type { ApplicationStatus, Prisma } from '@prisma/client';
import { toPublicOfferDto } from '../common/offer-response.dto';
type DecimalLike = Prisma.Decimal | number | string | null | undefined;
export type ApplicationAudience = 'customer' | 'ops' | 'dealer';
export declare function snapshotForAudience(snapshot: unknown, audience: ApplicationAudience): unknown;
export declare function toApplicationProductDto(product: {
    id: string;
    slug: string;
    make: string;
    model: string;
    trim?: string | null;
    modelYear: number;
    condition?: string;
    engine?: string | null;
    transmission?: string | null;
    cylinders?: number | null;
    drivetrain?: string | null;
    bodyType?: string | null;
    color?: string | null;
    mileage?: number | null;
    description?: string | null;
    price: DecimalLike;
    financeEligible?: boolean;
    warrantyMonths?: number | null;
    warrantyNotes?: string | null;
    listingStatus?: string;
    companyId?: string;
    publishedAt?: Date | null;
    defaultOfferId?: string | null;
}): {
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
};
export declare function toApplicationDocumentDto(doc: {
    id: string;
    category: string;
    mimeType?: string | null;
    createdAt: Date;
    originalName?: string | null;
    kycDocumentType?: string | null;
    verificationStatus?: string | null;
}): {
    id: string;
    category: string;
    mime_type: string | null;
    created_at: Date;
    original_name: string | null;
    kyc_document_type: string | null;
    verification_status: string | null;
};
export declare function toPaymentScheduleDto(schedule: {
    id: string;
    sequence: number;
    dueDate: Date;
    amount: DecimalLike;
    paidAmount: DecimalLike;
    remainingAmount: DecimalLike;
    status: string;
    paidAt?: Date | null;
    pendingWaiveReason?: string | null;
    pendingWaiveRequestedById?: string | null;
}): {
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
};
export type TakafulPolicyRow = {
    id: string;
    applicationId: string;
    provider?: string | null;
    policyNumber?: string | null;
    coverageType?: string | null;
    coverageAmount?: DecimalLike;
    premiumAmount?: DecimalLike;
    issuedAt?: Date | null;
    effectiveFrom?: Date | null;
    expiresAt?: Date | null;
    riders?: unknown;
    status: string;
    declarationAcceptedAt?: Date | null;
    declarationVersion?: string | null;
    documentPath?: string | null;
    verifiedAt?: Date | null;
    createdAt: Date;
};
export declare function daysToExpiry(expiresAt: Date | null | undefined, now?: Date): number | null;
export declare function toTakafulPolicyDto(policy: TakafulPolicyRow, now?: Date): {
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
};
type ApplicationCore = {
    id: string;
    customerUserId: string;
    customerEmail: string;
    customerSnapshot: unknown;
    productId: string;
    companyId: string;
    offerId: string;
    financePartnerId?: string | null;
    financePartnerBranchId?: string | null;
    branchId?: string | null;
    leadSource?: string | null;
    pricingSnapshot: unknown;
    installmentPlan?: unknown;
    status: ApplicationStatus;
    contractGenerated: boolean;
    rejectionReason?: string | null;
    resubmissionComment?: string | null;
    statusReason?: string | null;
    submittedAt?: Date | null;
    activatedAt?: Date | null;
    completedAt?: Date | null;
    identityHoldReason?: string | null;
    identityHoldAt?: Date | null;
    identityHoldClearedAt?: Date | null;
    identityHoldClearedById?: string | null;
    identityHoldClearedByName?: string | null;
    consentsCompletedAt?: Date | null;
    createdAt: Date;
    updatedAt: Date;
};
type ApplicationRelations = {
    product?: Partial<Parameters<typeof toApplicationProductDto>[0]> | null;
    documents?: Array<Partial<Parameters<typeof toApplicationDocumentDto>[0]>> | null;
    company?: {
        id?: string;
        name?: string;
        allowDirectActivate?: boolean;
    } | null;
    customer?: {
        name: string | null;
        email: string;
        phone?: string | null;
    } | null;
    offer?: (Parameters<typeof toPublicOfferDto>[0] & Record<string, unknown>) | null;
    paymentSchedules?: Array<Partial<Parameters<typeof toPaymentScheduleDto>[0]>> | null;
    financePartner?: {
        id?: string;
        name?: string | null;
        code?: string | null;
        crmAdapter?: string | null;
    } | null;
    branch?: {
        id?: string;
        name?: string | null;
        code?: string | null;
    } | null;
    takafulPolicies?: TakafulPolicyRow[] | null;
};
export declare function identityAndConsentFields(app: {
    identityHoldReason?: string | null;
    identityHoldAt?: Date | null;
    identityHoldClearedAt?: Date | null;
    identityHoldClearedByName?: string | null;
    consentsCompletedAt?: Date | null;
}): {
    identity_hold_reason: string | null;
    identity_hold_at: Date | null;
    identity_hold_cleared_at: Date | null;
    identity_hold_cleared_by_name: string | null;
    consents_completed_at: Date | null;
};
export declare function toApplicationDto(app: ApplicationCore & ApplicationRelations): {
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
};
export declare function toOpsApplicationDto(app: ApplicationCore & ApplicationRelations): {
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
};
export declare function toDealerApplicationDto(app: ApplicationCore & ApplicationRelations): {
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
};
export declare function mapApplicationDto(app: ApplicationCore & ApplicationRelations, audience: ApplicationAudience): {
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
};
export declare function toApplicationBlockingDto(result: {
    blocking: boolean;
    applicationId: string | null;
    status?: ApplicationStatus | null;
    draftApplicationId?: string | null;
}): {
    blocking: boolean;
    application_id: string | null;
    status: import(".prisma/client").$Enums.ApplicationStatus | null;
    draft_application_id: string | null;
};
export declare function toApplicationListItemDto(app: {
    id: string;
    status: ApplicationStatus;
    createdAt: Date;
    submittedAt?: Date | null;
    activatedAt?: Date | null;
    contractGenerated?: boolean;
    resubmissionComment?: string | null;
    pricingSnapshot?: unknown;
    identityHoldReason?: string | null;
    identityHoldAt?: Date | null;
    identityHoldClearedAt?: Date | null;
    consentsCompletedAt?: Date | null;
    product?: {
        make: string;
        model: string;
        modelYear: number;
        slug: string;
        price: DecimalLike;
    } | null;
}): {
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
};
export declare function toOpsApplicationQueueItemDto(app: {
    id: string;
    status: ApplicationStatus;
    createdAt: Date;
    submittedAt?: Date | null;
    customerSnapshot?: unknown;
    pricingSnapshot?: unknown;
    installmentPlan?: unknown;
    financePartnerId?: string | null;
    branchId?: string | null;
    identityHoldReason?: string | null;
    identityHoldAt?: Date | null;
    identityHoldClearedAt?: Date | null;
    consentsCompletedAt?: Date | null;
    product?: {
        make: string;
        model: string;
        modelYear: number;
        slug: string;
        price?: DecimalLike;
    } | null;
    company?: {
        name: string;
    } | null;
    customer?: {
        name: string | null;
        email: string;
    } | null;
    agent?: {
        id: string;
        name: string | null;
        email: string;
    } | null;
    paymentSchedules?: Array<{
        status: string;
        dueDate: Date;
    }>;
    financePartner?: {
        id?: string;
        name?: string | null;
        crmAdapter?: string | null;
    } | null;
    branch?: {
        id?: string;
        name?: string | null;
    } | null;
}): {
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
};
export declare function toDealerApplicationListItemDto(app: {
    id: string;
    status: ApplicationStatus;
    createdAt: Date;
    customerSnapshot?: unknown;
    pricingSnapshot?: unknown;
    financePartnerId?: string | null;
    branchId?: string | null;
    identityHoldReason?: string | null;
    identityHoldAt?: Date | null;
    identityHoldClearedAt?: Date | null;
    consentsCompletedAt?: Date | null;
    product?: {
        make: string;
        model: string;
        modelYear: number;
        slug: string;
    } | null;
    customer?: {
        name: string | null;
        email: string;
        phone?: string | null;
    } | null;
    agent?: {
        id: string;
        name: string | null;
        email: string;
    } | null;
    financePartner?: {
        id?: string;
        name?: string | null;
    } | null;
    branch?: {
        id?: string;
        name?: string | null;
    } | null;
}): {
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
};
export {};
