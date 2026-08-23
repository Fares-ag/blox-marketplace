import { BadRequestException, Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { User, UserRole } from '@prisma/client';
import { IsNumber, IsOptional, IsPositive, IsString, ValidateIf } from 'class-validator';
import { CurrentUser, Roles } from '../auth/guards';
import { CreditsService } from './credits.service';

class PayInstallmentDto {
  @IsString() applicationId!: string;
  @IsString() dueDate!: string;
  @IsNumber() @IsPositive() amount!: number;
}

class AdminCreditsDto {
  @IsString() action!: 'add' | 'subtract' | 'set';
  @IsNumber() @IsPositive() amount!: number;
  @IsOptional() @IsString() description?: string;
}

class ClaimCreditsDto {
  @IsOptional() @IsString() transactionId?: string;

  @ValidateIf((dto: ClaimCreditsDto) => !dto.transactionId)
  @IsNumber()
  @IsPositive()
  amount?: number;
}

@Controller('mobile/credits')
export class CreditsController {
  constructor(private readonly credits: CreditsService) {}

  @Roles(UserRole.customer)
  @Get('balance')
  balance(@CurrentUser() user: User) {
    return this.credits.getBalance(user);
  }

  @Roles(UserRole.customer)
  @HttpCode(200)
  @Post('pay-installment')
  pay(@CurrentUser() user: User, @Body() dto: PayInstallmentDto) {
    return this.credits.payInstallment(user, dto.applicationId, dto.dueDate, dto.amount);
  }

  @Roles(UserRole.customer)
  @HttpCode(200)
  @Post('claim')
  claim(@CurrentUser() user: User, @Body() dto: ClaimCreditsDto) {
    if (dto.transactionId?.trim()) {
      return this.credits.claimFromTopUp(user, dto.transactionId.trim());
    }
    if (dto.amount == null) {
      throw new BadRequestException('transactionId_or_amount_required');
    }
    return this.credits.claim(user, dto.amount);
  }
}

@Controller('ops/users')
export class OpsCreditsController {
  constructor(private readonly credits: CreditsService) {}

  @Roles(UserRole.admin, UserRole.super_admin)
  @Get(':id/credits')
  adminBalance(@Param('id') id: string) {
    return this.credits.adminBalance(id);
  }

  @Roles(UserRole.admin, UserRole.super_admin)
  @HttpCode(200)
  @Post(':id/credits')
  adminAdjust(@CurrentUser() actor: User, @Param('id') id: string, @Body() dto: AdminCreditsDto) {
    return this.credits.adminAdjust(actor, id, dto.action, dto.amount, dto.description);
  }
}
