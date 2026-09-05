import type { ApplicationStatus, PublicOffer } from '../types/domain';

export type OpsAudience = 'admin' | 'dealer' | 'credit' | 'finance' | 'super_admin';

export type OpsAgent = { id: string; name: string | null; email: string };

export type OpsQueueItem = {
  id: string;
  status: ApplicationStatus;
  created_at: string;
  submitted_at?: string | null;
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
  documents?: Array<{ id: string; category: string; mime_type?: string | null }>;
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
