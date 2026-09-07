import { ConfigService } from '@nestjs/config';
import { type NotificationLocale } from '../notifications/notification-texts';
import { PrismaService } from '../prisma/prisma.service';
export type MailTemplate = 'password_reset' | 'email_verification' | 'walk_in_invite' | 'staff_account_created' | 'assisted_session' | 'document_expiry' | 'takaful_renewal' | 'notification' | 'transactional';
export declare const MAIL_TEMPLATES: readonly MailTemplate[];
export declare function isMailTemplate(value: unknown): value is MailTemplate;
export type RenderedEmail = {
    subject: string;
    text: string;
    html: string;
};
export type MailInput = {
    to: string;
    subject: string;
    text: string;
    html?: string;
    template: MailTemplate;
    payload?: Record<string, unknown>;
    authCritical?: boolean;
};
export declare function resolveSmtpRequireTls(raw: string | undefined, opts: {
    host: string;
    port: number;
    secure: boolean;
}): boolean;
export declare class MailDeliveryError extends Error {
    readonly outboxId: string;
    constructor(message: string, outboxId: string);
}
export type DocumentExpiryEmailInput = {
    name: string;
    documentCategory: string;
    expiresAt: Date;
    daysToExpiry: number;
    url: string;
};
export declare function renderDocumentExpiryEmail(input: DocumentExpiryEmailInput, locale?: NotificationLocale): RenderedEmail;
export type TakafulRenewalEmailInput = {
    name: string;
    vehicleLabel: string;
    provider: string | null;
    expiresAt: Date;
    daysToExpiry: number;
    url: string;
};
export declare function renderTakafulRenewalEmail(input: TakafulRenewalEmailInput, locale?: NotificationLocale): RenderedEmail;
export type NotificationEmailInput = {
    name: string;
    title: string;
    body: string | null;
    url: string | null;
    category: string;
};
export declare function renderNotificationEmail(input: NotificationEmailInput, locale?: NotificationLocale): RenderedEmail;
export type AssistedSessionEmailInput = {
    url: string;
    dealerName: string;
    agentName?: string | null;
    expiresAt: Date;
};
export declare function renderAssistedSessionEmail(input: AssistedSessionEmailInput, locale?: NotificationLocale): RenderedEmail;
export declare class MailService {
    private readonly config;
    private readonly prisma;
    private readonly logger;
    private readonly transport;
    private transporter;
    private readonly postmarkToken;
    private readonly postmarkHttpTimeoutMs;
    private readonly from;
    constructor(config: ConfigService, prisma: PrismaService);
    get enabled(): boolean;
    assertProductionReady(_requireEmailVerification?: boolean): void;
    send(input: MailInput): Promise<void>;
    markForRetry(id: string): Promise<void>;
    processOutbox(limit?: number): Promise<{
        processed: number;
        sent: number;
        failed: number;
    }>;
    private attemptDelivery;
    private deliver;
    sendVerificationEmail(to: string, url: string): Promise<void>;
    sendPasswordResetEmail(to: string, url: string): Promise<void>;
    sendWalkInInviteEmail(to: string, url: string, dealerName: string): Promise<void>;
    sendDealerAgentWelcomeEmail(input: {
        to: string;
        name: string;
        loginUrl: string;
        temporaryPassword: string;
        dealerName: string;
    }): Promise<void>;
    sendAdminPasswordResetEmail(input: {
        to: string;
        name: string;
        loginUrl: string;
        temporaryPassword: string;
    }): Promise<void>;
    sendStaffAccountCreatedEmail(to: string, name: string, loginUrl: string): Promise<void>;
    sendDealerQuoteEmail(input: {
        to: string;
        url: string;
        dealerName: string;
        vehicleLabel: string;
        negotiatedPrice: number;
        expiresAt: Date;
    }): Promise<void>;
    sendAssistedSessionEmail(input: AssistedSessionEmailInput & {
        to: string;
        locale?: NotificationLocale;
    }): Promise<void>;
    sendDocumentExpiryEmail(input: DocumentExpiryEmailInput & {
        to: string;
        locale?: NotificationLocale;
    }): Promise<void>;
    sendTakafulRenewalEmail(input: TakafulRenewalEmailInput & {
        to: string;
        locale?: NotificationLocale;
    }): Promise<void>;
    sendNotificationEmail(input: NotificationEmailInput & {
        to: string;
        locale?: NotificationLocale;
    }): Promise<void>;
}
