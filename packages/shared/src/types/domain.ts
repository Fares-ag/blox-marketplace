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
