import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { User, UserRole } from '@prisma/client';
import { IsBoolean, IsIn, IsNumber, IsOptional, IsString } from 'class-validator';
import { CurrentUser, Roles } from '../auth/guards';
import { MusharakahService } from './musharakah.service';

class MandateDto {
  @IsOptional() @IsString() reference?: string;
}

class LpoDto {
  @IsOptional() @IsString() reference?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsString() settlementRef?: string;
}

class HardshipDto {
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsNumber() installmentsDeferred?: number;
  @IsOptional() @IsBoolean() overrideDeferQuota?: boolean;
}

class HardshipDecisionDto {
  @IsIn(['approve', 'fail', 'resolve']) decision!: 'approve' | 'fail' | 'resolve';
}

class RepossessionCloseDto {
  @IsNumber() saleProceeds!: number;
}

class TotalLossDto {
  @IsNumber() proceeds!: number;
  @IsOptional() @IsString() takafulPolicyId?: string;
  @IsOptional() @IsString() notes?: string;
}

@Controller()
export class MusharakahController {
  constructor(private readonly musharakah: MusharakahService) {}

  @Roles(UserRole.customer, UserRole.credit_officer, UserRole.finance_officer, UserRole.admin, UserRole.super_admin, UserRole.dealer_agent)
  @Get('applications/:id/ownership-register')
  register(@CurrentUser() user: User, @Param('id') id: string) {
    return this.musharakah.getRegister(user, id);
  }

  @Roles(UserRole.customer, UserRole.credit_officer, UserRole.finance_officer, UserRole.admin, UserRole.super_admin)
  @Get('applications/:id/pre-disbursal')
  preDisbursal(@CurrentUser() user: User, @Param('id') id: string) {
    return this.musharakah.buildPreDisbursal(id);
  }

  @Roles(UserRole.customer, UserRole.credit_officer, UserRole.finance_officer, UserRole.admin, UserRole.super_admin)
  @Post('applications/:id/pre-disbursal/complete')
  completePre(@CurrentUser() user: User, @Param('id') id: string) {
    return this.musharakah.completePreDisbursal(user, id);
  }

  @Roles(UserRole.customer, UserRole.credit_officer, UserRole.finance_officer, UserRole.admin, UserRole.super_admin)
  @Post('applications/:id/repayment/mandate')
  mandate(@CurrentUser() user: User, @Param('id') id: string, @Body() body: MandateDto) {
    return this.musharakah.registerMandate(user, id, body);
  }

  @Roles(UserRole.customer, UserRole.credit_officer, UserRole.finance_officer, UserRole.admin, UserRole.super_admin)
  @Get('applications/:id/unit-offers')
  offers(@CurrentUser() user: User, @Param('id') id: string) {
    return this.musharakah.listUnitOffers(user, id);
  }

  @Roles(UserRole.customer)
  @Post('applications/:id/unit-offers/disclosure')
  disclosure(@CurrentUser() user: User, @Param('id') id: string) {
    return this.musharakah.acknowledgeOfferDisclosure(user, id);
  }

  @Roles(UserRole.customer)
  @Post('applications/:id/unit-offers/:offerId/accept')
  accept(@CurrentUser() user: User, @Param('id') id: string, @Param('offerId') offerId: string) {
    return this.musharakah.acceptUnitOffer(user, id, offerId);
  }

  @Roles(UserRole.finance_officer, UserRole.admin, UserRole.super_admin)
  @Post('ops/applications/:id/lpo')
  issueLpo(@CurrentUser() user: User, @Param('id') id: string, @Body() body: LpoDto) {
    return this.musharakah.issueLpo(user, id, body);
  }

  @Roles(UserRole.finance_officer, UserRole.admin, UserRole.super_admin)
  @Post('ops/applications/:id/lpo/settle')
  settleLpo(@CurrentUser() user: User, @Param('id') id: string, @Body() body: LpoDto) {
    return this.musharakah.confirmLpoSettlement(user, id, body);
  }

  @Roles(UserRole.dealer_agent, UserRole.finance_officer, UserRole.admin, UserRole.super_admin)
  @Get('ops/lpo')
  lpoInbox(@CurrentUser() user: User) {
    return this.musharakah.listDealerLpos(user);
  }

  @Roles(UserRole.credit_officer, UserRole.finance_officer, UserRole.admin, UserRole.super_admin)
  @Post('ops/applications/:id/hardship')
  hardship(@CurrentUser() user: User, @Param('id') id: string, @Body() body: HardshipDto) {
    return this.musharakah.openHardship(user, id, body);
  }

  @Roles(UserRole.credit_officer, UserRole.finance_officer, UserRole.admin, UserRole.super_admin)
  @Post('ops/applications/:id/hardship/decide')
  decideHardship(@CurrentUser() user: User, @Param('id') id: string, @Body() body: HardshipDecisionDto) {
    return this.musharakah.decideHardship(user, id, body.decision);
  }

  @Roles(UserRole.finance_officer, UserRole.admin, UserRole.super_admin)
  @Post('ops/applications/:id/repossession/close')
  closeRepo(@CurrentUser() user: User, @Param('id') id: string, @Body() body: RepossessionCloseDto) {
    return this.musharakah.closeRepossession(user, id, body);
  }

  @Roles(UserRole.credit_officer, UserRole.finance_officer, UserRole.admin, UserRole.super_admin)
  @Post('ops/applications/:id/total-loss')
  totalLoss(@CurrentUser() user: User, @Param('id') id: string, @Body() body: TotalLossDto) {
    return this.musharakah.fileTotalLoss(user, id, body);
  }
}
