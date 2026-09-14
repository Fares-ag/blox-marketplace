/**
 * Wire types for the customer-platform features (consents, profile & vault,
 * takaful, assisted sessions, branches, finance providers, analytics, session
 * policy). Snake_case mirrors the API DTOs like the rest of `domain.ts`.
 */

export type ConsentCodeDto = 'credit_bureau' | 'terms' | 'kyc_biometric' | 'aml';
export type ConsentChannelDto = 'web' | 'mobile' | 'assisted';

export type ConsentRecordDto = {
  id: string;
  code: ConsentCodeDto;
  version: string;
  locale: 'en' | 'ar';
  channel: ConsentChannelDto;
  accepted_at: string;
  application_id: string | null;
  actor_name: string | null;
  /** True when the catalog has newer wording than this acceptance. */
  outdated: boolean;
  withdrawn_at?: string | null;
};

export type ConsentStatusDto = {
  catalog_version: string;
  required: ConsentCodeDto[];
  accepted: ConsentRecordDto[];
  missing: ConsentCodeDto[];
  complete: boolean;
  withdrawn?: ConsentRecordDto[];
};

export type GenderDto = 'male' | 'female' | 'prefer_not_to_say';

export type NotificationPreferencesDto = {
  channels: { email: boolean; sms: boolean; push: boolean; whatsapp: boolean };
  reminders: { payments: boolean; documents: boolean; takaful: boolean };
};

export type CustomerAddressDto = {
  line1?: string | null;
  area?: string | null;
  city?: string | null;
  zone?: string | null;
  po_box?: string | null;
};

export type CustomerProfileDto = {
  id: string;
  email: string;
  name: string;
  first_name: string | null;
  last_name: string | null;
  gender: GenderDto | null;
  date_of_birth: string | null;
  nationality: string | null;
  residency: 'qatari' | 'expat' | null;
  phone: string | null;
  qid_masked: string | null;
  preferred_language: 'en' | 'ar';
  notification_preferences: NotificationPreferencesDto;
  address: CustomerAddressDto | null;
};

export type CustomerDocumentCategoryDto =
  | 'qid_front'
  | 'qid_back'
  | 'passport'
  | 'driving_licence'
  | 'residence_proof'
  | 'salary_certificate'
  | 'bank_statement'
  | 'other';

export type CustomerDocumentDto = {
  id: string;
  category: CustomerDocumentCategoryDto;
  original_name: string | null;
  mime_type: string;
  size_bytes: number;
  document_number_masked: string | null;
  issued_at: string | null;
  expires_at: string | null;
  /** Days until expiry (negative when expired), null when no expiry recorded. */
  days_to_expiry: number | null;
  expiry_state: 'valid' | 'expiring_soon' | 'expired' | 'none';
  verified_at: string | null;
  created_at: string;
};

export type TakafulStatusDto = 'declared' | 'pending_verification' | 'active' | 'expired' | 'closed';

export type TakafulPolicyDto = {
  id: string;
  application_id: string;
  provider: string | null;
  policy_number: string | null;
  coverage_type: 'comprehensive' | 'third_party' | null;
  coverage_amount: number | null;
  premium_amount: number | null;
  issued_at: string | null;
  effective_from: string | null;
  expires_at: string | null;
  days_to_expiry: number | null;
  riders: string[];
  status: TakafulStatusDto;
  declaration_accepted_at: string | null;
  declaration_version: string | null;
  has_document: boolean;
  verified_at: string | null;
  created_at: string;
};

export type AssistedSessionStatusDto =
  | 'pending'
  | 'otp_verified'
  | 'consents_done'
  | 'identity_started'
  | 'completed'
  | 'expired'
  | 'cancelled';

export type AssistedSessionDto = {
  id: string;
  application_id: string;
  status: AssistedSessionStatusDto;
  phone_masked: string;
  expires_at: string;
  last_opened_at: string | null;
  otp_verified_at: string | null;
  consents_completed_at: string | null;
  identity_started_at: string | null;
  completed_at: string | null;
  /** Dealer-side only: the customer link, shown once for manual sharing. */
  link?: string;
  created_at: string;
};

/** What the customer sees when opening an assisted link (no auth). */
export type AssistedSessionPublicDto = {
  status: AssistedSessionStatusDto;
  phone_masked: string;
  dealer_name: string | null;
  agent_name: string | null;
  vehicle: { make: string; model: string; model_year: number | null } | null;
  plan: { tenure_months: number | null; down_payment_pct: number | null; monthly: number | null } | null;
  branding: CompanyBrandingDto | null;
  expires_at: string;
  consent_locale: 'en' | 'ar';
  kyc_url: string | null;
};

export type CompanyBrandingDto = {
  primary?: string | null;
  accent?: string | null;
  logo_url?: string | null;
  display_name?: string | null;
  tagline?: string | null;
};

export type BranchDto = {
  id: string;
  company_id: string;
  code: string;
  name: string;
  city: string | null;
  address: string | null;
  phone: string | null;
  active: boolean;
  staff_count?: number;
  created_at: string;
};

export type FinancePartnerBranchDto = {
  id: string;
  partner_id: string;
  code: string;
  name: string;
  city: string | null;
  active: boolean;
};

export type FinancePartnerEngagementModeDto = 'full_los_underwriting' | 'credit_file_handoff';
export type BreOwnershipDto = 'blox_bre_only' | 'blox_plus_partner_bre';

export type FinancePartnerAdminDto = {
  id: string;
  code: string;
  name: string;
  active: boolean;
  engagement_mode: FinancePartnerEngagementModeDto;
  bre_ownership: BreOwnershipDto;
  is_default_lender: boolean;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  notes: string | null;
  branches: FinancePartnerBranchDto[];
  application_count?: number;
};

