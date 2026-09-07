"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveQautoImageSourceDir = resolveQautoImageSourceDir;
exports.resolveQautoSourceFile = resolveQautoSourceFile;
exports.uploadQautoListingImages = uploadQautoListingImages;
const promises_1 = require("node:fs/promises");
const node_path_1 = __importDefault(require("node:path"));
const client_s3_1 = require("@aws-sdk/client-s3");
const seed_qauto_inventory_1 = require("./seed-qauto-inventory");
const VW_MODEL_SOURCE = {
    Teramont: 'vehicle-1-vw-teramont-grey.png',
    'T-Roc': 'vehicle-1-vw-teramont-grey.png',
    Tiguan: 'vehicle-1-vw-teramont-grey.png',
    Amarok: 'vehicle-1-vw-teramont-grey.png',
    Jetta: 'sedan.png',
    Passat: 'sedan.png',
    Caddy: 'sedan.png',
};
const LOCAL_BUCKET = 'listing-images';
function mimeForExt(ext) {
    switch (ext.toLowerCase()) {
        case '.webp':
            return 'image/webp';
        case '.png':
            return 'image/png';
        case '.jpg':
        case '.jpeg':
            return 'image/jpeg';
        default:
            return 'application/octet-stream';
    }
}
async function resolveQautoImageSourceDir() {
    const fromEnv = process.env.QAUTO_IMAGE_SOURCE_DIR?.trim();
    if (fromEnv)
        return node_path_1.default.resolve(fromEnv);
    const candidates = [
        node_path_1.default.resolve(process.cwd(), 'assets/qauto-catalog'),
        node_path_1.default.resolve(process.cwd(), '../../../blox-app/assets/vehicles/catalog'),
        node_path_1.default.resolve(process.cwd(), '../../blox-app/assets/vehicles/catalog'),
    ];
    for (const candidate of candidates) {
        if (await fileExists(candidate))
            return candidate;
    }
    return candidates[0];
}
async function fileExists(filePath) {
    try {
        await (0, promises_1.access)(filePath);
        return true;
    }
    catch {
        return false;
    }
}
function audiSourceName(listing) {
    if (!listing.image)
        return null;
    const base = node_path_1.default.basename(listing.image);
    return base || null;
}
function vwSourceName(listing) {
    return VW_MODEL_SOURCE[listing.model] ?? 'sedan.png';
}
async function resolveQautoSourceFile(listing, sourceDir) {
    const fileName = listing.make === 'Audi' ? audiSourceName(listing) : vwSourceName(listing);
    if (!fileName)
        return null;
    const filePath = node_path_1.default.join(sourceDir, fileName);
    if (!(await fileExists(filePath)))
        return null;
    return {
        filePath,
        kind: listing.make === 'Audi' ? 'catalog' : 'fallback',
    };
}
function storageKey(productId, ext) {
    return `qauto/${productId}/cover${ext}`;
}
function publicPath(key, useLocal, publicBase) {
    if (publicBase)
        return `${publicBase.replace(/\/$/, '')}/${key}`;
    if (useLocal)
        return `/uploads/${LOCAL_BUCKET}/${key}`;
    return `/api/v1/media/listings/${key}`;
}
async function createStorageWriter() {
    const endpoint = process.env.S3_ENDPOINT?.trim();
    const localRoot = node_path_1.default.join(process.cwd(), '.uploads');
    if (!endpoint) {
        await (0, promises_1.mkdir)(localRoot, { recursive: true });
        return {
            useLocal: true,
            put: async (key, body, _contentType) => {
                const full = node_path_1.default.join(localRoot, LOCAL_BUCKET, key);
                await (0, promises_1.mkdir)(node_path_1.default.dirname(full), { recursive: true });
                await (0, promises_1.writeFile)(full, body);
                return publicPath(key, true);
            },
        };
    }
    const client = new client_s3_1.S3Client({
        region: process.env.S3_REGION ?? 'us-east-1',
        endpoint,
        forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
        credentials: {
            accessKeyId: process.env.S3_ACCESS_KEY ?? '',
            secretAccessKey: process.env.S3_SECRET_KEY ?? '',
        },
    });
    const bucket = process.env.S3_BUCKET_LISTINGS ?? LOCAL_BUCKET;
    try {
        await client.send(new client_s3_1.CreateBucketCommand({ Bucket: bucket }));
    }
    catch {
    }
    const publicBase = process.env.S3_PUBLIC_BASE_URL?.trim();
    return {
        useLocal: false,
        put: async (key, body, contentType) => {
            await client.send(new client_s3_1.PutObjectCommand({
                Bucket: bucket,
                Key: key,
                Body: body,
                ContentType: contentType,
            }));
            return publicPath(key, false, publicBase);
        },
    };
}
async function upsertCoverPath(prisma, productId, listing, storagePath) {
    const alt = `${listing.make} ${listing.model}`.trim();
    const existing = await prisma.productImage.findFirst({
        where: { productId, sortOrder: 0 },
    });
    if (existing) {
        await prisma.productImage.update({
            where: { id: existing.id },
            data: { storagePath, altText: alt },
        });
        return;
    }
    await prisma.productImage.create({
        data: {
            productId,
            storagePath,
            sortOrder: 0,
            altText: alt,
        },
    });
}
async function uploadQautoListingImages(prisma, opts) {
    const sourceDir = opts?.sourceDir ?? (await resolveQautoImageSourceDir());
    if (!(await fileExists(sourceDir))) {
        throw new Error(`QAuto image source directory not found: ${sourceDir}. Set QAUTO_IMAGE_SOURCE_DIR or copy assets to packages/api/assets/qauto-catalog`);
    }
    const storage = await createStorageWriter();
    const listings = (0, seed_qauto_inventory_1.loadQautoListings)();
    let uploadedCatalog = 0;
    let uploadedFallback = 0;
    let missingProduct = 0;
    let missingSource = 0;
    for (const listing of listings) {
        const product = await prisma.product.findUnique({ where: { id: listing.id } });
        if (!product) {
            missingProduct += 1;
            continue;
        }
        const source = await resolveQautoSourceFile(listing, sourceDir);
        if (!source) {
            missingSource += 1;
            continue;
        }
        const ext = node_path_1.default.extname(source.filePath).toLowerCase() || '.webp';
        const bytes = await (0, promises_1.readFile)(source.filePath);
        const key = storageKey(listing.id, ext);
        const url = await storage.put(key, bytes, mimeForExt(ext));
        await upsertCoverPath(prisma, product.id, listing, url);
        if (source.kind === 'catalog')
            uploadedCatalog += 1;
        else
            uploadedFallback += 1;
    }
    return {
        sourceDir,
        uploadedCatalog,
        uploadedFallback,
        uploadedTotal: uploadedCatalog + uploadedFallback,
        missingProduct,
        missingSource,
    };
}
//# sourceMappingURL=upload-qauto-listing-images.js.map