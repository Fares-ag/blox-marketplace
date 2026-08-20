import { Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { User } from '@prisma/client';
import { CurrentUser } from '../auth/guards';
import { PaginationQueryDto } from '../common/pagination.dto';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@CurrentUser() user: User, @Query() query: PaginationQueryDto) {
    return this.notifications.listForUser(user, query);
  }

  @Get('unread-count')
  async unreadCount(@CurrentUser() user: User) {
    const count = await this.notifications.unreadCount(user);
    return { count };
  }

  @Patch(':id/read')
  markRead(@CurrentUser() user: User, @Param('id') id: string) {
    return this.notifications.markRead(user, id);
  }
}
