import type { Request, Response } from 'express';
import { StorageService } from '../storage/storage.service';

const LISTINGS_MARKER = '/media/listings/';

export function listingImageKeyFromRequest(req: Request): string | null {
  const idx = req.path.indexOf(LISTINGS_MARKER);
  if (idx < 0) return null;
  const key = decodeURIComponent(req.path.slice(idx + LISTINGS_MARKER.length));
  return key || null;
}

export async function serveListingImageRequest(
  storage: StorageService,
  req: Request,
  res: Response,
): Promise<void> {
  const key = listingImageKeyFromRequest(req);
  if (!key) {
    res.status(404).json({
      error: { code: 'not_found', message: 'Listing image path is required' },
    });
    return;
  }

  const file = await storage.readListingImage(key);
  res.setHeader('Content-Type', file.contentType);
  res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
  res.send(file.buffer);
}
