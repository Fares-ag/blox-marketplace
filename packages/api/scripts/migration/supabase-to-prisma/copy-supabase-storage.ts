/**
 * Copy Supabase Storage objects into marketplace S3/MinIO.
 *
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... S3_ENDPOINT=... \
 *     npx tsx scripts/migration/supabase-to-prisma/copy-supabase-storage.ts
 */
import { createHash } from 'node:crypto';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

async function listObjects(url: string, key: string, prefix: string): Promise<string[]> {
  const res = await fetch(`${url}/storage/v1/object/list/documents`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ prefix, limit: 1000 }),
  });
  if (!res.ok) {
    console.warn(`list ${prefix} failed: ${res.status}`);
    return [];
  }
  const body = (await res.json()) as Array<{ name?: string }>;
  return body.map((o) => `${prefix}${o.name ?? ''}`).filter(Boolean);
}

async function download(url: string, key: string, path: string): Promise<Buffer> {
  const res = await fetch(`${url}/storage/v1/object/documents/${path}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!res.ok) throw new Error(`download ${path} HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function main() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const endpoint = process.env.S3_ENDPOINT?.trim();
  if (!url || !key || !endpoint) {
    console.error('SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, S3_ENDPOINT required');
    process.exit(1);
  }
  const client = new S3Client({
    region: process.env.S3_REGION ?? 'us-east-1',
    endpoint,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY ?? '',
      secretAccessKey: process.env.S3_SECRET_KEY ?? '',
    },
  });

  const kycBucket = process.env.S3_BUCKET_KYC ?? 'kyc-docs';
  const contractBucket = process.env.S3_BUCKET_CONTRACTS ?? 'contracts';

  const prefixes: Array<{ prefix: string; bucket: string }> = [
    { prefix: 'application-documents/', bucket: kycBucket },
    { prefix: 'signed-contracts/', bucket: contractBucket },
  ];

  for (const { prefix, bucket } of prefixes) {
    const keys = await listObjects(url, key, prefix);
    console.log(`${prefix}: ${keys.length} objects → ${bucket}`);
    for (const objectKey of keys) {
      const bytes = await download(url, key, objectKey);
      const checksum = createHash('sha256').update(bytes).digest('hex');
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: objectKey,
          Body: bytes,
          Metadata: { sha256: checksum },
        }),
      );
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
