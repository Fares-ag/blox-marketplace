import { ConfigService } from '@nestjs/config';
export declare class EncryptionService {
    private readonly logger;
    private readonly key;
    private readonly indexKey;
    constructor(config: ConfigService);
    private static parseKey;
    encrypt(plain: string): string;
    decrypt(payload: string): string;
    blindIndex(value: string): string;
    qidHash(qid: string | null | undefined): string | null;
    static lastFour(value: string | null | undefined): string | null;
}
