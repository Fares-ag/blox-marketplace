import { createHash } from 'node:crypto';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { User, UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../storage/storage.service';
import { ActivityService } from '../../common/activity.service';
import { assertApplicationCanView } from '../application-access';
import { assertCompanyScope } from '../company-scope';
import { buildContractPdf, verifySignedContractReferencesOriginal } from '../contract-pdf';
import { toApplicationDto, toOpsApplicationDto } from '../application-response.dto';
import { buildCamFallbackPdf } from './cam-fallback-pdf';
import { contractPdfInputFromContext } from './contract-pdf-input';
import {
  fillAndValidateTemplate,
  readTemplate,
  expandScheduleRows,
} from './docx-template';
import { docxToPdf, embedPdfFingerprint, isLibreOfficeError } from './pdf-converter';
import { buildOwnershipSchedulePdf } from './ownership-schedule-pdf';
import { fieldsForDocument, type ContractFieldContext } from './field-maps';
import {
  documentsForFinancingType,
  filenameFor,
  type ContractDocumentAudience,
  type FinancingType,
} from './template-catalog';

type ContractDocumentRow = {
  id: string;
  applicationId: string;
  documentType: 'ijarah_agreement' | 'musharakah_agreement' | 'ownership_rental_schedule' | 'credit_appraisal_memorandum';
  audience: ContractDocumentAudience;
  label: string;
  generatedPath: string | null;
  contentSha256: string | null;
  signedPath: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
};

type ContractDocumentDelegate = {
  create: (args: { data: Record<string, unknown> }) => Promise<ContractDocumentRow>;
  findMany: (args: Record<string, unknown>) => Promise<ContractDocumentRow[]>;
  findFirst: (args: Record<string, unknown>) => Promise<ContractDocumentRow | null>;
  update: (args: { where: { id: string }; data: Record<string, unknown> }) => Promise<ContractDocumentRow>;
  count: (args: Record<string, unknown>) => Promise<number>;
};

function contractDocumentsDb(prisma: PrismaService): ContractDocumentDelegate {
  return (prisma as unknown as { contractDocument: ContractDocumentDelegate }).contractDocument;
}

const DECISION_ROLES: UserRole[] = [
  UserRole.credit_officer,
  UserRole.finance_officer,
  UserRole.admin,
  UserRole.super_admin,
];

function hashFields(applicationId: string, documentType: string, fields: Record<string, string>): string {
  const keys = Object.keys(fields).sort();
  const canonical = JSON.stringify({ applicationId, documentType, fields: keys.map((key) => [key, fields[key]]) });
  return createHash('sha256').update(canonical).digest('hex');
}

@Injectable()
export class ContractDocumentsService {
  private readonly logger = new Logger(ContractDocumentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly activity: ActivityService,
  ) {}

  async generateDocumentsForApproval(input: {
    applicationId: string;
    financingType?: FinancingType | null;
    ctx: ContractFieldContext;
  }): Promise<Array<{ id: string; documentType: string; audience: ContractDocumentAudience; label: string }>> {
    const specs = documentsForFinancingType(input.financingType ?? 'diminishing_musharakah');
    const created: Array<{ id: string; documentType: string; audience: ContractDocumentAudience; label: string }> = [];

    for (const spec of specs) {
      try {
        const row = await this.generateOne(
          input.applicationId,
          spec.documentType,
          spec.audience,
          spec.label,
          spec.templateFile,
          input.ctx,
        );
        created.push({
          id: row.id,
          documentType: row.documentType,
          audience: row.audience,
          label: row.label,
        });
      } catch (error) {
        this.logger.error(
          `Failed to generate ${spec.documentType} for ${input.applicationId}: ${error instanceof Error ? error.message : error}`,
        );
        throw error;
      }
    }
    return created;
  }

  private async generateOne(
    applicationId: string,
    documentType: Parameters<typeof fieldsForDocument>[0],
    audience: ContractDocumentAudience,
    label: string,
    templateFile: string,
    ctx: ContractFieldContext,
  ) {
    const fields = fieldsForDocument(documentType, ctx);
    const contentSha256 = hashFields(applicationId, documentType, fields);
    let pdf: Buffer;

    // Primary path for every document is the real DOCX template filled with the
    // deal data and branded, then converted to PDF via LibreOffice. Only if that
    // pipeline fails (e.g. LibreOffice unavailable) do we drop to a programmatic
    // fallback so approval never blocks on document generation.
    try {
      pdf = await this.generateFromDocxTemplate(documentType, audience, templateFile, ctx, fields);
    } catch (error) {
      this.logger.warn(
        `Template generation failed for ${documentType}, using programmatic PDF fallback: ${error instanceof Error ? error.message : error}`,
      );
      pdf = await this.generateFallback(documentType, ctx);
    }
    pdf = await embedPdfFingerprint(pdf, contentSha256, applicationId);

    const generatedPath = await this.storage.storeContractDocument(applicationId, documentType, pdf);

    return contractDocumentsDb(this.prisma).create({
      data: {
        applicationId,
        documentType,
        audience,
        label,
        generatedPath,
        contentSha256,
        status: 'generated',
      },
    });
  }

  private async generateFromDocxTemplate(
    documentType: Parameters<typeof fieldsForDocument>[0],
    audience: ContractDocumentAudience,
    templateFile: string,
    ctx: ContractFieldContext,
    fields: Record<string, string>,
  ): Promise<Buffer> {
    let docx = readTemplate(templateFile, { audience });
    if (documentType === 'ownership_rental_schedule') {
      docx = expandScheduleRows(docx, ctx.schedule.length);
    }
    const snapName = fields['Customer.FullNameEN'] ?? '';
    const required = [snapName, fields['Deal.Ref'] ?? ctx.applicationId].filter(Boolean);
    const filled = fillAndValidateTemplate(docx, fields, required);
    return docxToPdf(filled);
  }

  private async generateFallback(
    documentType: Parameters<typeof fieldsForDocument>[0],
    ctx: ContractFieldContext,
  ): Promise<Buffer> {
    if (documentType === 'ownership_rental_schedule') {
      return buildOwnershipSchedulePdf(ctx);
    }
    if (documentType === 'credit_appraisal_memorandum') {
      return buildCamFallbackPdf(ctx);
    }
    // ijarah_agreement / musharakah_agreement
    const built = await buildContractPdf(contractPdfInputFromContext(ctx));
    return built.buffer;
  }

  async listForUser(user: User, applicationId: string) {
    const app = await this.prisma.application.findUnique({ where: { id: applicationId } });
    if (!app) throw new NotFoundException();
    await assertApplicationCanView(this.prisma, user, app);
    const audienceFilter: Record<string, unknown> =
      user.role === UserRole.customer ? { audience: 'customer' } : {};
    const rows = await contractDocumentsDb(this.prisma).findMany({
      where: { applicationId, ...audienceFilter },
      orderBy: { createdAt: 'asc' },
    });
    return {
      items: rows.map((row) => ({
        id: row.id,
        document_type: row.documentType,
        audience: row.audience,
        label: row.label,
        status: row.status,
        generated: !!row.generatedPath,
        signed: !!row.signedPath,
        created_at: row.createdAt.toISOString(),
        updated_at: row.updatedAt.toISOString(),
      })),
      signed_count: rows.filter((row) => row.audience === 'customer' && row.status === 'signed_submitted').length,
      required_count: rows.filter((row) => row.audience === 'customer').length,
    };
  }

  async downloadForUser(user: User, applicationId: string, docId: string) {
    const app = await this.prisma.application.findUnique({ where: { id: applicationId } });
    if (!app) throw new NotFoundException();
    await assertApplicationCanView(this.prisma, user, app);
    const row = await contractDocumentsDb(this.prisma).findFirst({
      where: { id: docId, applicationId },
    });
    if (!row?.generatedPath) throw new NotFoundException();
    if (user.role === UserRole.customer && row.audience !== 'customer') {
      throw new ForbiddenException('forbidden_role');
    }
    const file = await this.storage.readContract(row.generatedPath);
    return { ...file, filename: filenameFor(row.documentType, applicationId) };
  }

  async signForUser(user: User, applicationId: string, docId: string, file: Express.Multer.File, asOps: boolean) {
    const app = await this.prisma.application.findUnique({ where: { id: applicationId } });
    if (!app) throw new NotFoundException();
    if (asOps) {
      if (!DECISION_ROLES.includes(user.role)) throw new ForbiddenException('forbidden_role');
      await assertCompanyScope(this.prisma, user, app.companyId);
    } else {
      if (user.role !== UserRole.customer || app.customerUserId !== user.id) {
        throw new ForbiddenException('forbidden_role');
      }
    }
    if (app.status !== 'contract_signing_required') {
      throw new BadRequestException('invalid_status_transition');
    }
    const row = await contractDocumentsDb(this.prisma).findFirst({
      where: { id: docId, applicationId, audience: 'customer' },
    });
    if (!row) throw new NotFoundException();
    this.storage.assertSignedContractFile(file);
    if (!row.contentSha256 || !(await verifySignedContractReferencesOriginal(file.buffer, row.contentSha256, applicationId))) {
      throw new BadRequestException('contract_hash_mismatch');
    }
    const signedPath = await this.storage.uploadSignedContractDocument(file, applicationId, row.documentType);
    await contractDocumentsDb(this.prisma).update({
      where: { id: row.id },
      data: { signedPath, status: 'signed_submitted' },
    });
    await this.activity.log({
      actorUserId: user.id,
      entityType: 'application',
      entityId: applicationId,
      action: 'contract_document_signed',
      metadata: { documentType: row.documentType, uploadedBy: asOps ? 'ops' : 'customer' },
    });
    const updated = await this.maybeSubmitAllSigned(user, applicationId, asOps);
    return asOps ? toOpsApplicationDto(updated) : toApplicationDto(updated);
  }

  async remainingCustomerDocuments(applicationId: string): Promise<number> {
    return contractDocumentsDb(this.prisma).count({
      where: {
        applicationId,
        audience: 'customer',
        status: { notIn: ['signed_submitted', 'verified'] },
      },
    });
  }

  async maybeSubmitAllSigned(user: User, applicationId: string, asOps: boolean) {
    const remaining = await this.remainingCustomerDocuments(applicationId);
    const app = await this.prisma.application.findUnique({ where: { id: applicationId } });
    if (!app) throw new NotFoundException();
    if (remaining > 0 || app.status !== 'contract_signing_required') {
      return app;
    }
    const latestSigned = await contractDocumentsDb(this.prisma).findFirst({
      where: { applicationId, audience: 'customer', signedPath: { not: null } },
      orderBy: { updatedAt: 'desc' },
    });
    const updated = await this.prisma.application.update({
      where: { id: applicationId },
      data: {
        status: 'contracts_submitted',
        signedContractPath: latestSigned?.signedPath ?? app.signedContractPath,
      },
    });
    await this.activity.log({
      actorUserId: user.id,
      entityType: 'application',
      entityId: applicationId,
      action: 'status_transition',
      fromValue: 'contract_signing_required',
      toValue: 'contracts_submitted',
      metadata: asOps ? { uploadedBy: 'ops', onBehalfOfCustomer: app.customerUserId } : undefined,
    });
    if (asOps && app.customerUserId) {
      await this.activity.notify(
        app.customerUserId,
        'Signed contracts received',
        'Your signed agreements were filed by our team and are now under review.',
        `/app/applications/${applicationId}`,
      );
    }
    return updated;
  }
}
