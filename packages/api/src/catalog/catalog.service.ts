import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationQueryDto, resolvePagination, toPaginatedResponse } from '../common/pagination.dto';

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  listPromotions(query: PaginationQueryDto) {
    return this.paged(this.prisma.promotion, query);
  }
  getPromotion(id: string) {
    return this.one(this.prisma.promotion, id);
  }
  createPromotion(data: Prisma.PromotionCreateInput) {
    return this.prisma.promotion.create({ data });
  }
  updatePromotion(id: string, data: Prisma.PromotionUpdateInput) {
    return this.prisma.promotion.update({ where: { id }, data });
  }
  deletePromotion(id: string) {
    return this.prisma.promotion.delete({ where: { id } });
  }

  listInsurance(query: PaginationQueryDto) {
    return this.paged(this.prisma.insuranceRate, query);
  }
  getInsurance(id: string) {
    return this.one(this.prisma.insuranceRate, id);
  }
  createInsurance(data: Prisma.InsuranceRateCreateInput) {
    return this.prisma.insuranceRate.create({ data });
  }
  updateInsurance(id: string, data: Prisma.InsuranceRateUpdateInput) {
    return this.prisma.insuranceRate.update({ where: { id }, data });
  }
  deleteInsurance(id: string) {
    return this.prisma.insuranceRate.delete({ where: { id } });
  }

  listPackages(query: PaginationQueryDto) {
    return this.paged(this.prisma.package, query);
  }
  getPackage(id: string) {
    return this.one(this.prisma.package, id);
  }
  createPackage(data: Prisma.PackageCreateInput) {
    return this.prisma.package.create({ data });
  }
  updatePackage(id: string, data: Prisma.PackageUpdateInput) {
    return this.prisma.package.update({ where: { id }, data });
  }
  deletePackage(id: string) {
    return this.prisma.package.delete({ where: { id } });
  }

  async getSettings() {
    const existing = await this.prisma.settlementDiscountSettings.findFirst({
      orderBy: { priority: 'desc' },
    });
    if (existing) return existing;
    return this.prisma.settlementDiscountSettings.create({
      data: { name: 'Default Settlement Discount Settings' },
    });
  }

  async patchSettings(data: Prisma.SettlementDiscountSettingsUpdateInput) {
    const current = await this.getSettings();
    return this.prisma.settlementDiscountSettings.update({ where: { id: current.id }, data });
  }

  private async paged(
    model: { findMany: Function; count: Function },
    query: PaginationQueryDto,
  ) {
    const { limit, offset } = resolvePagination(query, { defaultLimit: 50, maxLimit: 100 });
    const [items, total] = await Promise.all([
      model.findMany({ orderBy: { createdAt: 'desc' }, take: limit, skip: offset }),
      model.count(),
    ]);
    return toPaginatedResponse(items, total, limit, offset);
  }

  private async one(model: { findUnique: Function }, id: string) {
    const row = await model.findUnique({ where: { id } });
    if (!row) throw new NotFoundException();
    return row;
  }
}
