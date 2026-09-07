import path from 'node:path';
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ApplicationDocument, ApplicationStatus, Prisma, User } from '@prisma/client';
import type { PartnerApplicationDto } from '../../../shared/src/types/customer-platform';
import { ActivityService } from '../common/activity.service';
import { KycBridgeService } from '../kyc/kyc-bridge.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import {
  isPartnerVisibleDocument,
  PARTNER_DOCUMENT_CATEGORIES,
  partnerApplicationWhere,
  partnerSummary,
  toPartnerApplicationDto,
  type PartnerSummary,
} from './partner-logic';

const PARTNER_INCLUDE = {
  company: { select: { name: true } },
  branch: { select: { name: true } },
  product: { select: { make: true, model: true, modelYear: true, price: true } },
  customer: { select: { name: true } },
  documents: {
    where: { category: { in: PARTNER_DOCUMENT_CATEGORIES } },
    select: { id: true, category: true, originalName: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  },
} satisfies Prisma.ApplicationInclude;

export type PartnerListQuery = { status?: ApplicationStatus | null; limit: number; offset: number };
export type PartnerListResponse = { total: number; limit: number; offset: number; items: PartnerApplicationDto[] };
export type PartnerFile = { buffer: Buffer; contentType: string; filename: string };

/**
 * Read-only finance-provider (NBFC) view: applications tagged to the
 * viewer's own provider, from submission onwards, with the applicant's QID
 * masked, no phone, the stored credit assessment and the identity/income
 * documents. Every file read is audited.
 */
@Injectable()
export class PartnerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
    private readonly storage: StorageService,
    private readonly kycBridge: KycBridgeService,
  ) {}

  async list(user: User, query: PartnerListQuery): Promise<PartnerListResponse> {
    const where = partnerApplicationWhere(this.partnerIdOf(user), query.status ?? null);
    const [rows, total] = await Promise.all([
      this.prisma.application.findMany({
        where,
        include: PARTNER_INCLUDE,
        orderBy: [{ submittedAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
        take: query.limit,
        skip: query.offset,
      }),
      this.prisma.application.count({ where }),
    ]);
    return {
      total,
      limit: query.limit,
      offset: query.offset,
      items: rows.map((row) => toPartnerApplicationDto(row, user.role)),
    };
  }

  async detail(user: User, id: string): Promise<PartnerApplicationDto> {
    const row = await this.prisma.application.findFirst({
      where: { id, ...partnerApplicationWhere(this.partnerIdOf(user)) },
      include: PARTNER_INCLUDE,
    });
    if (!row) throw new NotFoundException('application_not_found');
    return toPartnerApplicationDto(row, user.role);
  }

  /** Identity/income documents only; anything else on the application reads as not found. */
  async documentFile(user: User, id: string, docId: string): Promise<PartnerFile> {
    const partnerId = this.partnerIdOf(user);
    const app = await this.prisma.application.findFirst({
      where: { id, ...partnerApplicationWhere(partnerId) },
      select: { id: true },
    });
    if (!app) throw new NotFoundException('application_not_found');
    const doc = await this.prisma.applicationDocument.findFirst({ where: { id: docId, applicationId: app.id } });
    if (!doc || !isPartnerVisibleDocument(doc.category)) throw new NotFoundException('document_not_found');

    const file = doc.storagePath.startsWith('kyc://')
      ? await this.kycBridge.readApplicationDocumentBytes(app.id, doc)
      : await this.readStored(doc);

    await this.activity.log({
      actorUserId: user.id,
      entityType: 'application',
      entityId: app.id,
      action: 'partner_document_viewed',
      metadata: { document_id: doc.id, category: doc.category, finance_partner_id: partnerId },
    });
    return file;
  }

  async summary(user: User): Promise<PartnerSummary> {
    const groups = await this.prisma.application.groupBy({
      by: ['status'],
      where: partnerApplicationWhere(this.partnerIdOf(user)),
      _count: { _all: true },
    });
    return partnerSummary(groups.map((group) => ({ status: group.status, count: group._count._all })));
  }

  /** A partner viewer without a provider sees nothing (misconfigured account, not an empty book). */
  private partnerIdOf(user: User): string {
    if (!user.financePartnerId) throw new ForbiddenException('partner_not_assigned');
    return user.financePartnerId;
  }

  private async readStored(doc: ApplicationDocument): Promise<PartnerFile> {
    const file = await this.storage.readKyc(doc.storagePath);
    const ext = path.extname(doc.storagePath) || '.pdf';
    return {
      buffer: file.buffer,
      contentType: doc.mimeType ?? file.contentType,
      filename: doc.originalName?.trim() || `${doc.category}${ext}`,
    };
  }
}
