import { User } from '@prisma/client';
import { PaginationQueryDto } from '../common/pagination.dto';
import { NotificationsService } from './notifications.service';
export declare class NotificationsController {
    private readonly notifications;
    constructor(notifications: NotificationsService);
    list(user: User, query: PaginationQueryDto): Promise<{
        total: number;
        limit: number;
        offset: number;
        items: {
            id: string;
            title: string;
            body: string | null;
            link_path: string | null;
            read_at: Date | null;
            created_at: Date;
        }[];
    }>;
    unreadCount(user: User): Promise<{
        count: number;
    }>;
    markRead(user: User, id: string): Promise<{
        id: string;
        read: boolean;
    }>;
}
