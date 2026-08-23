import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Inject,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CompanyKind, OfficerScope, User, UserRole } from '@prisma/client';
import { IsArray, IsBoolean, IsEmail, IsEnum, IsOptional, IsString } from 'class-validator';
import { randomBytes } from 'node:crypto';
import { CurrentUser, Roles } from '../auth/guards';
import { AUTH_INSTANCE, type AuthInstance } from '../auth/auth.constants';
import { MailService } from '../mail/mail.service';
import { AppConfigService } from '../config/app-config.service';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityService } from '../common/activity.service';
import { PaginationQueryDto, resolvePagination } from '../common/pagination.dto';
import { toAdminUserDto, toAdminUserListResponse, toAdminUserUpdateDto } from './user-response.dto';
import { resolveDescendantCompanyIds } from '../companies/company-hierarchy';

class UpdateUserDto {
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsEnum(UserRole) role?: UserRole;
  @IsOptional() @IsString() companyId?: string | null;
  @IsOptional() @IsEnum(OfficerScope) creditScope?: OfficerScope;
  @IsOptional() @IsEnum(OfficerScope) financeScope?: OfficerScope;
  @IsOptional() @IsArray() @IsString({ each: true }) creditCompanyIds?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) financeCompanyIds?: string[];
}

class CreateUserDto {
  @IsEmail() email!: string;
  @IsString() name!: string;
  @IsEnum(UserRole) role!: UserRole;
  @IsOptional() @IsString() companyId?: string;
  @IsOptional() @IsEnum(OfficerScope) creditScope?: OfficerScope;
  @IsOptional() @IsEnum(OfficerScope) financeScope?: OfficerScope;
}

class InviteDealerAgentDto {
  @IsEmail() email!: string;
  @IsString() name!: string;
}

const PRIVILEGED_ROLES: UserRole[] = [UserRole.admin, UserRole.super_admin, UserRole.group_admin];
const GROUP_MANAGEABLE_ROLES: UserRole[] = [
  UserRole.customer,
  UserRole.dealer_agent,
  UserRole.credit_officer,
  UserRole.finance_officer,
];

