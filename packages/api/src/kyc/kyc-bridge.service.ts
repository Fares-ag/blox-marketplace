import { createHmac, timingSafeEqual } from 'node:crypto';
import path from 'node:path';
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
import { buildKycVerificationSummary } from './kyc-verification-summary';
import { MusharakahService } from '../musharakah/musharakah.service';

const SLOT_CATEGORY: Record<string, DocumentCategory> = {
  qid_front: DocumentCategory.qid,
  qid_back: DocumentCategory.qid,
  passport: DocumentCategory.passport,
  selfie: DocumentCategory.selfie,
};

const SLOT_LABELS: Record<string, string> = {
  qid_front: 'QID Front',
  qid_back: 'QID Back',
  passport: 'Passport',
  selfie: 'Face liveness',
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
    private readonly musharakah: MusharakahService,
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
    event_id?: string;
    id?: string;
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

    if (!app.customerUserId) return { ok: true, skipped: 'customer_not_linked' };
    await this.syncDocuments(applicationId, app.customerUserId, kase.documents, kase.status);
    await this.musharakah.applyKycWebhookStatus(
      applicationId,
      payload.type,
      payload.event_id ?? payload.id,
    );
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
        mimeType: doc.mime_type ?? 'application/octet-stream',
        uploadedById,
        kycDocumentId: doc.id,
        kycDocumentType: doc.type,
        verificationStatus,
        quality: metricScore(doc.quality),
        authenticity: metricScore(doc.authenticity),
        reviewStatus: doc.review_status,
        originalName: SLOT_LABELS[doc.type] ?? doc.original_filename ?? doc.type,
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

  /** Pull the latest identity + liveness docs from the KYC platform into the application. */
  async syncDocumentsForApplication(applicationId: string) {
    if (!this.kyc.configured()) return;
    const app = await this.prisma.application.findUnique({ where: { id: applicationId } });
    if (!app?.kycCaseId || !app.customerUserId) return;
    const kase = await this.kyc.getCaseDetail(app.kycCaseId);
    await this.syncDocuments(applicationId, app.customerUserId, kase.documents, kase.status);
  }

  /** Resolve bytes for documents synced from the KYC platform (`kyc://…` storage paths). */
  async readApplicationDocumentBytes(
    applicationId: string,
    doc: {
      storagePath: string;
      mimeType?: string | null;
      originalName?: string | null;
      category: string;
      kycDocumentId?: string | null;
    },
  ): Promise<{ buffer: Buffer; contentType: string; filename: string }> {
    if (!doc.storagePath.startsWith('kyc://')) {
      throw new BadRequestException('not_kyc_document');
    }
    if (!this.kyc.configured()) throw new BadRequestException('kyc_not_configured');
    const app = await this.prisma.application.findUnique({
      where: { id: applicationId },
      select: { kycCaseId: true },
    });
    if (!app?.kycCaseId) throw new NotFoundException('kyc_case_not_linked');
    const kycDocId = doc.kycDocumentId ?? doc.storagePath.slice('kyc://'.length);
    const file = await this.kyc.fetchCaseDocumentFile(app.kycCaseId, kycDocId);
    const ext =
      path.extname(file.filename) ||
      (file.contentType === 'image/jpeg'
        ? '.jpg'
        : file.contentType === 'image/png'
          ? '.png'
          : file.contentType === 'application/pdf'
            ? '.pdf'
            : '');
    const baseName = doc.originalName?.trim() || doc.category;
    const filename = path.extname(baseName) ? baseName : `${baseName}${ext}`;
    return {
      buffer: file.buffer,
      contentType: doc.mimeType ?? file.contentType,
      filename,
    };
  }

  async getVerificationSummary(_applicationId: string, kycCaseId: string, kycStatus: string | null) {
    if (!this.kyc.configured()) return null;
    const kase = await this.kyc.getCaseDetail(kycCaseId);
    return buildKycVerificationSummary(kase, kycStatus);
  }
}
