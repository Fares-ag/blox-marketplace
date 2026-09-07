"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertDefaultOfferForCompany = assertDefaultOfferForCompany;
const common_1 = require("@nestjs/common");
async function assertDefaultOfferForCompany(prisma, companyId, defaultOfferId) {
    const offer = await prisma.offer.findUnique({ where: { id: defaultOfferId } });
    if (!offer)
        throw new common_1.BadRequestException('offer_not_found');
    if (offer.status !== 'active')
        throw new common_1.BadRequestException('offer_not_active');
    if (offer.companyId && offer.companyId !== companyId) {
        throw new common_1.BadRequestException('offer_not_permitted');
    }
    return offer;
}
//# sourceMappingURL=product-offer.js.map