export type OriginationFunnelGroupBy = 'company' | 'branch' | 'agent';

export type OriginationFunnelRow = {
  key: string;
  label: string;
  company_name?: string | null;
  branch_name?: string | null;
  drafts: number;
  submitted: number;
  approved: number;
  activated: number;
  rejected: number;
  /** Submitted → approved as a 0–1 ratio (null when nothing submitted). */
  approval_rate: number | null;
  median_approval_hours: number | null;
  under_24h_rate: number | null;
};

export type OriginationFunnelDto = {
  group_by: OriginationFunnelGroupBy;
  from: string;
  to: string;
  rows: OriginationFunnelRow[];
  totals: Omit<OriginationFunnelRow, 'key' | 'label'>;
};

export type SessionPolicyDto = {
  idle_timeout_sec: number;
  absolute_timeout_sec: number;
  warning_sec: number;
  single_session: boolean;
};

export type IdentityHoldDto = {
  reason: string;
  held_at: string;
  cleared_at: string | null;
  cleared_by_name?: string | null;
};

// ---------------------------------------------------------------------------
// Wave 2: settlement quotes, credit assessment, guarantors, takaful providers,
// data rights, partner view.
// ---------------------------------------------------------------------------

export type SettlementQuoteRowDto = {
  sequence: number;
  due_date: string;
  kind: 'settled' | 'overdue' | 'current' | 'future';
  principal_outstanding: number;
  rent_outstanding: number;
  accrued_rent: number;
  forgiven_rent: number;
};

export type SettlementQuoteDto = {
  as_of: string;
  principal_outstanding: number;
  accrued_profit: number;
  overdue_amount: number;
  forgiven_rent: number;
  settlement_amount: number;
  remaining_scheduled: number;
  savings: number;
  rows: SettlementQuoteRowDto[];
};

export type AffordabilityDto = {
  dbr: number;
  cap: number;
  hard_cap: number;
  status: 'within_cap' | 'exception_tier_1' | 'exception_tier_2' | 'exception_tier_3' | 'above_hard_cap';
  exception_tier: 0 | 1 | 2 | 3;
  max_installment_within_cap: number;
  headroom: number;
  stressed: { dbr: number; within_limit: boolean } | null;
};

export type CreditAssessmentDto = {
  affordability: AffordabilityDto | null;
  affordability_with_guarantor: AffordabilityDto | null;
  approval_authority: 'senior_manager' | 'head_of_credit' | 'above_matrix';
  path: 'approve' | 'refer' | 'decline';
  reasons: string[];
  rule_flags: Array<{ code: string; severity: 'hard' | 'soft'; params: Record<string, number | string> }>;
  assessed_at: string;
  financed_amount: number;
  monthly_installment: number;
  /** Computed for the requesting officer. */
  approver: { role_may_approve: boolean; required_roles: string[]; max_tier_for_role: number };
};

export type GuarantorSessionStatusDto = 'pending' | 'otp_verified' | 'consents_done' | 'completed' | 'expired' | 'cancelled';

export type GuarantorSessionDto = {
  id: string;
  application_id: string;
  status: GuarantorSessionStatusDto;
  guarantor_name: string;
  phone_masked: string;
  relationship: string | null;
  consents_completed_at: string | null;
  kyc_status: string | null;
  expires_at: string;
  last_opened_at: string | null;
  /** Returned on create/resend only. */
  link?: string;
  created_at: string;
};

export type GuarantorSessionPublicDto = {
  status: GuarantorSessionStatusDto;
  guarantor_first_name: string;
  applicant_first_name: string | null;
  dealer_name: string | null;
  vehicle: { make: string; model: string; model_year: number | null } | null;
  consent_codes: ConsentCodeDto[];
  consent_locale: 'en' | 'ar';
  expires_at: string;
  kyc_url: string | null;
};

export type TakafulProviderDto = {
  id: string;
  code: string;
  name: string;
  name_ar: string | null;
  comprehensive_rate_pct: number;
  third_party_annual: number | null;
  min_contribution: number | null;
  riders: Array<{ code: string; label: string; label_ar?: string | null; annual_amount: number }>;
  contact_phone: string | null;
  contact_email: string | null;
  website: string | null;
  active: boolean;
  sort_order: number;
};

export type TakafulQuoteDto = {
  provider: TakafulProviderDto;
  coverage_type: 'comprehensive' | 'third_party';
  annual_contribution: number;
  monthly_equivalent: number;
};

export type DataRightsRequestKindDto = 'access' | 'correction' | 'deletion' | 'consent_withdrawal';
export type DataRightsRequestStatusDto = 'open' | 'in_progress' | 'completed' | 'rejected';

export type DataRightsRequestDto = {
  id: string;
  kind: DataRightsRequestKindDto;
  status: DataRightsRequestStatusDto;
  details: string | null;
  consent_code: ConsentCodeDto | null;
  resolution_note: string | null;
  due_at: string | null;
  handled_at: string | null;
  handled_by_name?: string | null;
  customer?: { id: string; name: string | null; email: string } | null;
  created_at: string;
};

export type PartnerApplicationDto = {
  id: string;
  reference_no?: string | null;
  status: string;
  submitted_at: string | null;
  updated_at: string;
  company_name: string;
  branch_name: string | null;
  vehicle: { make: string; model: string; model_year: number; price: number | null };
  customer: { name: string | null; qid_masked: string | null; nationality: string | null; residency: 'qatari' | 'expat' | null };
  financing: { financed_amount: number | null; tenure_months: number | null; monthly: number | null; down_payment_pct: number | null };
  credit_assessment: CreditAssessmentDto | null;
  consents_completed_at: string | null;
  documents: Array<{ id: string; category: string; original_name: string | null; created_at: string }>;
};
