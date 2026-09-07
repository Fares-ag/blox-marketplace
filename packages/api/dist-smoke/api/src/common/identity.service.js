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
Object.defineProperty(exports, "__esModule", { value: true });
exports.IdentityService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const encryption_service_1 = require("./encryption.service");
let IdentityService = class IdentityService {
    encryption;
    storePlaintext;
    constructor(encryption, config) {
        this.encryption = encryption;
        const raw = (config.get('QID_STORE_PLAINTEXT') ?? 'true').trim().toLowerCase();
        this.storePlaintext = raw !== 'false' && raw !== '0';
    }
    prepareQidWrite(qid) {
        if (qid === undefined)
            return undefined;
        const digits = String(qid ?? '').replace(/\D/g, '');
        if (!digits)
            return { qid: null, qidEnc: null, qidHash: null };
        return {
            qid: this.storePlaintext ? digits : null,
            qidEnc: this.encryption.encrypt(digits),
            qidHash: this.encryption.qidHash(digits),
        };
    }
    readQid(row) {
        if (!row)
            return null;
        if (row.qidEnc) {
            try {
                return this.encryption.decrypt(row.qidEnc);
            }
            catch {
            }
        }
        return row.qid ?? null;
    }
    get plaintextRetained() {
        return this.storePlaintext;
    }
};
exports.IdentityService = IdentityService;
exports.IdentityService = IdentityService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [encryption_service_1.EncryptionService,
        config_1.ConfigService])
], IdentityService);
//# sourceMappingURL=identity.service.js.map