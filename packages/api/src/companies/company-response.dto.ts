import type { Company } from '@prisma/client';

export function toAdminCompanyDto(
  company: Company & {
    parentCompany?: { id: string; name: string } | null;
    _count?: { childCompanies?: number };
  },
) {
  return {
    id: company.id,
    name: company.name,
    code: company.code,
    status: company.status,
    kind: company.kind,
    parent_company_id: company.parentCompanyId,
    parent_name: company.parentCompany?.name ?? null,
    child_count: company._count?.childCompanies ?? 0,
    can_pay: company.canPay,
    allow_direct_activate: company.allowDirectActivate,
    contact_email: company.contactEmail,
    contact_phone: company.contactPhone,
    logo_url: company.logoUrl,
    address: company.address,
    created_at: company.createdAt,
    updated_at: company.updatedAt,
  };
}

export function toDealerCompanyDto(company: Company) {
  return {
    id: company.id,
    name: company.name,
    code: company.code,
    status: company.status,
    kind: company.kind,
    parent_company_id: company.parentCompanyId,
    logo_url: company.logoUrl,
    branding: company.branding,
    contact_email: company.contactEmail,
    contact_phone: company.contactPhone,
    address: company.address,
    allow_direct_activate: company.allowDirectActivate,
    can_pay: company.canPay,
  };
}

export function toPublicCompanyListItemDto(company: {
  id: string;
  name: string;
  code: string | null;
  logoUrl: string | null;
  published_count: number;
}) {
  return {
    id: company.id,
    name: company.name,
    code: company.code,
    logo_url: company.logoUrl,
    published_count: company.published_count,
  };
}

export function toPublicCompanyDetailDto(company: {
  id: string;
  name: string;
  code: string | null;
  logoUrl: string | null;
  address: string | null;
  contactPhone: string | null;
  published_count: number;
}) {
  return {
    id: company.id,
    name: company.name,
    code: company.code,
    logo_url: company.logoUrl,
    address: company.address,
    contact_phone: company.contactPhone,
    published_count: company.published_count,
  };
}
