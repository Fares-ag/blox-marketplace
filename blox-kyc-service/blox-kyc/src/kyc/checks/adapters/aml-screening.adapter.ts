import { Injectable } from '@nestjs/common';
import { KycCheckType } from '@prisma/client';
import { StubCheckAdapter } from './base.stub-adapter';

@Injectable()
export class AmlScreeningCheckAdapter extends StubCheckAdapter {
  readonly type: KycCheckType = 'aml_screen';
  protected readonly implNote = 'Sanctions/PEP screening via bought list provider (WS-F)';
}
