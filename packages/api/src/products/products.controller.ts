import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  BodyType,
  Drivetrain,
  Transmission,
  User,
  UserRole,
  VehicleCondition,
} from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { CurrentUser, OptionalSessionGuard, Public, Roles } from '../auth/guards';
import { multerUploadOptions } from '../common/multer-options';
import { ProductsService } from './products.service';

class CreateProductDto {
  @IsString() make!: string;
  @IsString() model!: string;
  @IsOptional() @IsString() trim?: string;
  @IsInt() modelYear!: number;
  @IsOptional() @IsEnum(VehicleCondition) condition?: VehicleCondition;
  @IsOptional() @IsString() engine?: string;
  @IsOptional() @IsEnum(Transmission) transmission?: Transmission;
  @IsOptional() @IsInt() cylinders?: number;
  @IsOptional() @IsEnum(Drivetrain) drivetrain?: Drivetrain;
  @IsOptional() @IsEnum(BodyType) bodyType?: BodyType;
  @IsOptional() @IsInt() warrantyMonths?: number;
  @IsOptional() @IsString() warrantyNotes?: string;
  @IsOptional() @IsString() color?: string;
  @IsOptional() @IsInt() mileage?: number;
  @IsOptional() @IsString() vin?: string;
  @IsOptional() @IsString() description?: string;
  @IsNumber() @Min(1) price!: number;
  @IsOptional() @IsBoolean() financeEligible?: boolean;
  @IsOptional() @IsString() defaultOfferId?: string;
}

class UpdateProductDto {
  @IsOptional() @IsString() make?: string;
  @IsOptional() @IsString() model?: string;
  @IsOptional() @IsString() trim?: string;
  @IsOptional() @IsInt() modelYear?: number;
  @IsOptional() @IsEnum(VehicleCondition) condition?: VehicleCondition;
  @IsOptional() @IsString() engine?: string;
  @IsOptional() @IsEnum(Transmission) transmission?: Transmission;
  @IsOptional() @IsInt() cylinders?: number;
  @IsOptional() @IsEnum(Drivetrain) drivetrain?: Drivetrain;
  @IsOptional() @IsEnum(BodyType) bodyType?: BodyType;
  @IsOptional() @IsInt() warrantyMonths?: number;
  @IsOptional() @IsString() warrantyNotes?: string;
  @IsOptional() @IsString() color?: string;
  @IsOptional() @IsInt() mileage?: number;
  @IsOptional() @IsString() vin?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsNumber() @Min(1) price?: number;
  @IsOptional() @IsBoolean() financeEligible?: boolean;
  @IsOptional() @IsString() defaultOfferId?: string;
}

@Controller()
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Public()
  @Get('products')
  list(
    @Query('make') make?: string,
    @Query('model') model?: string,
    @Query('yearMin') yearMin?: number,
    @Query('yearMax') yearMax?: number,
    @Query('priceMin') priceMin?: number,
    @Query('priceMax') priceMax?: number,
    @Query('condition') condition?: VehicleCondition,
    @Query('companyId') companyId?: string,
    @Query('transmission') transmission?: Transmission,
    @Query('drivetrain') drivetrain?: Drivetrain,
    @Query('bodyType') bodyType?: BodyType,
    @Query('cylinders') cylinders?: number,
    @Query('mileageMax') mileageMax?: number,
    @Query('hasWarranty') hasWarranty?: string,
    @Query('q') q?: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
    @Query('sort') sort?: 'newest' | 'price_asc' | 'price_desc' | 'year_desc' | 'mileage_asc',
  ) {
    return this.products.listPublished({
      make,
      model,
      yearMin,
      yearMax,
      priceMin,
      priceMax,
      condition,
      companyId,
      transmission,
      drivetrain,
      bodyType,
      cylinders: cylinders ? Number(cylinders) : undefined,
      mileageMax: mileageMax != null ? Number(mileageMax) : undefined,
      hasWarranty: hasWarranty === 'true' || hasWarranty === '1',
      q,
      limit,
      offset,
      sort,
    });
  }

  @Public()
  @Get('products/facet-options')
  facetOptions() {
    return this.products.listFacetOptions();
  }

  @Public()
  @UseGuards(OptionalSessionGuard)
  @Get('products/by-slug/:slug')
  detail(@Param('slug') slug: string, @CurrentUser() user?: User) {
    return this.products.getBySlug(slug, user);
  }

  @Roles(UserRole.dealer_agent, UserRole.admin, UserRole.super_admin)
  @Get('dealer/inventory')
  inventory(
    @CurrentUser() user: User,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return this.products.listDealerInventory(user, {
      limit: limit != null ? Number(limit) : undefined,
      offset: offset != null ? Number(offset) : undefined,
    });
  }

  @Roles(UserRole.dealer_agent, UserRole.admin, UserRole.super_admin)
  @Post('dealer/inventory')
  create(@CurrentUser() user: User, @Body() dto: CreateProductDto) {
    return this.products.create(user, dto);
  }

  @Roles(UserRole.dealer_agent, UserRole.admin, UserRole.super_admin)
  @Patch('dealer/inventory/:id')
  update(@CurrentUser() user: User, @Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.products.update(user, id, dto);
  }

  @Roles(UserRole.dealer_agent, UserRole.admin, UserRole.super_admin)
  @Post('dealer/inventory/:id/images')
  @UseInterceptors(FileInterceptor('file', multerUploadOptions()))
  uploadImage(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.products.addImage(user, id, file);
  }

  @Roles(UserRole.dealer_agent, UserRole.admin, UserRole.super_admin)
  @Post('dealer/inventory/:id/publish')
  publish(@CurrentUser() user: User, @Param('id') id: string) {
    return this.products.publish(user, id);
  }

  @Roles(UserRole.dealer_agent, UserRole.admin, UserRole.super_admin)
  @Post('dealer/inventory/:id/unpublish')
  unpublish(@CurrentUser() user: User, @Param('id') id: string) {
    return this.products.unpublish(user, id);
  }
}
