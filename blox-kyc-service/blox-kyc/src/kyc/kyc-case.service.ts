import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { KycCase, KycCaseStatus, KycCheckType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { FieldCryptoService } from '../common/crypto/field-crypto.service';
import type { CallerContext } from '../common/auth/service-auth.guard';
import { assertTransition, isTerminal } from './case-engine/case-state-machine';
import { DecisioningService, type LatestCheck } from './case-engine/decisioning.service';
import { CheckRegistryService } from './checks/check-registry.service';
import type { CheckContext } from './checks/check.types';
import { ConsentService } from './consent/consent.service';
import { CreateCaseDto } from './dto/create-case.dto';
import { RecordBindingDto } from './dto/record-binding.dto';
import { RegisterDocumentDto } from './dto/register-document.dto';
import { ReviewDecisionDto } from './dto/review-decision.dto';

const OPS_ROLES = new Set(['credit_officer', 'admin', 'super_admin']);

@Injectable()
export class KycCaseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly crypto: FieldCryptoService,
    private readonly decisioning: DecisioningService,
    private readonly checks: CheckRegistryService,
    private readonly consent: ConsentService,
  ) {}

  /** Idempotent per applicationId — returns the existing case if present. */
  async createCase(dto: CreateCaseDto, actor: CallerContext): Promise<KycCase> {
    const existing = await this.prisma.kycCase.findUnique({ where: { applicationId: dto.applicationId } });
    if (existing) return existing;

    const created = await this.prisma.kycCase.create({
      data: {
        applicationId: dto.applicationId,
        customerUserId: dto.customerUserId,
        companyId: dto.companyId,
        status: 'created',
      },
    });
    await this.audit.record({ caseId: created.id, action: 'case.created', actor, toValue: 'created' });
    return created;
  }

  async getCase(caseId: string, actor: CallerContext): Promise<KycCase> {
    const kase = await this.prisma.kycCase.findUnique({
      where: { id: caseId },
      include: { checks: true, documents: true, bindings: true, consents: true, screenings: true, statements: true },
    });
    if (!kase) throw new NotFoundException('case_not_found');
    this.assertScope(actor, kase.companyId);
    await this.audit.record({ caseId, action: 'case.read', actor });
    return kase;
  }

  async registerDocument(caseId: string, dto: RegisterDocumentDto, actor: CallerContext): Promise<void> {
    const kase = await this.load(caseId, actor);
    await this.moveIfNeeded(kase, 'capturing', actor);
    await this.prisma.identityDocument.create({
      data: {
        caseId,
        docType: dto.docType,
        storageRef: dto.storageRef,
        extractedEncrypted: dto.extractedFields ? this.crypto.encryptJson(dto.extractedFields) : null,
      },
    });
    await this.audit.record({ caseId, action: 'document.registered', actor, toValue: dto.docType });
  }

  async recordBinding(caseId: string, dto: RecordBindingDto, actor: CallerContext): Promise<void> {
    const kase = await this.load(caseId, actor);
    if (!OPS_ROLES.has(actor.role ?? '')) {
      throw new ForbiddenException('binding_requires_ops_role');
    }
    await this.prisma.identityBinding.create({
      data: {
        caseId: kase.id,
        method: dto.method,
        attesterUserId: dto.attesterUserId,
        evidenceRef: dto.evidenceRef,
        note: dto.note,
      },
    });
    await this.audit.record({
      caseId,
      action: 'identity_binding.recorded',
      actor,
      toValue: dto.method,
      metadata: { attesterUserId: dto.attesterUserId },
    });
  }

  /** Runs all v1 checks, records results, then routes the case per decisioning. */
  async runChecks(caseId: string, actor: CallerContext): Promise<KycCase> {
    const kase = await this.load(caseId, actor);
    if (isTerminal(kase.status)) throw new ConflictException('case_terminal');

    await this.moveIfNeeded(kase, 'checks_running', actor);

    const ctx: CheckContext = {
      caseId: kase.id,
      applicationId: kase.applicationId,
      customerUserId: kase.customerUserId,
      companyId: kase.companyId,
    };

    const required = this.decisioning.requiredForV1();
    for (const type of required) {
      const result = await this.checks.run(type as KycCheckType, ctx);
      await this.prisma.kycCheck.create({
        data: {
          caseId: kase.id,
          type: type as KycCheckType,
          status: result.status,
          score: result.score,
          provider: result.provider,
          providerVersion: result.providerVersion,
          reason: result.reason,
          evidence: (result.evidence ?? undefined) as Prisma.InputJsonValue | undefined,
        },
      });
    }

    const latest = await this.latestChecks(kase.id);
    const outcome = this.decisioning.decide(required, latest);

    // needs_review must pass through the reviewing state per the machine.
    const target: KycCaseStatus = outcome.nextStatus;
    const fresh = await this.prisma.kycCase.findUniqueOrThrow({ where: { id: kase.id } });
    return this.transition(fresh, target, actor, outcome.reason, outcome.nextStatus === 'approved' ? 'approved' : undefined);
  }

  /** Ops decision from the review console. */
  async decide(caseId: string, dto: ReviewDecisionDto, actor: CallerContext): Promise<KycCase> {
    const kase = await this.load(caseId, actor);
    if (!OPS_ROLES.has(actor.role ?? '')) throw new ForbiddenException('decision_requires_ops_role');

    let current = kase;
    if (current.status === 'needs_review' || current.status === 'step_up_required') {
      current = await this.transition(current, 'reviewing', actor, 'review_started');
    }
    if (current.status !== 'reviewing') {
      throw new ConflictException(`cannot_decide_from:${current.status}`);
    }
    const target: KycCaseStatus = dto.decision === 'approved' ? 'approved' : 'rejected';
    return this.transition(current, target, actor, dto.reason, dto.decision, dto.reviewerUserId ?? actor.userId);
  }

  async listQueue(actor: CallerContext): Promise<KycCase[]> {
    const where: Prisma.KycCaseWhereInput = { status: { in: ['needs_review', 'reviewing', 'step_up_required'] } };
    if (actor.role && !['admin', 'super_admin'].includes(actor.role) && actor.companyId) {
      where.companyId = actor.companyId;
    }
    return this.prisma.kycCase.findMany({ where, orderBy: { createdAt: 'asc' }, take: 100 });
  }

  // --- internals ---

  private async load(caseId: string, actor: CallerContext): Promise<KycCase> {
    const kase = await this.prisma.kycCase.findUnique({ where: { id: caseId } });
    if (!kase) throw new NotFoundException('case_not_found');
    this.assertScope(actor, kase.companyId);
    return kase;
  }

  private assertScope(actor: CallerContext, companyId: string): void {
    if (!actor.role) return; // system/service caller
    if (['admin', 'super_admin'].includes(actor.role)) return;
    if (actor.companyId && actor.companyId !== companyId) {
      // 404, not 403, so IDs are not enumerable across tenants.
      throw new NotFoundException('case_not_found');
    }
  }

  private async latestChecks(caseId: string): Promise<LatestCheck[]> {
    const rows = await this.prisma.kycCheck.findMany({
      where: { caseId },
      orderBy: { createdAt: 'desc' },
    });
    const seen = new Set<KycCheckType>();
    const latest: LatestCheck[] = [];
    for (const r of rows) {
      if (seen.has(r.type)) continue;
      seen.add(r.type);
      latest.push({ type: r.type, status: r.status });
    }
    return latest;
  }

  private async moveIfNeeded(kase: KycCase, to: KycCaseStatus, actor: CallerContext): Promise<KycCase> {
    if (kase.status === to) return kase;
    return this.transition(kase, to, actor, `enter_${to}`);
  }

  /** Guarded, atomic status transition. Refuses illegal moves and races. */
  private async transition(
    kase: KycCase,
    to: KycCaseStatus,
    actor: CallerContext,
    reason: string,
    decision?: 'approved' | 'rejected',
    reviewerUserId?: string,
  ): Promise<KycCase> {
    assertTransition(kase.status, to);
    const updated = await this.prisma.kycCase.updateMany({
      where: { id: kase.id, status: kase.status },
      data: {
        status: to,
        decision: decision ?? undefined,
        decisionReason: decision ? reason : undefined,
        reviewerUserId: reviewerUserId ?? undefined,
        reviewedAt: decision ? new Date() : undefined,
      },
    });
    if (updated.count === 0) {
      throw new ConflictException('stale_transition');
    }
    await this.audit.record({
      caseId: kase.id,
      action: 'case.transition',
      actor,
      fromValue: kase.status,
      toValue: to,
      metadata: { reason },
    });
    return this.prisma.kycCase.findUniqueOrThrow({ where: { id: kase.id } });
  }
}
