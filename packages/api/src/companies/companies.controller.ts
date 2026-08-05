import { Body, Controller, Get, Post } from '@nestjs/common';
import { User, UserRole } from '@prisma/client';
import { IsOptional, IsString } from 'class-validator';
import { CurrentUser, Public, Roles } from '../auth/guards';
import { PrismaService } from '../prisma/prisma.service';

class CreateCompanyDto {
  @IsString() name!: string;
  @IsOptional() @IsString() code?: string;
  @IsOptional() @IsString() contactEmail?: string;
  @IsOptional() @IsString() dealerUserId?: string;
}

@Controller('companies')
export class CompaniesController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  listPublic() {
    return this.prisma.company.findMany({
      where: { status: 'active' },
      select: { id: true, name: true, code: true, logoUrl: true },
      orderBy: { name: 'asc' },
    });
  }

  @Roles(UserRole.admin, UserRole.super_admin)
  @Get('all')
  listAll() {
    return this.prisma.company.findMany({ orderBy: { createdAt: 'desc' } });
  }

  @Roles(UserRole.admin, UserRole.super_admin)
  @Post()
  async create(@Body() dto: CreateCompanyDto) {
    const company = await this.prisma.company.create({
      data: {
        name: dto.name,
        code: dto.code,
        contactEmail: dto.contactEmail,
        status: 'active',
      },
    });
    if (dto.dealerUserId) {
      await this.prisma.user.update({
        where: { id: dto.dealerUserId },
        data: { role: UserRole.dealer_agent, companyId: company.id },
      });
    }
    return company;
  }

  @Roles(UserRole.dealer_agent)
  @Get('mine')
  mine(@CurrentUser() user: User) {
    if (!user.companyId) return null;
    return this.prisma.company.findUnique({ where: { id: user.companyId } });
  }
}
