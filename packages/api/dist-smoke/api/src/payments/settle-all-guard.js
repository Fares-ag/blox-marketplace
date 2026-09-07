"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isSettleAllRequest = isSettleAllRequest;
exports.assertNotSettleAll = assertNotSettleAll;
const common_1 = require("@nestjs/common");
const SETTLEMENT_MARKERS = new Set(['settlement', 'settle_all', 'settle-all', 'pay_remaining', 'pay-remaining', 'all']);
function isMarker(value) {
    return !!value && SETTLEMENT_MARKERS.has(value.trim().toLowerCase());
}
function custom1FlagsSettlement(custom1) {
    if (!custom1?.trim())
        return false;
    try {
        const parsed = JSON.parse(custom1);
        if (!parsed || typeof parsed !== 'object')
            return false;
        if (parsed.isSettlement === true || parsed.is_settlement === true)
            return true;
        const type = typeof parsed.type === 'string' ? parsed.type.toLowerCase() : '';
        if (type === 'settlement_payment' || type === 'settlement')
            return true;
        return isMarker(typeof parsed.dueDate === 'string' ? parsed.dueDate : null) ||
            isMarker(typeof parsed.scheduleItemId === 'string' ? parsed.scheduleItemId : null);
    }
    catch {
        return false;
    }
}
function isSettleAllRequest(probe) {
    return isMarker(probe.scheduleId) || isMarker(probe.dueDate) || custom1FlagsSettlement(probe.custom1);
}
function assertNotSettleAll(probe) {
    if (isSettleAllRequest(probe)) {
        throw new common_1.ConflictException('settlement_quote_required');
    }
}
//# sourceMappingURL=settle-all-guard.js.map