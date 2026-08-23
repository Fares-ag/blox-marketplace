import { DocumentCategory } from '@prisma/client';
import { logError, lookupId } from './id-map.js';
import { newId } from './01-users.js';
import type { MigrateCtx } from './migrate.js';

function mapCategory(raw: unknown): DocumentCategory {
  const key = `${raw ?? ''}`.toLowerCase().replace(/_/g, '-');
  if (['id', 'qatar-id', 'national-id', 'qid', 'qid-front', 'qid-back', 'qid_front', 'qid_back'].includes(key)) {
    return DocumentCategory.qid;
  }
  if (key.includes('passport')) return DocumentCategory.passport;
  if (key.includes('bank')) return DocumentCategory.bank;
  if (key.includes('salary')) return DocumentCategory.salary;
  if (key.includes('license')) return DocumentCategory.license;
  return DocumentCategory.other;
}

export async function migrateDocuments(ctx: MigrateCtx) {
  const { prisma } = ctx;
  const apps = await ctx.fetchTable('applications', 'id,documents,customer_email');
  for (const app of apps) {
    const applicationId = await lookupId(prisma, 'application', `${app.id}`);
    if (!applicationId) continue;
    const target = await prisma.application.findUnique({ where: { id: applicationId } });
    if (!target) continue;
    const docs = Array.isArray(app.documents) ? app.documents : [];
    for (const d of docs) {
      if (!d || typeof d !== 'object') continue;
      const row = d as Record<string, unknown>;
      const sourceDocId = `${row.id ?? row.path ?? newId()}`;
      try {
        if (await lookupId(prisma, 'document', sourceDocId)) continue;
        await prisma.applicationDocument.create({
          data: {
            id: newId(),
            applicationId,
            category: mapCategory(row.category ?? row.kycDocumentType),
            storagePath: `${row.path ?? row.url ?? `migrated/${sourceDocId}`}`,
            mimeType: row.type ? `${row.type}` : null,
            uploadedById: target.customerUserId,
            originalName: row.name ? `${row.name}` : null,
            kycDocumentId: row.kycDocumentId ? `${row.kycDocumentId}` : null,
            kycDocumentType: row.kycDocumentType ? `${row.kycDocumentType}` : null,
            verificationStatus: row.status ? `${row.status}` : null,
            quality: typeof row.quality === 'number' ? row.quality : null,
            authenticity: typeof row.authenticity === 'number' ? row.authenticity : null,
            reviewStatus: row.reviewStatus ? `${row.reviewStatus}` : null,
          },
        });
        await prisma.migrationIdMap.create({
          data: { entity: 'document', sourceId: sourceDocId, targetId: sourceDocId },
        });
      } catch (err) {
        await logError(prisma, 'document', sourceDocId, String(err), row);
      }
    }
  }
}
