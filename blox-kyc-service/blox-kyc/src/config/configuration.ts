export interface KycConfig {
  nodeEnv: string;
  port: number;
  serviceApiKey: string;
  fieldEncryptionKey: string;
}

/**
 * Loads and validates configuration at boot. Fails closed in production when a
 * required secret is missing or looks like a placeholder — the same discipline
 * the marketplace API uses for BETTER_AUTH_SECRET.
 */
export function loadConfig(): KycConfig {
  const nodeEnv = process.env.NODE_ENV ?? 'development';
  const isProd = nodeEnv === 'production';

  const serviceApiKey = (process.env.KYC_SERVICE_API_KEY ?? '').trim();
  const fieldEncryptionKey = (process.env.KYC_FIELD_ENCRYPTION_KEY ?? '').trim();

  if (isProd) {
    if (serviceApiKey.length < 24) {
      throw new Error('KYC_SERVICE_API_KEY is required in production (>=24 chars).');
    }
    if (!isValidBase64Key(fieldEncryptionKey, 32)) {
      throw new Error(
        'KYC_FIELD_ENCRYPTION_KEY must be a 32-byte base64 key in production (openssl rand -base64 32).',
      );
    }
  }

  return {
    nodeEnv,
    port: Number(process.env.KYC_PORT ?? process.env.PORT ?? 3020),
    serviceApiKey,
    fieldEncryptionKey,
  };
}

export function isValidBase64Key(value: string, bytes: number): boolean {
  if (!value) return false;
  try {
    return Buffer.from(value, 'base64').length === bytes;
  } catch {
    return false;
  }
}
