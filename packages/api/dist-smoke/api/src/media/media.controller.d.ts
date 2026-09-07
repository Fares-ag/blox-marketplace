import type { Request, Response } from 'express';
import { StorageService } from '../storage/storage.service';
export declare class MediaController {
    private readonly storage;
    constructor(storage: StorageService);
    serveListingImage(req: Request, res: Response): Promise<void>;
}
