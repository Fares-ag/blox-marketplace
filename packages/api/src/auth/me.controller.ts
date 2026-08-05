import { Controller, Get, Patch, Body } from '@nestjs/common';
import { IsOptional, IsString } from 'class-validator';
import type { User } from '@prisma/client';
import { CurrentUser } from './guards';
import { PrismaService } from '../prisma/prisma.service';

class UpdateProfileDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  qid?: string;
}

@Controller('me')
export class MeController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  me(@CurrentUser() user: User) {
    return this.toPublic(user);
  }

  @Patch()
  async update(@CurrentUser() user: User, @Body() dto: UpdateProfileDto) {
    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        name: dto.name ?? undefined,
        phone: dto.phone ?? undefined,
        qid: dto.qid ?? undefined,
      },
    });
    return this.toPublic(updated);
  }

  private toPublic(user: User) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      company_id: user.companyId,
      credit_scope: user.creditScope,
      finance_scope: user.financeScope,
      phone: user.phone,
      qid: user.qid,
      email_verified: user.emailVerified,
      is_active: user.isActive,
    };
  }
}
