import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CompanyKind, Prisma, User, UserRole } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { CurrentUser, Public, Roles } from '../auth/guards';
import { ActivityService } from '../common/activity.service';
import { PaginationQueryDto, resolvePagination, toPaginatedResponse } from '../common/pagination.dto';
import { isUniqueConstraintError } from '../common/prisma-errors';
import { PrismaService } from '../prisma/prisma.service';
import { BRANCH_INCLUDE, toBranchDto, toBranchRefDto } from './branch-response.dto';
import { mergeBranding } from './branding';
import {
  toAdminCompanyDto,
  toDealerCompanyDto,
  toPublicCompanyDetailDto,
} from './company-response.dto';
import { assertValidCompanyHierarchy, resolveDescendantCompanyIds } from './company-hierarchy';

class CreateCompanyDto {
  @IsString() name!: string;
  @IsOptional() @IsString() code?: string;
  @IsOptional() @IsString() contactEmail?: string;
  @IsOptional() @IsString() dealerUserId?: string;
  @IsOptional() @IsEnum(CompanyKind) kind?: CompanyKind;
  @IsOptional() @IsString() parentCompanyId?: string;
}

/** White-label block (`CompanyBrandingDto`): null or '' clears a field. */
class CompanyBrandingDto {
  @IsOptional() @IsString() @MaxLength(16) primary?: string | null;
  @IsOptional() @IsString() @MaxLength(16) accent?: string | null;
  @IsOptional() @IsString() @MaxLength(2048) logo_url?: string | null;
  @IsOptional() @IsString() @MaxLength(80) display_name?: string | null;
  @IsOptional() @IsString() @MaxLength(160) tagline?: string | null;
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
  @IsOptional() @ValidateNested() @Type(() => CompanyBrandingDto) branding?: CompanyBrandingDto;
}

class CreateBranchDto {
  @IsString() @IsNotEmpty() @MaxLength(32) code!: string;
  @IsString() @IsNotEmpty() @MaxLength(120) name!: string;
  @IsOptional() @IsString() @MaxLength(80) city?: string;
  @IsOptional() @IsString() @MaxLength(240) address?: string;
  @IsOptional() @IsString() @MaxLength(32) phone?: string;
}

class UpdateBranchDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(120) name?: string;
  @IsOptional() @IsString() @MaxLength(80) city?: string | null;
  @IsOptional() @IsString() @MaxLength(240) address?: string | null;
  @IsOptional() @IsString() @MaxLength(32) phone?: string | null;
  @IsOptional() @IsBoolean() active?: boolean;
}

