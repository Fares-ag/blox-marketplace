import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import { ApplicationStatus, User, UserRole } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';
import type { Response } from 'express';
import { CurrentUser, Roles } from '../auth/guards';
import { PaginationQueryDto, resolvePagination } from '../common/pagination.dto';
import { PartnerService } from './partner.service';

class PartnerApplicationsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(ApplicationStatus)
  status?: ApplicationStatus;
}

/** Finance-provider staff (`partner_viewer`) read-only routes; scoped to the viewer's own provider. */
@Roles(UserRole.partner_viewer)
@Controller('partner')
export class PartnerController {
  constructor(private readonly partner: PartnerService) {}

  @Get('applications')
  list(@CurrentUser() user: User, @Query() query: PartnerApplicationsQueryDto) {
    const { limit, offset } = resolvePagination(query, { defaultLimit: 50, maxLimit: 100 });
    return this.partner.list(user, { status: query.status ?? null, limit, offset });
  }

  @Get('summary')
  summary(@CurrentUser() user: User) {
    return this.partner.summary(user);
  }

  @Get('applications/:id')
  detail(@CurrentUser() user: User, @Param('id') id: string) {
    return this.partner.detail(user, id);
  }

  @Get('applications/:id/documents/:docId/file')
  async documentFile(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Param('docId') docId: string,
    @Res() res: Response,
  ) {
    const file = await this.partner.documentFile(user, id, docId);
    const safeName = file.filename.replace(/[^\w.\-() ]+/g, '_');
    res.setHeader('Content-Type', file.contentType);
    res.setHeader('Content-Disposition', `inline; filename="${safeName}"`);
    res.send(file.buffer);
  }
}
