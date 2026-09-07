import { User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreditsService } from '../credits/credits.service';
export declare function hasActiveBloxMembership(bloxMembership: unknown): boolean;
export declare class CustomerPaymentsService {
    private readonly prisma;
    private readonly credits;
    constructor(prisma: PrismaService, credits: CreditsService);
    paymentsHub(user: User): Promise<{
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
    deferPayment(user: User, applicationId: string, scheduleId: string, reason?: string): Promise<{
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
}
