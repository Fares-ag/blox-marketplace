import type { User } from '@prisma/client';
import type { CustomerAddressDto, CustomerProfileDto } from '../../../shared/src/types/customer-platform';
export declare function parseIsoDate(value: string | null | undefined): Date | null;
export declare function formatIsoDate(value: Date | null | undefined): string | null;
export declare function addressFromJson(raw: unknown): CustomerAddressDto | null;
export type AddressPatch = {
    line1?: string | null;
    area?: string | null;
    city?: string | null;
    zone?: string | null;
    po_box?: string | null;
};
export declare function mergeAddressJson(current: unknown, patch: AddressPatch): Record<string, string | null>;
export declare function composeName(first: string | null | undefined, last: string | null | undefined): string | null;
export declare function toCustomerProfileDto(user: User, qid: string | null): CustomerProfileDto;
