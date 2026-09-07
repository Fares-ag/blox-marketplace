import type { ApplicationStatus, PublicOffer } from '../types/domain';
import type { AssistedSessionDto, TakafulPolicyDto } from '../types/customer-platform';
import type { DocumentSlot } from '../lib/document-slots';

export type OpsAudience = 'admin' | 'dealer' | 'credit' | 'finance' | 'super_admin';

export type OpsAgent = { id: string; name: string | null; email: string };

/**
 * Soft product-rule finding stored on `pricing_snapshot.rule_flags` at intake.
 * Older records may carry bare code strings.
 */
export type OpsRuleFlag =
  | string
  | { code: string; severity?: 'hard' | 'soft'; params?: Record<string, string | number> };

/** `GET /api/ops/applications/:id/document-slots`. */
export type OpsDocumentSlotsResponse = {
  slots: DocumentSlot[];
  uploaded: string[];
  missing: string[];
};

/** `GET /api/assist-sessions?application_id=` — accepted as a bare array or a paginated envelope. */
export type AssistedSessionListResponse = AssistedSessionDto[] | { items: AssistedSessionDto[] };

/** `POST /api/ops/applications/:id/unmask`. */
export type OpsUnmaskField = 'qid' | 'phone';
export type OpsUnmaskResponse = { field: OpsUnmaskField; value: string };

/** Audited reveal of masked identity fields, wired from the workspace into the applicant profile. */
export type IdentityRevealProps = {
  canReveal: OpsUnmaskField[];
  revealed: Partial<Record<OpsUnmaskField, string>>;
  onReveal: (field: OpsUnmaskField) => void;
  busy?: boolean;
};

export type OpsQueueItem = {
  id: string;
  status: ApplicationStatus;
  created_at: string;
  submitted_at?: string | null;
  identity_hold_reason?: string | null;
  identity_hold_cleared_at?: string | null;
  finance_partner_id?: string | null;
  branch_id?: string | null;
  branch_name?: string | null;
  pricing_snapshot?: Record<string, unknown> | null;
  installment_plan?: Record<string, unknown> | null;
  deal_summary?: { selling_price: number; monthly: number; rate: number };
  payment_health?: 'none' | 'on_track' | 'overdue' | 'paid';
  risk_level?: 'low' | 'medium' | 'high';
  product?: { make: string; model: string; model_year: number; slug: string; price?: number | null };
  company?: { name: string };
  customer?: { name: string | null; email: string };
  agent?: OpsAgent | null;
  financing_source?: 'blox' | 'partner';
  finance_partner_name?: string | null;
};

export type VerificationCheckSummary = {
  score: number | null;
  passed: boolean | null;
  status: 'passed' | 'failed' | 'processing' | 'not_submitted';
  reasons: string[];
  vendor_status?: string | null;
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
  poa: DiditStepSummary & { submitted: boolean };
};

export type ExtractedIdentityField = {
  name: string;
  label: string;
  value: string;
  confidence: number;
  source: string;
  document_type: string;
};

export type KycVerificationSummary = {
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
    id_document: VerificationCheckSummary;
    liveness: VerificationCheckSummary;
    face_match: VerificationCheckSummary;
    authenticity: VerificationCheckSummary;
    ocr: VerificationCheckSummary;
  };
  warnings: string[];
};

export type OpsWorkspace = {
  id: string;
  status: ApplicationStatus;
  contract_generated?: boolean;
  customer_email?: string;
  customer_snapshot?: Record<string, unknown>;
  pricing_snapshot?: Record<string, unknown>;
  installment_plan?: Record<string, unknown> | null;
  product?: { make: string; model: string; model_year?: number; slug?: string };
  company?: { id: string; name: string };
  customer?: { name: string | null; email: string; phone?: string | null };
  offer?: PublicOffer;
  financing_source?: 'blox' | 'partner';
  finance_partner_name?: string | null;
  finance_partner_id?: string | null;
  submitted_at?: string | null;
  /** Identity hold set at intake when the QID is already on file with different details. */
  identity_hold_reason?: string | null;
  identity_hold_at?: string | null;
  identity_hold_cleared_at?: string | null;
  consents_completed_at?: string | null;
  branch_id?: string | null;
  branch_name?: string | null;
  /** Soft product-rule findings recorded at intake for credit review. */
  rule_flags?: OpsRuleFlag[] | null;
  takaful_policies?: TakafulPolicyDto[];
  kyc_verification?: KycVerificationSummary | null;
  documents?: Array<{
    id: string;
    category: string;
    mime_type?: string | null;
    original_name?: string | null;
    kyc_document_type?: string | null;
    verification_status?: string | null;
    created_at?: string;
  }>;
  payment_schedules?: Array<{
    id: string;
    sequence: number;
    due_date: string;
    amount: number | null;
    paid_amount?: number | null;
    remaining_amount?: number | null;
    status: string;
    pending_waive_reason?: string | null;
    pending_waive_requested_by_id?: string | null;
  }>;
  payment_transactions?: Array<{
    id: string;
    gateway: string;
    amount: number;
    status: string;
    created_at: string;
    receipt_url?: string | null;
  }>;
  activity_logs?: Array<{
    id: string;
    action: string;
    from_value: string | null;
    to_value: string | null;
    actor_email: string | null;
    created_at: string;
  }>;
  comments?: Array<{
    id: string;
    body: string | null;
    actor_email: string | null;
    created_at: string;
  }>;
  agent?: OpsAgent | null;
  allow_direct_activate?: boolean;
  rejection_reason?: string | null;
  resubmission_comment?: string | null;
  /** True when the current user is the credit approver and SoD blocks them from payments. */
  separation_of_duties_blocked?: boolean;
};

export type StaffCreatePayload = {
  productId?: string;
  productIds?: string[];
  offerId: string;
  customerSnapshot: {
    full_name: string;
    phone: string;
    qid: string;
    email: string;
    employment?: string;
    income?: number;
    applicantType?: 'individual' | 'corporate';
  };
  pricingSnapshot: Record<string, unknown>;
  installmentPlan?: Record<string, unknown>;
  agentUserId?: string;
  listPrice?: number;
  sellingPrice?: number;
  hideInterest?: boolean;
  companyId?: string;
  submit?: boolean;
};
