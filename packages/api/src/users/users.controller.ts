import { Controller, Get } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../auth/guards';
import { PrismaService } from '../prisma/prisma.service';

@Controller('users')
export class UsersController {
  constructor(private readonly prisma: PrismaService) {}

  @Roles(UserRole.admin, UserRole.super_admin)
  @Get()
  list() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        companyId: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
