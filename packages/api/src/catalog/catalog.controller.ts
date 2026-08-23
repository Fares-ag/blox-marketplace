import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { IsArray, IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator';
import { Roles } from '../auth/guards';
import { PaginationQueryDto } from '../common/pagination.dto';
import { CatalogService } from './catalog.service';

class PromotionDto {
  @IsString() name!: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsNumber() discountPercentage?: number;
  @IsOptional() @IsNumber() discountAmount?: number;
  @IsOptional() @IsString() startDate?: string;
  @IsOptional() @IsString() endDate?: string;
  @IsOptional() @IsString() status?: string;
}

class InsuranceDto {
  @IsString() name!: string;
  @IsOptional() @IsString() description?: string;
  @IsNumber() annualRate!: number;
  @IsNumber() annualRateProvider!: number;
  @IsOptional() @IsString() coverageType?: string;
  @IsOptional() @IsNumber() minVehicleValue?: number;
  @IsOptional() @IsNumber() maxVehicleValue?: number;
  @IsOptional() @IsNumber() minTenure?: number;
  @IsOptional() @IsNumber() maxTenure?: number;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsBoolean() isDefault?: boolean;
}

class PackageDto {
  @IsString() name!: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsArray() items?: unknown[];
  @IsNumber() price!: number;
  @IsOptional() @IsString() status?: string;
}

@Controller('ops')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Roles(UserRole.admin, UserRole.super_admin)
  @Get('promotions')
  listPromotions(@Query() query: PaginationQueryDto) {
    return this.catalog.listPromotions(query);
  }

  @Roles(UserRole.admin, UserRole.super_admin)
  @Get('promotions/:id')
  getPromotion(@Param('id') id: string) {
    return this.catalog.getPromotion(id);
  }

  @Roles(UserRole.admin, UserRole.super_admin)
  @Post('promotions')
  createPromotion(@Body() dto: PromotionDto) {
    return this.catalog.createPromotion({
      name: dto.name,
      description: dto.description,
      discountPercentage: dto.discountPercentage,
      discountAmount: dto.discountAmount,
      startDate: dto.startDate ? new Date(dto.startDate) : undefined,
      endDate: dto.endDate ? new Date(dto.endDate) : undefined,
      status: dto.status ?? 'active',
    });
  }

  @Roles(UserRole.admin, UserRole.super_admin)
  @Patch('promotions/:id')
  updatePromotion(@Param('id') id: string, @Body() dto: Partial<PromotionDto>) {
    return this.catalog.updatePromotion(id, {
      name: dto.name,
      description: dto.description,
      discountPercentage: dto.discountPercentage,
      discountAmount: dto.discountAmount,
      startDate: dto.startDate ? new Date(dto.startDate) : undefined,
      endDate: dto.endDate ? new Date(dto.endDate) : undefined,
      status: dto.status,
    });
  }

  @Roles(UserRole.admin, UserRole.super_admin)
  @Delete('promotions/:id')
  deletePromotion(@Param('id') id: string) {
    return this.catalog.deletePromotion(id);
  }

  @Roles(UserRole.admin, UserRole.super_admin)
  @Get('insurance-rates')
  listInsurance(@Query() query: PaginationQueryDto) {
    return this.catalog.listInsurance(query);
  }

  @Roles(UserRole.admin, UserRole.super_admin)
  @Get('insurance-rates/:id')
  getInsurance(@Param('id') id: string) {
    return this.catalog.getInsurance(id);
  }

  @Roles(UserRole.admin, UserRole.super_admin)
  @Post('insurance-rates')
  createInsurance(@Body() dto: InsuranceDto) {
    return this.catalog.createInsurance({
      name: dto.name,
      description: dto.description,
      annualRate: dto.annualRate,
      annualRateProvider: dto.annualRateProvider,
      coverageType: dto.coverageType,
      minVehicleValue: dto.minVehicleValue,
      maxVehicleValue: dto.maxVehicleValue,
      minTenure: dto.minTenure,
      maxTenure: dto.maxTenure,
      status: dto.status ?? 'active',
      isDefault: dto.isDefault ?? false,
    });
  }

  @Roles(UserRole.admin, UserRole.super_admin)
  @Patch('insurance-rates/:id')
  updateInsurance(@Param('id') id: string, @Body() dto: Partial<InsuranceDto>) {
    return this.catalog.updateInsurance(id, {
      name: dto.name,
      description: dto.description,
      annualRate: dto.annualRate,
      annualRateProvider: dto.annualRateProvider,
      coverageType: dto.coverageType,
      minVehicleValue: dto.minVehicleValue,
      maxVehicleValue: dto.maxVehicleValue,
      minTenure: dto.minTenure,
      maxTenure: dto.maxTenure,
      status: dto.status,
      isDefault: dto.isDefault,
    });
  }

  @Roles(UserRole.admin, UserRole.super_admin)
  @Delete('insurance-rates/:id')
  deleteInsurance(@Param('id') id: string) {
    return this.catalog.deleteInsurance(id);
  }

  @Roles(UserRole.admin, UserRole.super_admin)
  @Get('packages')
  listPackages(@Query() query: PaginationQueryDto) {
    return this.catalog.listPackages(query);
  }

  @Roles(UserRole.admin, UserRole.super_admin)
  @Get('packages/:id')
  getPackage(@Param('id') id: string) {
    return this.catalog.getPackage(id);
  }

  @Roles(UserRole.admin, UserRole.super_admin)
  @Post('packages')
  createPackage(@Body() dto: PackageDto) {
    return this.catalog.createPackage({
      name: dto.name,
      description: dto.description,
      items: (dto.items ?? []) as object[],
      price: dto.price,
      status: dto.status ?? 'active',
    });
  }

  @Roles(UserRole.admin, UserRole.super_admin)
  @Patch('packages/:id')
  updatePackage(@Param('id') id: string, @Body() dto: Partial<PackageDto>) {
    return this.catalog.updatePackage(id, {
      name: dto.name,
      description: dto.description,
      items: dto.items as object[] | undefined,
      price: dto.price,
      status: dto.status,
    });
  }

  @Roles(UserRole.admin, UserRole.super_admin)
  @Delete('packages/:id')
  deletePackage(@Param('id') id: string) {
    return this.catalog.deletePackage(id);
  }

  @Roles(UserRole.admin, UserRole.super_admin)
  @Get('settings/settlement-discounts')
  getSettings() {
    return this.catalog.getSettings();
  }

  @Roles(UserRole.admin, UserRole.super_admin)
  @Patch('settings/settlement-discounts')
  patchSettings(@Body() body: Record<string, unknown>) {
    return this.catalog.patchSettings(body);
  }
}
