import type { ConfigService } from '@nestjs/config';
import type { PrismaService } from '../prisma/prisma.service';
import type { MailService } from '../mail/mail.service';
export declare function createAuth(prisma: PrismaService, config: ConfigService, mail: MailService): import("better-auth").Auth<{
    advanced: {
        useSecureCookies: true;
        crossSubDomainCookies: {
            enabled: true;
            domain: string;
        };
        defaultCookieAttributes: {
            secure: true;
            sameSite: "lax";
        };
    };
    appName: string;
    database: (options: import("better-auth").BetterAuthOptions) => import("better-auth").DBAdapter<import("better-auth").BetterAuthOptions>;
    secret: string;
    baseURL: string;
    basePath: string;
    trustedOrigins: string[];
    emailAndPassword: {
        enabled: true;
        requireEmailVerification: boolean;
        revokeSessionsOnPasswordReset: true;
        sendResetPassword: ({ user, url }: {
            user: import("better-auth").User;
            url: string;
            token: string;
        }) => Promise<void>;
        onPasswordReset: ({ user }: {
            user: import("better-auth").User;
        }) => Promise<void>;
    };
    emailVerification: {
        sendOnSignUp: true;
        autoSignInAfterVerification: true;
        sendVerificationEmail: ({ user, url }: {
            user: import("better-auth").User;
            url: string;
            token: string;
        }) => Promise<void>;
    };
    user: {
        additionalFields: {
            role: {
                type: "string";
                required: false;
                defaultValue: string;
                input: false;
            };
            companyId: {
                type: "string";
                required: false;
                input: false;
            };
            phone: {
                type: "string";
                required: false;
                input: true;
            };
            qid: {
                type: "string";
                required: false;
                input: true;
            };
            preferredLanguage: {
                type: "string";
                required: false;
                defaultValue: string;
                input: true;
            };
            twoFactorEnabled: {
                type: "boolean";
                required: false;
                defaultValue: false;
                input: false;
            };
        };
    };
    session: {
        expiresIn: number;
        updateAge: number;
        cookieCache: {
            enabled: boolean;
            maxAge: number;
        };
    };
    plugins: [{
        id: "two-factor";
        version: string;
        endpoints: {
            enableTwoFactor: import("better-auth").StrictEndpoint<"/two-factor/enable", {
                method: "POST";
                body: import("better-auth").ZodObject<{
                    password: import("better-auth").ZodOptional<import("better-auth").ZodString>;
                    issuer: import("better-auth").ZodOptional<import("better-auth").ZodString>;
                }, import("zod/v4/core").$strip> | import("better-auth").ZodObject<{
                    password: import("better-auth").ZodString;
                    issuer: import("better-auth").ZodOptional<import("better-auth").ZodString>;
                }, import("zod/v4/core").$strip>;
                use: ((inputContext: import("better-auth").MiddlewareInputContext<import("better-auth").MiddlewareOptions>) => Promise<{
                    session: {
                        session: Record<string, any> & {
                            id: string;
                            createdAt: Date;
                            updatedAt: Date;
                            userId: string;
                            expiresAt: Date;
                            token: string;
                            ipAddress?: string | null | undefined;
                            userAgent?: string | null | undefined;
                        };
                        user: Record<string, any> & {
                            id: string;
                            createdAt: Date;
                            updatedAt: Date;
                            email: string;
                            emailVerified: boolean;
                            name: string;
                            image?: string | null | undefined;
                        };
                    };
                }>)[];
                metadata: {
                    openapi: {
                        summary: string;
                        description: string;
                        responses: {
                            200: {
                                description: string;
                                content: {
                                    "application/json": {
                                        schema: {
                                            type: "object";
                                            properties: {
                                                totpURI: {
                                                    type: string;
                                                    description: string;
                                                };
                                                backupCodes: {
                                                    type: string;
                                                    items: {
                                                        type: string;
                                                    };
                                                    description: string;
                                                };
                                            };
                                        };
                                    };
                                };
                            };
                        };
                    };
                };
            }, {
                totpURI: string;
                backupCodes: string[];
            }>;
            disableTwoFactor: import("better-auth").StrictEndpoint<"/two-factor/disable", {
                method: "POST";
                body: import("better-auth").ZodObject<{
                    password: import("better-auth").ZodOptional<import("better-auth").ZodString>;
                }, import("zod/v4/core").$strip> | import("better-auth").ZodObject<{
                    password: import("better-auth").ZodString;
                }, import("zod/v4/core").$strip>;
                use: ((inputContext: import("better-auth").MiddlewareInputContext<import("better-auth").MiddlewareOptions>) => Promise<{
                    session: {
                        session: Record<string, any> & {
                            id: string;
                            createdAt: Date;
                            updatedAt: Date;
                            userId: string;
                            expiresAt: Date;
                            token: string;
                            ipAddress?: string | null | undefined;
                            userAgent?: string | null | undefined;
                        };
                        user: Record<string, any> & {
                            id: string;
                            createdAt: Date;
                            updatedAt: Date;
                            email: string;
                            emailVerified: boolean;
                            name: string;
                            image?: string | null | undefined;
                        };
                    };
                }>)[];
                metadata: {
                    openapi: {
                        summary: string;
                        description: string;
                        responses: {
                            200: {
                                description: string;
                                content: {
                                    "application/json": {
                                        schema: {
                                            type: "object";
                                            properties: {
                                                status: {
                                                    type: string;
                                                };
                                            };
                                        };
                                    };
                                };
                            };
                        };
                    };
                };
            }, {
                status: boolean;
            }>;
            verifyBackupCode: import("better-auth").StrictEndpoint<"/two-factor/verify-backup-code", {
                method: "POST";
                body: import("better-auth").ZodObject<{
                    code: import("better-auth").ZodString;
                    disableSession: import("better-auth").ZodOptional<import("better-auth").ZodBoolean>;
                    trustDevice: import("better-auth").ZodOptional<import("better-auth").ZodBoolean>;
                }, import("zod/v4/core").$strip>;
                metadata: {
                    openapi: {
                        description: string;
                        responses: {
                            "200": {
                                description: string;
                                content: {
                                    "application/json": {
                                        schema: {
                                            type: "object";
                                            properties: {
                                                user: {
                                                    type: string;
                                                    properties: {
                                                        id: {
                                                            type: string;
                                                            description: string;
                                                        };
                                                        email: {
                                                            type: string;
                                                            format: string;
                                                            nullable: boolean;
                                                            description: string;
                                                        };
                                                        emailVerified: {
                                                            type: string;
                                                            nullable: boolean;
                                                            description: string;
                                                        };
                                                        name: {
                                                            type: string;
                                                            nullable: boolean;
                                                            description: string;
                                                        };
                                                        image: {
                                                            type: string;
                                                            format: string;
                                                            nullable: boolean;
                                                            description: string;
                                                        };
                                                        twoFactorEnabled: {
                                                            type: string;
                                                            description: string;
                                                        };
                                                        createdAt: {
                                                            type: string;
                                                            format: string;
                                                            description: string;
                                                        };
                                                        updatedAt: {
                                                            type: string;
                                                            format: string;
                                                            description: string;
                                                        };
                                                    };
                                                    required: string[];
                                                    description: string;
                                                };
                                                session: {
                                                    type: string;
                                                    properties: {
                                                        token: {
                                                            type: string;
                                                            description: string;
                                                        };
                                                        userId: {
                                                            type: string;
                                                            description: string;
                                                        };
                                                        createdAt: {
                                                            type: string;
                                                            format: string;
                                                            description: string;
                                                        };
                                                        expiresAt: {
                                                            type: string;
                                                            format: string;
                                                            description: string;
                                                        };
                                                    };
                                                    required: string[];
                                                    description: string;
                                                };
                                            };
                                            required: string[];
                                        };
                                    };
                                };
                            };
                        };
                    };
                };
            }, {
                token: string | undefined;
                user: (Record<string, any> & {
                    id: string;
                    createdAt: Date;
                    updatedAt: Date;
                    email: string;
                    emailVerified: boolean;
                    name: string;
                    image?: string | null | undefined;
                }) | import("better-auth/plugins").UserWithTwoFactor;
            }>;
            generateBackupCodes: import("better-auth").StrictEndpoint<"/two-factor/generate-backup-codes", {
                method: "POST";
                body: import("better-auth").ZodObject<{
                    password: import("better-auth").ZodOptional<import("better-auth").ZodString>;
                }, import("zod/v4/core").$strip> | import("better-auth").ZodObject<{
                    password: import("better-auth").ZodString;
                }, import("zod/v4/core").$strip>;
                use: ((inputContext: import("better-auth").MiddlewareInputContext<import("better-auth").MiddlewareOptions>) => Promise<{
                    session: {
                        session: Record<string, any> & {
                            id: string;
                            createdAt: Date;
                            updatedAt: Date;
                            userId: string;
                            expiresAt: Date;
                            token: string;
                            ipAddress?: string | null | undefined;
                            userAgent?: string | null | undefined;
                        };
                        user: Record<string, any> & {
                            id: string;
                            createdAt: Date;
                            updatedAt: Date;
                            email: string;
                            emailVerified: boolean;
                            name: string;
                            image?: string | null | undefined;
                        };
                    };
                }>)[];
                metadata: {
                    openapi: {
                        description: string;
                        responses: {
                            "200": {
                                description: string;
                                content: {
                                    "application/json": {
                                        schema: {
                                            type: "object";
                                            properties: {
                                                status: {
                                                    type: string;
                                                    description: string;
                                                    enum: boolean[];
                                                };
                                                backupCodes: {
                                                    type: string;
                                                    items: {
                                                        type: string;
                                                    };
                                                    description: string;
                                                };
                                            };
                                            required: string[];
                                        };
                                    };
                                };
                            };
                        };
                    };
                };
            }, {
                status: boolean;
                backupCodes: string[];
            }>;
            viewBackupCodes: import("better-auth").StrictEndpoint<string, {
                method: "POST";
                body: import("better-auth").ZodObject<{
                    userId: import("better-auth").ZodCoercedString<unknown>;
                }, import("zod/v4/core").$strip>;
            }, {
                status: boolean;
                backupCodes: string[];
            }>;
            sendTwoFactorOTP: import("better-auth").StrictEndpoint<"/two-factor/send-otp", {
                method: "POST";
                body: import("better-auth").ZodOptional<import("better-auth").ZodObject<{
                    trustDevice: import("better-auth").ZodOptional<import("better-auth").ZodBoolean>;
                }, import("zod/v4/core").$strip>>;
                metadata: {
                    openapi: {
                        summary: string;
                        description: string;
                        responses: {
                            200: {
                                description: string;
                                content: {
                                    "application/json": {
                                        schema: {
                                            type: "object";
                                            properties: {
                                                status: {
                                                    type: string;
                                                };
                                            };
                                        };
                                    };
                                };
                            };
                        };
                    };
                };
            }, {
                status: boolean;
            }>;
            verifyTwoFactorOTP: import("better-auth").StrictEndpoint<"/two-factor/verify-otp", {
                method: "POST";
                body: import("better-auth").ZodObject<{
                    code: import("better-auth").ZodString;
                    trustDevice: import("better-auth").ZodOptional<import("better-auth").ZodBoolean>;
                }, import("zod/v4/core").$strip>;
                metadata: {
                    openapi: {
                        summary: string;
                        description: string;
                        responses: {
                            "200": {
                                description: string;
                                content: {
                                    "application/json": {
                                        schema: {
                                            type: "object";
                                            properties: {
                                                token: {
                                                    type: string;
                                                    description: string;
                                                };
                                                user: {
                                                    type: string;
                                                    properties: {
                                                        id: {
                                                            type: string;
                                                            description: string;
                                                        };
                                                        email: {
                                                            type: string;
                                                            format: string;
                                                            nullable: boolean;
                                                            description: string;
                                                        };
                                                        emailVerified: {
                                                            type: string;
                                                            nullable: boolean;
                                                            description: string;
                                                        };
                                                        name: {
                                                            type: string;
                                                            nullable: boolean;
                                                            description: string;
                                                        };
                                                        image: {
                                                            type: string;
                                                            format: string;
                                                            nullable: boolean;
                                                            description: string;
                                                        };
                                                        createdAt: {
                                                            type: string;
                                                            format: string;
                                                            description: string;
                                                        };
                                                        updatedAt: {
                                                            type: string;
                                                            format: string;
                                                            description: string;
                                                        };
                                                    };
                                                    required: string[];
                                                    description: string;
                                                };
                                            };
                                            required: string[];
                                        };
                                    };
                                };
                            };
                        };
                    };
                };
            }, {
                token: string;
                user: import("better-auth/plugins").UserWithTwoFactor;
            } | {
                token: string;
                user: Record<string, any> & {
                    id: string;
                    createdAt: Date;
                    updatedAt: Date;
                    email: string;
                    emailVerified: boolean;
                    name: string;
                    image?: string | null | undefined;
                };
            }>;
            generateTOTP: import("better-auth").StrictEndpoint<string, {
                method: "POST";
                body: import("better-auth").ZodObject<{
                    secret: import("better-auth").ZodString;
                }, import("zod/v4/core").$strip>;
                metadata: {
                    openapi: {
                        summary: string;
                        description: string;
                        responses: {
                            200: {
                                description: string;
                                content: {
                                    "application/json": {
                                        schema: {
                                            type: "object";
                                            properties: {
                                                code: {
                                                    type: string;
                                                };
                                            };
                                        };
                                    };
                                };
                            };
                        };
                    };
                };
            }, {
                code: string;
            }>;
            getTOTPURI: import("better-auth").StrictEndpoint<"/two-factor/get-totp-uri", {
                method: "POST";
                use: ((inputContext: import("better-auth").MiddlewareInputContext<import("better-auth").MiddlewareOptions>) => Promise<{
                    session: {
                        session: Record<string, any> & {
                            id: string;
                            createdAt: Date;
                            updatedAt: Date;
                            userId: string;
                            expiresAt: Date;
                            token: string;
                            ipAddress?: string | null | undefined;
                            userAgent?: string | null | undefined;
                        };
                        user: Record<string, any> & {
                            id: string;
                            createdAt: Date;
                            updatedAt: Date;
                            email: string;
                            emailVerified: boolean;
                            name: string;
                            image?: string | null | undefined;
                        };
                    };
                }>)[];
                body: import("better-auth").ZodObject<{
                    password: import("better-auth").ZodOptional<import("better-auth").ZodString>;
                }, import("zod/v4/core").$strip> | import("better-auth").ZodObject<{
                    password: import("better-auth").ZodString;
                }, import("zod/v4/core").$strip>;
                metadata: {
                    openapi: {
                        summary: string;
                        description: string;
                        responses: {
                            200: {
                                description: string;
                                content: {
                                    "application/json": {
                                        schema: {
                                            type: "object";
                                            properties: {
                                                totpURI: {
                                                    type: string;
                                                };
                                            };
                                        };
                                    };
                                };
                            };
                        };
                    };
                };
            }, {
                totpURI: string;
            }>;
            verifyTOTP: import("better-auth").StrictEndpoint<"/two-factor/verify-totp", {
                method: "POST";
                body: import("better-auth").ZodObject<{
                    code: import("better-auth").ZodString;
                    trustDevice: import("better-auth").ZodOptional<import("better-auth").ZodBoolean>;
                }, import("zod/v4/core").$strip>;
                metadata: {
                    openapi: {
                        summary: string;
                        description: string;
                        responses: {
                            200: {
                                description: string;
                                content: {
                                    "application/json": {
                                        schema: {
                                            type: "object";
                                            properties: {
                                                status: {
                                                    type: string;
                                                };
                                            };
                                        };
                                    };
                                };
                            };
                        };
                    };
                };
            }, {
                token: string;
                user: import("better-auth/plugins").UserWithTwoFactor;
            } | {
                token: string;
                user: Record<string, any> & {
                    id: string;
                    createdAt: Date;
                    updatedAt: Date;
                    email: string;
                    emailVerified: boolean;
                    name: string;
                    image?: string | null | undefined;
                };
            }>;
        };
        options: NoInfer<{
            issuer: string;
            totpOptions: {
                digits: 6;
                period: number;
            };
            accountLockout: {
                enabled: true;
                maxFailedAttempts: number;
                durationSeconds: number;
            };
        }>;
        hooks: {
            after: {
                matcher(context: import("better-auth").HookEndpointContext): boolean;
                handler: (inputContext: import("better-auth").MiddlewareInputContext<import("better-auth").MiddlewareOptions>) => Promise<{
                    twoFactorRedirect: boolean;
                    twoFactorMethods: string[];
                } | undefined>;
            }[];
        };
        schema: {
            user: {
                fields: {
                    twoFactorEnabled: {
                        type: "boolean";
                        required: false;
                        defaultValue: false;
                        input: false;
                    };
                };
            };
            twoFactor: {
                fields: {
                    secret: {
                        type: "string";
                        required: true;
                        returned: false;
                        index: true;
                    };
                    backupCodes: {
                        type: "string";
                        required: true;
                        returned: false;
                    };
                    userId: {
                        type: "string";
                        required: true;
                        returned: false;
                        references: {
                            model: string;
                            field: string;
                        };
                        index: true;
                    };
                    verified: {
                        type: "boolean";
                        required: false;
                        defaultValue: true;
                        input: false;
                    };
                    failedVerificationCount: {
                        type: "number";
                        required: false;
                        defaultValue: number;
                        input: false;
                        returned: false;
                    };
                    lockedUntil: {
                        type: "date";
                        required: false;
                        input: false;
                        returned: false;
                    };
                };
            };
        };
        rateLimit: {
            pathMatcher(path: string): boolean;
            window: number;
            max: number;
        }[];
        $ERROR_CODES: {
            OTP_NOT_ENABLED: import("better-auth").RawError<"OTP_NOT_ENABLED">;
            OTP_HAS_EXPIRED: import("better-auth").RawError<"OTP_HAS_EXPIRED">;
            TOTP_NOT_ENABLED: import("better-auth").RawError<"TOTP_NOT_ENABLED">;
            TWO_FACTOR_NOT_ENABLED: import("better-auth").RawError<"TWO_FACTOR_NOT_ENABLED">;
            BACKUP_CODES_NOT_ENABLED: import("better-auth").RawError<"BACKUP_CODES_NOT_ENABLED">;
            INVALID_BACKUP_CODE: import("better-auth").RawError<"INVALID_BACKUP_CODE">;
            INVALID_CODE: import("better-auth").RawError<"INVALID_CODE">;
            TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE: import("better-auth").RawError<"TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE">;
            ACCOUNT_TEMPORARILY_LOCKED: import("better-auth").RawError<"ACCOUNT_TEMPORARILY_LOCKED">;
            INVALID_TWO_FACTOR_COOKIE: import("better-auth").RawError<"INVALID_TWO_FACTOR_COOKIE">;
        };
    }];
    hooks: {
        before: (inputContext: import("better-auth").MiddlewareInputContext<import("better-auth").MiddlewareOptions>) => Promise<void>;
        after: (inputContext: import("better-auth").MiddlewareInputContext<import("better-auth").MiddlewareOptions>) => Promise<void>;
    };
} | {
    advanced: {
        useSecureCookies: true;
        defaultCookieAttributes: {
            secure: true;
            sameSite: "none";
        };
        crossSubDomainCookies?: undefined;
    };
    appName: string;
    database: (options: import("better-auth").BetterAuthOptions) => import("better-auth").DBAdapter<import("better-auth").BetterAuthOptions>;
    secret: string;
    baseURL: string;
    basePath: string;
    trustedOrigins: string[];
    emailAndPassword: {
        enabled: true;
        requireEmailVerification: boolean;
        revokeSessionsOnPasswordReset: true;
        sendResetPassword: ({ user, url }: {
            user: import("better-auth").User;
            url: string;
            token: string;
        }) => Promise<void>;
        onPasswordReset: ({ user }: {
            user: import("better-auth").User;
        }) => Promise<void>;
    };
    emailVerification: {
        sendOnSignUp: true;
        autoSignInAfterVerification: true;
        sendVerificationEmail: ({ user, url }: {
            user: import("better-auth").User;
            url: string;
            token: string;
        }) => Promise<void>;
    };
    user: {
        additionalFields: {
            role: {
                type: "string";
                required: false;
                defaultValue: string;
                input: false;
            };
            companyId: {
                type: "string";
                required: false;
                input: false;
            };
            phone: {
                type: "string";
                required: false;
                input: true;
            };
            qid: {
                type: "string";
                required: false;
                input: true;
            };
            preferredLanguage: {
                type: "string";
                required: false;
                defaultValue: string;
                input: true;
            };
            twoFactorEnabled: {
                type: "boolean";
                required: false;
                defaultValue: false;
                input: false;
            };
        };
    };
    session: {
        expiresIn: number;
        updateAge: number;
        cookieCache: {
            enabled: boolean;
            maxAge: number;
        };
    };
    plugins: [{
        id: "two-factor";
        version: string;
        endpoints: {
            enableTwoFactor: import("better-auth").StrictEndpoint<"/two-factor/enable", {
                method: "POST";
                body: import("better-auth").ZodObject<{
                    password: import("better-auth").ZodOptional<import("better-auth").ZodString>;
                    issuer: import("better-auth").ZodOptional<import("better-auth").ZodString>;
                }, import("zod/v4/core").$strip> | import("better-auth").ZodObject<{
                    password: import("better-auth").ZodString;
                    issuer: import("better-auth").ZodOptional<import("better-auth").ZodString>;
                }, import("zod/v4/core").$strip>;
                use: ((inputContext: import("better-auth").MiddlewareInputContext<import("better-auth").MiddlewareOptions>) => Promise<{
                    session: {
                        session: Record<string, any> & {
                            id: string;
                            createdAt: Date;
                            updatedAt: Date;
                            userId: string;
                            expiresAt: Date;
                            token: string;
                            ipAddress?: string | null | undefined;
                            userAgent?: string | null | undefined;
                        };
                        user: Record<string, any> & {
                            id: string;
                            createdAt: Date;
                            updatedAt: Date;
                            email: string;
                            emailVerified: boolean;
                            name: string;
                            image?: string | null | undefined;
                        };
                    };
                }>)[];
                metadata: {
                    openapi: {
                        summary: string;
                        description: string;
                        responses: {
                            200: {
                                description: string;
                                content: {
                                    "application/json": {
                                        schema: {
                                            type: "object";
                                            properties: {
                                                totpURI: {
                                                    type: string;
                                                    description: string;
                                                };
                                                backupCodes: {
                                                    type: string;
                                                    items: {
                                                        type: string;
                                                    };
                                                    description: string;
                                                };
                                            };
                                        };
                                    };
                                };
                            };
                        };
                    };
                };
            }, {
                totpURI: string;
                backupCodes: string[];
            }>;
            disableTwoFactor: import("better-auth").StrictEndpoint<"/two-factor/disable", {
                method: "POST";
                body: import("better-auth").ZodObject<{
                    password: import("better-auth").ZodOptional<import("better-auth").ZodString>;
                }, import("zod/v4/core").$strip> | import("better-auth").ZodObject<{
                    password: import("better-auth").ZodString;
                }, import("zod/v4/core").$strip>;
                use: ((inputContext: import("better-auth").MiddlewareInputContext<import("better-auth").MiddlewareOptions>) => Promise<{
                    session: {
                        session: Record<string, any> & {
                            id: string;
                            createdAt: Date;
                            updatedAt: Date;
                            userId: string;
                            expiresAt: Date;
                            token: string;
                            ipAddress?: string | null | undefined;
                            userAgent?: string | null | undefined;
                        };
                        user: Record<string, any> & {
                            id: string;
                            createdAt: Date;
                            updatedAt: Date;
                            email: string;
                            emailVerified: boolean;
                            name: string;
                            image?: string | null | undefined;
                        };
                    };
                }>)[];
                metadata: {
                    openapi: {
                        summary: string;
                        description: string;
                        responses: {
                            200: {
                                description: string;
                                content: {
                                    "application/json": {
                                        schema: {
                                            type: "object";
                                            properties: {
                                                status: {
                                                    type: string;
                                                };
                                            };
                                        };
                                    };
                                };
                            };
                        };
                    };
                };
            }, {
                status: boolean;
            }>;
            verifyBackupCode: import("better-auth").StrictEndpoint<"/two-factor/verify-backup-code", {
                method: "POST";
                body: import("better-auth").ZodObject<{
                    code: import("better-auth").ZodString;
                    disableSession: import("better-auth").ZodOptional<import("better-auth").ZodBoolean>;
                    trustDevice: import("better-auth").ZodOptional<import("better-auth").ZodBoolean>;
                }, import("zod/v4/core").$strip>;
                metadata: {
                    openapi: {
                        description: string;
                        responses: {
                            "200": {
                                description: string;
                                content: {
                                    "application/json": {
                                        schema: {
                                            type: "object";
                                            properties: {
                                                user: {
                                                    type: string;
                                                    properties: {
                                                        id: {
                                                            type: string;
                                                            description: string;
                                                        };
                                                        email: {
                                                            type: string;
                                                            format: string;
                                                            nullable: boolean;
                                                            description: string;
                                                        };
                                                        emailVerified: {
                                                            type: string;
                                                            nullable: boolean;
                                                            description: string;
                                                        };
                                                        name: {
                                                            type: string;
                                                            nullable: boolean;
                                                            description: string;
                                                        };
                                                        image: {
                                                            type: string;
                                                            format: string;
                                                            nullable: boolean;
                                                            description: string;
                                                        };
                                                        twoFactorEnabled: {
                                                            type: string;
                                                            description: string;
                                                        };
                                                        createdAt: {
                                                            type: string;
                                                            format: string;
                                                            description: string;
                                                        };
                                                        updatedAt: {
                                                            type: string;
                                                            format: string;
                                                            description: string;
                                                        };
                                                    };
                                                    required: string[];
                                                    description: string;
                                                };
                                                session: {
                                                    type: string;
                                                    properties: {
                                                        token: {
                                                            type: string;
                                                            description: string;
                                                        };
                                                        userId: {
                                                            type: string;
                                                            description: string;
                                                        };
                                                        createdAt: {
                                                            type: string;
                                                            format: string;
                                                            description: string;
                                                        };
                                                        expiresAt: {
                                                            type: string;
                                                            format: string;
                                                            description: string;
                                                        };
                                                    };
                                                    required: string[];
                                                    description: string;
                                                };
                                            };
                                            required: string[];
                                        };
                                    };
                                };
                            };
                        };
                    };
                };
            }, {
                token: string | undefined;
                user: (Record<string, any> & {
                    id: string;
                    createdAt: Date;
                    updatedAt: Date;
                    email: string;
                    emailVerified: boolean;
                    name: string;
                    image?: string | null | undefined;
                }) | import("better-auth/plugins").UserWithTwoFactor;
            }>;
            generateBackupCodes: import("better-auth").StrictEndpoint<"/two-factor/generate-backup-codes", {
                method: "POST";
                body: import("better-auth").ZodObject<{
                    password: import("better-auth").ZodOptional<import("better-auth").ZodString>;
                }, import("zod/v4/core").$strip> | import("better-auth").ZodObject<{
                    password: import("better-auth").ZodString;
                }, import("zod/v4/core").$strip>;
                use: ((inputContext: import("better-auth").MiddlewareInputContext<import("better-auth").MiddlewareOptions>) => Promise<{
                    session: {
                        session: Record<string, any> & {
                            id: string;
                            createdAt: Date;
                            updatedAt: Date;
                            userId: string;
                            expiresAt: Date;
                            token: string;
                            ipAddress?: string | null | undefined;
                            userAgent?: string | null | undefined;
                        };
                        user: Record<string, any> & {
                            id: string;
                            createdAt: Date;
                            updatedAt: Date;
                            email: string;
                            emailVerified: boolean;
                            name: string;
                            image?: string | null | undefined;
                        };
                    };
                }>)[];
                metadata: {
                    openapi: {
                        description: string;
                        responses: {
                            "200": {
                                description: string;
                                content: {
                                    "application/json": {
                                        schema: {
                                            type: "object";
                                            properties: {
                                                status: {
                                                    type: string;
                                                    description: string;
                                                    enum: boolean[];
                                                };
                                                backupCodes: {
                                                    type: string;
                                                    items: {
                                                        type: string;
                                                    };
                                                    description: string;
                                                };
                                            };
                                            required: string[];
                                        };
                                    };
                                };
                            };
                        };
                    };
                };
            }, {
                status: boolean;
                backupCodes: string[];
            }>;
            viewBackupCodes: import("better-auth").StrictEndpoint<string, {
                method: "POST";
                body: import("better-auth").ZodObject<{
                    userId: import("better-auth").ZodCoercedString<unknown>;
                }, import("zod/v4/core").$strip>;
            }, {
                status: boolean;
                backupCodes: string[];
            }>;
            sendTwoFactorOTP: import("better-auth").StrictEndpoint<"/two-factor/send-otp", {
                method: "POST";
                body: import("better-auth").ZodOptional<import("better-auth").ZodObject<{
                    trustDevice: import("better-auth").ZodOptional<import("better-auth").ZodBoolean>;
                }, import("zod/v4/core").$strip>>;
                metadata: {
                    openapi: {
                        summary: string;
                        description: string;
                        responses: {
                            200: {
                                description: string;
                                content: {
                                    "application/json": {
                                        schema: {
                                            type: "object";
                                            properties: {
                                                status: {
                                                    type: string;
                                                };
                                            };
                                        };
                                    };
                                };
                            };
                        };
                    };
                };
            }, {
                status: boolean;
            }>;
            verifyTwoFactorOTP: import("better-auth").StrictEndpoint<"/two-factor/verify-otp", {
                method: "POST";
                body: import("better-auth").ZodObject<{
                    code: import("better-auth").ZodString;
                    trustDevice: import("better-auth").ZodOptional<import("better-auth").ZodBoolean>;
                }, import("zod/v4/core").$strip>;
                metadata: {
                    openapi: {
                        summary: string;
                        description: string;
                        responses: {
                            "200": {
                                description: string;
                                content: {
                                    "application/json": {
                                        schema: {
                                            type: "object";
                                            properties: {
                                                token: {
                                                    type: string;
                                                    description: string;
                                                };
                                                user: {
                                                    type: string;
                                                    properties: {
                                                        id: {
                                                            type: string;
                                                            description: string;
                                                        };
                                                        email: {
                                                            type: string;
                                                            format: string;
                                                            nullable: boolean;
                                                            description: string;
                                                        };
                                                        emailVerified: {
                                                            type: string;
                                                            nullable: boolean;
                                                            description: string;
                                                        };
                                                        name: {
                                                            type: string;
                                                            nullable: boolean;
                                                            description: string;
                                                        };
                                                        image: {
                                                            type: string;
                                                            format: string;
                                                            nullable: boolean;
                                                            description: string;
                                                        };
                                                        createdAt: {
                                                            type: string;
                                                            format: string;
                                                            description: string;
                                                        };
                                                        updatedAt: {
                                                            type: string;
                                                            format: string;
                                                            description: string;
                                                        };
                                                    };
                                                    required: string[];
                                                    description: string;
                                                };
                                            };
                                            required: string[];
                                        };
                                    };
                                };
                            };
                        };
                    };
                };
            }, {
                token: string;
                user: import("better-auth/plugins").UserWithTwoFactor;
            } | {
                token: string;
                user: Record<string, any> & {
                    id: string;
                    createdAt: Date;
                    updatedAt: Date;
                    email: string;
                    emailVerified: boolean;
                    name: string;
                    image?: string | null | undefined;
                };
            }>;
            generateTOTP: import("better-auth").StrictEndpoint<string, {
                method: "POST";
                body: import("better-auth").ZodObject<{
                    secret: import("better-auth").ZodString;
                }, import("zod/v4/core").$strip>;
                metadata: {
                    openapi: {
                        summary: string;
                        description: string;
                        responses: {
                            200: {
                                description: string;
                                content: {
                                    "application/json": {
                                        schema: {
                                            type: "object";
                                            properties: {
                                                code: {
                                                    type: string;
                                                };
                                            };
                                        };
                                    };
                                };
                            };
                        };
                    };
                };
            }, {
                code: string;
            }>;
            getTOTPURI: import("better-auth").StrictEndpoint<"/two-factor/get-totp-uri", {
                method: "POST";
                use: ((inputContext: import("better-auth").MiddlewareInputContext<import("better-auth").MiddlewareOptions>) => Promise<{
                    session: {
                        session: Record<string, any> & {
                            id: string;
                            createdAt: Date;
                            updatedAt: Date;
                            userId: string;
                            expiresAt: Date;
                            token: string;
                            ipAddress?: string | null | undefined;
                            userAgent?: string | null | undefined;
                        };
                        user: Record<string, any> & {
                            id: string;
                            createdAt: Date;
                            updatedAt: Date;
                            email: string;
                            emailVerified: boolean;
                            name: string;
                            image?: string | null | undefined;
                        };
                    };
                }>)[];
                body: import("better-auth").ZodObject<{
                    password: import("better-auth").ZodOptional<import("better-auth").ZodString>;
                }, import("zod/v4/core").$strip> | import("better-auth").ZodObject<{
                    password: import("better-auth").ZodString;
                }, import("zod/v4/core").$strip>;
                metadata: {
                    openapi: {
                        summary: string;
                        description: string;
                        responses: {
                            200: {
                                description: string;
                                content: {
                                    "application/json": {
                                        schema: {
                                            type: "object";
                                            properties: {
                                                totpURI: {
                                                    type: string;
                                                };
                                            };
                                        };
                                    };
                                };
                            };
                        };
                    };
                };
            }, {
                totpURI: string;
            }>;
            verifyTOTP: import("better-auth").StrictEndpoint<"/two-factor/verify-totp", {
                method: "POST";
                body: import("better-auth").ZodObject<{
                    code: import("better-auth").ZodString;
                    trustDevice: import("better-auth").ZodOptional<import("better-auth").ZodBoolean>;
                }, import("zod/v4/core").$strip>;
                metadata: {
                    openapi: {
                        summary: string;
                        description: string;
                        responses: {
                            200: {
                                description: string;
                                content: {
                                    "application/json": {
                                        schema: {
                                            type: "object";
                                            properties: {
                                                status: {
                                                    type: string;
                                                };
                                            };
                                        };
                                    };
                                };
                            };
                        };
                    };
                };
            }, {
                token: string;
                user: import("better-auth/plugins").UserWithTwoFactor;
            } | {
                token: string;
                user: Record<string, any> & {
                    id: string;
                    createdAt: Date;
                    updatedAt: Date;
                    email: string;
                    emailVerified: boolean;
                    name: string;
                    image?: string | null | undefined;
                };
            }>;
        };
        options: NoInfer<{
            issuer: string;
            totpOptions: {
                digits: 6;
                period: number;
            };
            accountLockout: {
                enabled: true;
                maxFailedAttempts: number;
                durationSeconds: number;
            };
        }>;
        hooks: {
            after: {
                matcher(context: import("better-auth").HookEndpointContext): boolean;
                handler: (inputContext: import("better-auth").MiddlewareInputContext<import("better-auth").MiddlewareOptions>) => Promise<{
                    twoFactorRedirect: boolean;
                    twoFactorMethods: string[];
                } | undefined>;
            }[];
        };
        schema: {
            user: {
                fields: {
                    twoFactorEnabled: {
                        type: "boolean";
                        required: false;
                        defaultValue: false;
                        input: false;
                    };
                };
            };
            twoFactor: {
                fields: {
                    secret: {
                        type: "string";
                        required: true;
                        returned: false;
                        index: true;
                    };
                    backupCodes: {
                        type: "string";
                        required: true;
                        returned: false;
                    };
                    userId: {
                        type: "string";
                        required: true;
                        returned: false;
                        references: {
                            model: string;
                            field: string;
                        };
                        index: true;
                    };
                    verified: {
                        type: "boolean";
                        required: false;
                        defaultValue: true;
                        input: false;
                    };
                    failedVerificationCount: {
                        type: "number";
                        required: false;
                        defaultValue: number;
                        input: false;
                        returned: false;
                    };
                    lockedUntil: {
                        type: "date";
                        required: false;
                        input: false;
                        returned: false;
                    };
                };
            };
        };
        rateLimit: {
            pathMatcher(path: string): boolean;
            window: number;
            max: number;
        }[];
        $ERROR_CODES: {
            OTP_NOT_ENABLED: import("better-auth").RawError<"OTP_NOT_ENABLED">;
            OTP_HAS_EXPIRED: import("better-auth").RawError<"OTP_HAS_EXPIRED">;
            TOTP_NOT_ENABLED: import("better-auth").RawError<"TOTP_NOT_ENABLED">;
            TWO_FACTOR_NOT_ENABLED: import("better-auth").RawError<"TWO_FACTOR_NOT_ENABLED">;
            BACKUP_CODES_NOT_ENABLED: import("better-auth").RawError<"BACKUP_CODES_NOT_ENABLED">;
            INVALID_BACKUP_CODE: import("better-auth").RawError<"INVALID_BACKUP_CODE">;
            INVALID_CODE: import("better-auth").RawError<"INVALID_CODE">;
            TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE: import("better-auth").RawError<"TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE">;
            ACCOUNT_TEMPORARILY_LOCKED: import("better-auth").RawError<"ACCOUNT_TEMPORARILY_LOCKED">;
            INVALID_TWO_FACTOR_COOKIE: import("better-auth").RawError<"INVALID_TWO_FACTOR_COOKIE">;
        };
    }];
    hooks: {
        before: (inputContext: import("better-auth").MiddlewareInputContext<import("better-auth").MiddlewareOptions>) => Promise<void>;
        after: (inputContext: import("better-auth").MiddlewareInputContext<import("better-auth").MiddlewareOptions>) => Promise<void>;
    };
} | {
    appName: string;
    database: (options: import("better-auth").BetterAuthOptions) => import("better-auth").DBAdapter<import("better-auth").BetterAuthOptions>;
    secret: string;
    baseURL: string;
    basePath: string;
    trustedOrigins: string[];
    emailAndPassword: {
        enabled: true;
        requireEmailVerification: boolean;
        revokeSessionsOnPasswordReset: true;
        sendResetPassword: ({ user, url }: {
            user: import("better-auth").User;
            url: string;
            token: string;
        }) => Promise<void>;
        onPasswordReset: ({ user }: {
            user: import("better-auth").User;
        }) => Promise<void>;
    };
    emailVerification: {
        sendOnSignUp: true;
        autoSignInAfterVerification: true;
        sendVerificationEmail: ({ user, url }: {
            user: import("better-auth").User;
            url: string;
            token: string;
        }) => Promise<void>;
    };
    user: {
        additionalFields: {
            role: {
                type: "string";
                required: false;
                defaultValue: string;
                input: false;
            };
            companyId: {
                type: "string";
                required: false;
                input: false;
            };
            phone: {
                type: "string";
                required: false;
                input: true;
            };
            qid: {
                type: "string";
                required: false;
                input: true;
            };
            preferredLanguage: {
                type: "string";
                required: false;
                defaultValue: string;
                input: true;
            };
            twoFactorEnabled: {
                type: "boolean";
                required: false;
                defaultValue: false;
                input: false;
            };
        };
    };
    session: {
        expiresIn: number;
        updateAge: number;
        cookieCache: {
            enabled: boolean;
            maxAge: number;
        };
    };
    plugins: [{
        id: "two-factor";
        version: string;
        endpoints: {
            enableTwoFactor: import("better-auth").StrictEndpoint<"/two-factor/enable", {
                method: "POST";
                body: import("better-auth").ZodObject<{
                    password: import("better-auth").ZodOptional<import("better-auth").ZodString>;
                    issuer: import("better-auth").ZodOptional<import("better-auth").ZodString>;
                }, import("zod/v4/core").$strip> | import("better-auth").ZodObject<{
                    password: import("better-auth").ZodString;
                    issuer: import("better-auth").ZodOptional<import("better-auth").ZodString>;
                }, import("zod/v4/core").$strip>;
                use: ((inputContext: import("better-auth").MiddlewareInputContext<import("better-auth").MiddlewareOptions>) => Promise<{
                    session: {
                        session: Record<string, any> & {
                            id: string;
                            createdAt: Date;
                            updatedAt: Date;
                            userId: string;
                            expiresAt: Date;
                            token: string;
                            ipAddress?: string | null | undefined;
                            userAgent?: string | null | undefined;
                        };
                        user: Record<string, any> & {
                            id: string;
                            createdAt: Date;
                            updatedAt: Date;
                            email: string;
                            emailVerified: boolean;
                            name: string;
                            image?: string | null | undefined;
                        };
                    };
                }>)[];
                metadata: {
                    openapi: {
                        summary: string;
                        description: string;
                        responses: {
                            200: {
                                description: string;
                                content: {
                                    "application/json": {
                                        schema: {
                                            type: "object";
                                            properties: {
                                                totpURI: {
                                                    type: string;
                                                    description: string;
                                                };
                                                backupCodes: {
                                                    type: string;
                                                    items: {
                                                        type: string;
                                                    };
                                                    description: string;
                                                };
                                            };
                                        };
                                    };
                                };
                            };
                        };
                    };
                };
            }, {
                totpURI: string;
                backupCodes: string[];
            }>;
            disableTwoFactor: import("better-auth").StrictEndpoint<"/two-factor/disable", {
                method: "POST";
                body: import("better-auth").ZodObject<{
                    password: import("better-auth").ZodOptional<import("better-auth").ZodString>;
                }, import("zod/v4/core").$strip> | import("better-auth").ZodObject<{
                    password: import("better-auth").ZodString;
                }, import("zod/v4/core").$strip>;
                use: ((inputContext: import("better-auth").MiddlewareInputContext<import("better-auth").MiddlewareOptions>) => Promise<{
                    session: {
                        session: Record<string, any> & {
                            id: string;
                            createdAt: Date;
                            updatedAt: Date;
                            userId: string;
                            expiresAt: Date;
                            token: string;
                            ipAddress?: string | null | undefined;
                            userAgent?: string | null | undefined;
                        };
                        user: Record<string, any> & {
                            id: string;
                            createdAt: Date;
                            updatedAt: Date;
                            email: string;
                            emailVerified: boolean;
                            name: string;
                            image?: string | null | undefined;
                        };
                    };
                }>)[];
                metadata: {
                    openapi: {
                        summary: string;
                        description: string;
                        responses: {
                            200: {
                                description: string;
                                content: {
                                    "application/json": {
                                        schema: {
                                            type: "object";
                                            properties: {
                                                status: {
                                                    type: string;
                                                };
                                            };
                                        };
                                    };
                                };
                            };
                        };
                    };
                };
            }, {
                status: boolean;
            }>;
            verifyBackupCode: import("better-auth").StrictEndpoint<"/two-factor/verify-backup-code", {
                method: "POST";
                body: import("better-auth").ZodObject<{
                    code: import("better-auth").ZodString;
                    disableSession: import("better-auth").ZodOptional<import("better-auth").ZodBoolean>;
                    trustDevice: import("better-auth").ZodOptional<import("better-auth").ZodBoolean>;
                }, import("zod/v4/core").$strip>;
                metadata: {
                    openapi: {
                        description: string;
                        responses: {
                            "200": {
                                description: string;
                                content: {
                                    "application/json": {
                                        schema: {
                                            type: "object";
                                            properties: {
                                                user: {
                                                    type: string;
                                                    properties: {
                                                        id: {
                                                            type: string;
                                                            description: string;
                                                        };
                                                        email: {
                                                            type: string;
                                                            format: string;
                                                            nullable: boolean;
                                                            description: string;
                                                        };
                                                        emailVerified: {
                                                            type: string;
                                                            nullable: boolean;
                                                            description: string;
                                                        };
                                                        name: {
                                                            type: string;
                                                            nullable: boolean;
                                                            description: string;
                                                        };
                                                        image: {
                                                            type: string;
                                                            format: string;
                                                            nullable: boolean;
                                                            description: string;
                                                        };
                                                        twoFactorEnabled: {
                                                            type: string;
                                                            description: string;
                                                        };
                                                        createdAt: {
                                                            type: string;
                                                            format: string;
                                                            description: string;
                                                        };
                                                        updatedAt: {
                                                            type: string;
                                                            format: string;
                                                            description: string;
                                                        };
                                                    };
                                                    required: string[];
                                                    description: string;
                                                };
                                                session: {
                                                    type: string;
                                                    properties: {
                                                        token: {
                                                            type: string;
                                                            description: string;
                                                        };
                                                        userId: {
                                                            type: string;
                                                            description: string;
                                                        };
                                                        createdAt: {
                                                            type: string;
                                                            format: string;
                                                            description: string;
                                                        };
                                                        expiresAt: {
                                                            type: string;
                                                            format: string;
                                                            description: string;
                                                        };
                                                    };
                                                    required: string[];
                                                    description: string;
                                                };
                                            };
                                            required: string[];
                                        };
                                    };
                                };
                            };
                        };
                    };
                };
            }, {
                token: string | undefined;
                user: (Record<string, any> & {
                    id: string;
                    createdAt: Date;
                    updatedAt: Date;
                    email: string;
                    emailVerified: boolean;
                    name: string;
                    image?: string | null | undefined;
                }) | import("better-auth/plugins").UserWithTwoFactor;
            }>;
            generateBackupCodes: import("better-auth").StrictEndpoint<"/two-factor/generate-backup-codes", {
                method: "POST";
                body: import("better-auth").ZodObject<{
                    password: import("better-auth").ZodOptional<import("better-auth").ZodString>;
                }, import("zod/v4/core").$strip> | import("better-auth").ZodObject<{
                    password: import("better-auth").ZodString;
                }, import("zod/v4/core").$strip>;
                use: ((inputContext: import("better-auth").MiddlewareInputContext<import("better-auth").MiddlewareOptions>) => Promise<{
                    session: {
                        session: Record<string, any> & {
                            id: string;
                            createdAt: Date;
                            updatedAt: Date;
                            userId: string;
                            expiresAt: Date;
                            token: string;
                            ipAddress?: string | null | undefined;
                            userAgent?: string | null | undefined;
                        };
                        user: Record<string, any> & {
                            id: string;
                            createdAt: Date;
                            updatedAt: Date;
                            email: string;
                            emailVerified: boolean;
                            name: string;
                            image?: string | null | undefined;
                        };
                    };
                }>)[];
                metadata: {
                    openapi: {
                        description: string;
                        responses: {
                            "200": {
                                description: string;
                                content: {
                                    "application/json": {
                                        schema: {
                                            type: "object";
                                            properties: {
                                                status: {
                                                    type: string;
                                                    description: string;
                                                    enum: boolean[];
                                                };
                                                backupCodes: {
                                                    type: string;
                                                    items: {
                                                        type: string;
                                                    };
                                                    description: string;
                                                };
                                            };
                                            required: string[];
                                        };
                                    };
                                };
                            };
                        };
                    };
                };
            }, {
                status: boolean;
                backupCodes: string[];
            }>;
            viewBackupCodes: import("better-auth").StrictEndpoint<string, {
                method: "POST";
                body: import("better-auth").ZodObject<{
                    userId: import("better-auth").ZodCoercedString<unknown>;
                }, import("zod/v4/core").$strip>;
            }, {
                status: boolean;
                backupCodes: string[];
            }>;
            sendTwoFactorOTP: import("better-auth").StrictEndpoint<"/two-factor/send-otp", {
                method: "POST";
                body: import("better-auth").ZodOptional<import("better-auth").ZodObject<{
                    trustDevice: import("better-auth").ZodOptional<import("better-auth").ZodBoolean>;
                }, import("zod/v4/core").$strip>>;
                metadata: {
                    openapi: {
                        summary: string;
                        description: string;
                        responses: {
                            200: {
                                description: string;
                                content: {
                                    "application/json": {
                                        schema: {
                                            type: "object";
                                            properties: {
                                                status: {
                                                    type: string;
                                                };
                                            };
                                        };
                                    };
                                };
                            };
                        };
                    };
                };
            }, {
                status: boolean;
            }>;
            verifyTwoFactorOTP: import("better-auth").StrictEndpoint<"/two-factor/verify-otp", {
                method: "POST";
                body: import("better-auth").ZodObject<{
                    code: import("better-auth").ZodString;
                    trustDevice: import("better-auth").ZodOptional<import("better-auth").ZodBoolean>;
                }, import("zod/v4/core").$strip>;
                metadata: {
                    openapi: {
                        summary: string;
                        description: string;
                        responses: {
                            "200": {
                                description: string;
                                content: {
                                    "application/json": {
                                        schema: {
                                            type: "object";
                                            properties: {
                                                token: {
                                                    type: string;
                                                    description: string;
                                                };
                                                user: {
                                                    type: string;
                                                    properties: {
                                                        id: {
                                                            type: string;
                                                            description: string;
                                                        };
                                                        email: {
                                                            type: string;
                                                            format: string;
                                                            nullable: boolean;
                                                            description: string;
                                                        };
                                                        emailVerified: {
                                                            type: string;
                                                            nullable: boolean;
                                                            description: string;
                                                        };
                                                        name: {
                                                            type: string;
                                                            nullable: boolean;
                                                            description: string;
                                                        };
                                                        image: {
                                                            type: string;
                                                            format: string;
                                                            nullable: boolean;
                                                            description: string;
                                                        };
                                                        createdAt: {
                                                            type: string;
                                                            format: string;
                                                            description: string;
                                                        };
                                                        updatedAt: {
                                                            type: string;
                                                            format: string;
                                                            description: string;
                                                        };
                                                    };
                                                    required: string[];
                                                    description: string;
                                                };
                                            };
                                            required: string[];
                                        };
                                    };
                                };
                            };
                        };
                    };
                };
            }, {
                token: string;
                user: import("better-auth/plugins").UserWithTwoFactor;
            } | {
                token: string;
                user: Record<string, any> & {
                    id: string;
                    createdAt: Date;
                    updatedAt: Date;
                    email: string;
                    emailVerified: boolean;
                    name: string;
                    image?: string | null | undefined;
                };
            }>;
            generateTOTP: import("better-auth").StrictEndpoint<string, {
                method: "POST";
                body: import("better-auth").ZodObject<{
                    secret: import("better-auth").ZodString;
                }, import("zod/v4/core").$strip>;
                metadata: {
                    openapi: {
                        summary: string;
                        description: string;
                        responses: {
                            200: {
                                description: string;
                                content: {
                                    "application/json": {
                                        schema: {
                                            type: "object";
                                            properties: {
                                                code: {
                                                    type: string;
                                                };
                                            };
                                        };
                                    };
                                };
                            };
                        };
                    };
                };
            }, {
                code: string;
            }>;
            getTOTPURI: import("better-auth").StrictEndpoint<"/two-factor/get-totp-uri", {
                method: "POST";
                use: ((inputContext: import("better-auth").MiddlewareInputContext<import("better-auth").MiddlewareOptions>) => Promise<{
                    session: {
                        session: Record<string, any> & {
                            id: string;
                            createdAt: Date;
                            updatedAt: Date;
                            userId: string;
                            expiresAt: Date;
                            token: string;
                            ipAddress?: string | null | undefined;
                            userAgent?: string | null | undefined;
                        };
                        user: Record<string, any> & {
                            id: string;
                            createdAt: Date;
                            updatedAt: Date;
                            email: string;
                            emailVerified: boolean;
                            name: string;
                            image?: string | null | undefined;
                        };
                    };
                }>)[];
                body: import("better-auth").ZodObject<{
                    password: import("better-auth").ZodOptional<import("better-auth").ZodString>;
                }, import("zod/v4/core").$strip> | import("better-auth").ZodObject<{
                    password: import("better-auth").ZodString;
                }, import("zod/v4/core").$strip>;
                metadata: {
                    openapi: {
                        summary: string;
                        description: string;
                        responses: {
                            200: {
                                description: string;
                                content: {
                                    "application/json": {
                                        schema: {
                                            type: "object";
                                            properties: {
                                                totpURI: {
                                                    type: string;
                                                };
                                            };
                                        };
                                    };
                                };
                            };
                        };
                    };
                };
            }, {
                totpURI: string;
            }>;
            verifyTOTP: import("better-auth").StrictEndpoint<"/two-factor/verify-totp", {
                method: "POST";
                body: import("better-auth").ZodObject<{
                    code: import("better-auth").ZodString;
                    trustDevice: import("better-auth").ZodOptional<import("better-auth").ZodBoolean>;
                }, import("zod/v4/core").$strip>;
                metadata: {
                    openapi: {
                        summary: string;
                        description: string;
                        responses: {
                            200: {
                                description: string;
                                content: {
                                    "application/json": {
                                        schema: {
                                            type: "object";
                                            properties: {
                                                status: {
                                                    type: string;
                                                };
                                            };
                                        };
                                    };
                                };
                            };
                        };
                    };
                };
            }, {
                token: string;
                user: import("better-auth/plugins").UserWithTwoFactor;
            } | {
                token: string;
                user: Record<string, any> & {
                    id: string;
                    createdAt: Date;
                    updatedAt: Date;
                    email: string;
                    emailVerified: boolean;
                    name: string;
                    image?: string | null | undefined;
                };
            }>;
        };
        options: NoInfer<{
            issuer: string;
            totpOptions: {
                digits: 6;
                period: number;
            };
            accountLockout: {
                enabled: true;
                maxFailedAttempts: number;
                durationSeconds: number;
            };
        }>;
        hooks: {
            after: {
                matcher(context: import("better-auth").HookEndpointContext): boolean;
                handler: (inputContext: import("better-auth").MiddlewareInputContext<import("better-auth").MiddlewareOptions>) => Promise<{
                    twoFactorRedirect: boolean;
                    twoFactorMethods: string[];
                } | undefined>;
            }[];
        };
        schema: {
            user: {
                fields: {
                    twoFactorEnabled: {
                        type: "boolean";
                        required: false;
                        defaultValue: false;
                        input: false;
                    };
                };
            };
            twoFactor: {
                fields: {
                    secret: {
                        type: "string";
                        required: true;
                        returned: false;
                        index: true;
                    };
                    backupCodes: {
                        type: "string";
                        required: true;
                        returned: false;
                    };
                    userId: {
                        type: "string";
                        required: true;
                        returned: false;
                        references: {
                            model: string;
                            field: string;
                        };
                        index: true;
                    };
                    verified: {
                        type: "boolean";
                        required: false;
                        defaultValue: true;
                        input: false;
                    };
                    failedVerificationCount: {
                        type: "number";
                        required: false;
                        defaultValue: number;
                        input: false;
                        returned: false;
                    };
                    lockedUntil: {
                        type: "date";
                        required: false;
                        input: false;
                        returned: false;
                    };
                };
            };
        };
        rateLimit: {
            pathMatcher(path: string): boolean;
            window: number;
            max: number;
        }[];
        $ERROR_CODES: {
            OTP_NOT_ENABLED: import("better-auth").RawError<"OTP_NOT_ENABLED">;
            OTP_HAS_EXPIRED: import("better-auth").RawError<"OTP_HAS_EXPIRED">;
            TOTP_NOT_ENABLED: import("better-auth").RawError<"TOTP_NOT_ENABLED">;
            TWO_FACTOR_NOT_ENABLED: import("better-auth").RawError<"TWO_FACTOR_NOT_ENABLED">;
            BACKUP_CODES_NOT_ENABLED: import("better-auth").RawError<"BACKUP_CODES_NOT_ENABLED">;
            INVALID_BACKUP_CODE: import("better-auth").RawError<"INVALID_BACKUP_CODE">;
            INVALID_CODE: import("better-auth").RawError<"INVALID_CODE">;
            TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE: import("better-auth").RawError<"TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE">;
            ACCOUNT_TEMPORARILY_LOCKED: import("better-auth").RawError<"ACCOUNT_TEMPORARILY_LOCKED">;
            INVALID_TWO_FACTOR_COOKIE: import("better-auth").RawError<"INVALID_TWO_FACTOR_COOKIE">;
        };
    }];
    hooks: {
        before: (inputContext: import("better-auth").MiddlewareInputContext<import("better-auth").MiddlewareOptions>) => Promise<void>;
        after: (inputContext: import("better-auth").MiddlewareInputContext<import("better-auth").MiddlewareOptions>) => Promise<void>;
    };
}>;
export type DmAuth = ReturnType<typeof createAuth>;
