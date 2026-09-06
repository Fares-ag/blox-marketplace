import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CreateBucketCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const KYC_MIME_TO_EXT: Record<string, string> = {
  'application/pdf': '.pdf',
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

/** Customer self-service uploads (vault, takaful): pdf/jpeg/png only, 5 MB — mirrors DOCUMENT_UPLOAD_* in shared. */
const CUSTOMER_MIME_TO_EXT: Record<string, string> = {
  'application/pdf': '.pdf',
  'image/jpeg': '.jpg',
  'image/png': '.png',
};

export const CUSTOMER_UPLOAD_MAX_BYTES = 5 * 1024 * 1024;

const LISTING_MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

/**
 * Data residency (LOS FSD §11.1): in production, customer documents and
 * contracts may only be written to an approved in-region bucket. Set
 * STORAGE_ALLOWED_REGIONS to a comma-separated list (e.g. `me-south-1,
 * me-central-1`); when it is empty the check is skipped so self-hosted MinIO
 * deployments keep working. The local .uploads/ fallback is already refused in
 * production above.
 */
export function assertStorageRegionAllowed(config: ConfigService): void {
  const allowed = (config.get<string>('STORAGE_ALLOWED_REGIONS') ?? '')
    .split(',')
    .map((r) => r.trim().toLowerCase())
    .filter(Boolean);
  if (!allowed.length) return;
  const region = (config.get<string>('S3_REGION') ?? '').trim().toLowerCase();
  if (!region || !allowed.includes(region)) {
    throw new Error(
      `S3_REGION "${region || '(unset)'}" is not in STORAGE_ALLOWED_REGIONS (${allowed.join(', ')}). ` +
        'Customer data must stay in an approved region.',
    );
  }
}

@Injectable()
export class StorageService implements OnModuleInit {
  private client: S3Client | null = null;
  private useLocal = false;
  private localRoot = path.join(process.cwd(), '.uploads');

  constructor(private readonly config: ConfigService) {}

  async onModuleInit() {
    const endpoint = this.config.get<string>('S3_ENDPOINT')?.trim();
    const isProduction = process.env.NODE_ENV === 'production';

    if (!endpoint) {
      if (isProduction) {
        throw new Error(
          'S3_ENDPOINT is required in production. Local .uploads/ fallback is not permitted — KYC and contract PDFs must use durable object storage.',
        );
      }
      this.useLocal = true;
      await mkdir(this.localRoot, { recursive: true });
      return;
    }

    if (isProduction) {
      const missing: string[] = [];
      if (!this.config.get<string>('S3_ACCESS_KEY')?.trim()) missing.push('S3_ACCESS_KEY');
      if (!this.config.get<string>('S3_SECRET_KEY')?.trim()) missing.push('S3_SECRET_KEY');
      for (const key of ['S3_BUCKET_LISTINGS', 'S3_BUCKET_KYC', 'S3_BUCKET_CONTRACTS'] as const) {
        if (!this.config.get<string>(key)?.trim()) missing.push(key);
      }
      if (missing.length) {
        throw new Error(
          `Missing required S3 configuration in production: ${missing.join(', ')}`,
        );
      }
      assertStorageRegionAllowed(this.config);
    }

    this.client = new S3Client({
      region: this.config.get('S3_REGION') ?? 'us-east-1',
      endpoint,
      forcePathStyle: this.config.get('S3_FORCE_PATH_STYLE') === 'true',
      credentials: {
        accessKeyId: this.config.get('S3_ACCESS_KEY') ?? '',
        secretAccessKey: this.config.get('S3_SECRET_KEY') ?? '',
      },
    });
    for (const key of ['S3_BUCKET_LISTINGS', 'S3_BUCKET_KYC', 'S3_BUCKET_CONTRACTS'] as const) {
      const bucket = this.config.get<string>(key);
      if (!bucket) continue;
      try {
        await this.client.send(new CreateBucketCommand({ Bucket: bucket }));
      } catch {
        /* exists */
      }
    }
  }

  async uploadListingImage(file: Express.Multer.File, companyId: string, productId: string) {
    const bucket = this.config.get('S3_BUCKET_LISTINGS') ?? 'listing-images';
    const ext = this.extensionFromMime(file.mimetype, LISTING_MIME_TO_EXT);
    const key = `${companyId}/${productId}/${randomUUID()}${ext}`;
    await this.put(bucket, key, file.buffer, file.mimetype);
    return this.publicUrl(bucket, key);
  }

  async uploadKyc(
    file: Express.Multer.File,
    applicationId: string,
    category: string,
  ) {
    const bucket = this.config.get('S3_BUCKET_KYC') ?? 'kyc-docs';
    const ext = this.extensionFromMime(file.mimetype, KYC_MIME_TO_EXT);
    const key = `${applicationId}/${category}/${randomUUID()}${ext}`;
    await this.put(bucket, key, file.buffer, file.mimetype);
    return key;
  }

  private async put(bucket: string, key: string, body: Buffer, contentType: string) {
    if (this.useLocal || !this.client) {
      const full = path.join(this.localRoot, bucket, key);
      await mkdir(path.dirname(full), { recursive: true });
      await writeFile(full, body);
      return;
    }
    await this.client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
  }

  private publicUrl(bucket: string, key: string) {
    const base = this.config.get<string>('S3_PUBLIC_BASE_URL');
    if (base) return `${base.replace(/\/$/, '')}/${key}`;
    if (this.useLocal) return `/uploads/${bucket}/${key}`;
    return `/api/v1/media/listings/${key}`;
  }

  async readListingImage(objectKey: string): Promise<{ buffer: Buffer; contentType: string }> {
    const buckets = [
      this.config.get<string>('S3_BUCKET_LISTINGS') ?? 'listing-images',
      'listing-images',
      'blox-listings',
    ].filter((bucket, index, all) => bucket && all.indexOf(bucket) === index);

    let lastError: unknown;
    for (const bucket of buckets) {
      try {
        return await this.readObject(bucket, objectKey);
      } catch (err) {
        lastError = err;
        if (!this.isMissingObjectError(err)) continue;
      }
    }
    if (this.isMissingObjectError(lastError)) {
      throw new NotFoundException('listing_image_not_found');
    }
    throw lastError ?? new BadRequestException('validation_failed');
  }

  private isMissingObjectError(err: unknown): boolean {
    if (!err || typeof err !== 'object') return false;
    const code = (err as { Code?: string; name?: string }).Code ?? (err as { name?: string }).name;
    return code === 'NoSuchKey' || code === 'NotFound' || code === 'ENOENT';
  }

  assertImage(file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('validation_failed');
    if (!file.mimetype.startsWith('image/')) {
      throw new BadRequestException('validation_failed');
    }
  }

  private static readonly KYC_ALLOWED_MIME = new Set(Object.keys(KYC_MIME_TO_EXT));

  private static readonly KYC_MAX_BYTES = 10 * 1024 * 1024;

  assertKycFile(file?: Express.Multer.File) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('validation_failed');
    }
    if (!StorageService.KYC_ALLOWED_MIME.has(file.mimetype)) {
      throw new BadRequestException('invalid_file_type');
    }
    const size = file.size ?? file.buffer.length;
    if (size > StorageService.KYC_MAX_BYTES) {
      throw new BadRequestException('file_too_large');
    }
  }

  async readKyc(storagePath: string): Promise<{ buffer: Buffer; contentType: string }> {
    const bucket = this.config.get('S3_BUCKET_KYC') ?? 'kyc-docs';
    return this.readObject(bucket, storagePath);
  }

  /** Customer self-service upload policy: present, pdf/jpeg/png, at most 5 MB. */
  assertCustomerUploadFile(file?: Express.Multer.File) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('validation_failed');
    }
    if (!CUSTOMER_MIME_TO_EXT[file.mimetype]) {
      throw new BadRequestException('invalid_file_type');
    }
    const size = file.size ?? file.buffer.length;
    if (size > CUSTOMER_UPLOAD_MAX_BYTES) {
      throw new BadRequestException('file_too_large');
    }
  }

  /** Document vault: stored in the KYC bucket under `vault/<userId>/<category>/<uuid>`; read back with readKyc(). */
  async uploadVaultDocument(file: Express.Multer.File, userId: string, category: string): Promise<string> {
    const bucket = this.config.get('S3_BUCKET_KYC') ?? 'kyc-docs';
    const ext = this.extensionFromMime(file.mimetype, CUSTOMER_MIME_TO_EXT);
    const key = `vault/${userId}/${category}/${randomUUID()}${ext}`;
    await this.put(bucket, key, file.buffer, file.mimetype);
    return key;
  }

  /** Takaful policy document: KYC bucket under `takaful/<applicationId>/<policyId>/<uuid>`; read back with readKyc(). */
  async uploadTakafulDocument(file: Express.Multer.File, applicationId: string, policyId: string): Promise<string> {
    const bucket = this.config.get('S3_BUCKET_KYC') ?? 'kyc-docs';
    const ext = this.extensionFromMime(file.mimetype, CUSTOMER_MIME_TO_EXT);
    const key = `takaful/${applicationId}/${policyId}/${randomUUID()}${ext}`;
    await this.put(bucket, key, file.buffer, file.mimetype);
    return key;
  }

  async storeContractPdf(applicationId: string, buffer: Buffer): Promise<string> {
    const bucket = this.config.get('S3_BUCKET_CONTRACTS') ?? 'contracts';
    const key = `${applicationId}/generated/contract.pdf`;
    await this.put(bucket, key, buffer, 'application/pdf');
    return key;
  }

  async uploadSignedContract(file: Express.Multer.File, applicationId: string): Promise<string> {
    const bucket = this.config.get('S3_BUCKET_CONTRACTS') ?? 'contracts';
    const key = `${applicationId}/signed/${randomUUID()}.pdf`;
    await this.put(bucket, key, file.buffer, file.mimetype);
    return key;
  }

  async readContract(storagePath: string): Promise<{ buffer: Buffer; contentType: string }> {
    const bucket = this.config.get('S3_BUCKET_CONTRACTS') ?? 'contracts';
    return this.readObject(bucket, storagePath);
  }

  assertSignedContractFile(file?: Express.Multer.File) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('validation_failed');
    }
    if (file.mimetype !== 'application/pdf') {
      throw new BadRequestException('invalid_file_type');
    }
    const size = file.size ?? file.buffer.length;
    if (size > StorageService.KYC_MAX_BYTES) {
      throw new BadRequestException('file_too_large');
    }
  }

  private extensionFromMime(mime: string, allowList: Record<string, string>): string {
    const ext = allowList[mime];
    if (!ext) throw new BadRequestException('invalid_file_type');
    return ext;
  }

  private async readObject(bucket: string, storagePath: string): Promise<{ buffer: Buffer; contentType: string }> {
    if (this.useLocal || !this.client) {
      const full = path.join(this.localRoot, bucket, storagePath);
      const buffer = await readFile(full);
      const ext = path.extname(storagePath).toLowerCase();
      const contentType =
        ext === '.pdf'
          ? 'application/pdf'
          : ext === '.png'
            ? 'image/png'
            : ext === '.webp'
              ? 'image/webp'
              : ext === '.jpg' || ext === '.jpeg'
                ? 'image/jpeg'
                : 'application/octet-stream';
      return { buffer, contentType };
    }
    const result = await this.client.send(
      new GetObjectCommand({ Bucket: bucket, Key: storagePath }),
    );
    const body = result.Body;
    if (!body) throw new BadRequestException('validation_failed');
    const buffer = Buffer.from(await body.transformToByteArray());
    return { buffer, contentType: result.ContentType ?? 'application/octet-stream' };
  }
}
