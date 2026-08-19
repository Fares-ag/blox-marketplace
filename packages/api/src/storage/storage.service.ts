import {
  BadRequestException,
  Injectable,
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

@Injectable()
export class StorageService implements OnModuleInit {
  private client: S3Client | null = null;
  private useLocal = false;
  private localRoot = path.join(process.cwd(), '.uploads');

  constructor(private readonly config: ConfigService) {}

  async onModuleInit() {
    const endpoint = this.config.get<string>('S3_ENDPOINT');
    if (!endpoint) {
      this.useLocal = true;
      await mkdir(this.localRoot, { recursive: true });
      return;
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
    const key = `${companyId}/${productId}/${randomUUID()}-${file.originalname}`;
    await this.put(bucket, key, file.buffer, file.mimetype);
    return this.publicUrl(bucket, key);
  }

  async uploadKyc(
    file: Express.Multer.File,
    applicationId: string,
    category: string,
  ) {
    const bucket = this.config.get('S3_BUCKET_KYC') ?? 'kyc-docs';
    const key = `${applicationId}/${category}/${randomUUID()}-${file.originalname}`;
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
    const endpoint = this.config.get('S3_ENDPOINT');
    return `${endpoint}/${bucket}/${key}`;
  }

  assertImage(file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('validation_failed');
    if (!file.mimetype.startsWith('image/')) {
      throw new BadRequestException('validation_failed');
    }
  }

  private static readonly KYC_ALLOWED_MIME = new Set([
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
  ]);

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

  async storeContractPdf(applicationId: string, buffer: Buffer): Promise<string> {
    const bucket = this.config.get('S3_BUCKET_CONTRACTS') ?? 'contracts';
    const key = `${applicationId}/generated/contract.pdf`;
    await this.put(bucket, key, buffer, 'application/pdf');
    return key;
  }

  async uploadSignedContract(file: Express.Multer.File, applicationId: string): Promise<string> {
    const bucket = this.config.get('S3_BUCKET_CONTRACTS') ?? 'contracts';
    const key = `${applicationId}/signed/${randomUUID()}-${file.originalname}`;
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
