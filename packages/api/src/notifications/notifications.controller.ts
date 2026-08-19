import { Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { User } from '@prisma/client';
import { CurrentUser } from '../auth/guards';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@CurrentUser() user: User, @Query('limit') limit?: number) {
    return this.notifications.listForUser(user, limit != null ? Number(limit) : undefined);
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