@Controller('users')
export class UsersController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
    private readonly mail: MailService,
    private readonly appConfig: AppConfigService,
    @Inject(AUTH_INSTANCE) private readonly auth: AuthInstance,
  ) {}

  @Roles(UserRole.admin, UserRole.super_admin, UserRole.group_admin)
  @Get()
  async list(@CurrentUser() actor: User, @Query() query: PaginationQueryDto) {
    const { limit, offset } = resolvePagination(query, { defaultLimit: 50, maxLimit: 100 });
    const scopeIds =
      actor.role === UserRole.group_admin && actor.companyId
        ? await resolveDescendantCompanyIds(this.prisma, actor.companyId)
        : null;
    const where = scopeIds
      ? {
          OR: [
            { companyId: { in: scopeIds } },
            { creditCompanies: { some: { companyId: { in: scopeIds } } } },
            { financeCompanies: { some: { companyId: { in: scopeIds } } } },
          ],
        }
      : {};
    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
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
        take: limit,
        skip: offset,
      }),
      this.prisma.user.count({ where }),
    ]);
    return toAdminUserListResponse(items, total, limit, offset);
  }

  @Roles(UserRole.admin, UserRole.super_admin, UserRole.group_admin)
  @Get(':id')
  async one(@CurrentUser() actor: User, @Param('id') id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        company: { select: { id: true, name: true } },
        creditCompanies: { select: { companyId: true } },
        financeCompanies: { select: { companyId: true } },
        _count: { select: { applications: true, agentApplications: true } },
      },
    });
    if (!user) throw new NotFoundException();
    if (actor.role === UserRole.group_admin && actor.companyId) {
      const allowed = await resolveDescendantCompanyIds(this.prisma, actor.companyId);
      const inTree =
        (user.companyId && allowed.includes(user.companyId)) ||
        user.creditCompanies.some((r) => allowed.includes(r.companyId)) ||
        user.financeCompanies.some((r) => allowed.includes(r.companyId));
      if (!inTree) throw new NotFoundException();
    }
    return {
      ...toAdminUserDto(user),
      company_name: user.company?.name ?? null,
      credit_scope: user.creditScope,
      finance_scope: user.financeScope,
      credit_company_ids: user.creditCompanies.map((r) => r.companyId),
      finance_company_ids: user.financeCompanies.map((r) => r.companyId),
      applications_count: user._count.applications,
      agent_applications_count: user._count.agentApplications,
    };
  }

  @Roles(UserRole.admin, UserRole.super_admin, UserRole.group_admin)
  @Post()
  async create(@CurrentUser() actor: User, @Body() dto: CreateUserDto) {
    return this.provisionUser(actor, dto);
  }

  /** Dealership staff can invite additional dealer agents for their own company. */
  @Roles(UserRole.dealer_agent)
  @Post('dealer-agents')
  async inviteDealerAgent(@CurrentUser() actor: User, @Body() dto: InviteDealerAgentDto) {
    if (!actor.companyId) throw new ForbiddenException('no_company');
    return this.provisionUser(actor, {
      email: dto.email,
      name: dto.name,
      role: UserRole.dealer_agent,
      companyId: actor.companyId,
    });
  }

  private async provisionUser(actor: User, dto: CreateUserDto) {
    if (PRIVILEGED_ROLES.includes(dto.role) && actor.role !== UserRole.super_admin) {
      throw new ForbiddenException('super_admin_required');
    }
    if (actor.role === UserRole.group_admin && !GROUP_MANAGEABLE_ROLES.includes(dto.role)) {
      throw new ForbiddenException('forbidden_role');
    }
    if (actor.role === UserRole.dealer_agent) {
      if (dto.role !== UserRole.dealer_agent || dto.companyId !== actor.companyId) {
        throw new ForbiddenException('forbidden_role');
      }
    }
    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new BadRequestException('email_taken');
    if (dto.companyId) {
      const company = await this.prisma.company.findUnique({ where: { id: dto.companyId } });
      if (!company) throw new BadRequestException('company_not_found');
      if (dto.role === UserRole.group_admin && company.kind !== CompanyKind.holding) {
        throw new BadRequestException('group_admin_requires_holding');
      }
      if (dto.role === UserRole.dealer_agent && company.kind === CompanyKind.holding) {
        throw new BadRequestException('dealer_requires_dealership');
      }
      if (actor.role === UserRole.group_admin && actor.companyId) {
        const allowed = await resolveDescendantCompanyIds(this.prisma, actor.companyId);
        if (!allowed.includes(dto.companyId)) throw new ForbiddenException('out_of_scope');
      }
    } else if (dto.role === UserRole.group_admin) {
      throw new BadRequestException('group_admin_requires_holding');
    }

    const password = `Tmp!${randomBytes(18).toString('base64url')}`;
    try {
      await this.auth.api.signUpEmail({
        body: { email, password, name: dto.name },
      });
    } catch {
      throw new BadRequestException('user_create_failed');
    }
    const created = await this.prisma.user.findUnique({ where: { email } });
    if (!created) throw new BadRequestException('user_create_failed');

    const updated = await this.prisma.user.update({
      where: { id: created.id },
      data: {
        role: dto.role,
        companyId: dto.companyId ?? null,
        creditScope: dto.creditScope ?? undefined,
        financeScope: dto.financeScope ?? undefined,
        emailVerified: false,
      },
    });

    try {
      await this.auth.api.requestPasswordReset({
        body: { email, redirectTo: this.appConfig.marketplacePath('/auth/reset-password') },
      });
    } catch {
      await this.mail.sendWalkInInviteEmail(
        email,
        this.appConfig.marketplacePath('/auth/forgot-password'),
        'Blox',
      );
    }

    await this.activity.log({
      actorUserId: actor.id,
      entityType: 'user',
      entityId: updated.id,
      action: 'user_created',
      toValue: updated.role,
    });
    return toAdminUserUpdateDto(updated);
  }

  /**
   * P1-6: suspend/reactivate users, assign roles and companies.
   * - Only super_admin may touch privileged (admin/super_admin) accounts or
   *   grant privileged roles.
   * - Nobody can suspend or demote themselves (prevents lock-out of the last
   *   operator account).
   * - Suspension revokes all sessions immediately.
   */
  @Roles(UserRole.admin, UserRole.super_admin, UserRole.group_admin)
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
    if (actor.role === UserRole.group_admin) {
      if (dto.role && !GROUP_MANAGEABLE_ROLES.includes(dto.role)) {
        throw new ForbiddenException('forbidden_role');
      }
    }

    if (target.id === actor.id && (dto.isActive === false || (dto.role && dto.role !== actor.role))) {
      throw new BadRequestException('cannot_modify_own_access');
    }

    if (dto.companyId) {
      const company = await this.prisma.company.findUnique({ where: { id: dto.companyId } });
      if (!company) throw new BadRequestException('company_not_found');
      const nextRole = dto.role ?? target.role;
      if (nextRole === UserRole.group_admin && company.kind !== CompanyKind.holding) {
        throw new BadRequestException('group_admin_requires_holding');
      }
      if (nextRole === UserRole.dealer_agent && company.kind === CompanyKind.holding) {
        throw new BadRequestException('dealer_requires_dealership');
      }
      if (actor.role === UserRole.group_admin && actor.companyId) {
        const allowed = await resolveDescendantCompanyIds(this.prisma, actor.companyId);
        if (!allowed.includes(dto.companyId)) throw new ForbiddenException('out_of_scope');
      }
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
      if (dto.creditCompanyIds) {
        await tx.creditOfficerCompany.deleteMany({ where: { userId: id } });
        if (dto.creditCompanyIds.length) {
          await tx.creditOfficerCompany.createMany({
            data: dto.creditCompanyIds.map((companyId) => ({ userId: id, companyId })),
          });
        }
      }
      if (dto.financeCompanyIds) {
        await tx.financeOfficerCompany.deleteMany({ where: { userId: id } });
        if (dto.financeCompanyIds.length) {
          await tx.financeOfficerCompany.createMany({
            data: dto.financeCompanyIds.map((companyId) => ({ userId: id, companyId })),
          });
        }
      }
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

    return toAdminUserUpdateDto(updated);
  }
}
