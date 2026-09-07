import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { User, UserRole } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { CurrentUser, Public, Roles } from '../auth/guards';
import { TAKAFUL_COVERAGES, type TakafulCoverage } from './takaful-quote';
import { TakafulProvidersService } from './takaful-providers.service';

const CODE_PATTERN = /^[a-z0-9][a-z0-9_-]*$/i;

class TakafulRiderDto {
  @IsString() @Length(1, 40) code!: string;
  @IsString() @Length(1, 120) label!: string;
  @IsOptional() @IsString() @MaxLength(120) label_ar?: string | null;
  @IsNumber() @Min(0) annual_amount!: number;
}

class UpdateTakafulProviderDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(40) @Matches(CODE_PATTERN) code?: string;
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(120) name?: string;
  @IsOptional() @IsString() @MaxLength(120) name_ar?: string | null;
  /** Comprehensive cover as % of vehicle value per year. */
  @IsOptional() @IsNumber() @Min(0) @Max(100) comprehensive_rate_pct?: number;
  @IsOptional() @IsNumber() @Min(0) third_party_annual?: number | null;
  @IsOptional() @IsNumber() @Min(0) min_contribution?: number | null;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => TakafulRiderDto)
  riders?: TakafulRiderDto[];
  @IsOptional() @IsString() @MaxLength(40) contact_phone?: string | null;
  @IsOptional() @IsString() @MaxLength(160) contact_email?: string | null;
  @IsOptional() @IsString() @MaxLength(200) website?: string | null;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string | null;
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @IsInt() @Min(0) sort_order?: number;
}

class CreateTakafulProviderDto extends UpdateTakafulProviderDto {
  @IsString() @IsNotEmpty() @MaxLength(40) @Matches(CODE_PATTERN) declare code: string;
  @IsString() @IsNotEmpty() @MaxLength(120) declare name: string;
  @IsNumber() @Min(0) @Max(100) declare comprehensive_rate_pct: number;
}

class TakafulQuoteQueryDto {
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) vehicle_price?: number;
  @IsOptional() @IsIn(TAKAFUL_COVERAGES) coverage?: TakafulCoverage;
}

/** Public quote comparison (`/api/takaful/providers`) and the admin provider master (`/api/ops/takaful-providers`). */
@Controller()
export class TakafulProvidersController {
  constructor(private readonly providers: TakafulProvidersService) {}

  @Public()
  @Get('takaful/providers')
  quotes(@Query() query: TakafulQuoteQueryDto) {
    return this.providers.quotes(query.coverage ?? 'comprehensive', query.vehicle_price ?? null);
  }

  @Roles(UserRole.admin, UserRole.super_admin)
  @Get('ops/takaful-providers')
  list() {
    return this.providers.list();
  }

  @Roles(UserRole.admin, UserRole.super_admin)
  @Get('ops/takaful-providers/:id')
  one(@Param('id') id: string) {
    return this.providers.get(id);
  }

  @Roles(UserRole.admin, UserRole.super_admin)
  @Post('ops/takaful-providers')
  create(@CurrentUser() actor: User, @Body() dto: CreateTakafulProviderDto) {
    return this.providers.create(actor, dto);
  }

  @Roles(UserRole.admin, UserRole.super_admin)
  @Patch('ops/takaful-providers/:id')
  update(@CurrentUser() actor: User, @Param('id') id: string, @Body() dto: UpdateTakafulProviderDto) {
    return this.providers.update(actor, id, dto);
  }
}
