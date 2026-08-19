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
  items: ProductCard[];
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
