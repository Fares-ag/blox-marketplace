import { ModuleRef } from '@nestjs/core';
import { type LocalizedText, type NotificationCategory, type NotificationData, type NotificationDispatchInput, type NotificationDispatchResult } from '../notifications/notification-router.contract';
import { PrismaService } from '../prisma/prisma.service';
export type NotifyOptions = {
    category?: NotificationCategory;
    data?: NotificationData;
    email?: NotificationDispatchInput['email'];
};
export declare class ActivityService {
    private readonly prisma;
    private readonly moduleRef;
    private readonly logger;
    private router;
    constructor(prisma: PrismaService, moduleRef: ModuleRef);
    log(opts: {
        actorUserId?: string | null;
        entityType: string;
        entityId: string;
        action: string;
        fromValue?: string | null;
        toValue?: string | null;
        metadata?: object | null;
    }): Promise<void>;
    notify(userId: string, title: LocalizedText, body?: LocalizedText | null, linkPath?: string, opts?: NotifyOptions): Promise<NotificationDispatchResult>;
    private resolveRouter;
}
