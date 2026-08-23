import { Injectable } from '@nestjs/common';
import { KycCheckType } from '@prisma/client';
import { StubCheckAdapter } from './base.stub-adapter';

@Injectable()
export class QidCheckAdapter extends StubCheckAdapter {
  readonly type: KycCheckType = 'qid';
  protected readonly implNote = 'QID OCR + MRZ/barcode extraction, checksum, expiry, name cross-match (WS-C)';
}
