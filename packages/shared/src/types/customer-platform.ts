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
};

export type ConsentStatusDto = {
  catalog_version: string;
  required: ConsentCodeDto[];
  accepted: ConsentRecordDto[];
  missing: ConsentCodeDto[];
  complete: boolean;
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
