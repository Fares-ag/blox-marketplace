import { CustomerDocumentCategory, User } from '@prisma/client';
import type { CustomerDocumentDto } from '../../../shared/src/types/customer-platform';
import { ActivityService } from '../common/activity.service';
import { EncryptionService } from '../common/encryption.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
export type UploadCustomerDocumentInput = {
    category: CustomerDocumentCategory;
    document_number?: string;
    issued_at?: string;
    expires_at?: string;
};
export type VaultFile = {
    buffer: Buffer;
    contentType: string;
    filename: string;
};
export declare class CustomerDocumentsService {
    private readonly prisma;
    private readonly storage;
    private readonly encryption;
    private readonly activity;
    constructor(prisma: PrismaService, storage: StorageService, encryption: EncryptionService, activity: ActivityService);
    list(userId: string): Promise<CustomerDocumentDto[]>;
    upload(user: User, input: UploadCustomerDocumentInput, file: Express.Multer.File | undefined): Promise<CustomerDocumentDto>;
    download(user: User, id: string): Promise<VaultFile>;
    softDelete(user: User, id: string): Promise<{
        status: true;
    }>;
    listForOps(actor: User, userId: string): Promise<CustomerDocumentDto[]>;
    downloadForOps(actor: User, userId: string, id: string): Promise<VaultFile>;
    verify(actor: User, userId: string, id: string): Promise<CustomerDocumentDto>;
    private assertOpsAccess;
    private findOwned;
    private findLive;
    private toDto;
    private readFile;
}
