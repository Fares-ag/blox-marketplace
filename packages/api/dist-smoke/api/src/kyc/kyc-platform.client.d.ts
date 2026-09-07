import { ConfigService } from '@nestjs/config';
export type KycDocument = {
    id: string;
    type: string;
    status: string;
    review_status: string | null;
    quality: number | {
        score?: number;
    } | null;
    authenticity: number | {
        score?: number;
    } | null;
    mime_type?: string | null;
    original_filename?: string | null;
    created_at: string;
};
export type KycVerificationResult = {
    id: string;
    case_id: string;
    document_id: string | null;
    kind: 'ocr' | 'authenticity' | 'liveness' | 'face_match';
    score: number | null;
    reasons: unknown;
    model_version: string | null;
    created_at: string;
};
export type DiditStepSummary = {
    status: string | null;
    score: number | null;
    warnings: string[];
};
export type DiditCaseSummary = {
    session_id: string;
    session_status: string;
    updated_at: string;
    document_type: string | null;
    image_quality_score: number | null;
    liveness_method: string | null;
    id_verification: DiditStepSummary;
    liveness: DiditStepSummary;
    face_match: DiditStepSummary;
    poa: DiditStepSummary & {
        submitted: boolean;
    };
};
export type ExtractedIdentityField = {
    name: string;
    label: string;
    value: string;
    confidence: number;
    source: string;
    document_type: string;
};
export type KycCaseDetail = {
    id: string;
    status: string;
    external_ref: string | null;
    required_documents: string[];
    documents: KycDocument[];
    verification_results?: KycVerificationResult[];
    didit?: DiditCaseSummary | null;
    extracted_identity?: ExtractedIdentityField[];
};
export declare const IDENTITY_SLOTS: readonly ["qid_front", "qid_back", "passport", "selfie"];
export declare class KycPlatformClient {
    private readonly config;
    private readonly logger;
    constructor(config: ConfigService);
    private baseUrl;
    private headers;
    configured(): boolean;
    private kycFetch;
    extractInviteToken(inviteUrl: string): string;
    findCaseByExternalRef(externalRef: string): Promise<KycCaseDetail | null>;
    createCase(input: {
        externalRef: string;
        fullName: string;
        email?: string;
        phone?: string;
    }): Promise<{
        id: string;
        status: string;
    }>;
    createInvite(caseId: string): Promise<{
        invite_url: string;
        invite_token: string;
    }>;
    getCaseDetail(caseId: string): Promise<KycCaseDetail>;
    fetchCaseDocumentFile(caseId: string, documentId: string): Promise<{
        buffer: Buffer;
        contentType: string;
        filename: string;
    }>;
    buildSlotSummary(kase: KycCaseDetail): ({
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
}
