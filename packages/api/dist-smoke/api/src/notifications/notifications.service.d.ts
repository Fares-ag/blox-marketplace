import { PrismaService } from '../prisma/prisma.service';
import { User } from '@prisma/client';
import { PaginationQueryDto } from '../common/pagination.dto';
export declare class NotificationsService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    listForUser(user: User, query?: PaginationQueryDto): Promise<{
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
    markRead(user: User, id: string): Promise<{
        id: string;
        read: boolean;
    }>;
    unreadCount(user: User): import(".prisma/client").Prisma.PrismaPromise<number>;
}
