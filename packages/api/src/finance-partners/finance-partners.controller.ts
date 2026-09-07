import {
  Body,
  ConflictException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import {
  BreOwnership,
  CrmAdapter,
  FinancePartnerEngagementMode,
  User,
  UserRole,
} from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { CurrentUser, Roles } from '../auth/guards';
import { ActivityService } from '../common/activity.service';
import { isUniqueConstraintError } from '../common/prisma-errors';
import { PrismaService } from '../prisma/prisma.service';
import {
  assertDefaultLenderEligible,
  planDefaultLenderSwitch,
  type DefaultLenderPlan,
} from './default-lender';
import {
  FINANCE_PARTNER_INCLUDE,
  toFinancePartnerAdminDto,
  toFinancePartnerBranchDto,
} from './finance-partner-response.dto';

const CODE_PATTERN = /^[a-z0-9][a-z0-9_-]*$/i;

class CreateFinancePartnerDto {
  @IsString() @IsNotEmpty() @MaxLength(40) @Matches(CODE_PATTERN) code!: string;
  @IsString() @IsNotEmpty() @MaxLength(120) name!: string;
  @IsEnum(FinancePartnerEngagementMode) engagement_mode!: FinancePartnerEngagementMode;
  @IsEnum(BreOwnership) bre_ownership!: BreOwnership;
  @IsOptional() @IsBoolean() is_default_lender?: boolean;
  @IsOptional() @IsString() @MaxLength(120) contact_name?: string | null;
  @IsOptional() @IsString() @MaxLength(160) contact_email?: string | null;
  @IsOptional() @IsString() @MaxLength(40) contact_phone?: string | null;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string | null;
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @IsEnum(CrmAdapter) crm_adapter?: CrmAdapter;
}

class UpdateFinancePartnerDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(40) @Matches(CODE_PATTERN) code?: string;
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(120) name?: string;
  @IsOptional() @IsEnum(FinancePartnerEngagementMode) engagement_mode?: FinancePartnerEngagementMode;
  @IsOptional() @IsEnum(BreOwnership) bre_ownership?: BreOwnership;
  @IsOptional() @IsBoolean() is_default_lender?: boolean;
  @IsOptional() @IsString() @MaxLength(120) contact_name?: string | null;
  @IsOptional() @IsString() @MaxLength(160) contact_email?: string | null;
  @IsOptional() @IsString() @MaxLength(40) contact_phone?: string | null;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string | null;
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @IsEnum(CrmAdapter) crm_adapter?: CrmAdapter;
}

class CreateFinancePartnerBranchDto {
  @IsString() @IsNotEmpty() @MaxLength(32) code!: string;
  @IsString() @IsNotEmpty() @MaxLength(120) name!: string;
  @IsOptional() @IsString() @MaxLength(80) city?: string | null;
}

class UpdateFinancePartnerBranchDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(120) name?: string;
  @IsOptional() @IsString() @MaxLength(80) city?: string | null;
  @IsOptional() @IsBoolean() active?: boolean;
}

const READ_ROLES: UserRole[] = [
  UserRole.admin,
  UserRole.super_admin,
  UserRole.group_admin,
  UserRole.credit_officer,
  UserRole.finance_officer,
  UserRole.dealer_agent,
];

