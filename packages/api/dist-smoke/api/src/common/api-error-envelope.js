"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildApiErrorEnvelope = buildApiErrorEnvelope;
exports.resolveHttpException = resolveHttpException;
exports.resolvePrismaKnownError = resolvePrismaKnownError;
const common_1 = require("@nestjs/common");
const error_messages_1 = require("./error-messages");
function buildApiErrorEnvelope(resolved, requestId) {
    return {
        error: {
            code: resolved.code,
            message: resolved.message,
            requestId,
            ...(resolved.details ? { details: resolved.details } : {}),
        },
    };
}
function nestDefaultMessage(status) {
    const labels = {
        [common_1.HttpStatus.BAD_REQUEST]: 'Bad Request',
        [common_1.HttpStatus.UNAUTHORIZED]: 'Unauthorized',
        [common_1.HttpStatus.FORBIDDEN]: 'Forbidden',
        [common_1.HttpStatus.NOT_FOUND]: 'Not Found',
        [common_1.HttpStatus.CONFLICT]: 'Conflict',
        [common_1.HttpStatus.PAYLOAD_TOO_LARGE]: 'Payload Too Large',
        [common_1.HttpStatus.INTERNAL_SERVER_ERROR]: 'Internal Server Error',
        [common_1.HttpStatus.NOT_IMPLEMENTED]: 'Not Implemented',
    };
    return labels[status];
}
const ENVELOPE_RESERVED_KEYS = new Set(['message', 'statusCode', 'error']);
function callerDetails(body) {
    const entries = Object.entries(body).filter(([key, value]) => !ENVELOPE_RESERVED_KEYS.has(key) && value !== undefined);
    return entries.length ? Object.fromEntries(entries) : undefined;
}
function resolveHttpException(exception) {
    const status = exception.getStatus();
    const response = exception.getResponse();
    if (typeof response === 'string') {
        if ((0, error_messages_1.isMachineErrorCode)(response)) {
            return { status, code: response, message: (0, error_messages_1.humanMessageForCode)(response) };
        }
        return { status, code: (0, error_messages_1.defaultCodeForHttpStatus)(status), message: response };
    }
    if (typeof response === 'object' && response !== null) {
        const body = response;
        const details = callerDetails(body);
        if (typeof body.error === 'string' && (0, error_messages_1.isMachineErrorCode)(body.error)) {
            return {
                status,
                code: body.error,
                message: (0, error_messages_1.humanMessageForCode)(body.error),
                ...(details ? { details } : {}),
            };
        }
        const rawMessage = body.message;
        if (typeof rawMessage === 'string' && (0, error_messages_1.isMachineErrorCode)(rawMessage)) {
            return {
                status,
                code: rawMessage,
                message: (0, error_messages_1.humanMessageForCode)(rawMessage),
                ...(details ? { details } : {}),
            };
        }
        if (Array.isArray(rawMessage)) {
            const messages = rawMessage.map(String);
            return {
                status,
                code: 'validation_failed',
                message: messages.join('; ') || (0, error_messages_1.humanMessageForCode)('validation_failed'),
                details: { messages },
            };
        }
        if (typeof rawMessage === 'string') {
            if (rawMessage === nestDefaultMessage(status)) {
                const code = (0, error_messages_1.defaultCodeForHttpStatus)(status);
                return { status, code, message: (0, error_messages_1.humanMessageForCode)(code) };
            }
            return { status, code: (0, error_messages_1.defaultCodeForHttpStatus)(status), message: rawMessage };
        }
    }
    const code = (0, error_messages_1.defaultCodeForHttpStatus)(status);
    return { status, code, message: (0, error_messages_1.humanMessageForCode)(code) };
}
function resolvePrismaKnownError(error) {
    switch (error.code) {
        case 'P2002':
            return {
                status: common_1.HttpStatus.CONFLICT,
                code: 'conflict',
                message: (0, error_messages_1.humanMessageForCode)('conflict'),
                details: {
                    prismaCode: error.code,
                    target: error.meta?.target ?? null,
                },
            };
        case 'P2003':
            return {
                status: common_1.HttpStatus.CONFLICT,
                code: 'conflict',
                message: (0, error_messages_1.humanMessageForCode)('conflict'),
                details: {
                    prismaCode: error.code,
                    field: error.meta?.field_name ?? null,
                },
            };
        case 'P2025':
            return {
                status: common_1.HttpStatus.NOT_FOUND,
                code: 'not_found',
                message: (0, error_messages_1.humanMessageForCode)('not_found'),
                details: { prismaCode: error.code },
            };
        default:
            return {
                status: common_1.HttpStatus.INTERNAL_SERVER_ERROR,
                code: 'internal_error',
                message: (0, error_messages_1.humanMessageForCode)('internal_error'),
                details: { prismaCode: error.code },
            };
    }
}
//# sourceMappingURL=api-error-envelope.js.map