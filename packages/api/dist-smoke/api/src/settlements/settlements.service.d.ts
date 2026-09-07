import { SettlementStatus, User, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityService } from '../common/activity.service';
import { type SettlementQuoteDto } from './settlement-quote';
export declare const SETTLEMENT_DECISION_ROLES: UserRole[];
export declare const SETTLEMENT_QUOTE_OPS_ROLES: UserRole[];
export declare class SettlementsService {
    private readonly prisma;
    private readonly activity;
    constructor(prisma: PrismaService, activity: ActivityService);
    private assertDecisionRole;
    private loadForQuote;
    quote(user: User, applicationId: string): Promise<SettlementQuoteDto>;
    request(user: User, applicationId: string): Promise<{
        id: string;
        application_id: string;
        application_status: import(".prisma/client").$Enums.ApplicationStatus;
        status: import(".prisma/client").$Enums.SettlementStatus;
        customer_email: string;
        customer_name: string;
        vehicle: string;
        company_name: string;
        settlement_amount: number;
        remaining_principal: number;
        discount_amount: number;
        forgiven_rent: number;
        accrued_profit: number;
        quote_as_of: string | null;
        savings: number;
        requested_at: string;
        decided_at: string | null;
        decision_reason: string | null;
    }>;
    list(user: User, query: {
        status?: SettlementStatus;
        limit?: number;
        offset?: number;
    }): Promise<{
        total: number;
        limit: number;
        offset: number;
        summary: {
            pending: number;
        };
        items: {
            id: string;
            application_id: string;
            application_status: import(".prisma/client").$Enums.ApplicationStatus;
            status: import(".prisma/client").$Enums.SettlementStatus;
            customer_email: string;
            customer_name: string;
            vehicle: string;
            company_name: string;
            settlement_amount: number;
            remaining_principal: number;
            discount_amount: number;
            forgiven_rent: number;
            accrued_profit: number;
            quote_as_of: string | null;
            savings: number;
            requested_at: string;
            decided_at: string | null;
            decision_reason: string | null;
        }[];
    }>;
    decide(user: User, id: string, decision: 'approved' | 'rejected', reason?: string): Promise<{
        id: string;
        application_id: string;
        application_status: import(".prisma/client").$Enums.ApplicationStatus;
        status: import(".prisma/client").$Enums.SettlementStatus;
        customer_email: string;
        customer_name: string;
        vehicle: string;
        company_name: string;
        settlement_amount: number;
        remaining_principal: number;
        discount_amount: number;
        forgiven_rent: number;
        accrued_profit: number;
        quote_as_of: string | null;
        savings: number;
        requested_at: string;
        decided_at: string | null;
        decision_reason: string | null;
    }>;
}
