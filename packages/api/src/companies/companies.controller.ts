import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { User, UserRole } from '@prisma/client';
import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { CurrentUser, Public, Roles } from '../auth/guards';
import { PaginationQueryDto, resolvePagination, toPaginatedResponse } from '../common/pagination.dto';
import { PrismaService } from '../prisma/prisma.service';
import { toAdminCompanyDto, toDealerCompanyDto } from './company-response.dto';

class CreateCompanyDto {
  @IsString() name!: string;
  @IsOptional() @IsString() code?: string;
  @IsOptional() @IsString() contactEmail?: string;
  @IsOptional() @IsString() dealerUserId?: string;
}

class UpdateCompanyDto {
  @IsOptional() @IsBoolean() allowDirectActivate?: boolean;
  @IsOptional() @IsBoolean() canPay?: boolean;
}

@Controller('companies')
export class CompaniesController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  async listPublic(@Query() query: PaginationQueryDto) {
    const { limit, offset } = resolvePagination(query, { defaultLimit: 50, maxLimit: 100 });
    const where = { status: 'active' as const };
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

  @Roles(UserRole.admin, UserRole.super_admin)
  @Get('all')
  async listAll(@Query() query: PaginationQueryDto) {
    const { limit, offset } = resolvePagination(query, { defaultLimit: 50, maxLimit: 100 });
    const [items, total] = await Promise.all([
      this.prisma.company.findMany({ orderBy: { createdAt: 'desc' }, take: limit, skip: offset }),
      this.prisma.company.count(),
    ]);
    return toPaginatedResponse(items.map((item) => toAdminCompanyDto(item)), total, limit, offset);
  }

  @Roles(UserRole.admin, UserRole.super_admin)
  @Post()
  async create(@Body() dto: CreateCompanyDto) {
    const company = await this.prisma.company.create({
      data: {
        name: dto.name,
        code: dto.code,
        contactEmail: dto.contactEmail,
        status: 'active',
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

  @Roles(UserRole.admin, UserRole.super_admin)
  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateCompanyDto) {
    const company = await this.prisma.company.update({
      where: { id },
      data: {
        ...(dto.allowDirectActivate !== undefined
          ? { allowDirectActivate: dto.allowDirectActivate }
          : {}),
        ...(dto.canPay !== undefined ? { canPay: dto.canPay } : {}),
      },
    });
    return toAdminCompanyDto(company);
  }

  @Roles(UserRole.dealer_agent)
  @Get('mine')
  async mine(@CurrentUser() user: User) {
    if (!user.companyId) return null;
    const company = await this.prisma.company.findUnique({ where: { id: user.companyId } });
    return company ? toDealerCompanyDto(company) : null;
  }
}
