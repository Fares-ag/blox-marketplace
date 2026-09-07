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
exports.TakafulProvidersService = void 0;
const common_1 = require("@nestjs/common");
const activity_service_1 = require("../common/activity.service");
const prisma_errors_1 = require("../common/prisma-errors");
const prisma_service_1 = require("../prisma/prisma.service");
const takaful_quote_1 = require("./takaful-quote");
function optionalText(value) {
    if (value == null)
        return null;
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
}
let TakafulProvidersService = class TakafulProvidersService {
    prisma;
    activity;
    constructor(prisma, activity) {
        this.prisma = prisma;
        this.activity = activity;
    }
    async quotes(coverage, vehiclePrice) {
        if (coverage === 'comprehensive' && !(vehiclePrice && vehiclePrice > 0)) {
            throw new common_1.BadRequestException('vehicle_price_required');
        }
        const rows = await this.prisma.takafulProvider.findMany({
            where: { active: true },
            orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        });
        return (0, takaful_quote_1.quoteTakaful)(rows.map(takaful_quote_1.toTakafulProviderDto), coverage, vehiclePrice);
    }
    async list() {
        const rows = await this.prisma.takafulProvider.findMany({
            orderBy: [{ active: 'desc' }, { sortOrder: 'asc' }, { name: 'asc' }],
        });
        return rows.map(takaful_quote_1.toTakafulProviderDto);
    }
    async get(id) {
        return (0, takaful_quote_1.toTakafulProviderDto)(await this.require(id));
    }
    async create(actor, input) {
        let created;
        try {
            created = await this.prisma.takafulProvider.create({
                data: {
                    code: input.code.trim().toLowerCase(),
                    name: input.name.trim(),
                    nameAr: optionalText(input.name_ar),
                    comprehensiveRatePct: input.comprehensive_rate_pct,
                    thirdPartyAnnual: input.third_party_annual ?? null,
                    minContribution: input.min_contribution ?? null,
                    riders: input.riders ? (0, takaful_quote_1.ridersToJson)(input.riders) : undefined,
                    contactPhone: optionalText(input.contact_phone),
                    contactEmail: optionalText(input.contact_email),
                    website: optionalText(input.website),
                    notes: optionalText(input.notes),
                    active: input.active ?? true,
                    sortOrder: input.sort_order ?? 0,
                },
            });
        }
        catch (err) {
            if ((0, prisma_errors_1.isUniqueConstraintError)(err))
                throw new common_1.ConflictException('takaful_provider_code_exists');
            throw err;
        }
        await this.activity.log({
            actorUserId: actor.id,
            entityType: 'takaful_provider',
            entityId: created.id,
            action: 'takaful_provider_created',
            toValue: created.code,
            metadata: {
                comprehensive_rate_pct: input.comprehensive_rate_pct,
                third_party_annual: input.third_party_annual ?? null,
                active: created.active,
            },
        });
        return (0, takaful_quote_1.toTakafulProviderDto)(created);
    }
    async update(actor, id, input) {
        const existing = await this.require(id);
        const data = {
            ...(input.code !== undefined ? { code: input.code.trim().toLowerCase() } : {}),
            ...(input.name !== undefined ? { name: input.name.trim() } : {}),
            ...(input.name_ar !== undefined ? { nameAr: optionalText(input.name_ar) } : {}),
            ...(input.comprehensive_rate_pct !== undefined ? { comprehensiveRatePct: input.comprehensive_rate_pct } : {}),
            ...(input.third_party_annual !== undefined ? { thirdPartyAnnual: input.third_party_annual } : {}),
            ...(input.min_contribution !== undefined ? { minContribution: input.min_contribution } : {}),
            ...(input.riders !== undefined ? { riders: (0, takaful_quote_1.ridersToJson)(input.riders) } : {}),
            ...(input.contact_phone !== undefined ? { contactPhone: optionalText(input.contact_phone) } : {}),
            ...(input.contact_email !== undefined ? { contactEmail: optionalText(input.contact_email) } : {}),
            ...(input.website !== undefined ? { website: optionalText(input.website) } : {}),
            ...(input.notes !== undefined ? { notes: optionalText(input.notes) } : {}),
            ...(input.active !== undefined ? { active: input.active } : {}),
            ...(input.sort_order !== undefined ? { sortOrder: input.sort_order } : {}),
        };
        if (!Object.keys(data).length)
            return (0, takaful_quote_1.toTakafulProviderDto)(existing);
        let updated;
        try {
            updated = await this.prisma.takafulProvider.update({ where: { id: existing.id }, data });
        }
        catch (err) {
            if ((0, prisma_errors_1.isUniqueConstraintError)(err))
                throw new common_1.ConflictException('takaful_provider_code_exists');
            throw err;
        }
        await this.activity.log({
            actorUserId: actor.id,
            entityType: 'takaful_provider',
            entityId: existing.id,
            action: 'takaful_provider_updated',
            fromValue: existing.active ? 'active' : 'inactive',
            toValue: updated.active ? 'active' : 'inactive',
            metadata: { fields: Object.keys(data) },
        });
        return (0, takaful_quote_1.toTakafulProviderDto)(updated);
    }
    async require(id) {
        const row = await this.prisma.takafulProvider.findUnique({ where: { id } });
        if (!row)
            throw new common_1.NotFoundException('takaful_provider_not_found');
        return row;
    }
};
exports.TakafulProvidersService = TakafulProvidersService;
exports.TakafulProvidersService = TakafulProvidersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        activity_service_1.ActivityService])
], TakafulProvidersService);
//# sourceMappingURL=takaful-providers.service.js.map