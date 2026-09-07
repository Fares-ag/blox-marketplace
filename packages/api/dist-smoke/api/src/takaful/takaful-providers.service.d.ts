import { User } from '@prisma/client';
import type { TakafulProviderDto, TakafulQuoteDto } from '../../../shared/src/types/customer-platform';
import { ActivityService } from '../common/activity.service';
import { PrismaService } from '../prisma/prisma.service';
import { type TakafulCoverage } from './takaful-quote';
export type TakafulRiderInput = {
    code: string;
    label: string;
    label_ar?: string | null;
    annual_amount: number;
};
export type TakafulProviderInput = {
    code?: string;
    name?: string;
    name_ar?: string | null;
    comprehensive_rate_pct?: number;
    third_party_annual?: number | null;
    min_contribution?: number | null;
    riders?: TakafulRiderInput[];
    contact_phone?: string | null;
    contact_email?: string | null;
    website?: string | null;
    notes?: string | null;
    active?: boolean;
    sort_order?: number;
};
export type CreateTakafulProviderInput = TakafulProviderInput & {
    code: string;
    name: string;
    comprehensive_rate_pct: number;
};
export declare class TakafulProvidersService {
    private readonly prisma;
    private readonly activity;
    constructor(prisma: PrismaService, activity: ActivityService);
    quotes(coverage: TakafulCoverage, vehiclePrice: number | null): Promise<TakafulQuoteDto[]>;
    list(): Promise<TakafulProviderDto[]>;
    get(id: string): Promise<TakafulProviderDto>;
    create(actor: User, input: CreateTakafulProviderInput): Promise<TakafulProviderDto>;
    update(actor: User, id: string, input: TakafulProviderInput): Promise<TakafulProviderDto>;
    private require;
}
