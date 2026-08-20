export type UserRole =
  | 'customer'
  | 'dealer_agent'
  | 'credit_officer'
  | 'finance_officer'
  | 'admin'
  | 'super_admin';

export type OfficerScope = 'all' | 'assigned';

export type CompanyStatus = 'active' | 'inactive';

export type ListingStatus = 'draft' | 'published' | 'reserved' | 'sold' | 'archived';

export type VehicleCondition = 'new' | 'used';

export type Transmission = 'automatic' | 'manual';

export type Drivetrain = 'fwd' | 'rwd' | 'awd' | 'four_wd';

export type BodyType = 'sedan' | 'suv' | 'coupe' | 'hatchback' | 'pickup' | 'van' | 'other';

export interface ProductCard {
  id: string;
  slug: string;
  make: string;
  model: string;
  trim: string | null;
  model_year: number;
  condition: VehicleCondition;
  transmission: Transmission | null;
  cylinders: number | null;
  drivetrain: Drivetrain | null;
  body_type: BodyType | null;
  color: string | null;
  mileage: number | null;
  description: string | null;
  price: number;
  finance_eligible: boolean;
  warranty_months: number | null;
  warranty_notes: string | null;
  company_id: string;
  company_name: string;
  company_code: string | null;
  company_logo: string | null;
  company_contact_phone?: string | null;
  primary_image: string | null;
  published_at: string | null;
  est_monthly: number | null;
  availability?: 'available' | 'pending_financing';
}

export interface ProductDetail extends ProductCard {
  engine: string | null;
  listing_status: ListingStatus;
  default_offer_id: string | null;
}

export interface ProductListResponse {
  total: number;
  limit: number;
  offset: number;
  items: ProductCard[];
}

export interface PaginatedResponse<T> {
  total: number;
  limit: number;
  offset: number;
  items: T[];
}

export interface PublicCompanyListResponse {
  total: number;
  limit: number;
  offset: number;
  items: PublicCompany[];
}

export interface ScheduleSummary {
  pending: number;
  overdue: number;
  paid: number;
}

export interface ScheduleListResponse<T = Record<string, unknown>> {
  total: number;
  limit: number;
  offset: number;
  summary: ScheduleSummary;
  items: T[];
}

export interface ProductDetailResponse {
  available: boolean;
  availability?: 'available' | 'pending_financing';
  reason?: string;
  product?: ProductDetail;
  images?: { id: string; storage_path: string; sort_order: number; alt_text: string | null }[];
  company?: { id: string; name: string; code: string | null; logo_url: string | null; contact_phone?: string | null };
  offer?: {
    id: string;
    name: string;
    annual_rent_rate: number;
    tenure_options: number[];
    min_down_payment_pct: number;
  } | null;
}

export interface PublicCompany {
  id: string;
  name: string;
  code: string | null;
  logo_url: string | null;
  published_count?: number;
  address?: string | null;
  contact_phone?: string | null;
}

export type ApplicationStatus =
  | 'draft'
  | 'under_review'
  | 'resubmission_required'
  | 'contract_signing_required'
  | 'contracts_submitted'
  | 'contract_under_review'
  | 'down_payment_required'
  | 'down_payment_submitted'
  | 'pending_finance_activation'
  | 'active'
  | 'completed'
  | 'rejected'
  | 'submission_cancelled';

/** Non-blocking statuses — customer may start a new application */
export const NON_BLOCKING_APPLICATION_STATUSES: ApplicationStatus[] = [
  'rejected',
  'submission_cancelled',
  'completed',
];

export interface DmUser {
  id: string;
  email: string;
  role: UserRole;
  company_id: string | null;
  credit_scope: OfficerScope;
  finance_scope: OfficerScope;
  full_name: string | null;
  phone: string | null;
  qid: string | null;
  is_active: boolean;
  email_verified: boolean;
  two_factor_enabled: boolean;
  mfa_required: boolean;
  mfa_setup_required: boolean;
}

