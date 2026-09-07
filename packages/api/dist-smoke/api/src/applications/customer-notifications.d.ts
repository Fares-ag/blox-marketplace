import { ApplicationStatus } from '@prisma/client';
export declare const DECISION_STATUSES_WITHOUT_REASON: ReadonlySet<ApplicationStatus>;
export declare function customerNotificationBody(toStatus: ApplicationStatus, reason?: string | null): string | undefined;
