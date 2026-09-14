import type { PDFFont } from 'pdf-lib';

function measure(font: PDFFont, text: string, size: number): number {
  const width = font.widthOfTextAtSize(text, size);
  return Number.isFinite(width) && width > 0 ? width : text.length * size * 0.45;
}

function breakLongToken(token: string, maxWidth: number, font: PDFFont, size: number): string[] {
  if (measure(font, token, size) <= maxWidth) return [token];
  const parts: string[] = [];
  let chunk = '';
  for (const ch of token) {
    const test = chunk + ch;
    if (measure(font, test, size) <= maxWidth) {
      chunk = test;
    } else {
      if (chunk) parts.push(chunk);
      chunk = ch;
    }
  }
  if (chunk) parts.push(chunk);
  return parts.length ? parts : [token.slice(0, 1)];
}

/** Break plain text into lines that fit within `maxWidth` at the given font size. */
export function wrapText(text: string, maxWidth: number, font: PDFFont, size: number): string[] {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) return [];
  const lines: string[] = [];
  let current = '';
  for (const word of normalized.split(' ')) {
    const test = current ? `${current} ${word}` : word;
    if (measure(font, test, size) <= maxWidth) {
      current = test;
      continue;
    }
    if (current) lines.push(current);
    const fragments = breakLongToken(word, maxWidth, font, size);
    if (fragments.length === 1) {
      current = fragments[0] ?? '';
    } else {
      lines.push(...fragments.slice(0, -1));
      current = fragments[fragments.length - 1] ?? '';
    }
  }
  if (current) lines.push(current);
  return lines;
}
