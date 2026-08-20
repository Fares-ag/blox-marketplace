/** RFC 5987-safe Content-Disposition for user-controlled filenames. */
export function buildContentDisposition(
  filename: string,
  type: 'attachment' | 'inline' = 'attachment',
): string {
  const sanitized =
    filename
      .replace(/[\r\n"]/g, '')
      .replace(/[^\w.\-()+\s]/g, '_')
      .trim()
      .slice(0, 200) || 'download';
  const encoded = encodeURIComponent(sanitized);
  return `${type}; filename="${sanitized}"; filename*=UTF-8''${encoded}`;
}

export function setFileDownloadHeaders(
  res: { setHeader: (name: string, value: string) => void },
  contentType: string,
  filename: string,
  disposition: 'attachment' | 'inline' = 'attachment',
): void {
  res.setHeader('Content-Type', contentType);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Disposition', buildContentDisposition(filename, disposition));
}
