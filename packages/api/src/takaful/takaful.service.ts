import path from 'node:path';
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ApplicationStatus, Prisma, TakafulPolicy, TakafulStatus, User, UserRole } from '@prisma/client';
import type { TakafulPolicyDto } from '../../../shared/src/types/customer-platform';
import { assertApplicationCanView } from '../applications/application-access';
import { ActivityService } from '../common/activity.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { parseIsoDate } from '../customers/customer-profile';
import { startOfUtcDay } from '../customers/vault-logic';
import { ridersFromJson, TAKAFUL_DECLARATION_VERSION, toTakafulPolicyDto, type TakafulCoverageType } from './takaful-dto';

export type TakafulPolicyInput = {
  provider?: string;
  policy_number?: string;
  coverage_type?: TakafulCoverageType;
  coverage_amount?: number | null;
  premium_amount?: number | null;
  effective_from?: string | null;
  expires_at?: string | null;
  riders?: string[];
};

export type DeclareTakafulInput = TakafulPolicyInput & {
  provider: string;
  policy_number: string;
  coverage_type: TakafulCoverageType;
  declaration_accepted: boolean;
};

export type TakafulFile = { buffer: Buffer; contentType: string; filename: string };

type ApplicationRef = { id: string; customerUserId: string; companyId: string; status: ApplicationStatus };

/** Policies the customer can no longer edit: verified cover and closed records. */
const LOCKED_STATUSES: TakafulStatus[] = [TakafulStatus.active, TakafulStatus.closed];

/**
 * Takaful (vehicle insurance) declarations and policies on an application.
 * Customers declare and update; ops verify (→ active); the reminder cron
 * expires and nudges renewals.
 */
