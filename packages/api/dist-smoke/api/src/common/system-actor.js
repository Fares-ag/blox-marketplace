"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SYSTEM_ACTOR = exports.SYSTEM_ACTOR_USER_ID = void 0;
const client_1 = require("@prisma/client");
exports.SYSTEM_ACTOR_USER_ID = 'system';
exports.SYSTEM_ACTOR = {
    id: exports.SYSTEM_ACTOR_USER_ID,
    role: client_1.UserRole.super_admin,
};
//# sourceMappingURL=system-actor.js.map