import { Injectable } from '@nestjs/common';
import { KycCheckType } from '@prisma/client';
import { StubCheckAdapter } from './base.stub-adapter';

@Injectable()
export class BankStatementCheckAdapter extends StubCheckAdapter {
  readonly type: KycCheckType = 'bank_statement';
  protected readonly implNote = 'Multi-bank PDF OCR + parsing + affordability + tamper detection (WS-E)';
}
