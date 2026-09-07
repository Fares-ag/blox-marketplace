"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestMeta = requestMeta;
function requestMeta(req) {
    const ua = req.headers['user-agent'];
    return {
        ipAddress: req.ip ?? null,
        userAgent: typeof ua === 'string' && ua.trim() ? ua.slice(0, 512) : null,
    };
}
//# sourceMappingURL=request-meta.js.map