import { type PrismaClient } from '@prisma/client';
export type CheryListing = {
    id: string;
    make: string;
    model: string;
    trim?: string;
    year: number;
    color?: string;
    price: number;
    gear?: string;
    drive?: string;
    body?: string;
    cover?: string;
    uri?: string;
    condition?: string;
    mileage?: number;
};
export declare const DEFAULT_OFFER_ID = "seed-al-jazeera-offer";
export declare function loadCheryListings(): CheryListing[];
export declare function seedCheryInventory(prisma: PrismaClient): Promise<{
    companyId: string;
    companyCode: string | null;
    companyName: string;
    listingsPublished: number;
}>;
