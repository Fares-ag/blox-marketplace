import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CompanyKind, User, UserRole } from '@prisma/client';
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { CurrentUser, Public, Roles } from '../auth/guards';
import { PaginationQueryDto, resolvePagination, toPaginatedResponse } from '../common/pagination.dto';
import { PrismaService } from '../prisma/prisma.service';
import { toAdminCompanyDto, toDealerCompanyDto } from './company-response.dto';
import { assertValidCompanyHierarchy, resolveDescendantCompanyIds } from './company-hierarchy';

class CreateCompanyDto {
  @IsString() name!: string;
  @IsOptional() @IsString() code?: string;
  @IsOptional() @IsString() contactEmail?: string;
  @IsOptional() @IsString() dealerUserId?: string;
  @IsOptional() @IsEnum(CompanyKind) kind?: CompanyKind;
  @IsOptional() @IsString() parentCompanyId?: string;
}

class UpdateCompanyDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() code?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() status?: 'active' | 'inactive';
  @IsOptional() @IsBoolean() allowDirectActivate?: boolean;
  @IsOptional() @IsBoolean() canPay?: boolean;
  @IsOptional() @IsEnum(CompanyKind) kind?: CompanyKind;
  @IsOptional() @IsString() parentCompanyId?: string | null;
}

