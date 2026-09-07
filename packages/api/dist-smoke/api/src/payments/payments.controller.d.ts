import { PaymentTransactionStatus, ScheduleStatus, User } from '@prisma/client';
import { IdempotencyService } from '../common/idempotency.service';
import { PaginationQueryDto } from '../common/pagination.dto';
import { PaymentsService } from './payments.service';
declare class RecordPaymentDto {
    amount?: number;
    method?: string;
    reference?: string;
}
declare class WaiveDto {
    reason: string;
}
declare class ListSchedulesQuery extends PaginationQueryDto {
    status?: ScheduleStatus;
    applicationId?: string;
}
declare class ActiveBookQuery extends PaginationQueryDto {
    q?: string;
}
declare class ListTransactionsQuery extends PaginationQueryDto {
    status?: PaymentTransactionStatus;
    applicationId?: string;
}
declare class SkipCashCompleteDto {
    idempotency_key: string;
    gateway_payment_id?: string;
}
export declare class PaymentsController {
    private readonly payments;
    private readonly idempotency;
    constructor(payments: PaymentsService, idempotency: IdempotencyService);
    list(user: User, query: ListSchedulesQuery): Promise<{
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
    book(user: User, query: ActiveBookQuery): Promise<{
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
    transactions(user: User, query: ListTransactionsQuery): Promise<{
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
    pay(user: User, id: string, dto: RecordPaymentDto, idempotencyKey?: string): Promise<{
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
    requestWaive(user: User, id: string, dto: WaiveDto): Promise<{
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
    confirmWaive(user: User, id: string): Promise<{
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
    markOverdue(user: User): Promise<{
        marked_overdue: number;
    }>;
    pendingBank(user: User, query: PaginationQueryDto): Promise<{
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
    createPendingBank(user: User, id: string, dto: RecordPaymentDto): Promise<{
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
    confirmBank(user: User, id: string): Promise<{
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
    createSkipCash(user: User, applicationId: string, scheduleId: string, idempotencyKey?: string): Promise<{
        transaction_id: string;
        idempotency_key: string;
        amount: number;
        currency: string;
        redirect_url: string;
        sandbox: boolean;
    }>;
    completeSkipCash(dto: SkipCashCompleteDto): Promise<{
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
}
export {};
