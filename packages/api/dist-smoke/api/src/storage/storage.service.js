"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var StorageService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.StorageService = exports.CUSTOMER_UPLOAD_MAX_BYTES = void 0;
exports.assertStorageRegionAllowed = assertStorageRegionAllowed;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const client_s3_1 = require("@aws-sdk/client-s3");
const promises_1 = require("node:fs/promises");
const node_path_1 = __importDefault(require("node:path"));
const node_crypto_1 = require("node:crypto");
const KYC_MIME_TO_EXT = {
    'application/pdf': '.pdf',
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
};
const CUSTOMER_MIME_TO_EXT = {
    'application/pdf': '.pdf',
    'image/jpeg': '.jpg',
    'image/png': '.png',
};
exports.CUSTOMER_UPLOAD_MAX_BYTES = 5 * 1024 * 1024;
const LISTING_MIME_TO_EXT = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif',
};
function assertStorageRegionAllowed(config) {
    const allowed = (config.get('STORAGE_ALLOWED_REGIONS') ?? '')
        .split(',')
        .map((r) => r.trim().toLowerCase())
        .filter(Boolean);
    if (!allowed.length)
        return;
    const region = (config.get('S3_REGION') ?? '').trim().toLowerCase();
    if (!region || !allowed.includes(region)) {
        throw new Error(`S3_REGION "${region || '(unset)'}" is not in STORAGE_ALLOWED_REGIONS (${allowed.join(', ')}). ` +
            'Customer data must stay in an approved region.');
    }
}
let StorageService = class StorageService {
    static { StorageService_1 = this; }
    config;
    client = null;
    useLocal = false;
    localRoot = node_path_1.default.join(process.cwd(), '.uploads');
    constructor(config) {
        this.config = config;
    }
    async onModuleInit() {
        const endpoint = this.config.get('S3_ENDPOINT')?.trim();
        const isProduction = process.env.NODE_ENV === 'production';
        if (!endpoint) {
            if (isProduction) {
                throw new Error('S3_ENDPOINT is required in production. Local .uploads/ fallback is not permitted — KYC and contract PDFs must use durable object storage.');
            }
            this.useLocal = true;
            await (0, promises_1.mkdir)(this.localRoot, { recursive: true });
            return;
        }
        if (isProduction) {
            const missing = [];
            if (!this.config.get('S3_ACCESS_KEY')?.trim())
                missing.push('S3_ACCESS_KEY');
            if (!this.config.get('S3_SECRET_KEY')?.trim())
                missing.push('S3_SECRET_KEY');
            for (const key of ['S3_BUCKET_LISTINGS', 'S3_BUCKET_KYC', 'S3_BUCKET_CONTRACTS']) {
                if (!this.config.get(key)?.trim())
                    missing.push(key);
            }
            if (missing.length) {
                throw new Error(`Missing required S3 configuration in production: ${missing.join(', ')}`);
            }
            assertStorageRegionAllowed(this.config);
        }
        this.client = new client_s3_1.S3Client({
            region: this.config.get('S3_REGION') ?? 'us-east-1',
            endpoint,
            forcePathStyle: this.config.get('S3_FORCE_PATH_STYLE') === 'true',
            credentials: {
                accessKeyId: this.config.get('S3_ACCESS_KEY') ?? '',
                secretAccessKey: this.config.get('S3_SECRET_KEY') ?? '',
            },
        });
        for (const key of ['S3_BUCKET_LISTINGS', 'S3_BUCKET_KYC', 'S3_BUCKET_CONTRACTS']) {
            const bucket = this.config.get(key);
            if (!bucket)
                continue;
            try {
                await this.client.send(new client_s3_1.CreateBucketCommand({ Bucket: bucket }));
            }
            catch {
            }
        }
    }
    async uploadListingImage(file, companyId, productId) {
        const bucket = this.config.get('S3_BUCKET_LISTINGS') ?? 'listing-images';
        const ext = this.extensionFromMime(file.mimetype, LISTING_MIME_TO_EXT);
        const key = `${companyId}/${productId}/${(0, node_crypto_1.randomUUID)()}${ext}`;
        await this.put(bucket, key, file.buffer, file.mimetype);
        return this.publicUrl(bucket, key);
    }
    async uploadKyc(file, applicationId, category) {
        const bucket = this.config.get('S3_BUCKET_KYC') ?? 'kyc-docs';
        const ext = this.extensionFromMime(file.mimetype, KYC_MIME_TO_EXT);
        const key = `${applicationId}/${category}/${(0, node_crypto_1.randomUUID)()}${ext}`;
        await this.put(bucket, key, file.buffer, file.mimetype);
        return key;
    }
    async put(bucket, key, body, contentType) {
        if (this.useLocal || !this.client) {
            const full = node_path_1.default.join(this.localRoot, bucket, key);
            await (0, promises_1.mkdir)(node_path_1.default.dirname(full), { recursive: true });
            await (0, promises_1.writeFile)(full, body);
            return;
        }
        await this.client.send(new client_s3_1.PutObjectCommand({
            Bucket: bucket,
            Key: key,
            Body: body,
            ContentType: contentType,
        }));
    }
    publicUrl(bucket, key) {
        const base = this.config.get('S3_PUBLIC_BASE_URL');
        if (base)
            return `${base.replace(/\/$/, '')}/${key}`;
        if (this.useLocal)
            return `/uploads/${bucket}/${key}`;
        return `/api/v1/media/listings/${key}`;
    }
    async readListingImage(objectKey) {
        const buckets = [
            this.config.get('S3_BUCKET_LISTINGS') ?? 'listing-images',
            'listing-images',
            'blox-listings',
        ].filter((bucket, index, all) => bucket && all.indexOf(bucket) === index);
        let lastError;
        for (const bucket of buckets) {
            try {
                return await this.readObject(bucket, objectKey);
            }
            catch (err) {
                lastError = err;
                if (!this.isMissingObjectError(err))
                    continue;
            }
        }
        if (this.isMissingObjectError(lastError)) {
            throw new common_1.NotFoundException('listing_image_not_found');
        }
        throw lastError ?? new common_1.BadRequestException('validation_failed');
    }
    isMissingObjectError(err) {
        if (!err || typeof err !== 'object')
            return false;
        const code = err.Code ?? err.name;
        return code === 'NoSuchKey' || code === 'NotFound' || code === 'ENOENT';
    }
    assertImage(file) {
        if (!file)
            throw new common_1.BadRequestException('validation_failed');
        if (!file.mimetype.startsWith('image/')) {
            throw new common_1.BadRequestException('validation_failed');
        }
    }
    static KYC_ALLOWED_MIME = new Set(Object.keys(KYC_MIME_TO_EXT));
    static KYC_MAX_BYTES = 10 * 1024 * 1024;
    assertKycFile(file) {
        if (!file?.buffer?.length) {
            throw new common_1.BadRequestException('validation_failed');
        }
        if (!StorageService_1.KYC_ALLOWED_MIME.has(file.mimetype)) {
            throw new common_1.BadRequestException('invalid_file_type');
        }
        const size = file.size ?? file.buffer.length;
        if (size > StorageService_1.KYC_MAX_BYTES) {
            throw new common_1.BadRequestException('file_too_large');
        }
    }
    async readKyc(storagePath) {
        const bucket = this.config.get('S3_BUCKET_KYC') ?? 'kyc-docs';
        return this.readObject(bucket, storagePath);
    }
    assertCustomerUploadFile(file) {
        if (!file?.buffer?.length) {
            throw new common_1.BadRequestException('validation_failed');
        }
        if (!CUSTOMER_MIME_TO_EXT[file.mimetype]) {
            throw new common_1.BadRequestException('invalid_file_type');
        }
        const size = file.size ?? file.buffer.length;
        if (size > exports.CUSTOMER_UPLOAD_MAX_BYTES) {
            throw new common_1.BadRequestException('file_too_large');
        }
    }
    async uploadVaultDocument(file, userId, category) {
        const bucket = this.config.get('S3_BUCKET_KYC') ?? 'kyc-docs';
        const ext = this.extensionFromMime(file.mimetype, CUSTOMER_MIME_TO_EXT);
        const key = `vault/${userId}/${category}/${(0, node_crypto_1.randomUUID)()}${ext}`;
        await this.put(bucket, key, file.buffer, file.mimetype);
        return key;
    }
    async uploadTakafulDocument(file, applicationId, policyId) {
        const bucket = this.config.get('S3_BUCKET_KYC') ?? 'kyc-docs';
        const ext = this.extensionFromMime(file.mimetype, CUSTOMER_MIME_TO_EXT);
        const key = `takaful/${applicationId}/${policyId}/${(0, node_crypto_1.randomUUID)()}${ext}`;
        await this.put(bucket, key, file.buffer, file.mimetype);
        return key;
    }
    async storeContractPdf(applicationId, buffer) {
        const bucket = this.config.get('S3_BUCKET_CONTRACTS') ?? 'contracts';
        const key = `${applicationId}/generated/contract.pdf`;
        await this.put(bucket, key, buffer, 'application/pdf');
        return key;
    }
    async uploadSignedContract(file, applicationId) {
        const bucket = this.config.get('S3_BUCKET_CONTRACTS') ?? 'contracts';
        const key = `${applicationId}/signed/${(0, node_crypto_1.randomUUID)()}.pdf`;
        await this.put(bucket, key, file.buffer, file.mimetype);
        return key;
    }
    async readContract(storagePath) {
        const bucket = this.config.get('S3_BUCKET_CONTRACTS') ?? 'contracts';
        return this.readObject(bucket, storagePath);
    }
    assertSignedContractFile(file) {
        if (!file?.buffer?.length) {
            throw new common_1.BadRequestException('validation_failed');
        }
        if (file.mimetype !== 'application/pdf') {
            throw new common_1.BadRequestException('invalid_file_type');
        }
        const size = file.size ?? file.buffer.length;
        if (size > StorageService_1.KYC_MAX_BYTES) {
            throw new common_1.BadRequestException('file_too_large');
        }
    }
    extensionFromMime(mime, allowList) {
        const ext = allowList[mime];
        if (!ext)
            throw new common_1.BadRequestException('invalid_file_type');
        return ext;
    }
    async readObject(bucket, storagePath) {
        if (this.useLocal || !this.client) {
            const full = node_path_1.default.join(this.localRoot, bucket, storagePath);
            const buffer = await (0, promises_1.readFile)(full);
            const ext = node_path_1.default.extname(storagePath).toLowerCase();
            const contentType = ext === '.pdf'
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
        const result = await this.client.send(new client_s3_1.GetObjectCommand({ Bucket: bucket, Key: storagePath }));
        const body = result.Body;
        if (!body)
            throw new common_1.BadRequestException('validation_failed');
        const buffer = Buffer.from(await body.transformToByteArray());
        return { buffer, contentType: result.ContentType ?? 'application/octet-stream' };
    }
};
exports.StorageService = StorageService;
exports.StorageService = StorageService = StorageService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], StorageService);
//# sourceMappingURL=storage.service.js.map