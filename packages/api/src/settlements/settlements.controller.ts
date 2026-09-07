import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { SettlementStatus, User, UserRole } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { CurrentUser, Roles } from '../auth/guards';
import { PaginationQueryDto } from '../common/pagination.dto';
import {
  SETTLEMENT_DECISION_ROLES,
  SETTLEMENT_QUOTE_OPS_ROLES,
  SettlementsService,
} from './settlements.service';

class ListSettlementsQuery extends PaginationQueryDto {
  @IsOptional() @IsEnum(SettlementStatus) status?: SettlementStatus;
}

class DecideSettlementDto {
  @IsOptional() @IsString() reason?: string;
}

@Controller()
export class SettlementsController {
  constructor(private readonly settlements: SettlementsService) {}

  /** Live early-settlement quote for the owner of an active financing. */
  @Roles(UserRole.customer)
  @Get('applications/:id/settlement-quote')
  quote(@CurrentUser() user: User, @Param('id') id: string) {
    return this.settlements.quote(user, id);
  }

  /** Same quote for finance / admin / credit (company scope applies). */
  @Roles(...SETTLEMENT_QUOTE_OPS_ROLES)
  @Get('ops/applications/:id/settlement-quote')
  quoteOps(@CurrentUser() user: User, @Param('id') id: string) {
    return this.settlements.quote(user, id);
  }

  /** Customer asks to settle an active financing early, at the quoted amount. */
  @Roles(UserRole.customer)
  @HttpCode(201)
  @Post('applications/:id/settlement-request')
  request(@CurrentUser() user: User, @Param('id') id: string) {
    return this.settlements.request(user, id);
  }

  @Roles(...SETTLEMENT_DECISION_ROLES)
  @Get('ops/settlements')
  list(@CurrentUser() user: User, @Query() query: ListSettlementsQuery) {
    return this.settlements.list(user, query);
  }

  @Roles(...SETTLEMENT_DECISION_ROLES)
  @HttpCode(200)
  @Post('ops/settlements/:id/approve')
  approve(@CurrentUser() user: User, @Param('id') id: string, @Body() dto: DecideSettlementDto) {
    return this.settlements.decide(user, id, 'approved', dto.reason);
  }

  @Roles(...SETTLEMENT_DECISION_ROLES)
  @HttpCode(200)
  @Post('ops/settlements/:id/reject')
  reject(@CurrentUser() user: User, @Param('id') id: string, @Body() dto: DecideSettlementDto) {
    return this.settlements.decide(user, id, 'rejected', dto.reason);
  }
}
