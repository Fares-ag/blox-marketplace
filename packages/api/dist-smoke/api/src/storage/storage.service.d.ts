import { OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
export declare const CUSTOMER_UPLOAD_MAX_BYTES: number;
export declare function assertStorageRegionAllowed(config: ConfigService): void;
export declare class StorageService implements OnModuleInit {
    private readonly config;
    private client;
    private useLocal;
    private localRoot;
    constructor(config: ConfigService);
    onModuleInit(): Promise<void>;
    uploadListingImage(file: Express.Multer.File, companyId: string, productId: string): Promise<string>;
    uploadKyc(file: Express.Multer.File, applicationId: string, category: string): Promise<string>;
    private put;
    private publicUrl;
    readListingImage(objectKey: string): Promise<{
        buffer: Buffer;
        contentType: string;
    }>;
    private isMissingObjectError;
    assertImage(file?: Express.Multer.File): void;
    private static readonly KYC_ALLOWED_MIME;
    private static readonly KYC_MAX_BYTES;
    assertKycFile(file?: Express.Multer.File): void;
    readKyc(storagePath: string): Promise<{
        buffer: Buffer;
        contentType: string;
    }>;
    assertCustomerUploadFile(file?: Express.Multer.File): void;
    uploadVaultDocument(file: Express.Multer.File, userId: string, category: string): Promise<string>;
    uploadTakafulDocument(file: Express.Multer.File, applicationId: string, policyId: string): Promise<string>;
    storeContractPdf(applicationId: string, buffer: Buffer): Promise<string>;
    uploadSignedContract(file: Express.Multer.File, applicationId: string): Promise<string>;
    readContract(storagePath: string): Promise<{
        buffer: Buffer;
        contentType: string;
    }>;
    assertSignedContractFile(file?: Express.Multer.File): void;
    private extensionFromMime;
    private readObject;
}
