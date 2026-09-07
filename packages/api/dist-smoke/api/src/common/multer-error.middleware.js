"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyMulterErrorMiddleware = applyMulterErrorMiddleware;
const common_1 = require("@nestjs/common");
function applyMulterErrorMiddleware(expressApp, multer) {
    expressApp.use((err, _req, _res, next) => {
        if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
            next(new common_1.PayloadTooLargeException('file_too_large'));
            return;
        }
        next(err);
    });
}
//# sourceMappingURL=multer-error.middleware.js.map