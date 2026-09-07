import { User } from '@prisma/client';
import { Response } from 'express';
import { PaymentsService } from '../payments/payments.service';
import { MobileService } from './mobile.service';
declare class MobileCreateApplicationDto {
    vehicleId: string;
    calculator?: Record<string, number>;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    nationalId: string;
    nationality?: string;
    gender?: string;
    dateOfBirth?: string;
    residenceDuration?: string;
}
declare class DeviceTokenDto {
    platform: string;
    fcmToken: string;
    appVersion?: string;
}
declare class SkipCashInitiateDto {
    applicationId: string;
    scheduleId: string;
    scheduleItemId?: string;
    returnUrl?: string;
    transactionId?: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    email?: string;
    custom1?: string;
    subject?: string;
    description?: string;
    onlyDebitCard?: boolean;
}
declare class SkipCashCreditTopUpDto {
    amount: number;
    transactionId: string;
    firstName: string;
    lastName: string;
    phone: string;
    email: string;
    returnUrl?: string;
    custom1?: string;
    subject?: string;
    description?: string;
}
declare class SkipCashVerifyDto {
    gatewayPaymentId?: string;
    paymentId?: string;
    transactionId?: string;
    idempotencyKey?: string;
}
export declare class MobileController {
    private readonly mobile;
    private readonly payments;
    constructor(mobile: MobileService, payments: PaymentsService);
    catalog(query: Record<string, string | string[] | undefined>): Promise<{
        items: {
            id: unknown;
            vehicle_id: unknown;
            make: unknown;
            model: unknown;
            trim: {} | null;
            model_year: unknown;
            condition: unknown;
            engine: {} | null;
            color: {} | null;
            mileage: {} | null;
            price: unknown;
            status: string;
            description: {} | null;
            attributes: any[];
            images: string[];
        }[];
        total: number;
        limit: number;
        offset: number;
    }>;
    vehicle(id: string): Promise<{
        id: unknown;
        vehicle_id: unknown;
        make: unknown;
        model: unknown;
        trim: {} | null;
        model_year: unknown;
        condition: unknown;
        engine: {} | null;
        color: {} | null;
        mileage: {} | null;
        price: unknown;
        status: string;
        description: {} | null;
        attributes: any[];
        images: string[];
    }>;
    dashboard(user: User): Promise<{
        applications: {
            id: string;
            status: import(".prisma/client").$Enums.ApplicationStatus;
            vehicle_id: string;
            vehicle: {
                make: string;
                model: string;
                price: import("@prisma/client/runtime/library").Decimal;
            };
            pricing_snapshot: import("@prisma/client/runtime/library").JsonValue;
            kyc_status: string | null;
            payment_schedules: {
                id: string;
                createdAt: Date;
                updatedAt: Date;
                status: import(".prisma/client").$Enums.ScheduleStatus;
                applicationId: string;
                dueDate: Date;
                sequence: number;
                amount: import("@prisma/client/runtime/library").Decimal;
                paidAmount: import("@prisma/client/runtime/library").Decimal;
                remainingAmount: import("@prisma/client/runtime/library").Decimal;
                paymentMethod: string | null;
                paymentReference: string | null;
                paidAt: Date | null;
                pendingWaiveReason: string | null;
                pendingWaiveRequestedById: string | null;
                pendingWaiveRequestedAt: Date | null;
            }[];
        }[];
        credits: {
            balance: number;
        };
    }>;
    create(user: User, dto: MobileCreateApplicationDto, res: Response): Promise<{
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
    offer(user: User, id: string): Promise<{
        application_id: string;
        status: string | undefined;
        pricing_snapshot: Record<string, unknown>;
        offer: {} | null;
    }>;
    accept(user: User, id: string): Promise<{
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
        ok: boolean;
        status: "active" | "completed" | "rejected" | "under_review" | "resubmission_required" | "contract_signing_required" | "contracts_submitted" | "contract_under_review" | "down_payment_required" | "down_payment_submitted" | "pending_finance_activation" | "partner_processing" | "submission_cancelled";
    }>;
    pre(user: User, id: string): Promise<{
        application_id: string;
        status: import(".prisma/client").$Enums.ApplicationStatus;
        kyc_status: string | null;
        qid_verified: boolean;
        contract_generated: boolean;
        signed_contract: boolean;
    }>;
    completePre(user: User, id: string): Promise<{
        application_id: string;
        status: import(".prisma/client").$Enums.ApplicationStatus;
        kyc_status: string | null;
        qid_verified: boolean;
        contract_generated: boolean;
        signed_contract: boolean;
    }>;
    hub(user: User): Promise<{
        schedules: ({
            application: {
                id: string;
                product: {
                    make: string;
                    model: string;
                    modelYear: number;
                };
                status: import(".prisma/client").$Enums.ApplicationStatus;
                productId: string;
                bloxMembership: import("@prisma/client/runtime/library").JsonValue;
            };
        } & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            status: import(".prisma/client").$Enums.ScheduleStatus;
            applicationId: string;
            dueDate: Date;
            sequence: number;
            amount: import("@prisma/client/runtime/library").Decimal;
            paidAmount: import("@prisma/client/runtime/library").Decimal;
            remainingAmount: import("@prisma/client/runtime/library").Decimal;
            paymentMethod: string | null;
            paymentReference: string | null;
            paidAt: Date | null;
            pendingWaiveReason: string | null;
            pendingWaiveRequestedById: string | null;
            pendingWaiveRequestedAt: Date | null;
        })[];
        credits: {
            balance: number;
        };
        settlement_application_id: string | null;
        settlement_quote: import("../settlements/settlement-quote").SettlementQuoteDto | null;
    }>;
    device(user: User, dto: DeviceTokenDto): Promise<{
        ok: boolean;
    }>;
    initiate(user: User, dto: SkipCashInitiateDto): Promise<{
        transaction_id: string;
        idempotency_key: string;
        amount: number;
        currency: string;
        redirect_url: string;
        paymentUrl: string;
        payUrl: string;
        paymentId: string | undefined;
        sandbox: boolean;
    }>;
    creditTopUp(user: User, dto: SkipCashCreditTopUpDto): Promise<{
        transaction_id: string;
        idempotency_key: string;
        amount: number;
        currency: string;
        redirect_url: string;
        paymentUrl: string;
        payUrl: string;
        paymentId: string | undefined;
        sandbox: boolean;
    }>;
    verify(user: User, dto: SkipCashVerifyDto): Promise<{
        data: {
            status: string;
            statusId: number;
            dbStatus: string;
            dbConfirmed: boolean;
            transactionId: string;
            amount: number;
        };
    }>;
}
export {};
