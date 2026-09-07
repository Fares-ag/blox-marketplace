import { type PrismaClient } from '@prisma/client';
export type QautoAttribute = {
    id: string;
    name: string;
    value: string;
};
export type QautoListing = {
    id: string;
    make: string;
    model: string;
    trim: string;
    year: number;
    condition: string;
    engine: string;
    color: string;
    mileage: number;
    price: number;
    description: string;
    image: string | null;
    attributes: QautoAttribute[];
};
export declare const EXPECTED_AUDI_COUNT = 25;
export declare const EXPECTED_VW_COUNT = 32;
export declare const EXPECTED_SKODA_COUNT = 34;
export declare function loadQautoListings(): QautoListing[];
export declare function seedQautoInventory(prisma: PrismaClient): Promise<{
    audiCompanyId: string;
    vwCompanyId: string;
    skodaCompanyId: string;
    audiPublished: number;
    volkswagenPublished: number;
    skodaPublished: number;
    listingsPublished: number;
}>;
