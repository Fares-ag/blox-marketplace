import { Prisma, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { IdempotencyService } from '../common/idempotency.service';
export declare class CreditsService {
    private readonly prisma;
    private readonly idempotency;
    constructor(prisma: PrismaService, idempotency: IdempotencyService);
    getBalance(user: User): Promise<{
        balance: number;
    }>;
    ensureRow(userId: string): Promise<{
        id: string;
        updatedAt: Date;
        userId: string;
        balance: Prisma.Decimal;
    }>;
    payInstallment(user: User, applicationId: string, dueDate: string, amount: number): Promise<{
        ok: boolean;
        remaining: number;
        balance: number;
        reference: string;
        credit_transaction_id: string;
        credits_debited: number;
    }>;
    listBalances(query: {
        q?: string;
        limit?: number;
        offset?: number;
    }): Promise<{
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
    adminBalance(userId: string): Promise<{
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
    adminAdjust(actor: User, userId: string, action: 'add' | 'subtract' | 'set', amount: number, description?: string): Promise<{
        balance: number;
    }>;
    claim(user: User, amount: number): Promise<{
        balance: number;
    }>;
    claimFromTopUp(user: User, transactionId: string): Promise<{
        balance: number;
        credits_added: number;
        message: string;
    }>;
}
