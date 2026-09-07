import {
  BadRequestException,
  Body,
  Controller,
  Delete,
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
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { randomBytes } from 'node:crypto';
import { CurrentUser, Roles } from '../auth/guards';
import { AUTH_INSTANCE, type AuthInstance } from '../auth/auth.constants';
import { MailService } from '../mail/mail.service';
import { AppConfigService } from '../config/app-config.service';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityService } from '../common/activity.service';
import { PaginationQueryDto, resolvePagination } from '../common/pagination.dto';
import { isForeignKeyConstraintError } from '../common/prisma-errors';
import { toAdminUserDto, toAdminUserListResponse, toAdminUserProvisionDto, toAdminUserUpdateDto } from './user-response.dto';
import { resolveDescendantCompanyIds } from '../companies/company-hierarchy';
import {
  assertCanManageUserRole,
  assertCanProvisionRole,
  assertHomeBranchInCompany,
} from './user-provisioning.policy';

const HOME_BRANCH_SELECT = { select: { id: true, code: true, name: true } } as const;

class UpdateUserDto {
  @IsOptional() @IsString() @IsNotEmpty() name?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsEnum(UserRole) role?: UserRole;
  @IsOptional() @IsString() companyId?: string | null;
  @IsOptional() @IsEnum(OfficerScope) creditScope?: OfficerScope;
  @IsOptional() @IsEnum(OfficerScope) financeScope?: OfficerScope;
  @IsOptional() @IsArray() @IsString({ each: true }) creditCompanyIds?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) financeCompanyIds?: string[];
  /** Branch of the user's company; null clears it. Both spellings accepted. */
  @IsOptional() @IsString() home_branch_id?: string | null;
  @IsOptional() @IsString() homeBranchId?: string | null;
}

class CreateUserDto {
  @IsEmail() email!: string;
  @IsString() name!: string;
  @IsEnum(UserRole) role!: UserRole;
  @IsOptional() @IsString() companyId?: string;
  @IsOptional() @IsEnum(OfficerScope) creditScope?: OfficerScope;
  @IsOptional() @IsEnum(OfficerScope) financeScope?: OfficerScope;
  @IsOptional() @IsArray() @IsString({ each: true }) creditCompanyIds?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) financeCompanyIds?: string[];
  @IsOptional() @IsString() home_branch_id?: string | null;
  @IsOptional() @IsString() homeBranchId?: string | null;
}

class InviteDealerAgentDto {
  @IsEmail() @IsNotEmpty() email!: string;
  @IsString() @IsNotEmpty() name!: string;
  @IsOptional() @IsString() home_branch_id?: string | null;
  @IsOptional() @IsString() homeBranchId?: string | null;
}

class SetPasswordDto {
  @IsOptional() @IsString() @MinLength(12) password?: string;
  @IsOptional() @IsBoolean() sendEmail?: boolean;
}

