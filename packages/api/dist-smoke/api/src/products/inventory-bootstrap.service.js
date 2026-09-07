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
var InventoryBootstrapService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.InventoryBootstrapService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../prisma/prisma.service");
const seed_finance_partners_1 = require("../../prisma/seed-finance-partners");
const seed_chery_1 = require("../../prisma/seed-chery");
let InventoryBootstrapService = InventoryBootstrapService_1 = class InventoryBootstrapService {
    prisma;
    config;
    logger = new common_1.Logger(InventoryBootstrapService_1.name);
    constructor(prisma, config) {
        this.prisma = prisma;
        this.config = config;
    }
    async onModuleInit() {
        const raw = this.config.get('SEED_INVENTORY_ON_STARTUP')?.trim().toLowerCase();
        if (raw === 'false' || raw === '0')
            return;
        const published = await this.prisma.product.count({
            where: { listingStatus: client_1.ListingStatus.published },
        });
        if (published > 0)
            return;
        this.logger.warn('No published inventory found — running Chery seed');
        await (0, seed_finance_partners_1.seedFinancePartners)(this.prisma);
        const result = await (0, seed_chery_1.seedCheryInventory)(this.prisma);
        this.logger.log(`Inventory bootstrap complete: ${result.listingsPublished} listings for ${result.companyName}`);
    }
};
exports.InventoryBootstrapService = InventoryBootstrapService;
exports.InventoryBootstrapService = InventoryBootstrapService = InventoryBootstrapService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        config_1.ConfigService])
], InventoryBootstrapService);
//# sourceMappingURL=inventory-bootstrap.service.js.map