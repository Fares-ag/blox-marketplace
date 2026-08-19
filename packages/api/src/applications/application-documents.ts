export const REQUIRED_APPLICATION_DOC_CATEGORIES = ['qid', 'salary', 'bank', 'other'] as const;

export type RequiredDocCategory = (typeof REQUIRED_APPLICATION_DOC_CATEGORIES)[number];

export function missingRequiredDocumentCategories(
  documents: Array<{ category: string }>,
): RequiredDocCategory[] {
  const present = new Set(documents.map((d) => d.category));
  return REQUIRED_APPLICATION_DOC_CATEGORIES.filter((c) => !present.has(c));
}

export function hasAllRequiredDocuments(documents: Array<{ category: string }>): boolean {
  return missingRequiredDocumentCategories(documents).length === 0;
}