export interface Company {
  id: string;
  name: string;
  code: string | null;
  status: CompanyStatus;
  can_pay: boolean;
  logo_url: string | null;
  branding: Record<string, unknown> | null;
  allow_direct_activate: boolean;
}

export interface PublicOffer {
  id: string;
  name: string;
  annual_rent_rate: number | null;
  tenure_options: unknown;
  min_down_payment_pct: number | null;
  finance_partner_id?: string | null;
  is_default?: boolean;
}

export interface ApplicationDocument {
  id: string;
  category: string;
  mime_type?: string | null;
  created_at: string;
}

export interface ApplicationPaymentSchedule {
  id: string;
  sequence: number;
  due_date: string;
  amount: number | null;
  paid_amount?: number | null;
  remaining_amount?: number | null;
  status: string;
  paid_at?: string | null;
}

export interface ApplicationListItem {
  id: string;
  status: ApplicationStatus;
  created_at: string;
  submitted_at?: string | null;
  activated_at?: string | null;
  contract_generated?: boolean;
  rejection_reason?: string | null;
  resubmission_comment?: string | null;
  pricing_snapshot?: Record<string, unknown> | null;
  product?: {
    make: string;
    model: string;
    model_year: number;
    slug: string;
    price?: number | null;
  };
}

export interface ApplicationDetail extends ApplicationListItem {
  customer_user_id?: string;
  customer_email?: string;
  customer_snapshot?: Record<string, unknown>;
  product_id?: string;
  company_id?: string;
  offer_id?: string;
  finance_partner_id?: string | null;
  installment_plan?: unknown;
  status_reason?: string | null;
  completed_at?: string | null;
  updated_at?: string;
  company?: { id: string; name: string };
  customer?: { name: string | null; email: string; phone?: string | null };
  offer?: PublicOffer;
  documents?: ApplicationDocument[];
  payment_schedules?: ApplicationPaymentSchedule[];
}

export interface ApplicationBlockingResponse {
  blocking: boolean;
  application_id: string | null;
}

export interface OpsApplicationQueueItem {
  id: string;
  status: ApplicationStatus;
  created_at: string;
  submitted_at?: string | null;
  product?: { make: string; model: string; model_year: number; slug: string };
  company?: { name: string };
  customer?: { name: string | null; email: string };
}

export interface NotificationItem {
  id: string;
  title: string;
  body: string | null;
  link_path: string | null;
  read_at: string | null;
  created_at: string;
}

export interface DealerInventoryItem {
  id: string;
  company_id: string;
  slug: string;
  make: string;
  model: string;
  trim: string | null;
  model_year: number;
  condition: string;
  engine: string | null;
  transmission: string | null;
  cylinders: number | null;
  drivetrain: string | null;
  body_type: string | null;
  warranty_months: number | null;
  warranty_notes: string | null;
  color: string | null;
  mileage: number | null;
  vin: string | null;
  description: string | null;
  price: number;
  finance_eligible: boolean;
  default_offer_id: string | null;
  listing_status: string;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  images: Array<{
    id: string;
    storage_path: string;
    sort_order: number;
    alt_text: string | null;
  }>;
}

export interface DealerQuoteItem {
  id: string;
  token: string;
  url: string;
  customer_email: string;
  negotiated_price: number | null;
  list_price_snapshot: number | null;
  expires_at: string;
  used_at?: string | null;
  revoked_at?: string | null;
  created_at?: string;
  status: string;
  product: { make: string; model: string; model_year: number; slug: string };
  created_by?: { name: string | null; email: string };
}

export interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  company_id: string | null;
  is_active: boolean;
  email_verified: boolean;
  created_at: string;
}

export interface AdminCompany {
  id: string;
  name: string;
  code: string | null;
  status: CompanyStatus;
  can_pay: boolean;
  allow_direct_activate: boolean;
  contact_email: string | null;
  contact_phone: string | null;
  logo_url: string | null;
  address: string | null;
  created_at: string;
  updated_at: string;
}

export interface FinancePartner {
  id: string;
  code: string;
  name: string;
  crm_adapter: string;
}
