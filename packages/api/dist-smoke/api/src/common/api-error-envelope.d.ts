import { HttpException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
export type ApiErrorBody = {
    error: {
        code: string;
        message: string;
        requestId: string;
        details?: Record<string, unknown>;
    };
};
export type ResolvedApiError = {
    status: number;
    code: string;
    message: string;
    details?: Record<string, unknown>;
};
export declare function buildApiErrorEnvelope(resolved: ResolvedApiError, requestId: string): ApiErrorBody;
export declare function resolveHttpException(exception: HttpException): ResolvedApiError;
export declare function resolvePrismaKnownError(error: Prisma.PrismaClientKnownRequestError): ResolvedApiError;
