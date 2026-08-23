import { Injectable } from '@nestjs/common';
import { KycCheckType } from '@prisma/client';
import { StubCheckAdapter } from './base.stub-adapter';

/** Phase 3 — gated on QFC licensing / Qatar Credit Bureau membership. */
@Injectable()
export class BureauCheckAdapter extends StubCheckAdapter {
  readonly type: KycCheckType = 'bureau';
  protected readonly implNote = 'Qatar Credit Bureau report pull (Phase 3, requires membership)';
}
