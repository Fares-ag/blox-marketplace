import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentCategory, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { IDENTITY_SLOTS, KycPlatformClient, type KycDocument } from './kyc-platform.client';

const SLOT_CATEGORY: Record<string, DocumentCategory> = {
  qid_front: DocumentCategory.qid,
  qid_back: DocumentCategory.qid,
  passport: DocumentCategory.passport,
};

const SLOT_LABELS: Record<string, string> = {
  qid_front: 'QID Front',
  qid_back: 'QID Back',
  passport: 'Passport',
};

function metricScore(value: KycDocument['quality']): number | null {
  if (value == null) return null;
  if (typeof value === 'number') return value;
  if (typeof value === 'object' && typeof value.score === 'number') return value.score;
  return null;
}

@Injectable()
export class KycBridgeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly kyc: KycPlatformClient,
    private readonly config: ConfigService,
  ) {}

  verifyWebhookSignature(rawBody: string, signatureHeader: string | undefined): boolean {
    const secret = this.config.get<string>('KYC_WEBHOOK_SECRET') ?? '';
    if (!secret || !signatureHeader) return false;
    const parts = Object.fromEntries(
      signatureHeader.split(',').map((p) => {
        const [k, ...rest] = p.trim().split('=');
        return [k, rest.join('=')];
      }),
    );
    const timestamp = parts.t;
    const signature = parts.v1;
    if (!timestamp || !signature) return false;
    const expected = createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
    try {
      return timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'));
    } catch {
      return false;
    }
  }

  async ensureSession(user: User, applicationId: string) {
    const app = await this.prisma.application.findUnique({ where: { id: applicationId } });
    if (!app) throw new NotFoundException('application_not_found');
    if (app.customerUserId !== user.id) throw new UnauthorizedException();
    if (!this.kyc.configured()) throw new BadRequestException('kyc_not_configured');

    const snap = (app.customerSnapshot ?? {}) as Record<string, unknown>;
    const fullName =
      `${snap.full_name ?? ''}`.trim() ||
      `${snap.firstName ?? ''} ${snap.lastName ?? ''}`.trim() ||
      user.name;

    let caseId = app.kycCaseId;
    if (!caseId) {
      const existing = await this.kyc.findCaseByExternalRef(applicationId);
      if (existing) {
        caseId = existing.id;
      } else {
        const created = await this.kyc.createCase({
          externalRef: applicationId,
          fullName,
          email: app.customerEmail || user.email,
          phone: `${snap.phone ?? user.phone ?? ''}` || undefined,
        });
        caseId = created.id;
      }
      await this.prisma.application.update({
        where: { id: applicationId },
        data: { kycCaseId: caseId, kycStatus: 'pending' },
      });
    }

    const invite = await this.kyc.createInvite(caseId);
    return {
      case_id: caseId,
      invite_token: invite.invite_token,
      invite_url: invite.invite_url,
      required_slots: [...IDENTITY_SLOTS],
    };
  }

  async documentStatus(user: User, applicationId: string) {
    const app = await this.prisma.application.findUnique({ where: { id: applicationId } });
    if (!app) throw new NotFoundException('application_not_found');
    if (app.customerUserId !== user.id) throw new UnauthorizedException();

    if (!app.kycCaseId) {
      return {
        case_status: 'NOT_STARTED',
        kyc_status: app.kycStatus,
        slots: IDENTITY_SLOTS.map((type) => ({ type, status: 'missing' })),
      };
    }
    const kase = await this.kyc.getCaseDetail(app.kycCaseId);
    return {
      case_id: app.kycCaseId,
      case_status: kase.status,
      kyc_status: app.kycStatus,
      slots: this.kyc.buildSlotSummary(kase),
    };
  }

  async handleWebhook(rawBody: string, signature: string | undefined, payload: {
    type?: string;
    case_id?: string;
  }) {
    if (!this.verifyWebhookSignature(rawBody, signature)) {
      throw new UnauthorizedException('invalid_signature');
    }
    const caseId = payload.case_id;
    if (!caseId) throw new BadRequestException('missing_case_id');

    const kase = await this.kyc.getCaseDetail(caseId);
    const applicationId = kase.external_ref;
    if (!applicationId) return { ok: true, skipped: 'no_external_ref' };

    const app = await this.prisma.application.findUnique({ where: { id: applicationId } });
    if (!app) return { ok: true, skipped: 'application_not_found' };

    await this.syncDocuments(applicationId, app.customerUserId, kase.documents, kase.status);
    return { ok: true };
  }

  async syncDocuments(
    applicationId: string,
    uploadedById: string,
    docs: KycDocument[],
    caseStatus: string,
  ) {
    const identity = docs.filter((d) => SLOT_CATEGORY[d.type]);
    for (const doc of identity) {
      const category = SLOT_CATEGORY[doc.type];
      const verified =
        doc.status === 'PROCESSED' &&
        doc.review_status !== 'fail' &&
        doc.review_status !== 'rejected';
      const rejected =
        doc.status === 'FAILED' ||
        doc.status === 'REJECTED' ||
        doc.review_status === 'fail' ||
        doc.review_status === 'rejected';
      const verificationStatus = rejected ? 'rejected' : verified ? 'verified' : 'processing';

      const existing = await this.prisma.applicationDocument.findFirst({
        where: { applicationId, kycDocumentType: doc.type },
      });
      const data = {
        category,
        storagePath: `kyc://${doc.id}`,
        mimeType: 'application/octet-stream',
        uploadedById,
        kycDocumentId: doc.id,
        kycDocumentType: doc.type,
        verificationStatus,
        quality: metricScore(doc.quality),
        authenticity: metricScore(doc.authenticity),
        reviewStatus: doc.review_status,
        originalName: SLOT_LABELS[doc.type] ?? doc.type,
      };
      if (existing) {
        await this.prisma.applicationDocument.update({ where: { id: existing.id }, data });
      } else {
        await this.prisma.applicationDocument.create({
          data: { applicationId, ...data },
        });
      }
    }

    let kycStatus = 'pending';
    if (caseStatus === 'APPROVED') kycStatus = 'verified';
    else if (caseStatus === 'REJECTED') kycStatus = 'rejected';
    else if (caseStatus === 'MANUAL_REVIEW') kycStatus = 'manual_review';
    else if (identity.some((d) => d.status === 'PROCESSING' || d.status === 'UPLOADED')) {
      kycStatus = 'processing';
    }

    await this.prisma.application.update({
      where: { id: applicationId },
      data: { kycStatus },
    });
  }
}
