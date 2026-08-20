import type { Notification } from '@prisma/client';

export function toNotificationDto(notification: Notification) {
  return {
    id: notification.id,
    title: notification.title,
    body: notification.body,
    link_path: notification.linkPath,
    read_at: notification.readAt,
    created_at: notification.createdAt,
  };
}
