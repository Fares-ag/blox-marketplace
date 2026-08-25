import { Controller, Get, NotFoundException, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Public } from '../auth/guards';
import { StorageService } from '../storage/storage.service';
import { listingImageKeyFromRequest, serveListingImageRequest } from './listing-image.handler';

/** Public listing image proxy — browsers cannot load private R2/S3 endpoint URLs directly. */
@Controller('media')
export class MediaController {
  constructor(private readonly storage: StorageService) {}

  @Public()
  @Get('listings/*path')
  async serveListingImage(@Req() req: Request, @Res() res: Response) {
    if (!listingImageKeyFromRequest(req)) throw new NotFoundException();
    await serveListingImageRequest(this.storage, req, res);
  }
}
