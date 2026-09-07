import { ConfigService } from '@nestjs/config';
import { User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { KycPlatformClient, type KycDocument } from './kyc-platform.client';
export declare class KycBridgeService {
    private readonly prisma;
    private readonly kyc;
    private readonly config;
    constructor(prisma: PrismaService, kyc: KycPlatformClient, config: ConfigService);
    verifyWebhookSignature(rawBody: string, signatureHeader: string | undefined): boolean;
    ensureSession(user: User, applicationId: string): Promise<{
        case_id: string;
        invite_token: string;
        invite_url: string;
        required_slots: ("qid_front" | "qid_back" | "passport" | "selfie")[];
    }>;
    documentStatus(user: User, applicationId: string): Promise<{
        case_status: string;
        kyc_status: string | null;
        slots: {
            type: "qid_front" | "qid_back" | "passport" | "selfie";
            status: string;
        }[];
        case_id?: undefined;
    } | {
        case_id: string;
        case_status: string;
        kyc_status: string | null;
        slots: ({
            type: "qid_front" | "qid_back" | "passport" | "selfie";
            status: "missing";
            document_id?: undefined;
            review_status?: undefined;
            quality?: undefined;
            authenticity?: undefined;
        } | {
            type: "qid_front" | "qid_back" | "passport" | "selfie";
            document_id: string;
            status: string;
            review_status: string;
            quality: number | {
                score?: number;
            } | null;
            authenticity: number | {
                score?: number;
            } | null;
        })[];
    }>;
    handleWebhook(rawBody: string, signature: string | undefined, payload: {
        type?: string;
        case_id?: string;
    }): Promise<{
        ok: boolean;
        skipped: string;
    } | {
        ok: boolean;
        skipped?: undefined;
    }>;
    syncDocuments(applicationId: string, uploadedById: string, docs: KycDocument[], caseStatus: string): Promise<void>;
    syncDocumentsForApplication(applicationId: string): Promise<void>;
    readApplicationDocumentBytes(applicationId: string, doc: {
        storagePath: string;
        mimeType?: string | null;
        originalName?: string | null;
        category: string;
        kycDocumentId?: string | null;
    }): Promise<{
        buffer: Buffer;
        contentType: string;
        filename: string;
    }>;
    getVerificationSummary(_applicationId: string, kycCaseId: string, kycStatus: string | null): Promise<import("./kyc-verification-summary").KycVerificationSummaryDto | null>;
}
