import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { User, UserRole } from '@prisma/client';
import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { CurrentUser, Public, Roles } from '../auth/guards';
import { PrismaService } from '../prisma/prisma.service';

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
  listPublic() {
    return this.prisma.company.findMany({
      where: { status: 'active' },
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
    }).then((rows) =>
      rows.map((c) => ({
        id: c.id,
        name: c.name,
        code: c.code,
        logo_url: c.logoUrl,
        published_count: c._count.products,
      })),
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
  listAll() {
    return this.prisma.company.findMany({ orderBy: { createdAt: 'desc' } });
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
    return company;
  }

  @Roles(UserRole.admin, UserRole.super_admin)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCompanyDto) {
    return this.prisma.company.update({
      where: { id },
      data: {
        ...(dto.allowDirectActivate !== undefined
          ? { allowDirectActivate: dto.allowDirectActivate }
          : {}),
        ...(dto.canPay !== undefined ? { canPay: dto.canPay } : {}),
      },
    });
  }

  @Roles(UserRole.dealer_agent)
  @Get('mine')
  mine(@CurrentUser() user: User) {
    if (!user.companyId) return null;
    return this.prisma.company.findUnique({ where: { id: user.companyId } });
  }
}
