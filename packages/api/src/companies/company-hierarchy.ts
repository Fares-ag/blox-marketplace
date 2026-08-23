import { BadRequestException } from '@nestjs/common';
import { CompanyKind } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';

type CompanyClient = Pick<PrismaService, 'company'>;

export async function resolveDescendantCompanyIds(
  prisma: CompanyClient,
  companyId: string,
): Promise<string[]> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true, kind: true },
  });
  if (!company) return [companyId];
  if (company.kind !== CompanyKind.holding) return [company.id];
  const children = await prisma.company.findMany({
    where: { parentCompanyId: companyId },
    select: { id: true },
  });
  return [company.id, ...children.map((c) => c.id)];
}

export async function expandCompanyIds(
  prisma: CompanyClient,
  ids: string[],
): Promise<string[]> {
  if (!ids.length) return [];
  const companies = await prisma.company.findMany({
    where: { id: { in: ids } },
    select: { id: true, kind: true },
  });
  const holdingIds = companies.filter((c) => c.kind === CompanyKind.holding).map((c) => c.id);
  const children = holdingIds.length
    ? await prisma.company.findMany({
        where: { parentCompanyId: { in: holdingIds } },
        select: { id: true },
      })
    : [];
  return [...new Set([...ids, ...children.map((c) => c.id)])];
}

export async function assertValidCompanyHierarchy(
  prisma: CompanyClient,
  opts: { kind?: CompanyKind | string; parentCompanyId?: string | null },
) {
  const kind = (opts.kind ?? CompanyKind.dealership) as CompanyKind;
  if (kind === CompanyKind.holding && opts.parentCompanyId) {
    throw new BadRequestException('holding_cannot_have_parent');
  }
  if (!opts.parentCompanyId) return;
  if (kind !== CompanyKind.dealership) {
    throw new BadRequestException('only_dealership_can_have_parent');
  }
  const parent = await prisma.company.findUnique({
    where: { id: opts.parentCompanyId },
    select: { id: true, kind: true },
  });
  if (!parent) throw new BadRequestException('parent_company_not_found');
  if (parent.kind !== CompanyKind.holding) {
    throw new BadRequestException('parent_must_be_holding');
  }
}

export async function assertDealershipCompany(
  prisma: CompanyClient,
  companyId: string,
) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true, kind: true },
  });
  if (!company) throw new BadRequestException('company_not_found');
  if (company.kind === CompanyKind.holding) {
    throw new BadRequestException('holding_cannot_have_products');
  }
  return company;
}
