"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UPLOAD_MAX_BYTES = void 0;
exports.multerUploadOptions = multerUploadOptions;
exports.UPLOAD_MAX_BYTES = 10 * 1024 * 1024;
function multerUploadOptions() {
    return {
        limits: { fileSize: exports.UPLOAD_MAX_BYTES },
    };
}
//# sourceMappingURL=multer-options.js.map