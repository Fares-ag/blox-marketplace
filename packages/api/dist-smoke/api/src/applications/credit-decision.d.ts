import { type ApprovalAuthority, type CreditAssessment } from "@drivemarket/shared/domain-rules";
export type ApprovalDecisionInput = {
    role: string;
    assessment: CreditAssessment;
    overrideReason?: string | null;
};
export type ApprovalDecisionOutcome = {
    ok: true;
    overridden: boolean;
    authority: ApprovalAuthority;
    tier: number;
} | {
    ok: false;
    status: 403 | 409;
    code: 'approval_authority_required' | 'dbr_exception_escalation_required' | 'dbr_above_hard_cap';
    extras: Record<string, unknown>;
};
export declare function effectiveAffordability(assessment: CreditAssessment): import("@drivemarket/shared/domain-rules").AffordabilityResult | null;
export declare function declinedForHardCap(assessment: CreditAssessment): boolean;
export declare function evaluateApprovalAuthorization(input: ApprovalDecisionInput): ApprovalDecisionOutcome;
export declare function assertApprovalAuthorized(input: ApprovalDecisionInput): Extract<ApprovalDecisionOutcome, {
    ok: true;
}>;
