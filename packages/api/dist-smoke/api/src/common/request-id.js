"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.RequestIdLogger = exports.requestContext = exports.REQUEST_ID_HEADER = void 0;
exports.getRequestId = getRequestId;
exports.resolveRequestId = resolveRequestId;
exports.applyRequestIdMiddleware = applyRequestIdMiddleware;
const node_async_hooks_1 = require("node:async_hooks");
const node_crypto_1 = require("node:crypto");
const common_1 = require("@nestjs/common");
const Sentry = __importStar(require("@sentry/node"));
exports.REQUEST_ID_HEADER = 'x-request-id';
exports.requestContext = new node_async_hooks_1.AsyncLocalStorage();
function getRequestId() {
    return exports.requestContext.getStore()?.requestId;
}
function resolveRequestId(raw) {
    if (typeof raw === 'string' && raw.trim())
        return raw.trim();
    if (Array.isArray(raw) && raw[0]?.trim())
        return raw[0].trim();
    return (0, node_crypto_1.randomUUID)();
}
function applyRequestIdMiddleware(expressApp) {
    expressApp.use((req, res, next) => {
        const requestId = resolveRequestId(req.headers[exports.REQUEST_ID_HEADER]);
        req.headers[exports.REQUEST_ID_HEADER] = requestId;
        res.setHeader(exports.REQUEST_ID_HEADER, requestId);
        Sentry.getCurrentScope().setTag('request_id', requestId);
        exports.requestContext.run({ requestId }, () => next());
    });
}
class RequestIdLogger extends common_1.ConsoleLogger {
    withRequestId(message) {
        const id = getRequestId();
        const body = typeof message === 'string' ? message : JSON.stringify(message);
        return id ? `[${id}] ${body}` : body;
    }
    log(message, context) {
        super.log(this.withRequestId(message), context);
    }
    warn(message, context) {
        super.warn(this.withRequestId(message), context);
    }
    error(message, stack, context) {
        super.error(this.withRequestId(message), stack, context);
    }
    debug(message, context) {
        super.debug(this.withRequestId(message), context);
    }
    verbose(message, context) {
        super.verbose(this.withRequestId(message), context);
    }
}
exports.RequestIdLogger = RequestIdLogger;
//# sourceMappingURL=request-id.js.map