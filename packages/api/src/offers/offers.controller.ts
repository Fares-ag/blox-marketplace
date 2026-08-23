import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { OfferStatus, UserRole } from '@prisma/client';
import { IsArray, IsBoolean, IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';
import { Public, Roles } from '../auth/guards';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationQueryDto, resolvePagination, toPaginatedResponse } from '../common/pagination.dto';
import { toPublicOfferDto } from '../common/offer-response.dto';

class UpsertOfferDto {
  @IsString() name!: string;
  @IsNumber() annualRentRate!: number;
  @IsOptional() @IsNumber() profitRate?: number;
  @IsArray() @IsNumber({}, { each: true }) tenureOptions!: number[];
  @IsOptional() @IsNumber() minDownPaymentPct?: number;
  @IsOptional() @IsBoolean() isDefault?: boolean;
  @IsOptional() @IsEnum(OfferStatus) status?: OfferStatus;
  @IsOptional() @IsString() companyId?: string;
  @IsOptional() @IsString() financePartnerId?: string;
  @IsOptional() @IsString() insuranceRateId?: string;
}

function toStaffOfferDto(offer: {
  id: string;
  name: string;
  annualRentRate: Parameters<typeof toPublicOfferDto>[0]['annualRentRate'];
  profitRate: unknown;
  tenureOptions: Parameters<typeof toPublicOfferDto>[0]['tenureOptions'];
  minDownPaymentPct: Parameters<typeof toPublicOfferDto>[0]['minDownPaymentPct'];
  isDefault: boolean;
  status: string;
  companyId: string | null;
  financePartnerId: string | null;
}) {
  return {
    ...toPublicOfferDto(offer),
    profit_rate: offer.profitRate != null ? Number(offer.profitRate) : null,
    status: offer.status,
    company_id: offer.companyId,
  };
}

@Controller()
export class OffersController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Public storefront needs rate/tenure/down-payment to render estimates.
   * P1-7: internal margin (profitRate) and other internals stay server-side.
   */
  @Public()
  @Get('offers')
  async list(@Query() query: PaginationQueryDto) {
    const { limit, offset } = resolvePagination(query, { defaultLimit: 50, maxLimit: 100 });
    const where = { status: 'active' as const };
    const [items, total] = await Promise.all([
      this.prisma.offer.findMany({
        where,
        select: {
          id: true,
          name: true,
          annualRentRate: true,
          tenureOptions: true,
          minDownPaymentPct: true,
          isDefault: true,
          financePartnerId: true,
          financePartner: { select: { name: true, crmAdapter: true } },
        },
        orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
        take: limit,
        skip: offset,
      }),
      this.prisma.offer.count({ where }),
    ]);
    return toPaginatedResponse(items.map((item) => toPublicOfferDto(item)), total, limit, offset);
  }

  @Roles(UserRole.admin, UserRole.super_admin)
  @Get('ops/offers')
  async listOps(@Query() query: PaginationQueryDto) {
    const { limit, offset } = resolvePagination(query, { defaultLimit: 50, maxLimit: 100 });
    const [items, total] = await Promise.all([
      this.prisma.offer.findMany({
        orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
        take: limit,
        skip: offset,
      }),
      this.prisma.offer.count(),
    ]);
    return toPaginatedResponse(items.map((item) => toStaffOfferDto(item)), total, limit, offset);
  }

  @Roles(UserRole.admin, UserRole.super_admin, UserRole.dealer_agent, UserRole.credit_officer)
  @Get('ops/offers/:id')
  async one(@Param('id') id: string) {
    const offer = await this.prisma.offer.findUnique({ where: { id } });
    if (!offer) return null;
    return toStaffOfferDto(offer);
  }

  @Roles(UserRole.admin, UserRole.super_admin)
  @Post('ops/offers')
  async create(@Body() dto: UpsertOfferDto) {
    if (dto.isDefault) {
      await this.prisma.offer.updateMany({ data: { isDefault: false }, where: { isDefault: true } });
    }
    const offer = await this.prisma.offer.create({
      data: {
        name: dto.name,
        annualRentRate: dto.annualRentRate,
        profitRate: dto.profitRate,
        tenureOptions: dto.tenureOptions,
        minDownPaymentPct: dto.minDownPaymentPct ?? 0,
        isDefault: dto.isDefault ?? false,
        status: dto.status ?? 'active',
        companyId: dto.companyId,
        financePartnerId: dto.financePartnerId,
        insuranceRateId: dto.insuranceRateId,
      },
    });
    return toStaffOfferDto(offer);
  }

  @Roles(UserRole.admin, UserRole.super_admin)
  @Delete('ops/offers/:id')
  async remove(@Param('id') id: string) {
    await this.prisma.offer.delete({ where: { id } });
    return { ok: true };
  }

  @Roles(UserRole.admin, UserRole.super_admin)
  @Patch('ops/offers/:id')
  async update(@Param('id') id: string, @Body() dto: Partial<UpsertOfferDto>) {
    if (dto.isDefault) {
      await this.prisma.offer.updateMany({ data: { isDefault: false }, where: { isDefault: true } });
    }
    const offer = await this.prisma.offer.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.annualRentRate !== undefined ? { annualRentRate: dto.annualRentRate } : {}),
        ...(dto.profitRate !== undefined ? { profitRate: dto.profitRate } : {}),
        ...(dto.tenureOptions !== undefined ? { tenureOptions: dto.tenureOptions } : {}),
        ...(dto.minDownPaymentPct !== undefined ? { minDownPaymentPct: dto.minDownPaymentPct } : {}),
        ...(dto.isDefault !== undefined ? { isDefault: dto.isDefault } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.companyId !== undefined ? { companyId: dto.companyId } : {}),
        ...(dto.financePartnerId !== undefined ? { financePartnerId: dto.financePartnerId } : {}),
        ...(dto.insuranceRateId !== undefined ? { insuranceRateId: dto.insuranceRateId } : {}),
      },
    });
    return toStaffOfferDto(offer);
  }
}
