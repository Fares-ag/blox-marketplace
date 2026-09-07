"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SYSTEM_USER_EMAIL = void 0;
exports.ensureSystemUser = ensureSystemUser;
const client_1 = require("@prisma/client");
const system_actor_1 = require("./system-actor");
exports.SYSTEM_USER_EMAIL = 'system@internal.blox.invalid';
async function ensureSystemUser(prisma) {
    await prisma.user.upsert({
        where: { id: system_actor_1.SYSTEM_ACTOR_USER_ID },
        create: {
            id: system_actor_1.SYSTEM_ACTOR_USER_ID,
            name: 'System',
            email: exports.SYSTEM_USER_EMAIL,
            emailVerified: false,
            role: client_1.UserRole.super_admin,
            isActive: true,
        },
        update: {
            name: 'System',
            role: client_1.UserRole.super_admin,
            isActive: true,
        },
    });
}
//# sourceMappingURL=ensure-system-user.js.map