function optionalText(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

/**
 * Finance Provider Master (LOS FSD §5.8): engagement mode and rules-engine
 * ownership are fixed per provider; exactly one provider is the default
 * lender of record for offers that carry no partner.
 */
@Controller('finance-partners')
export class FinancePartnersController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
  ) {}

  /** Every staff role can read the master (lender tagging, pickers); inactive providers are included. */
  @Roles(...READ_ROLES)
  @Get()
  async list() {
    const rows = await this.prisma.financePartner.findMany({
      include: FINANCE_PARTNER_INCLUDE,
      orderBy: [{ isDefaultLender: 'desc' }, { name: 'asc' }],
    });
    return rows.map((row) => toFinancePartnerAdminDto(row));
  }

  @Roles(UserRole.admin, UserRole.super_admin)
  @Post()
  async create(@CurrentUser() user: User, @Body() dto: CreateFinancePartnerDto) {
    const code = dto.code.trim().toLowerCase();
    const active = dto.active ?? true;
    const isDefault = dto.is_default_lender ?? false;
    assertDefaultLenderEligible({ active }, isDefault);

    let created;
    try {
      created = await this.prisma.$transaction(async (tx) => {
        if (isDefault) {
          const partners = await tx.financePartner.findMany({
            select: { id: true, isDefaultLender: true },
          });
          const plan = planDefaultLenderSwitch(partners, '__new__', true);
          if (plan.clearIds.length) {
            await tx.financePartner.updateMany({
              where: { id: { in: plan.clearIds } },
              data: { isDefaultLender: false },
            });
          }
        }
        return tx.financePartner.create({
          data: {
            code,
            name: dto.name.trim(),
            active,
            crmAdapter: dto.crm_adapter ?? CrmAdapter.none,
            engagementMode: dto.engagement_mode,
            breOwnership: dto.bre_ownership,
            isDefaultLender: isDefault,
            contactName: optionalText(dto.contact_name),
            contactEmail: optionalText(dto.contact_email),
            contactPhone: optionalText(dto.contact_phone),
            notes: optionalText(dto.notes),
          },
          include: FINANCE_PARTNER_INCLUDE,
        });
      });
    } catch (err) {
      if (isUniqueConstraintError(err)) throw new ConflictException('finance_partner_code_exists');
      throw err;
    }

    await this.activity.log({
      actorUserId: user.id,
      entityType: 'finance_partner',
      entityId: created.id,
      action: 'finance_partner_created',
      toValue: created.code,
      metadata: {
        engagement_mode: created.engagementMode,
        bre_ownership: created.breOwnership,
        is_default_lender: created.isDefaultLender,
      },
    });
    if (isDefault) {
      await this.activity.log({
        actorUserId: user.id,
        entityType: 'finance_partner',
        entityId: created.id,
        action: 'default_lender_set',
        toValue: created.code,
      });
    }
    return toFinancePartnerAdminDto(created);
  }

  @Roles(UserRole.admin, UserRole.super_admin)
  @Patch(':id')
  async update(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: UpdateFinancePartnerDto,
  ) {
    const existing = await this.prisma.financePartner.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('finance_partner_not_found');

    const nextActive = dto.active ?? existing.active;
    const nextDefault = dto.is_default_lender ?? existing.isDefaultLender;
    assertDefaultLenderEligible({ active: nextActive }, nextDefault);

    const changes = {
      ...(dto.code !== undefined ? { code: dto.code.trim().toLowerCase() } : {}),
      ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
      ...(dto.engagement_mode !== undefined ? { engagementMode: dto.engagement_mode } : {}),
      ...(dto.bre_ownership !== undefined ? { breOwnership: dto.bre_ownership } : {}),
      ...(dto.contact_name !== undefined ? { contactName: optionalText(dto.contact_name) } : {}),
      ...(dto.contact_email !== undefined ? { contactEmail: optionalText(dto.contact_email) } : {}),
      ...(dto.contact_phone !== undefined ? { contactPhone: optionalText(dto.contact_phone) } : {}),
      ...(dto.notes !== undefined ? { notes: optionalText(dto.notes) } : {}),
      ...(dto.active !== undefined ? { active: dto.active } : {}),
      ...(dto.crm_adapter !== undefined ? { crmAdapter: dto.crm_adapter } : {}),
    };

    let plan: DefaultLenderPlan = {
      clearIds: [],
      targetIsDefault: existing.isDefaultLender,
      changed: false,
    };
    let updated;
    try {
      updated = await this.prisma.$transaction(async (tx) => {
        // Default-lender exclusivity: clear every other partner in the same transaction.
        const partners = await tx.financePartner.findMany({
          select: { id: true, isDefaultLender: true },
        });
        plan = planDefaultLenderSwitch(partners, id, dto.is_default_lender);
        if (plan.clearIds.length) {
          await tx.financePartner.updateMany({
            where: { id: { in: plan.clearIds } },
            data: { isDefaultLender: false },
          });
        }
        return tx.financePartner.update({
          where: { id },
          data: {
            ...changes,
            ...(dto.is_default_lender !== undefined ? { isDefaultLender: plan.targetIsDefault } : {}),
          },
          include: FINANCE_PARTNER_INCLUDE,
        });
      });
    } catch (err) {
      if (isUniqueConstraintError(err)) throw new ConflictException('finance_partner_code_exists');
      throw err;
    }

    await this.activity.log({
      actorUserId: user.id,
      entityType: 'finance_partner',
      entityId: id,
      action: 'finance_partner_updated',
      fromValue: existing.active ? 'active' : 'inactive',
      toValue: updated.active ? 'active' : 'inactive',
      metadata: {
        changes: {
          ...changes,
          ...(dto.is_default_lender !== undefined ? { isDefaultLender: plan.targetIsDefault } : {}),
        },
      },
    });
    if (dto.is_default_lender !== undefined && plan.changed) {
      await this.activity.log({
        actorUserId: user.id,
        entityType: 'finance_partner',
        entityId: id,
        action: plan.targetIsDefault ? 'default_lender_set' : 'default_lender_cleared',
        fromValue: existing.isDefaultLender ? existing.code : null,
        toValue: plan.targetIsDefault ? updated.code : null,
        metadata: plan.clearIds.length ? { cleared_partner_ids: plan.clearIds } : undefined,
      });
    }
    return toFinancePartnerAdminDto(updated);
  }

  @Roles(UserRole.admin, UserRole.super_admin)
  @Post(':id/branches')
  async createBranch(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: CreateFinancePartnerBranchDto,
  ) {
    await this.requirePartner(id);
    let branch;
    try {
      branch = await this.prisma.financePartnerBranch.create({
        data: {
          partnerId: id,
          code: dto.code.trim(),
          name: dto.name.trim(),
          city: optionalText(dto.city),
        },
      });
    } catch (err) {
      if (isUniqueConstraintError(err)) {
        throw new ConflictException('finance_partner_branch_code_exists');
      }
      throw err;
    }
    await this.activity.log({
      actorUserId: user.id,
      entityType: 'finance_partner_branch',
      entityId: branch.id,
      action: 'finance_partner_branch_created',
      toValue: branch.code,
      metadata: { partner_id: id, name: branch.name },
    });
    return toFinancePartnerBranchDto(branch);
  }

  @Roles(UserRole.admin, UserRole.super_admin)
  @Patch(':id/branches/:branchId')
  async updateBranch(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Param('branchId') branchId: string,
    @Body() dto: UpdateFinancePartnerBranchDto,
  ) {
    const existing = await this.prisma.financePartnerBranch.findFirst({
      where: { id: branchId, partnerId: id },
    });
    if (!existing) throw new NotFoundException('finance_partner_branch_not_found');

    const changes = {
      ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
      ...(dto.city !== undefined ? { city: optionalText(dto.city) } : {}),
      ...(dto.active !== undefined ? { active: dto.active } : {}),
    };
    const branch = await this.prisma.financePartnerBranch.update({
      where: { id: existing.id },
      data: changes,
    });
    await this.activity.log({
      actorUserId: user.id,
      entityType: 'finance_partner_branch',
      entityId: branch.id,
      action: 'finance_partner_branch_updated',
      fromValue: existing.active ? 'active' : 'inactive',
      toValue: branch.active ? 'active' : 'inactive',
      metadata: { partner_id: id, changes },
    });
    return toFinancePartnerBranchDto(branch);
  }

  private async requirePartner(id: string) {
    const partner = await this.prisma.financePartner.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!partner) throw new NotFoundException('finance_partner_not_found');
    return partner;
  }
}
