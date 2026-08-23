import { Body, Controller, Get, Headers, Param, Post, Req } from '@nestjs/common';
import type { User } from '@prisma/client';
import type { Request } from 'express';
import { CurrentUser, Public, Roles } from '../auth/guards';
import { UserRole } from '@prisma/client';
import { KycBridgeService } from './kyc-bridge.service';

@Controller()
export class KycController {
  constructor(private readonly kyc: KycBridgeService) {}

  @Roles(UserRole.customer)
  @Post('applications/:applicationId/kyc/session')
  session(@CurrentUser() user: User, @Param('applicationId') applicationId: string) {
    return this.kyc.ensureSession(user, applicationId);
  }

  @Roles(UserRole.customer)
  @Get('applications/:applicationId/kyc/documents')
  documents(@CurrentUser() user: User, @Param('applicationId') applicationId: string) {
    return this.kyc.documentStatus(user, applicationId);
  }

  @Public()
  @Post('webhooks/kyc')
  webhook(
    @Req() req: Request & { rawBody?: string },
    @Headers('x-kyc-signature') signature: string | undefined,
    @Body() body: { type?: string; case_id?: string },
  ) {
    const raw = req.rawBody ?? JSON.stringify(body ?? {});
    return this.kyc.handleWebhook(raw, signature, body ?? {});
  }
}
