import { CustomerDocumentCategory, Gender, User } from '@prisma/client';
import type { Response } from 'express';
import { CustomerDocumentsService } from './customer-documents.service';
import { CustomersService } from './customers.service';
declare class NotificationChannelsDto {
    email?: boolean;
    sms?: boolean;
    push?: boolean;
    whatsapp?: boolean;
}
declare class NotificationRemindersDto {
    payments?: boolean;
    documents?: boolean;
    takaful?: boolean;
}
declare class NotificationPreferencesPatchDto {
    channels?: NotificationChannelsDto;
    reminders?: NotificationRemindersDto;
}
declare class CustomerAddressPatchDto {
    line1?: string | null;
    area?: string | null;
    city?: string | null;
    zone?: string | null;
    po_box?: string | null;
}
declare class UpdateCustomerProfileDto {
    first_name?: string | null;
    last_name?: string | null;
    gender?: Gender | null;
    date_of_birth?: string | null;
    nationality?: string | null;
    phone?: string | null;
    preferred_language?: 'en' | 'ar';
    notification_preferences?: NotificationPreferencesPatchDto;
    address?: CustomerAddressPatchDto;
}
declare class UploadCustomerDocumentDto {
    category: CustomerDocumentCategory;
    document_number?: string;
    issued_at?: string;
    expires_at?: string;
}
export declare class CustomersController {
    private readonly customers;
    private readonly documents;
    constructor(customers: CustomersService, documents: CustomerDocumentsService);
    profile(user: User): import("@drivemarket/shared/src/types/customer-platform").CustomerProfileDto;
    updateProfile(user: User, dto: UpdateCustomerProfileDto): Promise<import("@drivemarket/shared/src/types/customer-platform").CustomerProfileDto>;
    listDocuments(user: User): Promise<import("@drivemarket/shared/src/types/customer-platform").CustomerDocumentDto[]>;
    uploadDocument(user: User, dto: UploadCustomerDocumentDto, file: Express.Multer.File | undefined): Promise<import("@drivemarket/shared/src/types/customer-platform").CustomerDocumentDto>;
    downloadDocument(user: User, id: string, res: Response): Promise<void>;
    deleteDocument(user: User, id: string): Promise<{
        status: true;
    }>;
    opsListDocuments(user: User, userId: string): Promise<import("@drivemarket/shared/src/types/customer-platform").CustomerDocumentDto[]>;
    opsDownloadDocument(user: User, userId: string, id: string, res: Response): Promise<void>;
    opsVerifyDocument(user: User, userId: string, id: string): Promise<import("@drivemarket/shared/src/types/customer-platform").CustomerDocumentDto>;
}
export {};
