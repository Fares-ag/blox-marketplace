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
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
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
var AllExceptionsFilter_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AllExceptionsFilter = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const Sentry = __importStar(require("@sentry/node"));
const api_error_envelope_1 = require("./api-error-envelope");
const error_messages_1 = require("./error-messages");
const request_id_1 = require("./request-id");
let AllExceptionsFilter = AllExceptionsFilter_1 = class AllExceptionsFilter {
    logger = new common_1.Logger(AllExceptionsFilter_1.name);
    catch(exception, host) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse();
        const request = ctx.getRequest();
        const requestId = (0, request_id_1.getRequestId)() ??
            (0, request_id_1.resolveRequestId)(request.headers[request_id_1.REQUEST_ID_HEADER]);
        response.setHeader(request_id_1.REQUEST_ID_HEADER, requestId);
        const resolved = this.resolveException(exception);
        if (resolved.status >= common_1.HttpStatus.BAD_REQUEST &&
            resolved.status < common_1.HttpStatus.INTERNAL_SERVER_ERROR &&
            resolved.status !== common_1.HttpStatus.UNAUTHORIZED &&
            resolved.status !== common_1.HttpStatus.NOT_FOUND) {
            this.logger.warn(`${request.method} ${request.url} -> ${resolved.status} ${resolved.code} [${requestId}]`);
        }
        if (resolved.status >= common_1.HttpStatus.INTERNAL_SERVER_ERROR) {
            this.logger.error(`${request.method} ${request.url} -> ${resolved.code}`, exception instanceof Error ? exception.stack : String(exception));
            Sentry.withScope((scope) => {
                scope.setTag('request_id', requestId);
                scope.setTag('error_code', resolved.code);
                Sentry.captureException(exception);
            });
        }
        response.status(resolved.status).json((0, api_error_envelope_1.buildApiErrorEnvelope)(resolved, requestId));
    }
    resolveException(exception) {
        if (exception instanceof common_1.HttpException) {
            return (0, api_error_envelope_1.resolveHttpException)(exception);
        }
        if (exception instanceof client_1.Prisma.PrismaClientKnownRequestError) {
            return (0, api_error_envelope_1.resolvePrismaKnownError)(exception);
        }
        return {
            status: common_1.HttpStatus.INTERNAL_SERVER_ERROR,
            code: 'internal_error',
            message: (0, error_messages_1.humanMessageForCode)('internal_error'),
        };
    }
};
exports.AllExceptionsFilter = AllExceptionsFilter;
exports.AllExceptionsFilter = AllExceptionsFilter = AllExceptionsFilter_1 = __decorate([
    (0, common_1.Catch)()
], AllExceptionsFilter);
//# sourceMappingURL=all-exceptions.filter.js.map