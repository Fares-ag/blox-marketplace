import { PayloadTooLargeException } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

type MulterLikeError = Error & { code?: string };

/** Converts multer LIMIT_FILE_SIZE into a Nest HttpException for the global error envelope. */
export function applyMulterErrorMiddleware(
  expressApp: { use: (...handlers: unknown[]) => unknown },
  multer: { MulterError: new (...args: unknown[]) => MulterLikeError },
): void {
  expressApp.use(
    (err: MulterLikeError, _req: Request, _res: Response, next: NextFunction) => {
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        next(new PayloadTooLargeException('file_too_large'));
        return;
      }
      next(err);
    },
  );
}