@Controller('companies')
export class CompaniesController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  async listPublic(@Query() query: PaginationQueryDto) {
    const { limit, offset } = resolvePagination(query, { defaultLimit: 50, maxLimit: 100 });
    const where = { status: 'active' as const, kind: CompanyKind.dealership };
    const [rows, total] = await Promise.all([
      this.prisma.company.findMany({
        where,
        select: {
          id: true,
          name: true,
          code: true,
          logoUrl: true,
          _count: {
            select: {
              products: { where: { listingStatus: 'published' } },
            },
          },
        },
        orderBy: { name: 'asc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.company.count({ where }),
    ]);
    return toPaginatedResponse(
      rows.map((c) => ({
        id: c.id,
        name: c.name,
        code: c.code,
        logo_url: c.logoUrl,
        published_count: c._count.products,
      })),
      total,
      limit,
      offset,
    );
  }

  @Public()
  @Get('by-code/:code')
  async byCode(@Param('code') code: string) {
    const company = await this.prisma.company.findFirst({
      where: { code, status: 'active' },
      select: {
        id: true,
        name: true,
        code: true,
        logoUrl: true,
        address: true,
        contactPhone: true,
        _count: {
          select: {
            products: { where: { listingStatus: 'published' } },
          },
        },
      },
    });
    if (!company) return null;
    return {
      id: company.id,
      name: company.name,
      code: company.code,
      logo_url: company.logoUrl,
      address: company.address,
      contact_phone: company.contactPhone,
      published_count: company._count.products,
    };
  }

  @Roles(UserRole.admin, UserRole.super_admin, UserRole.group_admin)
  @Get('all')
  async listAll(@CurrentUser() user: User, @Query() query: PaginationQueryDto) {
    const { limit, offset } = resolvePagination(query, { defaultLimit: 50, maxLimit: 100 });
    const scopeIds =
      user.role === UserRole.group_admin && user.companyId
        ? await resolveDescendantCompanyIds(this.prisma, user.companyId)
        : null;
    const where = scopeIds ? { id: { in: scopeIds } } : {};
    const [items, total] = await Promise.all([
      this.prisma.company.findMany({
        where,
        include: {
          parentCompany: { select: { id: true, name: true } },
          _count: { select: { childCompanies: true } },
        },
        orderBy: [{ kind: 'asc' }, { name: 'asc' }],
        take: limit,
        skip: offset,
      }),
      this.prisma.company.count({ where }),
    ]);
    return toPaginatedResponse(items.map((item) => toAdminCompanyDto(item)), total, limit, offset);
  }

  @Roles(UserRole.admin, UserRole.super_admin, UserRole.group_admin)
  @Post()
  async create(@CurrentUser() user: User, @Body() dto: CreateCompanyDto) {
    const kind = dto.kind ?? CompanyKind.dealership;
    let parentCompanyId = dto.parentCompanyId ?? null;
    if (user.role === UserRole.group_admin) {
      if (kind === CompanyKind.holding) throw new ForbiddenException('forbidden_role');
      if (!user.companyId) throw new ForbiddenException('forbidden_role');
      parentCompanyId = user.companyId;
    }
    await assertValidCompanyHierarchy(this.prisma, { kind, parentCompanyId });
    const company = await this.prisma.company.create({
      data: {
        name: dto.name,
        code: dto.code,
        contactEmail: dto.contactEmail,
        status: 'active',
        kind,
        parentCompanyId,
      },
      include: {
        parentCompany: { select: { id: true, name: true } },
        _count: { select: { childCompanies: true } },
      },
    });
    if (dto.dealerUserId) {
      await this.prisma.user.update({
        where: { id: dto.dealerUserId },
        data: { role: UserRole.dealer_agent, companyId: company.id },
      });
    }
    return toAdminCompanyDto(company);
  }

  @Roles(UserRole.admin, UserRole.super_admin, UserRole.group_admin)
  @Patch(':id')
  async update(@CurrentUser() user: User, @Param('id') id: string, @Body() dto: UpdateCompanyDto) {
    const existing = await this.prisma.company.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException();
    if (user.role === UserRole.group_admin) {
      if (!user.companyId) throw new ForbiddenException('forbidden_role');
      const allowed = await resolveDescendantCompanyIds(this.prisma, user.companyId);
      if (!allowed.includes(id) || id === user.companyId) {
        throw new ForbiddenException('forbidden_role');
      }
    }
    const nextKind = dto.kind ?? existing.kind;
    const nextParent =
      dto.parentCompanyId === undefined ? existing.parentCompanyId : dto.parentCompanyId;
    await assertValidCompanyHierarchy(this.prisma, {
      kind: nextKind,
      parentCompanyId: nextParent,
    });
    if (nextParent === id) throw new BadRequestException('company_cannot_parent_self');
    const company = await this.prisma.company.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.code !== undefined ? { code: dto.code } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.kind !== undefined ? { kind: dto.kind } : {}),
        ...(dto.parentCompanyId !== undefined ? { parentCompanyId: dto.parentCompanyId } : {}),
        ...(dto.allowDirectActivate !== undefined
          ? { allowDirectActivate: dto.allowDirectActivate }
          : {}),
        ...(dto.canPay !== undefined ? { canPay: dto.canPay } : {}),
      },
      include: {
        parentCompany: { select: { id: true, name: true } },
        _count: { select: { childCompanies: true } },
      },
    });
    return toAdminCompanyDto(company);
  }

  @Roles(UserRole.admin, UserRole.super_admin, UserRole.group_admin)
  @Get(':id/children')
  async children(@CurrentUser() user: User, @Param('id') id: string) {
    if (user.role === UserRole.group_admin) {
      if (user.companyId !== id) throw new ForbiddenException('forbidden_role');
    }
    const items = await this.prisma.company.findMany({
      where: { parentCompanyId: id },
      include: {
        parentCompany: { select: { id: true, name: true } },
        _count: { select: { childCompanies: true } },
      },
      orderBy: { name: 'asc' },
    });
    return { items: items.map((item) => toAdminCompanyDto(item)) };
  }

  @Roles(UserRole.admin, UserRole.super_admin, UserRole.dealer_agent, UserRole.group_admin)
  @Get(':id/agents')
  async agents(@CurrentUser() user: User, @Param('id') id: string) {
    if (user.role === UserRole.dealer_agent && user.companyId !== id) {
      return { items: [] };
    }
    if (user.role === UserRole.group_admin) {
      const allowed = user.companyId
        ? await resolveDescendantCompanyIds(this.prisma, user.companyId)
        : [];
      if (!allowed.includes(id)) return { items: [] };
    }
    const agents = await this.prisma.user.findMany({
      where: { companyId: id, role: UserRole.dealer_agent, isActive: true },
      select: { id: true, name: true, email: true, role: true },
      orderBy: { name: 'asc' },
    });
    return { items: agents };
  }

  @Roles(UserRole.dealer_agent)
  @Get('mine')
  async mine(@CurrentUser() user: User) {
    if (!user.companyId) return null;
    const company = await this.prisma.company.findUnique({ where: { id: user.companyId } });
    return company ? toDealerCompanyDto(company) : null;
  }
}