@Injectable()
export class TakafulService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly activity: ActivityService,
  ) {}

  async listForCustomer(user: User, applicationId: string): Promise<TakafulPolicyDto[]> {
    const app = await this.ownedApplication(user, applicationId);
    return this.listDto(app.id);
  }

  async listForOps(user: User, applicationId: string): Promise<TakafulPolicyDto[]> {
    const app = await this.viewableApplication(user, applicationId);
    return this.listDto(app.id);
  }

  async declare(user: User, applicationId: string, input: DeclareTakafulInput): Promise<TakafulPolicyDto> {
    const app = await this.ownedApplication(user, applicationId);
    if (app.status === ApplicationStatus.completed) throw new ConflictException('application_completed');
    if (!input.declaration_accepted) throw new BadRequestException('takaful_declaration_required');
    const dates = this.parseDates(input);

    const policy = await this.prisma.takafulPolicy.create({
      data: {
        applicationId: app.id,
        provider: input.provider.trim(),
        policyNumber: input.policy_number.trim(),
        coverageType: input.coverage_type,
        coverageAmount: input.coverage_amount ?? null,
        premiumAmount: input.premium_amount ?? null,
        effectiveFrom: dates.effectiveFrom,
        expiresAt: dates.expiresAt,
        riders: input.riders ? ridersFromJson(input.riders) : undefined,
        status: TakafulStatus.declared,
        declarationAcceptedAt: new Date(),
        declarationVersion: TAKAFUL_DECLARATION_VERSION,
        createdByUserId: user.id,
      },
    });

    await this.activity.log({
      actorUserId: user.id,
      entityType: 'takaful_policy',
      entityId: policy.id,
      action: 'takaful_declared',
      toValue: TakafulStatus.declared,
      metadata: {
        application_id: app.id,
        provider: policy.provider,
        coverage_type: policy.coverageType,
        declaration_version: TAKAFUL_DECLARATION_VERSION,
      },
    });
    return toTakafulPolicyDto(policy);
  }

  async update(user: User, applicationId: string, policyId: string, input: TakafulPolicyInput): Promise<TakafulPolicyDto> {
    const app = await this.ownedApplication(user, applicationId);
    const policy = await this.policyOf(app.id, policyId);
    if (LOCKED_STATUSES.includes(policy.status)) throw new ConflictException('takaful_policy_locked');
    const dates = this.parseDates(input);

    const data: Prisma.TakafulPolicyUpdateInput = {};
    const changed: string[] = [];
    if (input.provider !== undefined) {
      data.provider = input.provider.trim();
      changed.push('provider');
    }
    if (input.policy_number !== undefined) {
      data.policyNumber = input.policy_number.trim();
      changed.push('policy_number');
    }
    if (input.coverage_type !== undefined) {
      data.coverageType = input.coverage_type;
      changed.push('coverage_type');
    }
    if (input.coverage_amount !== undefined) {
      data.coverageAmount = input.coverage_amount;
      changed.push('coverage_amount');
    }
    if (input.premium_amount !== undefined) {
      data.premiumAmount = input.premium_amount;
      changed.push('premium_amount');
    }
    if (input.effective_from !== undefined) {
      data.effectiveFrom = dates.effectiveFrom;
      changed.push('effective_from');
    }
    if (input.expires_at !== undefined) {
      data.expiresAt = dates.expiresAt;
      // A new expiry restarts the reminder ladder.
      data.lastReminderKind = null;
      data.lastReminderAt = null;
      changed.push('expires_at');
    }
    if (input.riders !== undefined) {
      data.riders = ridersFromJson(input.riders);
      changed.push('riders');
    }

    // Renewal: an expired policy with a future expiry goes back to `declared` for re-verification.
    let toStatus: TakafulStatus | null = null;
    if (
      policy.status === TakafulStatus.expired &&
      dates.expiresAt &&
      dates.expiresAt.getTime() >= startOfUtcDay().getTime()
    ) {
      toStatus = TakafulStatus.declared;
      data.status = toStatus;
      data.verifiedAt = null;
      data.verifiedById = null;
    }

    if (!changed.length) return toTakafulPolicyDto(policy);

    const updated = await this.prisma.takafulPolicy.update({ where: { id: policy.id }, data });
    await this.activity.log({
      actorUserId: user.id,
      entityType: 'takaful_policy',
      entityId: policy.id,
      action: 'takaful_updated',
      fromValue: policy.status,
      toValue: toStatus ?? policy.status,
      metadata: { application_id: app.id, fields: changed },
    });
    return toTakafulPolicyDto(updated);
  }

  async uploadDocument(
    user: User,
    applicationId: string,
    policyId: string,
    file: Express.Multer.File | undefined,
  ): Promise<TakafulPolicyDto> {
    const app = await this.ownedApplication(user, applicationId);
    const policy = await this.policyOf(app.id, policyId);
    if (LOCKED_STATUSES.includes(policy.status)) throw new ConflictException('takaful_policy_locked');
    this.storage.assertCustomerUploadFile(file);
    const upload = file as Express.Multer.File;

    const documentPath = await this.storage.uploadTakafulDocument(upload, app.id, policy.id);
    const updated = await this.prisma.takafulPolicy.update({
      where: { id: policy.id },
      data: { documentPath, documentMime: upload.mimetype, status: TakafulStatus.pending_verification },
    });

    await this.activity.log({
      actorUserId: user.id,
      entityType: 'takaful_policy',
      entityId: policy.id,
      action: 'takaful_document_uploaded',
      fromValue: policy.status,
      toValue: TakafulStatus.pending_verification,
      metadata: { application_id: app.id, mime_type: upload.mimetype },
    });
    await this.notifyVerifiers(app.companyId, app.id, policy.policyNumber);
    return toTakafulPolicyDto(updated);
  }

  /** Owner or any staff member who can view the application. */
  async downloadDocument(user: User, applicationId: string, policyId: string): Promise<TakafulFile> {
    const app =
      user.role === UserRole.customer
        ? await this.ownedApplication(user, applicationId)
        : await this.viewableApplication(user, applicationId);
    const policy = await this.policyOf(app.id, policyId);
    if (!policy.documentPath) throw new NotFoundException('takaful_document_not_found');
    const file = await this.storage.readKyc(policy.documentPath);
    const ext = path.extname(policy.documentPath) || '';
    const filename = `takaful-${(policy.policyNumber ?? policy.id).replace(/[^\w.-]+/g, '_')}${ext}`;
    return { buffer: file.buffer, contentType: policy.documentMime ?? file.contentType, filename };
  }

  async verify(user: User, applicationId: string, policyId: string): Promise<TakafulPolicyDto> {
    const app = await this.viewableApplication(user, applicationId);
    const policy = await this.policyOf(app.id, policyId);
    if (policy.status === TakafulStatus.active) throw new ConflictException('takaful_already_active');
    if (policy.status !== TakafulStatus.declared && policy.status !== TakafulStatus.pending_verification) {
      throw new ConflictException('invalid_status_transition');
    }

    const updated = await this.prisma.takafulPolicy.update({
      where: { id: policy.id },
      data: { status: TakafulStatus.active, verifiedAt: new Date(), verifiedById: user.id },
    });
    await this.activity.log({
      actorUserId: user.id,
      entityType: 'takaful_policy',
      entityId: policy.id,
      action: 'takaful_verified',
      fromValue: policy.status,
      toValue: TakafulStatus.active,
      metadata: { application_id: app.id },
    });
    await this.activity.notify(
      app.customerUserId,
      'Takaful policy verified',
      `Your takaful policy${policy.policyNumber ? ` ${policy.policyNumber}` : ''} has been verified and is now active.`,
      `/app/applications/${app.id}`,
    );
    return toTakafulPolicyDto(updated);
  }

  private async listDto(applicationId: string): Promise<TakafulPolicyDto[]> {
    const policies = await this.prisma.takafulPolicy.findMany({
      where: { applicationId },
      orderBy: { createdAt: 'desc' },
    });
    const now = new Date();
    return policies.map((p) => toTakafulPolicyDto(p, now));
  }

  private async loadApplication(applicationId: string): Promise<ApplicationRef | null> {
    return this.prisma.application.findUnique({
      where: { id: applicationId },
      select: { id: true, customerUserId: true, companyId: true, status: true },
    });
  }

  private async ownedApplication(user: User, applicationId: string): Promise<ApplicationRef> {
    const app = await this.loadApplication(applicationId);
    if (!app || app.customerUserId !== user.id) throw new NotFoundException('application_not_found');
    return app;
  }

  private async viewableApplication(user: User, applicationId: string): Promise<ApplicationRef> {
    const app = await this.loadApplication(applicationId);
    if (!app) throw new NotFoundException('application_not_found');
    await assertApplicationCanView(this.prisma, user, app);
    return app;
  }

  private async policyOf(applicationId: string, policyId: string): Promise<TakafulPolicy> {
    const policy = await this.prisma.takafulPolicy.findFirst({ where: { id: policyId, applicationId } });
    if (!policy) throw new NotFoundException('takaful_policy_not_found');
    return policy;
  }

  private parseDates(input: TakafulPolicyInput): { effectiveFrom: Date | null; expiresAt: Date | null } {
    const effectiveFrom = input.effective_from ? parseIsoDate(input.effective_from) : null;
    if (input.effective_from && !effectiveFrom) throw new BadRequestException('effective_from_invalid');
    const expiresAt = input.expires_at ? parseIsoDate(input.expires_at) : null;
    if (input.expires_at && !expiresAt) throw new BadRequestException('expires_at_invalid');
    if (effectiveFrom && expiresAt && expiresAt.getTime() < effectiveFrom.getTime()) {
      throw new BadRequestException('expires_before_effective');
    }
    return { effectiveFrom, expiresAt };
  }

  /** Credit/finance officers who can see the company, plus admins, hear about a policy awaiting verification. */
  private async notifyVerifiers(companyId: string, applicationId: string, policyNumber: string | null) {
    const targets = await this.prisma.user.findMany({
      where: {
        isActive: true,
        OR: [
          { role: UserRole.credit_officer, creditScope: 'all' },
          { role: UserRole.credit_officer, creditCompanies: { some: { companyId } } },
          { role: UserRole.finance_officer, financeScope: 'all' },
          { role: UserRole.finance_officer, financeCompanies: { some: { companyId } } },
          { role: { in: [UserRole.admin, UserRole.super_admin] } },
        ],
      },
      select: { id: true },
    });
    for (const target of targets) {
      await this.activity.notify(
        target.id,
        'Takaful policy awaiting verification',
        `A customer uploaded takaful policy${policyNumber ? ` ${policyNumber}` : ''} for verification.`,
        `/applications/${applicationId}`,
      );
    }
  }
}
