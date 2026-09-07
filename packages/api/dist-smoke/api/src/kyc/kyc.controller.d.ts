import type { User } from '@prisma/client';
import type { Request } from 'express';
import { KycBridgeService } from './kyc-bridge.service';
export declare class KycController {
    private readonly kyc;
    constructor(kyc: KycBridgeService);
    session(user: User, applicationId: string): Promise<{
        case_id: string;
        invite_token: string;
        invite_url: string;
        required_slots: ("qid_front" | "qid_back" | "passport" | "selfie")[];
    }>;
    documents(user: User, applicationId: string): Promise<{
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
    webhook(req: Request & {
        rawBody?: string;
    }, signature: string | undefined, body: {
        type?: string;
        case_id?: string;
    }): Promise<{
        ok: boolean;
        skipped: string;
    } | {
        ok: boolean;
        skipped?: undefined;
    }>;
}
