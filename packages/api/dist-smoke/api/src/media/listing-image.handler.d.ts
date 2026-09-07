import type { Request, Response } from 'express';
import { StorageService } from '../storage/storage.service';
export declare function listingImageKeyFromRequest(req: Request): string | null;
export declare function serveListingImageRequest(storage: StorageService, req: Request, res: Response): Promise<void>;
