import { PaginationQueryDto } from '../common/pagination.dto';
import { CatalogService } from './catalog.service';
declare class PromotionDto {
    name: string;
    description?: string;
    discountPercentage?: number;
    discountAmount?: number;
    startDate?: string;
    endDate?: string;
    status?: string;
}
declare class InsuranceDto {
    name: string;
    description?: string;
    annualRate: number;
    annualRateProvider: number;
    coverageType?: string;
    minVehicleValue?: number;
    maxVehicleValue?: number;
    minTenure?: number;
    maxTenure?: number;
    status?: string;
    isDefault?: boolean;
}
declare class PackageDto {
    name: string;
    description?: string;
    items?: unknown[];
    price: number;
    status?: string;
}
export declare class CatalogController {
    private readonly catalog;
    constructor(catalog: CatalogService);
    listPromotions(query: PaginationQueryDto): Promise<{
        total: number;
        limit: number;
        offset: number;
        items: unknown[];
    }>;
    getPromotion(id: string): Promise<{}>;
    createPromotion(dto: PromotionDto): import(".prisma/client").Prisma.Prisma__PromotionClient<{
        name: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: string;
        description: string | null;
        startDate: Date | null;
        discountPercentage: import("@prisma/client/runtime/library").Decimal | null;
        discountAmount: import("@prisma/client/runtime/library").Decimal | null;
        endDate: Date | null;
    }, never, import("@prisma/client/runtime/library").DefaultArgs, import(".prisma/client").Prisma.PrismaClientOptions>;
    updatePromotion(id: string, dto: Partial<PromotionDto>): import(".prisma/client").Prisma.Prisma__PromotionClient<{
        name: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: string;
        description: string | null;
        startDate: Date | null;
        discountPercentage: import("@prisma/client/runtime/library").Decimal | null;
        discountAmount: import("@prisma/client/runtime/library").Decimal | null;
        endDate: Date | null;
    }, never, import("@prisma/client/runtime/library").DefaultArgs, import(".prisma/client").Prisma.PrismaClientOptions>;
    deletePromotion(id: string): import(".prisma/client").Prisma.Prisma__PromotionClient<{
        name: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: string;
        description: string | null;
        startDate: Date | null;
        discountPercentage: import("@prisma/client/runtime/library").Decimal | null;
        discountAmount: import("@prisma/client/runtime/library").Decimal | null;
        endDate: Date | null;
    }, never, import("@prisma/client/runtime/library").DefaultArgs, import(".prisma/client").Prisma.PrismaClientOptions>;
    listInsurance(query: PaginationQueryDto): Promise<{
        total: number;
        limit: number;
        offset: number;
        items: unknown[];
    }>;
    getInsurance(id: string): Promise<{}>;
    createInsurance(dto: InsuranceDto): import(".prisma/client").Prisma.Prisma__InsuranceRateClient<{
        name: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: string;
        description: string | null;
        isDefault: boolean;
        coverageType: string | null;
        annualRate: import("@prisma/client/runtime/library").Decimal;
        annualRateProvider: import("@prisma/client/runtime/library").Decimal;
        minVehicleValue: import("@prisma/client/runtime/library").Decimal | null;
        maxVehicleValue: import("@prisma/client/runtime/library").Decimal | null;
        minTenure: number | null;
        maxTenure: number | null;
    }, never, import("@prisma/client/runtime/library").DefaultArgs, import(".prisma/client").Prisma.PrismaClientOptions>;
    updateInsurance(id: string, dto: Partial<InsuranceDto>): import(".prisma/client").Prisma.Prisma__InsuranceRateClient<{
        name: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: string;
        description: string | null;
        isDefault: boolean;
        coverageType: string | null;
        annualRate: import("@prisma/client/runtime/library").Decimal;
        annualRateProvider: import("@prisma/client/runtime/library").Decimal;
        minVehicleValue: import("@prisma/client/runtime/library").Decimal | null;
        maxVehicleValue: import("@prisma/client/runtime/library").Decimal | null;
        minTenure: number | null;
        maxTenure: number | null;
    }, never, import("@prisma/client/runtime/library").DefaultArgs, import(".prisma/client").Prisma.PrismaClientOptions>;
    deleteInsurance(id: string): import(".prisma/client").Prisma.Prisma__InsuranceRateClient<{
        name: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: string;
        description: string | null;
        isDefault: boolean;
        coverageType: string | null;
        annualRate: import("@prisma/client/runtime/library").Decimal;
        annualRateProvider: import("@prisma/client/runtime/library").Decimal;
        minVehicleValue: import("@prisma/client/runtime/library").Decimal | null;
        maxVehicleValue: import("@prisma/client/runtime/library").Decimal | null;
        minTenure: number | null;
        maxTenure: number | null;
    }, never, import("@prisma/client/runtime/library").DefaultArgs, import(".prisma/client").Prisma.PrismaClientOptions>;
    listPackages(query: PaginationQueryDto): Promise<{
        total: number;
        limit: number;
        offset: number;
        items: unknown[];
    }>;
    getPackage(id: string): Promise<{}>;
    createPackage(dto: PackageDto): import(".prisma/client").Prisma.Prisma__PackageClient<{
        name: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: string;
        items: import("@prisma/client/runtime/library").JsonValue;
        description: string | null;
        price: import("@prisma/client/runtime/library").Decimal;
    }, never, import("@prisma/client/runtime/library").DefaultArgs, import(".prisma/client").Prisma.PrismaClientOptions>;
    updatePackage(id: string, dto: Partial<PackageDto>): import(".prisma/client").Prisma.Prisma__PackageClient<{
        name: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: string;
        items: import("@prisma/client/runtime/library").JsonValue;
        description: string | null;
        price: import("@prisma/client/runtime/library").Decimal;
    }, never, import("@prisma/client/runtime/library").DefaultArgs, import(".prisma/client").Prisma.PrismaClientOptions>;
    deletePackage(id: string): import(".prisma/client").Prisma.Prisma__PackageClient<{
        name: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: string;
        items: import("@prisma/client/runtime/library").JsonValue;
        description: string | null;
        price: import("@prisma/client/runtime/library").Decimal;
    }, never, import("@prisma/client/runtime/library").DefaultArgs, import(".prisma/client").Prisma.PrismaClientOptions>;
    getSettings(): Promise<{
        name: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        isActive: boolean;
        priority: number;
        description: string | null;
        principalDiscountEnabled: boolean;
        principalDiscountType: string;
        principalDiscountValue: import("@prisma/client/runtime/library").Decimal;
        principalDiscountMinAmount: import("@prisma/client/runtime/library").Decimal;
        interestDiscountEnabled: boolean;
        interestDiscountType: string;
        interestDiscountValue: import("@prisma/client/runtime/library").Decimal;
        interestDiscountMinAmount: import("@prisma/client/runtime/library").Decimal;
        minSettlementAmount: import("@prisma/client/runtime/library").Decimal;
        minRemainingPayments: number;
        maxDiscountAmount: import("@prisma/client/runtime/library").Decimal | null;
        maxDiscountPercentage: import("@prisma/client/runtime/library").Decimal | null;
        tieredDiscounts: import("@prisma/client/runtime/library").JsonValue;
        validFrom: Date | null;
        validUntil: Date | null;
    }>;
    patchSettings(body: Record<string, unknown>): Promise<{
        name: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        isActive: boolean;
        priority: number;
        description: string | null;
        principalDiscountEnabled: boolean;
        principalDiscountType: string;
        principalDiscountValue: import("@prisma/client/runtime/library").Decimal;
        principalDiscountMinAmount: import("@prisma/client/runtime/library").Decimal;
        interestDiscountEnabled: boolean;
        interestDiscountType: string;
        interestDiscountValue: import("@prisma/client/runtime/library").Decimal;
        interestDiscountMinAmount: import("@prisma/client/runtime/library").Decimal;
        minSettlementAmount: import("@prisma/client/runtime/library").Decimal;
        minRemainingPayments: number;
        maxDiscountAmount: import("@prisma/client/runtime/library").Decimal | null;
        maxDiscountPercentage: import("@prisma/client/runtime/library").Decimal | null;
        tieredDiscounts: import("@prisma/client/runtime/library").JsonValue;
        validFrom: Date | null;
        validUntil: Date | null;
    }>;
}
export {};
