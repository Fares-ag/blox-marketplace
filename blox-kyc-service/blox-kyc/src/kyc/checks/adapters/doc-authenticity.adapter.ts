import { Injectable } from '@nestjs/common';
import { KycCheckType } from '@prisma/client';
import { StubCheckAdapter } from './base.stub-adapter';

@Injectable()
export class DocAuthenticityCheckAdapter extends StubCheckAdapter {
  readonly type: KycCheckType = 'doc_authenticity';
  protected readonly implNote = 'In-house tamper/template/screen-replay detection; NFC as strong signal (WS-C)';
}
