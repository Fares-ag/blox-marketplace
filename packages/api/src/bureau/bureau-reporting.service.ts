import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ApplicationStatus, Prisma, UserRole } from '@prisma/client';
import { normalizeQid } from '@drivemarket/shared/domain-rules';
import { formatApplicationRef } from '../applications/application-reference';
import { readCustomerSnapshot } from '../applications/customer-snapshot';
import { ActivityService } from '../common/activity.service';
import { IdentityService } from '../common/identity.service';
import { SYSTEM_ACTOR_USER_ID } from '../common/system-actor';
import { AppConfigService } from '../config/app-config.service';
import { PrismaService } from '../prisma/prisma.service';
import { toCanonicalBureauFacility, type CanonicalBureauFacility } from './canonical-snapshot';
import { buildHypothesisDlt } from './dlt-file';
import { BUREAU_MAP_VERSION } from './field-map.v1';
import {
  evaluateBureauPopulation,
  type BureauExcludeReason,
  type BureauPopulationPolicy,
} from './population';
import { isLastCalendarDayQatar, qatarYmd, reportingPeriodOf } from './qatar-time';
import { resolveBureauTransport } from './transport';

const CANDIDATE_STATUSES: ApplicationStatus[] = [
  ApplicationStatus.draft,
  ApplicationStatus.rejected,
  ApplicationStatus.submission_cancelled,
  ApplicationStatus.active,
  ApplicationStatus.hardship,
  ApplicationStatus.repossession_in_progress,
  ApplicationStatus.total_loss,
  ApplicationStatus.completed,
  ApplicationStatus.under_review,
  ApplicationStatus.resubmission_required,
  ApplicationStatus.contract_signing_required,
  ApplicationStatus.contracts_submitted,
  ApplicationStatus.contract_under_review,
  ApplicationStatus.down_payment_required,
  ApplicationStatus.down_payment_submitted,
  ApplicationStatus.pending_finance_activation,
  ApplicationStatus.partner_processing,
  ApplicationStatus.lpo_issued,
  ApplicationStatus.acquisition_pending,
];

