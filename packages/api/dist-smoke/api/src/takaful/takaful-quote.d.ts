import type { Prisma, TakafulProvider } from '@prisma/client';
import type { TakafulProviderDto, TakafulQuoteDto } from '../../../shared/src/types/customer-platform';
export declare const TAKAFUL_COVERAGES: readonly ["comprehensive", "third_party"];
export type TakafulCoverage = (typeof TAKAFUL_COVERAGES)[number];
export type TakafulRider = TakafulProviderDto['riders'][number];
export declare function roundMoney(value: number): number;
export declare function ridersFromProviderJson(raw: unknown): TakafulRider[];
export declare function ridersToJson(riders: Array<{
    code: string;
    label: string;
    label_ar?: string | null;
    annual_amount: number;
}>): Prisma.InputJsonValue;
export declare function toTakafulProviderDto(row: TakafulProvider): TakafulProviderDto;
export type TakafulRateCard = Pick<TakafulProviderDto, 'comprehensive_rate_pct' | 'min_contribution' | 'third_party_annual'>;
export declare function annualContribution(provider: TakafulRateCard, coverage: TakafulCoverage, vehiclePrice: number | null | undefined): number | null;
export declare function quoteTakaful(providers: TakafulProviderDto[], coverage: TakafulCoverage, vehiclePrice: number | null | undefined): TakafulQuoteDto[];
