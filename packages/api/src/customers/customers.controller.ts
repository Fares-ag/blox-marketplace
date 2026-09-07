import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CustomerDocumentCategory, Gender, User, UserRole } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional, IsString, Matches, MaxLength, ValidateNested } from 'class-validator';
import type { Response } from 'express';
import { CurrentUser, Roles } from '../auth/guards';
import { multerUploadOptions } from '../common/multer-options';
import { CustomerDocumentsService, type VaultFile } from './customer-documents.service';
import { CustomersService } from './customers.service';

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DATE_MESSAGE = 'dates must be YYYY-MM-DD';

class NotificationChannelsDto {
  @IsOptional() @IsBoolean() email?: boolean;
  @IsOptional() @IsBoolean() sms?: boolean;
  @IsOptional() @IsBoolean() push?: boolean;
  @IsOptional() @IsBoolean() whatsapp?: boolean;
}

class NotificationRemindersDto {
  @IsOptional() @IsBoolean() payments?: boolean;
  @IsOptional() @IsBoolean() documents?: boolean;
  @IsOptional() @IsBoolean() takaful?: boolean;
}

class NotificationPreferencesPatchDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => NotificationChannelsDto)
  channels?: NotificationChannelsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => NotificationRemindersDto)
  reminders?: NotificationRemindersDto;
}

class CustomerAddressPatchDto {
  @IsOptional() @IsString() @MaxLength(160) line1?: string | null;
  @IsOptional() @IsString() @MaxLength(80) area?: string | null;
  @IsOptional() @IsString() @MaxLength(80) city?: string | null;
  @IsOptional() @IsString() @MaxLength(20) zone?: string | null;
  @IsOptional() @IsString() @MaxLength(20) po_box?: string | null;
}

class UpdateCustomerProfileDto {
  @IsOptional() @IsString() @MaxLength(80) first_name?: string | null;
  @IsOptional() @IsString() @MaxLength(80) last_name?: string | null;
  @IsOptional() @IsIn(Object.values(Gender)) gender?: Gender | null;
  @IsOptional() @IsString() @MaxLength(10) date_of_birth?: string | null;
  @IsOptional() @IsString() @MaxLength(80) nationality?: string | null;
  @IsOptional() @IsString() @MaxLength(24) phone?: string | null;
  @IsOptional() @IsIn(['en', 'ar']) preferred_language?: 'en' | 'ar';

  @IsOptional()
  @ValidateNested()
  @Type(() => NotificationPreferencesPatchDto)
  notification_preferences?: NotificationPreferencesPatchDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => CustomerAddressPatchDto)
  address?: CustomerAddressPatchDto;
}

class UploadCustomerDocumentDto {
  @IsIn(Object.values(CustomerDocumentCategory))
  category!: CustomerDocumentCategory;

  @IsOptional() @IsString() @MaxLength(40) document_number?: string;
  @IsOptional() @Matches(ISO_DATE_PATTERN, { message: ISO_DATE_MESSAGE }) issued_at?: string;
  @IsOptional() @Matches(ISO_DATE_PATTERN, { message: ISO_DATE_MESSAGE }) expires_at?: string;
}

function sendFile(res: Response, file: VaultFile) {
  const safeName = file.filename.replace(/[^\w.\-() ]+/g, '_');
  res.setHeader('Content-Type', file.contentType);
  res.setHeader('Content-Disposition', `inline; filename="${safeName}"`);
  res.send(file.buffer);
}

@Controller()
export class CustomersController {
  constructor(
    private readonly customers: CustomersService,
    private readonly documents: CustomerDocumentsService,
  ) {}

  // ---- Profile ----

  @Roles(UserRole.customer)
  @Get('me/profile')
  profile(@CurrentUser() user: User) {
    return this.customers.profile(user);
  }

  @Roles(UserRole.customer)
  @Patch('me/profile')
  updateProfile(@CurrentUser() user: User, @Body() dto: UpdateCustomerProfileDto) {
    return this.customers.updateProfile(user, dto);
  }

  // ---- Document vault ----

  @Roles(UserRole.customer)
  @Get('me/documents')
  listDocuments(@CurrentUser() user: User) {
    return this.documents.list(user.id);
  }

  @Roles(UserRole.customer)
  @Post('me/documents')
  @UseInterceptors(FileInterceptor('file', multerUploadOptions()))
  uploadDocument(
    @CurrentUser() user: User,
    @Body() dto: UploadCustomerDocumentDto,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    return this.documents.upload(user, dto, file);
  }

  @Roles(UserRole.customer)
  @Get('me/documents/:id/file')
  async downloadDocument(@CurrentUser() user: User, @Param('id') id: string, @Res() res: Response) {
    sendFile(res, await this.documents.download(user, id));
  }

  @Roles(UserRole.customer)
  @Delete('me/documents/:id')
  @HttpCode(200)
  deleteDocument(@CurrentUser() user: User, @Param('id') id: string) {
    return this.documents.softDelete(user, id);
  }

  // ---- Ops ----

  @Roles(UserRole.credit_officer, UserRole.admin, UserRole.super_admin)
  @Get('ops/customers/:userId/documents')
  opsListDocuments(@CurrentUser() user: User, @Param('userId') userId: string) {
    return this.documents.listForOps(user, userId);
  }

  @Roles(UserRole.credit_officer, UserRole.admin, UserRole.super_admin)
  @Get('ops/customers/:userId/documents/:id/file')
  async opsDownloadDocument(
    @CurrentUser() user: User,
    @Param('userId') userId: string,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    sendFile(res, await this.documents.downloadForOps(user, userId, id));
  }

  @Roles(UserRole.credit_officer, UserRole.admin, UserRole.super_admin)
  @Post('ops/customers/:userId/documents/:id/verify')
  @HttpCode(200)
  opsVerifyDocument(@CurrentUser() user: User, @Param('userId') userId: string, @Param('id') id: string) {
    return this.documents.verify(user, userId, id);
  }
}
