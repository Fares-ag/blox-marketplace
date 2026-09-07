/**
 * Local view types for the admin portal. Wire contracts come from `@drivemarket/shared`
 * (`BranchDto`, `FinancePartnerAdminDto`, `OriginationFunnelDto`, ...); this file only
 * adds the portal-side shapes (form state, table rows) built on top of them.
 */
import type {
  AdminCompany,
  AdminUser,
  BranchDto,
  CompanyBrandingDto,
  FinancePartnerAdminDto,
  FinancePartnerBranchDto,
  OriginationFunnelDto,
  OriginationFunnelGroupBy,
  OriginationFunnelRow,
} from '@drivemarket/shared';

export type {
  BranchDto,
  CompanyBrandingDto,
  FinancePartnerAdminDto,
  FinancePartnerBranchDto,
  OriginationFunnelDto,
  OriginationFunnelGroupBy,
  OriginationFunnelRow,
};

/** Company row from `GET /api/companies/all`; `branding` appears once the admin DTO carries it. */
export type CompanyRow = AdminCompany & { branding?: CompanyBrandingDto | null };

export type CompanyListResponse = { total: number; items: CompanyRow[] };

/** `home_branch` as returned on user DTOs (list, detail, dealer-agents). */
export type HomeBranchRef = { id: string; code: string; name: string };

export type UserRowWithBranch = AdminUser & { home_branch?: HomeBranchRef | null };

export type ProviderEngagementMode = FinancePartnerAdminDto['engagement_mode'];
export type ProviderBreOwnership = FinancePartnerAdminDto['bre_ownership'];

export type ProviderFormValues = {
  code: string;
  name: string;
  engagement_mode: ProviderEngagementMode;
  bre_ownership: ProviderBreOwnership;
  is_default_lender: boolean;
  active: boolean;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  notes: string;
};

export type ProviderBranchFormValues = { code: string; name: string; city: string };

export type BranchFormValues = { code: string; name: string; city: string; address: string; phone: string };

export type BrandingFormValues = {
  display_name: string;
  tagline: string;
  primary: string;
  accent: string;
  logo_url: string;
};

export type FunnelPeriodPreset = 'last7' | 'last30' | 'last90' | 'thisMonth' | 'custom';
