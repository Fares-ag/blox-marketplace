import { ConfigService } from '@nestjs/config';
import { EncryptionService } from './encryption.service';
export type QidWrite = {
    qid: string | null;
    qidEnc: string | null;
    qidHash: string | null;
};
export type QidCarrier = {
    qid?: string | null;
    qidEnc?: string | null;
};
export declare class IdentityService {
    private readonly encryption;
    private readonly storePlaintext;
    constructor(encryption: EncryptionService, config: ConfigService);
    prepareQidWrite(qid: string | null | undefined): QidWrite | undefined;
    readQid(row: QidCarrier | null | undefined): string | null;
    get plaintextRetained(): boolean;
}
