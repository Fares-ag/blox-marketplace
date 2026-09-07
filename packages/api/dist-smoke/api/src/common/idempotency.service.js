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
exports.IdempotencyService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const prisma_errors_1 = require("./prisma-errors");
const idempotency_constants_1 = require("./idempotency.constants");
const IN_FLIGHT_POLL_MS = 50;
const IN_FLIGHT_MAX_WAIT_MS = 30_000;
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
let IdempotencyService = class IdempotencyService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async run(opts) {
        const rawKey = opts.idempotencyKey?.trim();
        if (!rawKey) {
            return opts.handler();
        }
        if (rawKey.length > idempotency_constants_1.MAX_IDEMPOTENCY_KEY_LENGTH) {
            throw new common_1.BadRequestException('invalid_idempotency_key');
        }
        const where = {
            userId_scope_idempotencyKey: {
                userId: opts.userId,
                scope: opts.scope,
                idempotencyKey: rawKey,
            },
        };
        const existing = await this.prisma.idempotencyRecord.findUnique({ where });
        if (existing?.responseBody != null) {
            return existing.responseBody;
        }
        let ownsLock = false;
        if (!existing) {
            try {
                await this.prisma.idempotencyRecord.create({
                    data: {
                        userId: opts.userId,
                        scope: opts.scope,
                        idempotencyKey: rawKey,
                        statusCode: opts.statusCode ?? 201,
                    },
                });
                ownsLock = true;
            }
            catch (err) {
                if (!(0, prisma_errors_1.isUniqueConstraintError)(err))
                    throw err;
            }
        }
        if (!ownsLock) {
            return this.waitForStoredResponse(where);
        }
        try {
            const result = await opts.handler();
            await this.prisma.idempotencyRecord.update({
                where,
                data: {
                    responseBody: result,
                    statusCode: opts.statusCode ?? 201,
                    completedAt: new Date(),
                },
            });
            return result;
        }
        catch (err) {
            await this.prisma.idempotencyRecord
                .delete({ where })
                .catch(() => undefined);
            throw err;
        }
    }
    async waitForStoredResponse(where) {
        const deadline = Date.now() + IN_FLIGHT_MAX_WAIT_MS;
        while (Date.now() < deadline) {
            const row = await this.prisma.idempotencyRecord.findUnique({ where });
            if (row?.responseBody != null) {
                return row.responseBody;
            }
            await sleep(IN_FLIGHT_POLL_MS);
        }
        throw new common_1.ConflictException('idempotency_in_progress');
    }
};
exports.IdempotencyService = IdempotencyService;
exports.IdempotencyService = IdempotencyService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], IdempotencyService);
//# sourceMappingURL=idempotency.service.js.map