import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';

/** Max upload size enforced by multer before buffering completes. */
export const UPLOAD_MAX_BYTES = 10 * 1024 * 1024;

export function multerUploadOptions(): MulterOptions {
  return {
    limits: { fileSize: UPLOAD_MAX_BYTES },
  };
}
