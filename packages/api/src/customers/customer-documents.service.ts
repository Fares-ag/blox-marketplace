import path from 'node:path';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CustomerDocument, CustomerDocumentCategory, User, UserRole } from '@prisma/client';
import type { CustomerDocumentDto } from '../../../shared/src/types/customer-platform';
import { opsCompanyFilter } from '../applications/company-scope';
import { ActivityService } from '../common/activity.service';
import { EncryptionService } from '../common/encryption.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { parseIsoDate } from './customer-profile';
import { CUSTOMER_DOCUMENT_LABELS, toCustomerDocumentDto } from './vault-logic';

export type UploadCustomerDocumentInput = {
  category: CustomerDocumentCategory;
  document_number?: string;
  issued_at?: string;
  expires_at?: string;
};

export type VaultFile = { buffer: Buffer; contentType: string; filename: string };

/**
 * Customer document vault: identity and income documents kept on the profile.
 * Document numbers are encrypted at rest (AES-256-GCM) and only ever shown
 * masked; files live in the KYC bucket under `vault/<userId>/…`.
 */
@Injectable()
export class CustomerDocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly encryption: EncryptionService,
    private readonly activity: ActivityService,
  ) {}

  async list(userId: string): Promise<CustomerDocumentDto[]> {
    const docs = await this.prisma.customerDocument.findMany({
      where: { userId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    return docs.map((doc) => this.toDto(doc));
  }

  async upload(
    user: User,
    input: UploadCustomerDocumentInput,
    file: Express.Multer.File | undefined,
  ): Promise<CustomerDocumentDto> {
    this.storage.assertCustomerUploadFile(file);
    const upload = file as Express.Multer.File;

    const issuedAt = input.issued_at ? parseIsoDate(input.issued_at) : null;
    if (input.issued_at && !issuedAt) throw new BadRequestException('issued_at_invalid');
    const expiresAt = input.expires_at ? parseIsoDate(input.expires_at) : null;
    if (input.expires_at && !expiresAt) throw new BadRequestException('expires_at_invalid');
    if (issuedAt && expiresAt && expiresAt.getTime() < issuedAt.getTime()) {
      throw new BadRequestException('expires_before_issued');
    }

    const number = input.document_number?.trim() || null;
    const storagePath = await this.storage.uploadVaultDocument(upload, user.id, input.category);
    const doc = await this.prisma.customerDocument.create({
      data: {
        userId: user.id,
        category: input.category,
        storagePath,
        mimeType: upload.mimetype,
        originalName: upload.originalname?.slice(0, 200) || null,
        sizeBytes: upload.size ?? upload.buffer.length,
        documentNumberEnc: number ? this.encryption.encrypt(number) : null,
        issuedAt,
        expiresAt,
      },
    });

    await this.activity.log({
      actorUserId: user.id,
      entityType: 'customer_document',
      entityId: doc.id,
      action: 'vault_document_uploaded',
      metadata: { category: doc.category, has_expiry: Boolean(expiresAt), has_number: Boolean(number) },
    });
    return this.toDto(doc);
  }

  async download(user: User, id: string): Promise<VaultFile> {
    const doc = await this.findOwned(user.id, id);
    return this.readFile(doc);
  }

  async softDelete(user: User, id: string): Promise<{ status: true }> {
    const doc = await this.findOwned(user.id, id);
    await this.prisma.customerDocument.update({ where: { id: doc.id }, data: { deletedAt: new Date() } });
    await this.activity.log({
      actorUserId: user.id,
      entityType: 'customer_document',
      entityId: doc.id,
      action: 'vault_document_deleted',
      metadata: { category: doc.category },
    });
    return { status: true };
  }

  // ---- Ops (credit / admin / super_admin) ----

  async listForOps(actor: User, userId: string): Promise<CustomerDocumentDto[]> {
    await this.assertOpsAccess(actor, userId);
    return this.list(userId);
  }

  async downloadForOps(actor: User, userId: string, id: string): Promise<VaultFile> {
    await this.assertOpsAccess(actor, userId);
    const doc = await this.findLive(userId, id);
    await this.activity.log({
      actorUserId: actor.id,
      entityType: 'customer_document',
      entityId: doc.id,
      action: 'vault_document_viewed',
      metadata: { user_id: userId, category: doc.category },
    });
    return this.readFile(doc);
  }

  async verify(actor: User, userId: string, id: string): Promise<CustomerDocumentDto> {
    await this.assertOpsAccess(actor, userId);
    const doc = await this.findLive(userId, id);
    const updated = await this.prisma.customerDocument.update({
      where: { id: doc.id },
      data: { verifiedAt: new Date(), verifiedById: actor.id },
    });
    await this.activity.log({
      actorUserId: actor.id,
      entityType: 'customer_document',
      entityId: doc.id,
      action: 'vault_document_verified',
      fromValue: doc.verifiedAt ? 'verified' : 'unverified',
      toValue: 'verified',
      metadata: { user_id: userId, category: doc.category },
    });
    await this.activity.notify(
      userId,
      'Document verified',
      `Your ${CUSTOMER_DOCUMENT_LABELS[doc.category]} has been verified by Blox.`,
      '/app/profile',
    );
    return this.toDto(updated);
  }

  /**
   * Admins see every vault; credit officers only customers with an application
   * inside their company scope. Out-of-scope customers read as not found.
   */
  private async assertOpsAccess(actor: User, userId: string): Promise<void> {
    const customer = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true },
    });
    if (!customer || customer.role !== UserRole.customer) throw new NotFoundException('customer_not_found');
    if (actor.role === UserRole.admin || actor.role === UserRole.super_admin) return;
    const allowed = await opsCompanyFilter(this.prisma, actor);
    if (allowed === null) return;
    const inScope = await this.prisma.application.count({
      where: { customerUserId: userId, companyId: { in: allowed } },
    });
    if (!inScope) throw new NotFoundException('customer_not_found');
  }

  private async findOwned(userId: string, id: string): Promise<CustomerDocument> {
    return this.findLive(userId, id);
  }

  private async findLive(userId: string, id: string): Promise<CustomerDocument> {
    const doc = await this.prisma.customerDocument.findFirst({ where: { id, userId, deletedAt: null } });
    if (!doc) throw new NotFoundException('document_not_found');
    return doc;
  }

  private toDto(doc: CustomerDocument): CustomerDocumentDto {
    let number: string | null = null;
    if (doc.documentNumberEnc) {
      try {
        number = this.encryption.decrypt(doc.documentNumberEnc);
      } catch {
        number = null;
      }
    }
    return toCustomerDocumentDto(doc, number);
  }

  private async readFile(doc: CustomerDocument): Promise<VaultFile> {
    const file = await this.storage.readKyc(doc.storagePath);
    const ext = path.extname(doc.storagePath) || '';
    const filename = doc.originalName?.trim() || `${doc.category}${ext}`;
    return { buffer: file.buffer, contentType: doc.mimeType ?? file.contentType, filename };
  }
}
