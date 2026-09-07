import type { TakafulPolicy } from '@prisma/client';
import type { TakafulPolicyDto } from '../../../shared/src/types/customer-platform';
export declare const TAKAFUL_DECLARATION_VERSION = "takaful-2026-09-v1";
export declare const TAKAFUL_COVERAGE_TYPES: readonly ["comprehensive", "third_party"];
export type TakafulCoverageType = (typeof TAKAFUL_COVERAGE_TYPES)[number];
export declare function ridersFromJson(raw: unknown): string[];
export declare function toTakafulPolicyDto(policy: TakafulPolicy, now?: Date): TakafulPolicyDto;
