import type { DiditCaseSummary, ExtractedIdentityField, KycCaseDetail } from './kyc-platform.client';
export type VerificationCheckDto = {
    score: number | null;
    passed: boolean | null;
    status: 'passed' | 'failed' | 'processing' | 'not_submitted';
    reasons: string[];
    vendor_status?: string | null;
};
export type KycVerificationSummaryDto = {
    case_id: string;
    case_status: string;
    kyc_status: string | null;
    provider: 'didit' | 'native' | null;
    didit_session_id: string | null;
    didit_session_status: string | null;
    didit_verified_at: string | null;
    document_type: string | null;
    image_quality_score: number | null;
    liveness_method: string | null;
    extracted_identity: ExtractedIdentityField[];
    didit_steps: DiditCaseSummary | null;
    overall_status: 'approved' | 'declined' | 'processing' | 'not_started';
    checks: {
        id_document: VerificationCheckDto;
        liveness: VerificationCheckDto;
        face_match: VerificationCheckDto;
        authenticity: VerificationCheckDto;
        ocr: VerificationCheckDto;
    };
    warnings: string[];
};
export declare function buildKycVerificationSummary(kase: KycCaseDetail, kycStatus: string | null): KycVerificationSummaryDto;
