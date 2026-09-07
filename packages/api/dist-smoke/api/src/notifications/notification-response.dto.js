"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toNotificationDto = toNotificationDto;
function toNotificationDto(notification) {
    return {
        id: notification.id,
        title: notification.title,
        body: notification.body,
        link_path: notification.linkPath,
        read_at: notification.readAt,
        created_at: notification.createdAt,
    };
}
//# sourceMappingURL=notification-response.dto.js.map