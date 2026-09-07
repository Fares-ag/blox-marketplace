import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GuarantorSessionStatus, Prisma, UserRole } from '@prisma/client';
import { ActivityService } from '../common/activity.service';
import { EncryptionService } from '../common/encryption.service';
import { IdentityService } from '../common/identity.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  decideIdentityHold,
  type IdentityCandidate,
  type IdentityHoldDecision,
} from './application-dedup';
import { productRuleEnforcementFrom, type ProductRuleEnforcement } from './application-rules';
import {
  birthYearOf,
  readCustomerSnapshot,
  type CustomerProfileFields,
  type NormalizedCustomerSnapshot,
} from './customer-snapshot';

/**
 * Intake support shared by the customer, staff and mobile application paths:
 * identity-level de-duplication (LOS FSD §5.3.1), the MISMATCHED_IDENTITY hold
 * with its audit trail and ops notification, default-lender tagging and the
 * product-rule enforcement flags.
 */
@Injectable()
export class ApplicationIntakeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
    private readonly encryption: EncryptionService,
    private readonly identity: IdentityService,
    private readonly config: ConfigService,
  ) {}

  ruleEnforcement(): ProductRuleEnforcement {
    return productRuleEnforcementFrom((key) => this.config.get<string>(key));
  }

  qidHash(qid: string | null | undefined): string | null {
    return this.encryption.qidHash(qid);
  }

  /**
   * Other accounts/applications carrying the same Qatar ID. Legacy accounts
   * created before the blind index existed are matched on the plaintext QID.
   */
  async evaluateIdentity(input: {
    userId: string;
    qid: string | null | undefined;
    name: string | null | undefined;
    birthYear: number | null | undefined;
  }): Promise<IdentityHoldDecision> {
    const qidHash = this.encryption.qidHash(input.qid);
    if (!qidHash) return null;
    const digits = String(input.qid ?? '').replace(/\D/g, '');

    const [users, applications] = await Promise.all([
      this.prisma.user.findMany({
        where: {
          id: { not: input.userId },
          OR: [{ qidHash }, ...(digits ? [{ qid: digits }] : [])],
        },
        select: { id: true, name: true, firstName: true, lastName: true, dateOfBirth: true },
        take: 25,
      }),
      this.prisma.application.findMany({
        where: { qidHash, customerUserId: { not: input.userId } },
        select: { customerUserId: true, customerSnapshot: true },
        orderBy: { createdAt: 'desc' },
        take: 25,
      }),
    ]);

    const matches: IdentityCandidate[] = [
      ...users.map((u) => ({
        userId: u.id,
        name: u.name || [u.firstName, u.lastName].filter(Boolean).join(' '),
        birthYear: u.dateOfBirth ? u.dateOfBirth.getUTCFullYear() : null,
        source: 'user' as const,
      })),
      ...applications.map((a) => {
        const snapshot = readCustomerSnapshot(a.customerSnapshot);
        return {
          userId: a.customerUserId,
          name: snapshot.full_name,
          birthYear: birthYearOf(snapshot),
          source: 'application' as const,
        };
      }),
    ];

    return decideIdentityHold(
      { userId: input.userId, name: input.name, birthYear: input.birthYear },
      matches,
    );
  }

  /** Column values that put a new application on hold. */
  holdColumns(decision: IdentityHoldDecision, now = new Date()) {
    if (!decision) return {};
    return {
      identityHoldReason: decision.reason,
      identityHoldAt: now,
      identityHoldClearedAt: null,
      identityHoldClearedById: null,
    };
  }

  /** Audit trail + ops notification for a hold that was just written. */
  async recordHold(input: {
    applicationId: string;
    companyId: string;
    actorUserId: string | null;
    decision: NonNullable<IdentityHoldDecision>;
  }): Promise<void> {
    await this.activity.log({
      actorUserId: input.actorUserId,
      entityType: 'application',
      entityId: input.applicationId,
      action: 'identity_hold',
      toValue: input.decision.reason,
      metadata: {
        reason: input.decision.reason,
        conflicts: input.decision.conflicts.map((c) => ({
          user_id: c.userId,
          source: c.source,
          name_mismatch: c.nameMismatch,
          birth_year_mismatch: c.birthYearMismatch,
        })),
      },
    });
    await this.notifyOps(
      input.companyId,
      [UserRole.credit_officer, UserRole.admin, UserRole.super_admin],
      'Identity hold on an application',
      'The Qatar ID on a new application is already on file under a different name or date of birth. Review and clear the hold.',
      `/applications/${input.applicationId}`,
    );
  }

  /**
   * The guarantor submit gate reads the consent session the guarantors module
   * writes: a session that captured its consents and was not cancelled since.
   */
  async guarantorConsentCompleted(applicationId: string): Promise<boolean> {
    const session = await this.prisma.guarantorConsentSession.findFirst({
      where: {
        applicationId,
        consentsCompletedAt: { not: null },
        status: { not: GuarantorSessionStatus.cancelled },
      },
      select: { id: true },
    });
    return !!session;
  }

  /** `FinancePartner.isDefaultLender` — lender of record for offers without a partner. */
  async defaultLenderId(): Promise<string | null> {
    const partner = await this.prisma.financePartner.findFirst({
      where: { isDefaultLender: true, active: true },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    });
    return partner?.id ?? null;
  }

  /**
   * Profile columns mirrored onto the customer account (only what was
   * provided). The Qatar ID is written through `IdentityService` so the
   * encrypted copy and blind index stay in step with the plaintext column
   * while it is still retained.
   */
  userProfileData(
    user: { name: string | null; phone: string | null; qid: string | null; qidEnc?: string | null },
    normalized: NormalizedCustomerSnapshot,
    opts?: { omitQid?: boolean },
  ): Prisma.UserUpdateInput {
    const keptQid = this.identity.readQid(user) || normalized.snapshot.qid || null;
    const profile: CustomerProfileFields = normalized.profile;
    const data: Prisma.UserUpdateInput = {
      name: user.name || normalized.snapshot.full_name,
      phone: user.phone || normalized.snapshot.phone,
    };
    if (!opts?.omitQid) {
      Object.assign(data, this.identity.prepareQidWrite(keptQid) ?? {});
    }
    if (profile.firstName) data.firstName = profile.firstName;
    if (profile.lastName) data.lastName = profile.lastName;
    if (profile.gender) data.gender = profile.gender;
    if (profile.dateOfBirth) data.dateOfBirth = profile.dateOfBirth;
    if (profile.nationality) data.nationality = profile.nationality;
    return data;
  }

  /**
   * Staff who should hear about an event on a company's application: every
   * credit/finance officer who can see the company (global scope or assigned,
   * holdings included via the assignment rows), the dealer's agents when asked
   * for, and admins. The link is portal-relative; BloxShell prefixes the portal
   * base path when rendering.
   */
  async notifyOps(
    companyId: string,
    roles: UserRole[],
    title: string | ((role: UserRole) => string),
    body: string,
    linkPath: string,
  ): Promise<void> {
    const or: Prisma.UserWhereInput[] = [];
    if (roles.includes(UserRole.credit_officer)) {
      or.push({ role: UserRole.credit_officer, creditScope: 'all' });
      or.push({ role: UserRole.credit_officer, creditCompanies: { some: { companyId } } });
    }
    if (roles.includes(UserRole.finance_officer)) {
      or.push({ role: UserRole.finance_officer, financeScope: 'all' });
      or.push({ role: UserRole.finance_officer, financeCompanies: { some: { companyId } } });
    }
    if (roles.includes(UserRole.dealer_agent)) {
      or.push({ role: UserRole.dealer_agent, companyId });
    }
    const adminRoles = roles.filter((r) => r === UserRole.admin || r === UserRole.super_admin);
    if (adminRoles.length) or.push({ role: { in: adminRoles } });
    if (or.length === 0) return;

    const targets = await this.prisma.user.findMany({
      where: { isActive: true, OR: or },
      select: { id: true, role: true },
    });
    for (const target of targets) {
      await this.activity.notify(
        target.id,
        typeof title === 'function' ? title(target.role) : title,
        body,
        linkPath,
      );
    }
  }
}
