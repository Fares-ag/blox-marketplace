import { describe, expect, it } from 'vitest';
import { collapseSplitPlaceholdersInXml } from './docx-normalize';

describe('docx-normalize', () => {
  it('joins split merge tags inside a paragraph', () => {
    const xml = `<w:p><w:r><w:t>{{Customer.</w:t></w:r><w:r><w:t>FullNameEN}}</w:t></w:r></w:p>`;
    const out = collapseSplitPlaceholdersInXml(xml);
    expect(out).toContain('{{Customer.FullNameEN}}');
    expect(out).not.toMatch(/\{\{Customer\.<\/w:t>/);
  });
});