function optionalText(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

@Controller('companies')
export class CompaniesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
  ) {}

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

  /** White-label entry point (`/dealers/:code/apply`): includes `branding` + `logo_url`. */
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
        branding: true,
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
    return toPublicCompanyDetailDto({
      ...company,
      published_count: company._count.products,
    });
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

    // Hex colours are validated inside mergeBranding (400 invalid_hex_colour).
    const branding = dto.branding !== undefined ? mergeBranding(existing.branding, dto.branding) : undefined;

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
        ...(branding !== undefined
          ? { branding: branding ? (branding as Prisma.InputJsonObject) : Prisma.DbNull }
          : {}),
      },
      include: {
        parentCompany: { select: { id: true, name: true } },
        _count: { select: { childCompanies: true } },
      },
    });
    if (branding !== undefined) {
      await this.activity.log({
        actorUserId: user.id,
        entityType: 'company',
        entityId: id,
        action: 'company_branding_updated',
        metadata: { branding },
      });
    }
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
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        homeBranch: { select: { id: true, code: true, name: true } },
      },
      orderBy: { name: 'asc' },
    });
    return {
      items: agents.map(({ homeBranch, ...agent }) => ({
        ...agent,
        home_branch: toBranchRefDto(homeBranch),
      })),
    };
  }

  // ---------------------------------------------------------------------
  // Branches (LOS FSD dealer branch master). Admin/super_admin manage every
  // company, group_admin their tree, dealer agents read their own company.
  // ---------------------------------------------------------------------

  @Roles(UserRole.admin, UserRole.super_admin, UserRole.group_admin, UserRole.dealer_agent)
  @Get(':id/branches')
  async branches(@CurrentUser() user: User, @Param('id') id: string) {
    await this.assertBranchScope(user, id);
    const rows = await this.prisma.branch.findMany({
      where: { companyId: id },
      include: BRANCH_INCLUDE,
      orderBy: [{ active: 'desc' }, { name: 'asc' }],
    });
    return rows.map((row) => toBranchDto(row));
  }

  @Roles(UserRole.admin, UserRole.super_admin, UserRole.group_admin)
  @Post(':id/branches')
  async createBranch(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: CreateBranchDto,
  ) {
    await this.assertBranchScope(user, id);
    const code = dto.code.trim();
    let branch;
    try {
      branch = await this.prisma.branch.create({
        data: {
          companyId: id,
          code,
          name: dto.name.trim(),
          city: optionalText(dto.city),
          address: optionalText(dto.address),
          phone: optionalText(dto.phone),
        },
        include: BRANCH_INCLUDE,
      });
    } catch (err) {
      if (isUniqueConstraintError(err)) throw new ConflictException('branch_code_exists');
      throw err;
    }
    await this.activity.log({
      actorUserId: user.id,
      entityType: 'branch',
      entityId: branch.id,
      action: 'branch_created',
      toValue: branch.code,
      metadata: { company_id: id, name: branch.name },
    });
    return toBranchDto(branch);
  }

  @Roles(UserRole.admin, UserRole.super_admin, UserRole.group_admin)
  @Patch(':id/branches/:branchId')
  async updateBranch(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Param('branchId') branchId: string,
    @Body() dto: UpdateBranchDto,
  ) {
    await this.assertBranchScope(user, id);
    const existing = await this.prisma.branch.findFirst({ where: { id: branchId, companyId: id } });
    if (!existing) throw new NotFoundException('branch_not_found');

    const changes = {
      ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
      ...(dto.city !== undefined ? { city: optionalText(dto.city) } : {}),
      ...(dto.address !== undefined ? { address: optionalText(dto.address) } : {}),
      ...(dto.phone !== undefined ? { phone: optionalText(dto.phone) } : {}),
      ...(dto.active !== undefined ? { active: dto.active } : {}),
    };
    const branch = await this.prisma.branch.update({
      where: { id: existing.id },
      data: changes,
      include: BRANCH_INCLUDE,
    });
    await this.activity.log({
      actorUserId: user.id,
      entityType: 'branch',
      entityId: branch.id,
      action: 'branch_updated',
      fromValue: existing.active ? 'active' : 'inactive',
      toValue: branch.active ? 'active' : 'inactive',
      metadata: { company_id: id, changes },
    });
    return toBranchDto(branch);
  }

  @Roles(UserRole.dealer_agent)
  @Get('mine')
  async mine(@CurrentUser() user: User) {
    if (!user.companyId) return null;
    const company = await this.prisma.company.findUnique({ where: { id: user.companyId } });
    return company ? toDealerCompanyDto(company) : null;
  }

  /** Same hierarchy rules as the company endpoints; dealer agents see only their own company. */
  private async assertBranchScope(user: User, companyId: string): Promise<void> {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true },
    });
    if (!company) throw new NotFoundException('company_not_found');
    if (user.role === UserRole.dealer_agent) {
      if (user.companyId !== companyId) throw new ForbiddenException('forbidden_role');
      return;
    }
    if (user.role === UserRole.group_admin) {
      const allowed = user.companyId
        ? await resolveDescendantCompanyIds(this.prisma, user.companyId)
        : [];
      if (!allowed.includes(companyId)) throw new ForbiddenException('out_of_scope');
    }
  }
}
