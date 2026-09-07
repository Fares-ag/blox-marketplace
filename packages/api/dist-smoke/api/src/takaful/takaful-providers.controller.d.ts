import { User } from '@prisma/client';
import { type TakafulCoverage } from './takaful-quote';
import { TakafulProvidersService } from './takaful-providers.service';
declare class TakafulRiderDto {
    code: string;
    label: string;
    label_ar?: string | null;
    annual_amount: number;
}
declare class UpdateTakafulProviderDto {
    code?: string;
    name?: string;
    name_ar?: string | null;
    comprehensive_rate_pct?: number;
    third_party_annual?: number | null;
    min_contribution?: number | null;
    riders?: TakafulRiderDto[];
    contact_phone?: string | null;
    contact_email?: string | null;
    website?: string | null;
    notes?: string | null;
    active?: boolean;
    sort_order?: number;
}
declare class CreateTakafulProviderDto extends UpdateTakafulProviderDto {
    code: string;
    name: string;
    comprehensive_rate_pct: number;
}
declare class TakafulQuoteQueryDto {
    vehicle_price?: number;
    coverage?: TakafulCoverage;
}
export declare class TakafulProvidersController {
    private readonly providers;
    constructor(providers: TakafulProvidersService);
    quotes(query: TakafulQuoteQueryDto): Promise<import("@drivemarket/shared/src/types/customer-platform").TakafulQuoteDto[]>;
    list(): Promise<import("@drivemarket/shared/src/types/customer-platform").TakafulProviderDto[]>;
    one(id: string): Promise<import("@drivemarket/shared/src/types/customer-platform").TakafulProviderDto>;
    create(actor: User, dto: CreateTakafulProviderDto): Promise<import("@drivemarket/shared/src/types/customer-platform").TakafulProviderDto>;
    update(actor: User, id: string, dto: UpdateTakafulProviderDto): Promise<import("@drivemarket/shared/src/types/customer-platform").TakafulProviderDto>;
}
export {};
