import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ApplicationStatus, Prisma, SettlementStatus, User, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityService } from '../common/activity.service';
import { assertCompanyScope, opsCompanyFilter } from '../applications/company-scope';

/** Settlements are a finance/admin money op (blox-vercel FINANCE_PORTAL.md); credit is read-only elsewhere. */
export const SETTLEMENT_DECISION_ROLES: UserRole[] = [
  UserRole.finance_officer,
  UserRole.admin,
  UserRole.super_admin,
];

type SettlementWithApp = Prisma.ApplicationSettlementGetPayload<{
  include: {
    application: {
      select: {
        id: true;
        status: true;
        companyId: true;
        customer: { select: { name: true } };
        product: { select: { make: true; model: true; modelYear: true } };
        company: { select: { name: true } };
      };
    };
  };
}>;

const APP_INCLUDE = {
  application: {
    select: {
      id: true,
      status: true,
      companyId: true,
      customer: { select: { name: true } },
      product: { select: { make: true, model: true, modelYear: true } },
      company: { select: { name: true } },
    },
  },
} as const;

function toDto(row: SettlementWithApp) {
  return {
    id: row.id,
    application_id: row.applicationId,
    application_status: row.application.status,
    status: row.status,
    customer_email: row.customerEmail,
    customer_name: row.application.customer.name,
    vehicle: `${row.application.product.make} ${row.application.product.model} ${row.application.product.modelYear ?? ''}`.trim(),
    company_name: row.application.company.name,
    settlement_amount: Number(row.settlementAmount),
    remaining_principal: Number(row.remainingPrincipal),
    discount_amount: Number(row.discountAmount),
    forgiven_rent: Number(row.forgivenRent),
    requested_at: row.requestedAt.toISOString(),
    decided_at: row.decidedAt?.toISOString() ?? null,
    decision_reason: row.decisionReason,
  };
}

@Injectable()
export class SettlementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
  ) {}

  private assertDecisionRole(user: User) {
    if (!SETTLEMENT_DECISION_ROLES.includes(user.role)) {
      throw new ForbiddenException('forbidden_role');
    }
  }

  /** Remaining principal = unpaid remainder across the schedule ledger. */
  private async remainingPrincipal(applicationId: string): Promise<Prisma.Decimal> {
    const agg = await this.prisma.paymentSchedule.aggregate({
      where: { applicationId, remainingAmount: { gt: 0 } },
      _sum: { remainingAmount: true },
    });
    return agg._sum.remainingAmount ?? new Prisma.Decimal(0);
  }

  /** Customer asks to settle early. One open request per application. */
  async request(user: User, applicationId: string) {
    if (user.role !== UserRole.customer) throw new ForbiddenException('forbidden_role');
    const app = await this.prisma.application.findUnique({ where: { id: applicationId } });
    if (!app || app.customerUserId !== user.id) throw new NotFoundException();
    if (app.status !== ApplicationStatus.active) {
      throw new BadRequestException('settlement_requires_active_financing');
    }
    const open = await this.prisma.applicationSettlement.findFirst({
      where: { applicationId, status: SettlementStatus.pending },
    });
    if (open) throw new BadRequestException('settlement_already_requested');

    const remaining = await this.remainingPrincipal(applicationId);
    if (remaining.lte(0)) throw new BadRequestException('nothing_to_settle');

    const row = await this.prisma.applicationSettlement.create({
      data: {
        applicationId,
        customerUserId: user.id,
        customerEmail: app.customerEmail,
        remainingPrincipal: remaining,
        settlementAmount: remaining,
      },
      include: APP_INCLUDE,
    });
    await this.activity.log({
      actorUserId: user.id,
      entityType: 'application',
      entityId: applicationId,
      action: 'settlement_requested',
      toValue: 'pending',
      metadata: { settlement_id: row.id, amount: Number(remaining) },
    });
    return toDto(row);
  }

  async list(user: User, query: { status?: SettlementStatus; limit?: number; offset?: number }) {
    this.assertDecisionRole(user);
    const limit = Math.min(Math.max(Number(query.limit) || 50, 1), 200);
    const offset = Math.max(Number(query.offset) || 0, 0);
    const companyFilter = await opsCompanyFilter(this.prisma, user);
    const where: Prisma.ApplicationSettlementWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(companyFilter ? { application: { companyId: { in: companyFilter } } } : {}),
    };
    const [total, rows, pending] = await Promise.all([
      this.prisma.applicationSettlement.count({ where }),
      this.prisma.applicationSettlement.findMany({
        where,
        include: APP_INCLUDE,
        orderBy: { requestedAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      this.prisma.applicationSettlement.count({
        where: { ...where, status: SettlementStatus.pending },
      }),
    ]);
    return { total, limit, offset, summary: { pending }, items: rows.map(toDto) };
  }

  async decide(
    user: User,
    id: string,
    decision: 'approved' | 'rejected',
    reason?: string,
  ) {
    this.assertDecisionRole(user);
    const row = await this.prisma.applicationSettlement.findUnique({
      where: { id },
      include: APP_INCLUDE,
    });
    if (!row) throw new NotFoundException();
    await assertCompanyScope(this.prisma, user, row.application.companyId);
    if (row.status !== SettlementStatus.pending) {
      throw new BadRequestException('settlement_not_pending');
    }
    if (decision === 'rejected' && !reason?.trim()) {
      throw new BadRequestException('validation_failed');
    }

    const updated = await this.prisma.applicationSettlement.update({
      where: { id },
      data: {
        status: decision,
        decidedAt: new Date(),
        decidedByUserId: user.id,
        decisionReason: reason?.trim() || null,
      },
      include: APP_INCLUDE,
    });

    await this.activity.log({
      actorUserId: user.id,
      entityType: 'application',
      entityId: row.applicationId,
      action: `settlement_${decision}`,
      fromValue: 'pending',
      toValue: decision,
      metadata: { settlement_id: id, reason },
    });
    await this.activity.notify(
      row.customerUserId,
      decision === 'approved' ? 'Settlement approved' : 'Settlement request declined',
      reason,
      `/app/applications/${row.applicationId}`,
    );
    return toDto(updated);
  }
}
