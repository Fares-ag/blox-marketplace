import { User } from '@prisma/client';
import { CreditsService } from './credits.service';
declare class PayInstallmentDto {
    applicationId: string;
    dueDate: string;
    amount: number;
}
declare class AdminCreditsDto {
    action: 'add' | 'subtract' | 'set';
    amount: number;
    description?: string;
}
declare class ClaimCreditsDto {
    transactionId?: string;
    amount?: number;
}
export declare class CreditsController {
    private readonly credits;
    constructor(credits: CreditsService);
    balance(user: User): Promise<{
        balance: number;
    }>;
    pay(user: User, dto: PayInstallmentDto): Promise<{
        ok: boolean;
        remaining: number;
        balance: number;
        reference: string;
        credit_transaction_id: string;
        credits_debited: number;
    }>;
    claim(user: User, dto: ClaimCreditsDto): Promise<{
        balance: number;
    }>;
}
declare class ListCreditsQuery {
    q?: string;
    limit?: number;
    offset?: number;
}
export declare class OpsCreditsController {
    private readonly credits;
    constructor(credits: CreditsService);
    adminBalance(id: string): Promise<{
        balance: number;
        transactions: {
            id: string;
            action: string;
            amount: number;
            balance_after: number;
            description: string | null;
            created_at: string;
        }[];
    }>;
    adminAdjust(actor: User, id: string, dto: AdminCreditsDto): Promise<{
        balance: number;
    }>;
}
export declare class OpsCreditsListController {
    private readonly credits;
    constructor(credits: CreditsService);
    list(query: ListCreditsQuery): Promise<{
        total: number;
        limit: number;
        offset: number;
        items: {
            user_id: string;
            email: string;
            name: string;
            balance: number;
            updated_at: string;
        }[];
    }>;
}
export {};
