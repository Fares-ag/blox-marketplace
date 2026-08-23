import { Injectable } from '@nestjs/common';
import { KycCheckType } from '@prisma/client';
import { StubCheckAdapter } from './base.stub-adapter';

@Injectable()
export class PassportCheckAdapter extends StubCheckAdapter {
  readonly type: KycCheckType = 'passport';
  protected readonly implNote = 'Passport MRZ (ICAO 9303) + NFC passive authentication (WS-C)';
}
