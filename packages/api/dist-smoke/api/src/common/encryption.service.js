"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var EncryptionService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.EncryptionService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const node_crypto_1 = require("node:crypto");
const auth_config_1 = require("../auth/auth-config");
const VERSION = 'v1';
const ALGO = 'aes-256-gcm';
const IV_BYTES = 12;
let EncryptionService = EncryptionService_1 = class EncryptionService {
    logger = new common_1.Logger(EncryptionService_1.name);
    key;
    indexKey;
    constructor(config) {
        const raw = config.get('FIELD_ENCRYPTION_KEY')?.trim();
        if (raw) {
            this.key = EncryptionService_1.parseKey(raw);
        }
        else {
            if (process.env.NODE_ENV === 'production') {
                throw new Error('FIELD_ENCRYPTION_KEY is required in production (32 bytes, base64 or hex)');
            }
            this.logger.warn('FIELD_ENCRYPTION_KEY not set — deriving a development key from BETTER_AUTH_SECRET');
            this.key = (0, node_crypto_1.scryptSync)((0, auth_config_1.resolveAuthSecret)(config), 'drivemarket-field-encryption', 32);
        }
        this.indexKey = (0, node_crypto_1.createHmac)('sha256', this.key).update('blind-index').digest();
    }
    static parseKey(raw) {
        const hex = /^[0-9a-fA-F]{64}$/.test(raw) ? Buffer.from(raw, 'hex') : null;
        const buf = hex ?? Buffer.from(raw, 'base64');
        if (buf.length !== 32) {
            throw new Error('FIELD_ENCRYPTION_KEY must decode to exactly 32 bytes');
        }
        return buf;
    }
    encrypt(plain) {
        const iv = (0, node_crypto_1.randomBytes)(IV_BYTES);
        const cipher = (0, node_crypto_1.createCipheriv)(ALGO, this.key, iv);
        const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
        const tag = cipher.getAuthTag();
        return [VERSION, iv.toString('base64url'), tag.toString('base64url'), ct.toString('base64url')].join(':');
    }
    decrypt(payload) {
        const [version, ivB64, tagB64, ctB64] = payload.split(':');
        if (version !== VERSION || !ivB64 || !tagB64 || !ctB64) {
            throw new Error('encrypted_payload_invalid');
        }
        const decipher = (0, node_crypto_1.createDecipheriv)(ALGO, this.key, Buffer.from(ivB64, 'base64url'));
        decipher.setAuthTag(Buffer.from(tagB64, 'base64url'));
        return Buffer.concat([decipher.update(Buffer.from(ctB64, 'base64url')), decipher.final()]).toString('utf8');
    }
    blindIndex(value) {
        return (0, node_crypto_1.createHmac)('sha256', this.indexKey).update(value).digest('hex');
    }
    qidHash(qid) {
        const digits = String(qid ?? '').replace(/\D/g, '');
        return digits ? this.blindIndex(`qid:${digits}`) : null;
    }
    static lastFour(value) {
        const v = String(value ?? '').replace(/\s+/g, '');
        return v ? v.slice(-4) : null;
    }
};
exports.EncryptionService = EncryptionService;
exports.EncryptionService = EncryptionService = EncryptionService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], EncryptionService);
//# sourceMappingURL=encryption.service.js.map