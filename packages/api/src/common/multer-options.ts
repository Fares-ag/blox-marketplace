import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';

/** Max upload size enforced by multer before buffering completes. Keep in step with DOCUMENT_UPLOAD_MAX_BYTES. */
export const UPLOAD_MAX_BYTES = 20 * 1024 * 1024;

export function multerUploadOptions(): MulterOptions {
  return {
    limits: { fileSize: UPLOAD_MAX_BYTES },
  };
}
