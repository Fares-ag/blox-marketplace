import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { Caller, type CallerContext } from '../common/auth/service-auth.guard';
import { KycCaseService } from './kyc-case.service';
import { ConsentService } from './consent/consent.service';
import { CreateCaseDto } from './dto/create-case.dto';
import { SubmitConsentDto } from './dto/submit-consent.dto';
import { RecordBindingDto } from './dto/record-binding.dto';
import { RegisterDocumentDto } from './dto/register-document.dto';
import { ReviewDecisionDto } from './dto/review-decision.dto';

/**
 * Service API for the KYC platform. The marketplace API is the only caller and
 * forwards the acting user's identity via x-actor-* headers (see ServiceAuthGuard).
 */
@Controller('kyc')
export class KycController {
  constructor(
    private readonly cases: KycCaseService,
    private readonly consent: ConsentService,
  ) {}

  @Post('cases')
  create(@Body() dto: CreateCaseDto, @Caller() actor: CallerContext) {
    return this.cases.createCase(dto, actor);
  }

  @Get('cases')
  queue(@Caller() actor: CallerContext) {
    return this.cases.listQueue(actor);
  }

  @Get('cases/:id')
  getOne(@Param('id') id: string, @Caller() actor: CallerContext) {
    return this.cases.getCase(id, actor);
  }

  @Post('cases/:id/consent')
  async submitConsent(@Param('id') id: string, @Body() dto: SubmitConsentDto, @Caller() actor: CallerContext) {
    await this.consent.grant(id, dto.purpose, dto.granted, dto.textVersion, dto.textShown, actor);
    return { ok: true };
  }

  @Post('cases/:id/documents')
  async registerDocument(@Param('id') id: string, @Body() dto: RegisterDocumentDto, @Caller() actor: CallerContext) {
    await this.cases.registerDocument(id, dto, actor);
    return { ok: true };
  }

  @Post('cases/:id/identity-binding')
  async recordBinding(@Param('id') id: string, @Body() dto: RecordBindingDto, @Caller() actor: CallerContext) {
    await this.cases.recordBinding(id, dto, actor);
    return { ok: true };
  }

  @Post('cases/:id/run')
  run(@Param('id') id: string, @Caller() actor: CallerContext) {
    return this.cases.runChecks(id, actor);
  }

  @Post('cases/:id/decision')
  decide(@Param('id') id: string, @Body() dto: ReviewDecisionDto, @Caller() actor: CallerContext) {
    return this.cases.decide(id, dto, actor);
  }
}