function asMoney(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export type BureauRunTrigger = 'cron' | 'manual';

export type BureauRunResult = {
  skipped?: 'disabled' | 'not_month_end';
  id?: string;
  submission_id?: string;
  status?: string;
  period?: string;
  record_count?: number;
  excluded_count?: number;
  awaiting_approval?: boolean;
};

@Injectable()
export class BureauReportingService {
  private readonly logger = new Logger(BureauReportingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly appConfig: AppConfigService,
    private readonly identity: IdentityService,
    private readonly activity: ActivityService,
  ) {}

  populationPolicy(): BureauPopulationPolicy {
    return {
      companyIds: new Set(this.appConfig.bureauCompanyIds),
      includeAllCompanies: this.appConfig.bureauIncludeAllCompanies,
      includeCorporate: this.appConfig.bureauIncludeCorporate,
    };
  }

  async runMonthEndJob(): Promise<BureauRunResult> {
    if (!this.appConfig.bureauReportingEnabled) {
      this.logger.debug('Bureau month-end skipped — BUREAU_REPORTING_ENABLED is off');
      return { skipped: 'disabled' };
    }
    const asOf = new Date();
    if (!this.appConfig.bureauCronAnyDay && !isLastCalendarDayQatar(asOf)) {
      return { skipped: 'not_month_end' };
    }
    return this.run({ asOf, triggeredBy: 'cron', actorUserId: SYSTEM_ACTOR_USER_ID });
  }

  async run(opts: {
    asOf?: Date;
    triggeredBy: BureauRunTrigger;
    actorUserId?: string | null;
  }): Promise<BureauRunResult> {
    const asOf = opts.asOf ?? new Date();
    const period = reportingPeriodOf(asOf);
    const policy = this.populationPolicy();
    const transport = resolveBureauTransport(
      this.appConfig.bureauTransport,
      this.appConfig.bureauSftpEnabled,
    );

    try {
      const { included, excluded, facilities } = await this.selectPopulation(asOf, period, policy);
      const file = buildHypothesisDlt({ period, asOf, facilities });
      const submission = await this.prisma.bureauSubmission.create({
        data: {
          period,
          asOf,
          mapVersion: file.mapVersion,
          unsigned: file.unsigned,
          status: 'generated',
          transport: transport.kind,
          filename: file.filename,
          checksum: file.checksum,
          recordCount: file.recordCount,
          excludedCount: excluded.length,
          outstandingSum: new Prisma.Decimal(file.outstandingSum.toFixed(2)),
          fileBody: file.body,
          actorUserId: opts.actorUserId ?? null,
          triggeredBy: opts.triggeredBy,
          rows: {
            create: [...included, ...excluded].map((row) => ({
              applicationId: row.applicationId,
              referenceSeq: row.referenceSeq,
              included: row.included,
              excludeReason: row.excludeReason,
              outstandingSource: row.outstandingSource,
              outstanding: row.outstanding == null ? null : new Prisma.Decimal(row.outstanding.toFixed(2)),
              statusCode: row.statusCode,
              ibraAmount: row.ibraAmount == null ? null : new Prisma.Decimal(row.ibraAmount.toFixed(2)),
            })),
          },
        },
      });

      await this.activity.log({
        actorUserId: opts.actorUserId ?? SYSTEM_ACTOR_USER_ID,
        entityType: 'bureau_submission',
        entityId: submission.id,
        action: 'bureau_generated',
        toValue: 'generated',
        metadata: {
          period,
          record_count: file.recordCount,
          excluded_count: excluded.length,
          checksum: file.checksum,
          transport: transport.kind,
          map_version: BUREAU_MAP_VERSION,
          triggered_by: opts.triggeredBy,
        },
      });

      let updated = submission;
      if (this.appConfig.bureauAutoSend) {
        updated = await this.deliverSubmission({
          submissionId: submission.id,
          filename: file.filename,
          body: file.body,
          period,
          recordCount: file.recordCount,
          excludedCount: excluded.length,
          checksum: file.checksum,
          transport,
          actorUserId: opts.actorUserId ?? SYSTEM_ACTOR_USER_ID,
        });
      }

      this.logger.log(
        `Bureau ${period} ${updated.status} records=${file.recordCount} excluded=${excluded.length} checksum=${file.checksum}`,
      );
      return {
        id: updated.id,
        submission_id: updated.id,
        status: updated.status,
        period,
        record_count: file.recordCount,
        excluded_count: excluded.length,
        awaiting_approval: updated.status === 'generated',
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const failed = await this.prisma.bureauSubmission.create({
        data: {
          period,
          asOf,
          mapVersion: BUREAU_MAP_VERSION,
          unsigned: true,
          status: 'failed',
          transport: this.appConfig.bureauTransport,
          error: message.slice(0, 2000),
          actorUserId: opts.actorUserId ?? null,
          triggeredBy: opts.triggeredBy,
        },
      });
      await this.activity.log({
        actorUserId: opts.actorUserId ?? SYSTEM_ACTOR_USER_ID,
        entityType: 'bureau_submission',
        entityId: failed.id,
        action: 'bureau_month_end_failed',
        toValue: 'failed',
        metadata: { period, error: message.slice(0, 500) },
      });
      await this.alertFailure(period, message);
      this.logger.error(`Bureau ${period} failed: ${message}`);
      return { id: failed.id, submission_id: failed.id, status: 'failed', period, record_count: 0, excluded_count: 0 };
    }
  }

  async approveAndSend(id: string, actorUserId: string) {
    const row = await this.prisma.bureauSubmission.findUnique({
      where: { id },
      select: {
        id: true,
        period: true,
        status: true,
        filename: true,
        fileBody: true,
        checksum: true,
        recordCount: true,
        excludedCount: true,
        transport: true,
      },
    });
    if (!row) throw new NotFoundException('not_found');
    if (row.status !== 'generated') {
      throw new BadRequestException('bureau_run_not_pending');
    }
    if (!row.fileBody || !row.filename) {
      throw new BadRequestException('bureau_run_no_file');
    }

    const transport = resolveBureauTransport(
      this.appConfig.bureauTransport,
      this.appConfig.bureauSftpEnabled,
    );

    const updated = await this.deliverSubmission({
      submissionId: row.id,
      filename: row.filename,
      body: row.fileBody,
      period: row.period,
      recordCount: row.recordCount,
      excludedCount: row.excludedCount,
      checksum: row.checksum ?? '',
      transport,
      actorUserId,
      approvedByUserId: actorUserId,
    });

    return {
      ...this.toRunDto(updated),
      record_count: row.recordCount,
      excluded_count: row.excludedCount,
    };
  }

  async listRuns() {
    const items = await this.prisma.bureauSubmission.findMany({
      orderBy: { createdAt: 'desc' },
      take: 24,
      select: {
        id: true,
        period: true,
        asOf: true,
        mapVersion: true,
        unsigned: true,
        status: true,
        transport: true,
        filename: true,
        checksum: true,
        recordCount: true,
        excludedCount: true,
        outstandingSum: true,
        error: true,
        triggeredBy: true,
        approvedAt: true,
        sendAcknowledgement: true,
        createdAt: true,
      },
    });
    return { items: items.map((row) => this.toRunDto(row)) };
  }

  async getRun(id: string) {
    const row = await this.prisma.bureauSubmission.findUnique({
      where: { id },
      include: {
        rows: { orderBy: { referenceSeq: 'asc' } },
      },
    });
    if (!row) throw new NotFoundException('not_found');
    return {
      ...this.toRunDto(row),
      rows: row.rows.map((item) => ({
        application_id: item.applicationId,
        reference_seq: item.referenceSeq,
        reference_no: formatApplicationRef(item.referenceSeq),
        included: item.included,
        exclude_reason: item.excludeReason,
        outstanding_source: item.outstandingSource,
        outstanding: item.outstanding == null ? null : asMoney(item.outstanding),
        status_code: item.statusCode,
        ibra_amount: item.ibraAmount == null ? null : asMoney(item.ibraAmount),
      })),
    };
  }

  async getFile(id: string): Promise<{ filename: string; body: string }> {
    const row = await this.prisma.bureauSubmission.findUnique({
      where: { id },
      select: { filename: true, fileBody: true },
    });
    if (!row?.fileBody || !row.filename) throw new NotFoundException('not_found');
    return { filename: row.filename, body: row.fileBody };
  }

  private async selectPopulation(asOf: Date, period: string, policy: BureauPopulationPolicy) {
    const companyFilter =
      policy.includeAllCompanies
        ? {}
        : policy.companyIds.size > 0
          ? { companyId: { in: [...policy.companyIds] } }
          : { companyId: { in: ['__none__'] } };

    const apps = await this.prisma.application.findMany({
      where: {
        activatedAt: { not: null },
        status: { in: CANDIDATE_STATUSES },
        ...companyFilter,
      },
      include: {
        customer: { select: { qid: true, qidEnc: true } },
        financePartner: { select: { crmAdapter: true } },
        ownershipRegister: true,
        paymentSchedules: {
          select: { status: true, remainingAmount: true, dueDate: true, paidAt: true },
        },
        rentPoolEntries: { select: { type: true, amount: true, createdAt: true } },
      },
    });

    const included: Array<{
      applicationId: string;
      referenceSeq: number;
      included: true;
      excludeReason: null;
      outstandingSource: string;
      outstanding: number;
      statusCode: string;
      ibraAmount: number;
    }> = [];
    const excluded: Array<{
      applicationId: string;
      referenceSeq: number;
      included: false;
      excludeReason: BureauExcludeReason;
      outstandingSource: null;
      outstanding: null;
      statusCode: string;
      ibraAmount: null;
    }> = [];
    const facilities: CanonicalBureauFacility[] = [];

    for (const app of apps) {
      if (!app.activatedAt) continue;
      const snapshot = readCustomerSnapshot(app.customerSnapshot);
      const qid = this.resolveQid(app.customer, snapshot.qid);
      const decision = evaluateBureauPopulation(
        {
          id: app.id,
          status: app.status,
          activatedAt: app.activatedAt,
          kycStatus: app.kycStatus,
          qid,
          identityHoldReason: app.identityHoldReason,
          identityHoldClearedAt: app.identityHoldClearedAt,
          companyId: app.companyId,
          applicantType: snapshot.applicantType,
          crmAdapter: app.financePartner?.crmAdapter ?? 'none',
        },
        policy,
      );
      if (!decision.include) {
        excluded.push({
          applicationId: app.id,
          referenceSeq: app.referenceSeq,
          included: false,
          excludeReason: decision.reason,
          outstandingSource: null,
          outstanding: null,
          statusCode: app.status,
          ibraAmount: null,
        });
        continue;
      }
      const register = app.ownershipRegister
        ? {
            bloxUnits: app.ownershipRegister.bloxUnits,
            customerUnits: app.ownershipRegister.customerUnits,
            totalUnits: app.ownershipRegister.totalUnits,
            unitNominalValue: asMoney(app.ownershipRegister.unitNominalValue),
          }
        : null;
      const facility = toCanonicalBureauFacility(
        {
          id: app.id,
          referenceSeq: app.referenceSeq,
          status: app.status,
          activatedAt: app.activatedAt,
          completedAt: app.completedAt,
          qid: qid!,
          defaultClassification: app.defaultClassification,
          customerSnapshot: app.customerSnapshot,
          pricingSnapshot: app.pricingSnapshot,
          register,
          schedules: app.paymentSchedules.map((row) => ({
            status: row.status,
            remainingAmount: asMoney(row.remainingAmount),
            dueDate: row.dueDate,
            paidAt: row.paidAt,
          })),
          forgivenRentTotal: app.rentPoolEntries
            .filter((entry) => entry.type === 'forgiven')
            .reduce((sum, entry) => sum + asMoney(entry.amount), 0),
          rentCollectedInPeriod: app.rentPoolEntries
            .filter((entry) => entry.type === 'collected' && reportingPeriodOf(entry.createdAt) === period)
            .reduce((sum, entry) => sum + asMoney(entry.amount), 0),
        },
        asOf,
      );
      facilities.push(facility);
      included.push({
        applicationId: app.id,
        referenceSeq: app.referenceSeq,
        included: true,
        excludeReason: null,
        outstandingSource: facility.outstandingSource,
        outstanding: facility.outstanding,
        statusCode: facility.applicationStatus,
        ibraAmount: facility.ibraAmount,
      });
    }

    return { included, excluded, facilities };
  }

  private resolveQid(customer: { qid: string | null; qidEnc: string | null } | null, snapshotQid: string): string | null {
    const fromIdentity = this.identity.readQid(customer);
    const digits = normalizeQid(fromIdentity || snapshotQid || '');
    return digits || null;
  }

  private async deliverSubmission(opts: {
    submissionId: string;
    filename: string;
    body: string;
    period: string;
    recordCount: number;
    excludedCount: number;
    checksum: string;
    transport: ReturnType<typeof resolveBureauTransport>;
    actorUserId: string;
    approvedByUserId?: string;
  }) {
    const approvedAt = opts.approvedByUserId ? new Date() : undefined;
    let send;
    try {
      send = await opts.transport.send(opts.filename, opts.body);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const failed = await this.prisma.bureauSubmission.update({
        where: { id: opts.submissionId },
        data: {
          status: 'failed',
          error: message.slice(0, 2000),
          approvedAt,
          approvedByUserId: opts.approvedByUserId ?? null,
        },
      });
      await this.activity.log({
        actorUserId: opts.actorUserId,
        entityType: 'bureau_submission',
        entityId: failed.id,
        action: 'bureau_send_failed',
        toValue: 'failed',
        metadata: { period: opts.period, error: message.slice(0, 500), transport: opts.transport.kind },
      });
      await this.alertFailure(opts.period, message);
      return failed;
    }

    const updated = await this.prisma.bureauSubmission.update({
      where: { id: opts.submissionId },
      data: {
        status: send.accepted ? 'sent' : 'failed',
        approvedAt,
        approvedByUserId: opts.approvedByUserId ?? null,
        sendAcknowledgement: send.acknowledgement,
        error: send.accepted ? null : send.acknowledgement,
      },
    });
    await this.activity.log({
      actorUserId: opts.actorUserId,
      entityType: 'bureau_submission',
      entityId: updated.id,
      action: 'bureau_sent',
      toValue: updated.status,
      metadata: {
        period: opts.period,
        record_count: opts.recordCount,
        excluded_count: opts.excludedCount,
        checksum: opts.checksum,
        transport: opts.transport.kind,
        acknowledgement: send.acknowledgement,
        map_version: BUREAU_MAP_VERSION,
      },
    });
    return updated;
  }

  private toRunDto(row: {
    id: string;
    period: string;
    asOf: Date;
    mapVersion: string;
    unsigned: boolean;
    status: string;
    transport: string;
    filename?: string | null;
    checksum?: string | null;
    recordCount: number;
    excludedCount: number;
    outstandingSum: Prisma.Decimal | number | string;
    error?: string | null;
    triggeredBy: string;
    approvedAt?: Date | null;
    sendAcknowledgement?: string | null;
    createdAt: Date;
  }) {
    return {
      id: row.id,
      period: row.period,
      as_of: row.asOf.toISOString(),
      as_of_qatar: qatarYmd(row.asOf),
      map_version: row.mapVersion,
      unsigned: row.unsigned,
      status: row.status,
      transport: row.transport,
      filename: row.filename ?? null,
      checksum: row.checksum ?? null,
      record_count: row.recordCount,
      excluded_count: row.excludedCount,
      outstanding_sum: asMoney(row.outstandingSum),
      error: row.error ?? null,
      triggered_by: row.triggeredBy,
      approved_at: row.approvedAt?.toISOString() ?? null,
      send_acknowledgement: row.sendAcknowledgement ?? null,
      awaiting_approval: row.status === 'generated',
      created_at: row.createdAt.toISOString(),
    };
  }

  private async alertFailure(period: string, message: string): Promise<void> {
    const targets = await this.prisma.user.findMany({
      where: {
        isActive: true,
        role: { in: [UserRole.finance_officer, UserRole.admin, UserRole.super_admin] },
      },
      select: { id: true },
    });
    const title = `Bureau month-end failed (${period})`;
    const body = `The Qatar Credit Bureau dry-run did not complete. ${message.slice(0, 300)}`;
    for (const target of targets) {
      await this.activity.notify(target.id, title, body, '/bureau');
    }
  }
}
