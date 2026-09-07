"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isUniqueConstraintError = isUniqueConstraintError;
exports.isForeignKeyConstraintError = isForeignKeyConstraintError;
const client_1 = require("@prisma/client");
function isUniqueConstraintError(err) {
    return (err instanceof client_1.Prisma.PrismaClientKnownRequestError && err.code === 'P2002');
}
function isForeignKeyConstraintError(err) {
    return (err instanceof client_1.Prisma.PrismaClientKnownRequestError && err.code === 'P2003');
}
//# sourceMappingURL=prisma-errors.js.map