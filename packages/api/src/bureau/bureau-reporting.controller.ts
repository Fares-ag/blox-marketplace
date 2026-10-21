import { Controller, Get, HttpCode, Param, Post, Res } from '@nestjs/common';
import { User, UserRole } from '@prisma/client';
import type { Response } from 'express';
import { CurrentUser, Roles } from '../auth/guards';
import { setFileDownloadHeaders } from '../common/content-disposition';
import { BureauReportingService } from './bureau-reporting.service';

@Controller('ops/bureau')
export class BureauReportingController {
  constructor(private readonly bureau: BureauReportingService) {}

  @Roles(UserRole.finance_officer, UserRole.admin, UserRole.super_admin)
  @Get('runs')
  list() {
    return this.bureau.listRuns();
  }

  @Roles(UserRole.finance_officer, UserRole.admin, UserRole.super_admin)
  @Get('runs/:id')
  get(@Param('id') id: string) {
    return this.bureau.getRun(id);
  }

  @Roles(UserRole.finance_officer, UserRole.admin, UserRole.super_admin)
  @Get('runs/:id/file')
  async file(@Param('id') id: string, @Res() res: Response) {
    const file = await this.bureau.getFile(id);
    setFileDownloadHeaders(res, 'text/plain; charset=utf-8', file.filename);
    res.send(file.body);
  }

  @Roles(UserRole.finance_officer, UserRole.admin, UserRole.super_admin)
  @HttpCode(200)
  @Post('runs')
  run(@CurrentUser() user: User) {
    return this.bureau.run({ triggeredBy: 'manual', actorUserId: user.id });
  }

  @Roles(UserRole.finance_officer, UserRole.admin, UserRole.super_admin)
  @HttpCode(200)
  @Post('runs/:id/send')
  approveAndSend(@Param('id') id: string, @CurrentUser() user: User) {
    return this.bureau.approveAndSend(id, user.id);
  }
}
