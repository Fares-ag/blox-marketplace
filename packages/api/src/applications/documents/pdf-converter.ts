import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { PDFDocument } from 'pdf-lib';
import { writeTempFile } from './docx-template';

const execFileAsync = promisify(execFile);

function sofficeBinary(): string | null {
  const configured = process.env.SOFFICE_PATH?.trim();
  if (configured) return configured;
  const candidates =
    process.platform === 'win32'
      ? [
          'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
          'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe',
        ]
      : ['soffice', 'libreoffice'];
  for (const candidate of candidates) {
    if (candidate === 'soffice' || candidate === 'libreoffice') return candidate;
    if (fs.existsSync(candidate)) return candidate;
  }
  return process.platform === 'win32' ? null : 'soffice';
}

export async function embedPdfFingerprint(
  pdf: Buffer,
  contentSha256: string,
  applicationId: string,
): Promise<Buffer> {
  const doc = await PDFDocument.load(pdf, { ignoreEncryption: true });
  doc.setSubject(contentSha256);
  doc.setKeywords([applicationId, contentSha256]);
  return Buffer.from(await doc.save());
}

export async function docxToPdf(docx: Buffer): Promise<Buffer> {
  const binary = sofficeBinary();
  if (!binary) {
    throw new Error('libreoffice_unavailable');
  }
  const input = writeTempFile('blox-docx-', docx, '.docx');
  const dir = path.dirname(input);
  try {
    await execFileAsync(
      binary,
      ['--headless', '--nologo', '--nolockcheck', '--convert-to', 'pdf', '--outdir', dir, input],
      { timeout: 60_000, windowsHide: true },
    );
    const output = path.join(dir, `${path.basename(input, '.docx')}.pdf`);
    if (!fs.existsSync(output)) {
      throw new Error('libreoffice_convert_failed');
    }
    return fs.readFileSync(output);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

export function isLibreOfficeError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes('libreoffice') ||
    message.includes('ENOENT') ||
    message.includes('soffice')
  );
}

export function tmpDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}