/** `undefined` = not mentioned in the payload; `null`/'' = clear. */
function requestedHomeBranch(dto: {
  home_branch_id?: string | null;
  homeBranchId?: string | null;
}): string | null | undefined {
  const raw = dto.home_branch_id !== undefined ? dto.home_branch_id : dto.homeBranchId;
  if (raw === undefined) return undefined;
  return raw ? raw : null;
}

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
          company: { select: { name: true } },
          homeBranch: HOME_BRANCH_SELECT,
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
        homeBranch: HOME_BRANCH_SELECT,
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
      home_branch_id: requestedHomeBranch(dto),
    });
  }

  private async provisionUser(actor: User, dto: CreateUserDto) {
    assertCanProvisionRole(actor, dto.role);
    if (actor.role === UserRole.dealer_agent) {
      if (dto.role !== UserRole.dealer_agent || dto.companyId !== actor.companyId) {
        throw new ForbiddenException('forbidden_role');
      }
    }
    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new BadRequestException('email_taken');

    if (dto.role === UserRole.dealer_agent && !dto.companyId) {
      throw new BadRequestException('dealer_requires_company');
    }
    if (dto.role === UserRole.group_admin && !dto.companyId) {
      throw new BadRequestException('group_admin_requires_holding');
    }

    let companyName: string | null = null;
    if (dto.companyId) {
      const company = await this.prisma.company.findUnique({ where: { id: dto.companyId } });
      if (!company) throw new BadRequestException('company_not_found');
      companyName = company.name;
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
    }

    const homeBranchId = await this.resolveHomeBranch(requestedHomeBranch(dto), dto.companyId ?? null);

    const officerCompanyIds = [
      ...(dto.creditCompanyIds ?? []),
      ...(dto.financeCompanyIds ?? []),
    ];
    if (officerCompanyIds.length) {
      const uniqueIds = [...new Set(officerCompanyIds)];
      const found = await this.prisma.company.findMany({
        where: { id: { in: uniqueIds } },
        select: { id: true },
      });
      if (found.length !== uniqueIds.length) throw new BadRequestException('company_not_found');
      if (actor.role === UserRole.group_admin && actor.companyId) {
        const allowed = await resolveDescendantCompanyIds(this.prisma, actor.companyId);
        if (uniqueIds.some((id) => !allowed.includes(id))) throw new ForbiddenException('out_of_scope');
      }
    }

    const password = `Tmp!${randomBytes(18).toString('base64url')}`;
    const staffProvisioned = dto.role !== UserRole.customer;
    try {
      await this.auth.api.signUpEmail({
        body: { email, password, name: dto.name.trim() },
      });
    } catch {
      const raced = await this.prisma.user.findUnique({ where: { email } });
      if (raced) throw new BadRequestException('email_taken');
      throw new BadRequestException('user_create_failed');
    }
    const created = await this.prisma.user.findUnique({ where: { email } });
    if (!created) throw new BadRequestException('user_create_failed');

    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.user.update({
        where: { id: created.id },
        data: {
          role: dto.role,
          companyId: dto.companyId ?? null,
          homeBranchId: homeBranchId ?? null,
          creditScope: dto.creditScope ?? undefined,
          financeScope: dto.financeScope ?? undefined,
          emailVerified: staffProvisioned,
        },
        include: { homeBranch: HOME_BRANCH_SELECT },
      });
      if (dto.creditCompanyIds?.length) {
        await tx.creditOfficerCompany.createMany({
          data: dto.creditCompanyIds.map((companyId) => ({ userId: next.id, companyId })),
          skipDuplicates: true,
        });
      }
      if (dto.financeCompanyIds?.length) {
        await tx.financeOfficerCompany.createMany({
          data: dto.financeCompanyIds.map((companyId) => ({ userId: next.id, companyId })),
          skipDuplicates: true,
        });
      }
      return next;
    });

    const loginUrl = this.appConfig.portalSignInUrl(dto.role);
    if (staffProvisioned) {
      try {
        if (dto.role === UserRole.dealer_agent && companyName) {
          await this.mail.sendDealerAgentWelcomeEmail({
            to: email,
            name: dto.name.trim(),
            loginUrl,
            temporaryPassword: password,
            dealerName: companyName,
          });
        } else {
          await this.mail.sendStaffAccountCreatedEmail(email, dto.name.trim(), loginUrl);
        }
      } catch {
        // Admin receives credentials in the API response; email is best-effort.
      }
    } else {
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
    }

    await this.activity.log({
      actorUserId: actor.id,
      entityType: 'user',
      entityId: updated.id,
      action: 'user_created',
      toValue: updated.role,
      metadata: homeBranchId ? { homeBranchId } : undefined,
    });
    return toAdminUserProvisionDto(updated, {
      temporaryPassword: password,
      loginUrl,
      companyName,
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
  @Roles(UserRole.admin, UserRole.super_admin, UserRole.group_admin)
  @Patch(':id')
  async update(
    @CurrentUser() actor: User,
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
  ) {
    const target = await this.prisma.user.findUnique({ where: { id } });
    if (!target) throw new NotFoundException();

    assertCanManageUserRole(actor, target.role, dto.role);

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

    // The home branch must belong to the company the user ends up in; moving
    // company without naming a branch drops the old (now foreign) branch.
    const nextCompanyId = dto.companyId === undefined ? target.companyId : dto.companyId;
    let homeBranchId = await this.resolveHomeBranch(requestedHomeBranch(dto), nextCompanyId);
    if (homeBranchId === undefined && dto.companyId !== undefined && dto.companyId !== target.companyId) {
      homeBranchId = null;
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.user.update({
        where: { id },
        data: {
          name: dto.name?.trim() ?? undefined,
          isActive: dto.isActive ?? undefined,
          role: dto.role ?? undefined,
          companyId: dto.companyId === undefined ? undefined : dto.companyId,
          homeBranchId: homeBranchId === undefined ? undefined : homeBranchId,
          creditScope: dto.creditScope ?? undefined,
          financeScope: dto.financeScope ?? undefined,
        },
        include: { homeBranch: HOME_BRANCH_SELECT },
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
          ...(homeBranchId !== undefined ? { homeBranchId } : {}),
          ...(dto.creditScope !== undefined ? { creditScope: dto.creditScope } : {}),
          ...(dto.financeScope !== undefined ? { financeScope: dto.financeScope } : {}),
        },
      },
    });

    return toAdminUserUpdateDto(updated);
  }

  /** Admin sets a new password (generates one when omitted) and revokes all sessions. */
  @Roles(UserRole.admin, UserRole.super_admin, UserRole.group_admin)
  @Post(':id/set-password')
  async setPassword(
    @CurrentUser() actor: User,
    @Param('id') id: string,
    @Body() dto: SetPasswordDto,
  ) {
    const target = await this.loadManagedUser(actor, id);
    if (target.id === actor.id) throw new BadRequestException('cannot_modify_own_access');

    const password = dto.password?.trim() || `Tmp!${randomBytes(18).toString('base64url')}`;
    const ctx = await this.auth.$context;
    const hash = await ctx.password.hash(password);
    await ctx.internalAdapter.updatePassword(target.id, hash);

    await this.prisma.$transaction(async (tx) => {
      await tx.session.deleteMany({ where: { userId: target.id } });
      await tx.mobileRefreshToken.updateMany({
        where: { userId: target.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });

    const loginUrl = this.appConfig.portalSignInUrl(target.role);
    if (dto.sendEmail !== false) {
      try {
        await this.mail.sendAdminPasswordResetEmail({
          to: target.email,
          name: target.name,
          loginUrl,
          temporaryPassword: password,
        });
      } catch {
        // Admin receives credentials in the response; email is best-effort.
      }
    }

    await this.activity.log({
      actorUserId: actor.id,
      entityType: 'user',
      entityId: target.id,
      action: 'user_password_reset',
      metadata: { emailed: dto.sendEmail !== false },
    });

    return toAdminUserProvisionDto(target, {
      temporaryPassword: password,
      loginUrl,
      companyName: target.company?.name ?? null,
    });
  }

  /** Remove a user with no linked applications or other blocking records. */
  @Roles(UserRole.admin, UserRole.super_admin, UserRole.group_admin)
  @Delete(':id')
  async remove(@CurrentUser() actor: User, @Param('id') id: string) {
    const target = await this.loadManagedUser(actor, id);
    if (target.id === actor.id) throw new BadRequestException('cannot_modify_own_access');

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.creditOfficerCompany.deleteMany({ where: { userId: id } });
        await tx.financeOfficerCompany.deleteMany({ where: { userId: id } });
        await tx.session.deleteMany({ where: { userId: id } });
        await tx.mobileRefreshToken.deleteMany({ where: { userId: id } });
        await tx.deviceToken.deleteMany({ where: { userId: id } });
        await tx.account.deleteMany({ where: { userId: id } });
        await tx.user.delete({ where: { id } });
      });
    } catch (err) {
      if (isForeignKeyConstraintError(err)) {
        throw new BadRequestException('user_has_dependencies');
      }
      throw err;
    }

    await this.activity.log({
      actorUserId: actor.id,
      entityType: 'user',
      entityId: id,
      action: 'user_deleted',
      fromValue: target.email,
    });

    return { ok: true };
  }

  /**
   * Resolves a requested home branch against the user's company.
   * `undefined` = untouched, `null` = clear; anything else must be a branch
   * of `companyId` (400 branch_not_in_company / branch_requires_company).
   */
  private async resolveHomeBranch(
    requested: string | null | undefined,
    companyId: string | null,
  ): Promise<string | null | undefined> {
    if (requested === undefined) return undefined;
    if (requested === null) return null;
    const branch = await this.prisma.branch.findUnique({
      where: { id: requested },
      select: { id: true, companyId: true },
    });
    assertHomeBranchInCompany(branch, companyId);
    return requested;
  }

  private async loadManagedUser(actor: User, id: string) {
    const target = await this.prisma.user.findUnique({
      where: { id },
      include: { company: { select: { name: true } }, homeBranch: HOME_BRANCH_SELECT },
    });
    if (!target) throw new NotFoundException();
    assertCanManageUserRole(actor, target.role);
    if (actor.role === UserRole.group_admin && actor.companyId) {
      const allowed = await resolveDescendantCompanyIds(this.prisma, actor.companyId);
      const inTree =
        (target.companyId && allowed.includes(target.companyId)) ||
        (await this.prisma.creditOfficerCompany.count({
          where: { userId: id, companyId: { in: allowed } },
        })) > 0 ||
        (await this.prisma.financeOfficerCompany.count({
          where: { userId: id, companyId: { in: allowed } },
        })) > 0;
      if (!inTree) throw new NotFoundException();
    }
    return target;
  }
}
