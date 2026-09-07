import { ConfigService } from '@nestjs/config';
import { ScheduleStatus, PaymentTransactionStatus, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationQueryDto } from '../common/pagination.dto';
import { AppConfigService } from '../config/app-config.service';
import { ActivityService } from '../common/activity.service';
import { AnalyticsService } from '../analytics/analytics.service';
export type MobileSkipCashInitiateInput = {
    applicationId: string;
    scheduleId: string;
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
};
export type MobileCreditTopUpInput = {
    amount: number;
    transactionId: string;
    returnUrl?: string;
    firstName: string;
    lastName: string;
    phone: string;
    email: string;
    custom1?: string;
    subject?: string;
    description?: string;
};
export type MobileSkipCashVerifyInput = {
    gatewayPaymentId?: string;
    paymentId?: string;
    transactionId?: string;
    idempotencyKey?: string;
};
export declare class PaymentsService {
    private readonly prisma;
    private readonly activity;
    private readonly analytics;
    private readonly config;
    private readonly appConfig;
    private readonly logger;
    constructor(prisma: PrismaService, activity: ActivityService, analytics: AnalyticsService, config: ConfigService, appConfig: AppConfigService);
    private isSkipCashSandbox;
    private skipCashClient;
    private mobileSkipCashResponse;
    private attachSkipCashCheckout;
    private assertWaiveRole;
    private resolveSodEnabled;
    private assertPaymentRole;
    listActiveBook(user: User, query: PaginationQueryDto & {
        q?: string;
    }): Promise<{
        total: number;
        limit: number;
        offset: number;
        summary: {
            active: number;
            remaining_principal: number;
        };
        items: {
            application_id: string;
            customer_name: string;
            customer_email: string;
            vehicle: string;
            company_name: string;
            activated_at: string | null;
            remaining_principal: number;
            installments_total: number;
            installments_paid: number;
            installments_overdue: number;
            next_due_date: string | null;
            next_amount: number | null;
            next_sequence: number | null;
        }[];
    }>;
    listTransactions(user: User, query: PaginationQueryDto & {
        status?: PaymentTransactionStatus;
        applicationId?: string;
    }): Promise<{
        total: number;
        limit: number;
        offset: number;
        items: {
            id: string;
            application_id: string;
            gateway: string;
            gateway_payment_id: string | null;
            amount: number;
            currency: string;
            status: import(".prisma/client").$Enums.PaymentTransactionStatus;
            sequence: number | null;
            due_date: string | null;
            customer_name: string;
            customer_email: string;
            vehicle: string;
            company_name: string;
            created_at: string;
        }[];
    }>;
    listSchedules(user: User, query: PaginationQueryDto & {
        status?: ScheduleStatus;
        applicationId?: string;
    }): Promise<{
        total: number;
        limit: number;
        offset: number;
        summary: {
            pending: number;
            overdue: number;
            paid: number;
        };
        items: {
            id: string;
            application_id: string;
            application_status: import(".prisma/client").$Enums.ApplicationStatus;
            customer_name: string;
            customer_email: string;
            vehicle: string;
            company_name: string;
            sequence: number;
            due_date: string;
            amount: number;
            paid_amount: number;
            remaining_amount: number;
            status: import(".prisma/client").$Enums.ScheduleStatus;
            effective_status: import(".prisma/client").$Enums.ScheduleStatus;
            payment_method: string | null;
            payment_reference: string | null;
            paid_at: string | null;
        }[];
    }>;
    recordPayment(user: User, scheduleId: string, body: {
        amount?: number;
        method?: string;
        reference?: string;
    }): Promise<{
        schedule: {
            id: string;
            application_id: string;
            sequence: number;
            due_date: string;
            amount: number;
            paid_amount: number;
            remaining_amount: number;
            status: import(".prisma/client").$Enums.ScheduleStatus;
            payment_method: string | null;
            payment_reference: string | null;
            paid_at: string | null;
            pending_waive_reason: string | null;
            pending_waive_requested_by_id: string | null;
            pending_waive_requested_at: string | null;
        };
        application_completed: boolean;
    }>;
    listPendingBank(user: User, query?: PaginationQueryDto): Promise<{
        total: number;
        limit: number;
        offset: number;
        items: {
            id: string;
            application_id: string;
            schedule_id: string | null;
            amount: number;
            status: import(".prisma/client").$Enums.PaymentTransactionStatus;
            customer_name: string;
            customer_email: string;
            vehicle: string;
            company_name: string;
            sequence: number | null;
            due_date: string | null;
            created_at: string;
        }[];
    }>;
    createPendingBank(user: User, scheduleId: string, body: {
        amount?: number;
        reference?: string;
    }): Promise<{
        id: string;
        idempotency_key: string;
        application_id: string;
        schedule_id: string | null;
        amount: number;
        status: import(".prisma/client").$Enums.PaymentTransactionStatus;
        gateway_payment_id: string | null;
        created_at: Date;
        updated_at: Date;
    }>;
    confirmBank(user: User, transactionId: string): Promise<{
        schedule: {
            id: string;
            application_id: string;
            sequence: number;
            due_date: string;
            amount: number;
            paid_amount: number;
            remaining_amount: number;
            status: import(".prisma/client").$Enums.ScheduleStatus;
            payment_method: string | null;
            payment_reference: string | null;
            paid_at: string | null;
            pending_waive_reason: string | null;
            pending_waive_requested_by_id: string | null;
            pending_waive_requested_at: string | null;
        };
        application_completed: boolean;
    }>;
    requestWaiveSchedule(user: User, scheduleId: string, reason?: string): Promise<{
        schedule: {
            id: string;
            application_id: string;
            sequence: number;
            due_date: string;
            amount: number;
            paid_amount: number;
            remaining_amount: number;
            status: import(".prisma/client").$Enums.ScheduleStatus;
            payment_method: string | null;
            payment_reference: string | null;
            paid_at: string | null;
            pending_waive_reason: string | null;
            pending_waive_requested_by_id: string | null;
            pending_waive_requested_at: string | null;
        };
    }>;
    confirmWaiveSchedule(user: User, scheduleId: string): Promise<{
        schedule: {
            id: string;
            application_id: string;
            sequence: number;
            due_date: string;
            amount: number;
            paid_amount: number;
            remaining_amount: number;
            status: import(".prisma/client").$Enums.ScheduleStatus;
            payment_method: string | null;
            payment_reference: string | null;
            paid_at: string | null;
            pending_waive_reason: string | null;
            pending_waive_requested_by_id: string | null;
            pending_waive_requested_at: string | null;
        };
        application_completed: boolean;
    }>;
    markOverdueSystem(): Promise<{
        marked_overdue: number;
    }>;
    markOverdue(user: User): Promise<{
        marked_overdue: number;
    }>;
    createSkipCashPayment(user: User, applicationId: string, scheduleId: string): Promise<{
        transaction_id: string;
        idempotency_key: string;
        amount: number;
        currency: string;
        redirect_url: string;
        sandbox: boolean;
    }>;
    initiateMobileInstallmentPayment(user: User, input: MobileSkipCashInitiateInput): Promise<{
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
    createCreditTopUpPayment(user: User, input: MobileCreditTopUpInput): Promise<{
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
    mobileVerifySkipCash(user: User, input: MobileSkipCashVerifyInput): Promise<{
        data: {
            status: string;
            statusId: number;
            dbStatus: string;
            dbConfirmed: boolean;
            transactionId: string;
            amount: number;
        };
    }>;
    private formatMobileVerifyResponse;
    private completeCreditTopUpPayment;
    private skipCashOpenWindowMs;
    private serializeSkipCashPayment;
    verifyAndComplete(gatewayPaymentId: string): Promise<{
        transaction: {
            id: string;
            idempotency_key: string;
            application_id: string;
            schedule_id: string | null;
            amount: number;
            status: import(".prisma/client").$Enums.PaymentTransactionStatus;
            gateway_payment_id: string | null;
            created_at: Date;
            updated_at: Date;
        };
        already_completed: boolean;
        transaction_id?: undefined;
        schedule?: undefined;
        application_completed?: undefined;
    } | {
        transaction_id: string;
        schedule: {
            id: string;
            application_id: string;
            sequence: number;
            due_date: string;
            amount: number;
            paid_amount: number;
            remaining_amount: number;
            status: import(".prisma/client").$Enums.ScheduleStatus;
            payment_method: string | null;
            payment_reference: string | null;
            paid_at: string | null;
            pending_waive_reason: string | null;
            pending_waive_requested_by_id: string | null;
            pending_waive_requested_at: string | null;
        };
        application_completed: boolean;
        already_completed: boolean;
        transaction?: undefined;
    }>;
    completeSkipCashPayment(idempotencyKey: string, gatewayPaymentId?: string): Promise<{
        transaction: {
            id: string;
            idempotency_key: string;
            application_id: string;
            schedule_id: string | null;
            amount: number;
            status: import(".prisma/client").$Enums.PaymentTransactionStatus;
            gateway_payment_id: string | null;
            created_at: Date;
            updated_at: Date;
        };
        already_completed: boolean;
        transaction_id?: undefined;
        schedule?: undefined;
        application_completed?: undefined;
    } | {
        transaction_id: string;
        schedule: {
            id: string;
            application_id: string;
            sequence: number;
            due_date: string;
            amount: number;
            paid_amount: number;
            remaining_amount: number;
            status: import(".prisma/client").$Enums.ScheduleStatus;
            payment_method: string | null;
            payment_reference: string | null;
            paid_at: string | null;
            pending_waive_reason: string | null;
            pending_waive_requested_by_id: string | null;
            pending_waive_requested_at: string | null;
        };
        application_completed: boolean;
        already_completed: boolean;
        transaction?: undefined;
    }>;
    private sandboxCompleteSkipCashPayment;
}
