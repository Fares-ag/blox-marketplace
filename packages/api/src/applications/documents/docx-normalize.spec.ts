import { describe, expect, it } from 'vitest';
import PizZip from 'pizzip';
import { collapseSplitPlaceholdersInXml, repairZipPaths } from './docx-normalize';
import { fillTemplate, readTemplate } from './docx-template';

describe('docx-normalize', () => {
  it('joins split merge tags inside a paragraph', () => {
    const xml = `<w:p><w:r><w:t>{{Customer.</w:t></w:r><w:r><w:t>FullNameEN}}</w:t></w:r></w:p>`;
    const out = collapseSplitPlaceholdersInXml(xml);
    expect(out).toContain('{{Customer.FullNameEN}}');
    expect(out).not.toMatch(/\{\{Customer\.<\/w:t>/);
  });

  it('rewrites backslash zip entry names to forward slashes', () => {
    const zip = new PizZip();
    // Simulate the corrupted templates: entries stored with backslash names.
    zip.file('word\\document.xml', '<w:document/>');
    zip.file('word\\media\\logo.png', Buffer.from([1, 2, 3]), { binary: true });
    const repaired = repairZipPaths(zip.generate({ type: 'nodebuffer' }) as Buffer);
    const out = new PizZip(repaired);
    const keys = Object.keys(out.files);
    expect(keys).toContain('word/document.xml');
    expect(keys).toContain('word/media/logo.png');
    expect(keys.some((k) => k.includes('\\'))).toBe(false);
  });
});

describe('fillTemplate', () => {
  it('resolves dotted field names in the real Ijarah template from a flat map', () => {
    // Regression guard: the default docxtemplater parser treats dotted names as
    // nested lookups and leaves every field blank. The flat-key parser must
    // populate them from a flat `{ 'Deal.Ref': ... }` map.
    const docx = readTemplate('BLX-TPL-011_Ijarah_Agreement.docx', { branded: false });
    const filled = fillTemplate(docx, {
      'Deal.Ref': 'APP-REGRESSION-123',
      'Customer.FullNameEN': 'REGRESSION CUSTOMER',
    });
    const zip = new PizZip(filled);
    const key = Object.keys(zip.files).find((k) => k.replace(/\\/g, '/').endsWith('word/document.xml'))!;
    const xml = zip.file(key)!.asText();
    expect(xml).toContain('APP-REGRESSION-123');
    expect(xml).toContain('REGRESSION CUSTOMER');
    expect(xml).not.toContain('{{');
  });
});
