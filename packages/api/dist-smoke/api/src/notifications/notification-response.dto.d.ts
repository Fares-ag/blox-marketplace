import type { Notification } from '@prisma/client';
export declare function toNotificationDto(notification: Notification): {
    id: string;
    title: string;
    body: string | null;
    link_path: string | null;
    read_at: Date | null;
    created_at: Date;
};
