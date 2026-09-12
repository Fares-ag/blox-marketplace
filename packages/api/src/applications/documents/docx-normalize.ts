import PizZip from 'pizzip';

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function normalizeZipPath(entry: string): string {
  return entry.replace(/\\/g, '/');
}

/**
 * Some template files were previously written with backslash zip entry names
 * (e.g. `word\media\blox-logo-nav.png`). OOXML requires forward slashes, and
 * Word/LibreOffice silently drop entries at backslash paths — which is why the
 * embedded logo and headers never rendered. Rebuild the archive with clean
 * forward-slash keys. No-op when the archive is already valid.
 */
export function repairZipPaths(docx: Buffer): Buffer {
  const zip = new PizZip(docx);
  const keys = zipEntryKeys(zip);
  if (!keys.some((key) => key.includes('\\'))) {
    return docx;
  }
  const out = new PizZip();
  for (const key of keys) {
    const entry = zip.files[key];
    if (!entry || entry.dir) continue;
    out.file(normalizeZipPath(key), entry.asUint8Array(), { binary: true });
  }
  return out.generate({ type: 'nodebuffer' }) as Buffer;
}

function zipEntryKeys(zip: PizZip): string[] {
  return Object.keys(zip.files);
}

function findZipEntry(zip: PizZip, suffix: string): string | undefined {
  const normalized = suffix.replace(/\\/g, '/');
  return zipEntryKeys(zip).find((key) => normalizeZipPath(key).endsWith(normalized));
}

/** Word often splits `{{Deal.Ref}}` across multiple `<w:t>` runs — docxtemplater then skips them. */
export function collapseSplitPlaceholdersInXml(xml: string): string {
  return xml.replace(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/g, (paragraph) => {
    const texts = [...paragraph.matchAll(/<w:t(?:\s+xml:space="preserve")?>([^<]*)<\/w:t>/g)].map(
      (match) => match[1],
    );
    const joined = texts.join('');
    if (!joined.includes('{{') || !joined.includes('}}')) {
      return paragraph;
    }
    if (!/\{\{[^}]+\}\}/.test(joined)) {
      return paragraph;
    }
    const open = paragraph.match(/^<w:p\b[^>]*>/)?.[0] ?? '<w:p>';
    const pPr = paragraph.match(/<w:pPr>[\s\S]*?<\/w:pPr>/)?.[0] ?? '';
    return `${open}${pPr}<w:r><w:t xml:space="preserve">${escapeXml(joined)}</w:t></w:r></w:p>`;
  });
}

const XML_PARTS = [
  'word/document.xml',
  /^word\/header\d+\.xml$/,
  /^word\/footer\d+\.xml$/,
];

export function normalizeDocxMergeTags(docx: Buffer): Buffer {
  const zip = new PizZip(docx);
  for (const key of zipEntryKeys(zip)) {
    const path = normalizeZipPath(key);
    const isPart =
      path.endsWith('word/document.xml') ||
      /^word\/header\d+\.xml$/.test(path) ||
      /^word\/footer\d+\.xml$/.test(path);
    if (!isPart) continue;
    const file = zip.file(key);
    if (!file) continue;
    zip.file(key, collapseSplitPlaceholdersInXml(file.asText()));
  }
  return zip.generate({ type: 'nodebuffer' }) as Buffer;
}

export function assertDocxFilled(docx: Buffer, required: string[]): void {
  const zip = new PizZip(docx);
  const key = findZipEntry(zip, 'word/document.xml');
  const xml = key ? zip.file(key)?.asText() ?? '' : '';
  for (const snippet of required) {
    if (!xml.includes(snippet)) {
      throw new Error(`template_unfilled:${snippet}`);
    }
  }
  if (/\{\{[^}]+\}\}/.test(xml)) {
    throw new Error('template_unmerged_tags');
  }
}
