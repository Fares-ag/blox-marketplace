"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.emitProductEvent = emitProductEvent;
const common_1 = require("@nestjs/common");
const events_1 = require("../../../shared/src/analytics/events");
const logger = new common_1.Logger('ProductAnalytics');
function emitProductEvent(event, props = {}) {
    if (process.env.PRODUCT_ANALYTICS_ENABLED === 'false')
        return;
    const payload = {
        event,
        ...(0, events_1.sanitizeAnalyticsProps)(props),
        ts: new Date().toISOString(),
    };
    logger.log(JSON.stringify(payload));
}
//# sourceMappingURL=emit-product-event.js.map