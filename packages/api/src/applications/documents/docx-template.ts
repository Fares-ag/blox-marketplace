import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { applyBranding } from './apply-docx-branding';
import { assertDocxFilled, normalizeDocxMergeTags } from './docx-normalize';
import type { ContractDocumentAudience } from './template-catalog';

export type TemplateData = Record<string, unknown>;

/** Turns `Deal.Ref` into `{ Deal: { Ref } }` so `{{Deal.Ref}}` resolves. */
export function nestDottedFields(flat: Record<string, string>): TemplateData {
  const root: TemplateData = {};
  for (const [key, value] of Object.entries(flat)) {
    const parts = key.split('.');
    let cursor: TemplateData = root;
    for (let i = 0; i < parts.length - 1; i += 1) {
      const part = parts[i];
      const next = cursor[part];
      if (!next || typeof next !== 'object' || Array.isArray(next)) {
        cursor[part] = {};
      }
      cursor = cursor[part] as TemplateData;
    }
    cursor[parts[parts.length - 1]] = value;
  }
  return root;
}

function normalizeZipPath(entry: string): string {
  return entry.replace(/\\/g, '/');
}

function findZipEntry(zip: PizZip, suffix: string): string | undefined {
  const normalized = suffix.replace(/\\/g, '/');
  return Object.keys(zip.files).find((key) => normalizeZipPath(key).endsWith(normalized));
}

export function resolveTemplatesDir(): string {
  const candidates = [
    path.join(__dirname, 'templates'),
    path.join(process.cwd(), 'src', 'applications', 'documents', 'templates'),
    path.join(process.cwd(), 'assets', 'contract-templates'),
    path.join(process.cwd(), 'packages', 'api', 'src', 'applications', 'documents', 'templates'),
    path.join(process.cwd(), 'packages', 'api', 'assets', 'contract-templates'),
  ];
  return candidates.find((dir) => fs.existsSync(dir)) ?? candidates[0];
}

export function readTemplate(
  templateFile: string,
  options?: { audience?: ContractDocumentAudience; branded?: boolean },
): Buffer {
  const full = path.join(resolveTemplatesDir(), templateFile);
  if (!fs.existsSync(full)) {
    throw new Error(`contract_template_missing:${templateFile}`);
  }
  let buffer = fs.readFileSync(full);
  if (options?.branded !== false) {
    buffer = applyBranding(buffer, { templateFile, audience: options?.audience });
  }
  return normalizeDocxMergeTags(buffer);
}

/**
 * Duplicate the `Sch.1.*` table row once per installment and drop `Sch.n.*`
 * so the ownership schedule can list every period.
 */
export function expandScheduleRows(docx: Buffer, periodCount: number): Buffer {
  if (periodCount < 1) return docx;
  const zip = new PizZip(docx);
  const xmlKey = findZipEntry(zip, 'word/document.xml');
  if (!xmlKey) return docx;
  let xml = zip.file(xmlKey)!.asText();
  const rows = [...xml.matchAll(/<w:tr\b[\s\S]*?<\/w:tr>/g)];
  const first = rows.find((row) => row[0].includes('Sch.1.'));
  if (!first) return docx;
  const last = rows.find((row) => row[0].includes('Sch.n.'));
  const clones = Array.from({ length: periodCount }, (_, index) =>
    first[0].replaceAll('Sch.1.', `Sch.${index + 1}.`),
  );
  if (last && last.index !== first.index) {
    xml = xml.replace(last[0], '');
  }
  xml = xml.replace(first[0], clones.join(''));
  zip.file(xmlKey, xml);
  return normalizeDocxMergeTags(zip.generate({ type: 'nodebuffer' }) as Buffer);
}

export function fillTemplate(docx: Buffer, data: TemplateData): Buffer {
  const normalized = normalizeDocxMergeTags(docx);
  const zip = new PizZip(normalized);
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    delimiters: { start: '{{', end: '}}' },
    nullGetter: () => '',
  });
  doc.render(data);
  return doc.getZip().generate({ type: 'nodebuffer' }) as Buffer;
}

export function fillAndValidateTemplate(
  docx: Buffer,
  data: TemplateData,
  requiredSnippets: string[],
): Buffer {
  const filled = fillTemplate(docx, data);
  assertDocxFilled(filled, requiredSnippets);
  return filled;
}

export function writeTempFile(prefix: string, buffer: Buffer, ext: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  const file = path.join(dir, `doc${ext}`);
  fs.writeFileSync(file, buffer);
  return file;
}
