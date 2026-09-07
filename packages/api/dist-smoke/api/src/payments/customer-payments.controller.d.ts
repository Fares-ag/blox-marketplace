import { User } from '@prisma/client';
import { CustomerPaymentsService } from './customer-payments.service';
export declare class CustomerPaymentsController {
    private readonly payments;
    constructor(payments: CustomerPaymentsService);
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
    deferralStatus(user: User): Promise<{
        year: number;
        used: number;
        remaining: number;
        limit: number;
        membership_active: boolean;
    }>;
}
