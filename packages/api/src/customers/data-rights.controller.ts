import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ConsentCode, DataRightsRequestKind, DataRightsRequestStatus, User, UserRole } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { CurrentUser, Roles } from '../auth/guards';
import { DataRightsService } from './data-rights.service';

class CreateDataRightsRequestDto {
  @IsEnum(DataRightsRequestKind)
  kind!: DataRightsRequestKind;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  details?: string;

  /** Required for `consent_withdrawal`. */
  @IsOptional()
  @IsEnum(ConsentCode)
  consent_code?: ConsentCode;
}

class TransitionDataRightsRequestDto {
  @IsEnum(DataRightsRequestStatus)
  status!: DataRightsRequestStatus;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  resolution_note?: string;
}

class DataRightsQueueQueryDto {
  @IsOptional()
  @IsEnum(DataRightsRequestStatus)
  status?: DataRightsRequestStatus;
}

/** Customer data rights (`/api/me/data-rights`, `/api/me/data-export`) and the privacy-team queue (`/api/ops/data-rights`). */
@Controller()
export class DataRightsController {
  constructor(private readonly dataRights: DataRightsService) {}

  @Roles(UserRole.customer)
  @Get('me/data-rights')
  listMine(@CurrentUser() user: User) {
    return this.dataRights.listMine(user.id);
  }

  @Roles(UserRole.customer)
  @Post('me/data-rights')
  create(@CurrentUser() user: User, @Body() dto: CreateDataRightsRequestDto) {
    return this.dataRights.create(user, dto);
  }

  @Roles(UserRole.customer)
  @Get('me/data-export')
  exportMine(@CurrentUser() user: User) {
    return this.dataRights.exportFor(user);
  }

  @Roles(UserRole.admin, UserRole.super_admin)
  @Get('ops/data-rights')
  queue(@Query() query: DataRightsQueueQueryDto) {
    return this.dataRights.listForOps(query.status ?? null);
  }

  @Roles(UserRole.admin, UserRole.super_admin)
  @Post('ops/data-rights/:id/transition')
  @HttpCode(200)
  transition(@CurrentUser() actor: User, @Param('id') id: string, @Body() dto: TransitionDataRightsRequestDto) {
    return this.dataRights.transition(actor, id, dto);
  }
}
