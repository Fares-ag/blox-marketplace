import reshaper from 'arabic-reshaper';
import bidiFactory from 'bidi-js';

const bidi = bidiFactory();

// Arabic + Arabic Supplement + Arabic Presentation Forms A/B.
const ARABIC_RE = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;

export function hasArabic(text: string): boolean {
  return ARABIC_RE.test(text);
}

/** Convert Arabic letters to their positional presentation forms (isolated/initial/medial/final). */
export function reshapeArabic(text: string): string {
  try {
    return reshaper.convertArabic(text);
  } catch {
    return text;
  }
}

/**
 * Reorder a single, already-reshaped line into visual (left-to-right on the page)
 * order for an RTL base paragraph, so pdf-lib — which has no text shaping engine —
 * draws the glyphs in the correct sequence. European numbers and Latin runs embedded
 * in the Arabic text are placed correctly by the Unicode bidi algorithm.
 */
export function toVisualOrder(line: string): string {
  try {
    const embeddingLevels = bidi.getEmbeddingLevels(line, 'rtl');
    return bidi.getReorderedString(line, embeddingLevels);
  } catch {
    return line;
  }
}

/** Shape a single-line Arabic label: reshape then reorder to visual order. */
export function shapeArabicLine(text: string): string {
  if (!hasArabic(text)) return text;
  return toVisualOrder(reshapeArabic(text));
}
