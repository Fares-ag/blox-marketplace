import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Patch,
} from '@nestjs/common';
import { OfficerScope, User, UserRole } from '@prisma/client';
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { CurrentUser, Roles } from '../auth/guards';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityService } from '../common/activity.service';

class UpdateUserDto {
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsEnum(UserRole) role?: UserRole;
  @IsOptional() @IsString() companyId?: string | null;
  @IsOptional() @IsEnum(OfficerScope) creditScope?: OfficerScope;
  @IsOptional() @IsEnum(OfficerScope) financeScope?: OfficerScope;
}

const PRIVILEGED_ROLES: UserRole[] = [UserRole.admin, UserRole.super_admin];

@Controller('users')
export class UsersController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
  ) {}

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
        emailVerified: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * P1-6: suspend/reactivate users, assign roles and companies.
   * - Only super_admin may touch privileged (admin/super_admin) accounts or
   *   grant privileged roles.
   * - Nobody can suspend or demote themselves (prevents lock-out of the last
   *   operator account).
   * - Suspension revokes all sessions immediately.
   */
  @Roles(UserRole.admin, UserRole.super_admin)
  @Patch(':id')
  async update(
    @CurrentUser() actor: User,
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
  ) {
    const target = await this.prisma.user.findUnique({ where: { id } });
    if (!target) throw new NotFoundException();

    const touchesPrivileged =
      PRIVILEGED_ROLES.includes(target.role) ||
      (dto.role !== undefined && PRIVILEGED_ROLES.includes(dto.role));
    if (touchesPrivileged && actor.role !== UserRole.super_admin) {
      throw new ForbiddenException('super_admin_required');
    }

    if (target.id === actor.id && (dto.isActive === false || (dto.role && dto.role !== actor.role))) {
      throw new BadRequestException('cannot_modify_own_access');
    }

    if (dto.companyId) {
      const company = await this.prisma.company.findUnique({ where: { id: dto.companyId } });
      if (!company) throw new BadRequestException('company_not_found');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.user.update({
        where: { id },
        data: {
          isActive: dto.isActive ?? undefined,
          role: dto.role ?? undefined,
          companyId: dto.companyId === undefined ? undefined : dto.companyId,
          creditScope: dto.creditScope ?? undefined,
          financeScope: dto.financeScope ?? undefined,
        },
      });
      if (dto.isActive === false) {
        // Immediate containment: kill every live session for the suspended user.
        await tx.session.deleteMany({ where: { userId: id } });
      }
      return next;
    });

    await this.activity.log({
      actorUserId: actor.id,
      entityType: 'user',
      entityId: id,
      action: 'user_updated',
      fromValue: `${target.role}:${target.isActive ? 'active' : 'suspended'}`,
      toValue: `${updated.role}:${updated.isActive ? 'active' : 'suspended'}`,
      metadata: {
        changes: {
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
          ...(dto.role !== undefined ? { role: dto.role } : {}),
          ...(dto.companyId !== undefined ? { companyId: dto.companyId } : {}),
          ...(dto.creditScope !== undefined ? { creditScope: dto.creditScope } : {}),
          ...(dto.financeScope !== undefined ? { financeScope: dto.financeScope } : {}),
        },
      },
    });

    return {
      id: updated.id,
      email: updated.email,
      name: updated.name,
      role: updated.role,
      companyId: updated.companyId,
      isActive: updated.isActive,
    };
  }
}
