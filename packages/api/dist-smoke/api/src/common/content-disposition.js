"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildContentDisposition = buildContentDisposition;
exports.setFileDownloadHeaders = setFileDownloadHeaders;
function buildContentDisposition(filename, type = 'attachment') {
    const sanitized = filename
        .replace(/[\r\n"]/g, '')
        .replace(/[^\w.\-()+\s]/g, '_')
        .trim()
        .slice(0, 200) || 'download';
    const encoded = encodeURIComponent(sanitized);
    return `${type}; filename="${sanitized}"; filename*=UTF-8''${encoded}`;
}
function setFileDownloadHeaders(res, contentType, filename, disposition = 'attachment') {
    res.setHeader('Content-Type', contentType);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Disposition', buildContentDisposition(filename, disposition));
}
//# sourceMappingURL=content-disposition.js.map