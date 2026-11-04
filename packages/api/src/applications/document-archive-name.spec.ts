import { describe, expect, it } from 'vitest';
import { documentArchiveFilename } from './document-archive-name';

describe('documentArchiveFilename', () => {
  it('includes the BLOX reference and the applicant name', () => {
    expect(
      documentArchiveFilename({
        referenceSeq: 42,
        applicationId: 'cm123',
        applicantName: 'Ahmad Hassan',
      }),
    ).toBe('BLOX-0042-Ahmad-Hassan-documents.zip');
  });

  it('drops characters that are unsafe in a download name', () => {
    expect(
      documentArchiveFilename({
        referenceSeq: 7,
        applicationId: 'cm123',
        applicantName: 'Ahmad/Hassan?',
      }),
    ).toBe('BLOX-0007-Ahmad_Hassan-documents.zip');
  });

  it('falls back to the reference when the name is empty', () => {
    expect(documentArchiveFilename({ referenceSeq: 1, applicationId: 'cm123', applicantName: '   ' })).toBe(
      'BLOX-0001-documents.zip',
    );
  });

  it('uses a short id when there is no reference sequence', () => {
    expect(documentArchiveFilename({ referenceSeq: null, applicationId: 'abcdefghij', applicantName: null })).toBe(
      'abcdefgh-documents.zip',
    );
  });
});