import type { PrismaClient } from '@prisma/client';

export async function mapId(
  prisma: PrismaClient,
  entity: string,
  sourceId: string,
  targetId: string,
): Promise<string> {
  const existing = await prisma.migrationIdMap.findUnique({
    where: { entity_sourceId: { entity, sourceId } },
  });
  if (existing) return existing.targetId;
  await prisma.migrationIdMap.create({ data: { entity, sourceId, targetId } });
  return targetId;
}

export async function lookupId(
  prisma: PrismaClient,
  entity: string,
  sourceId: string,
): Promise<string | null> {
  const row = await prisma.migrationIdMap.findUnique({
    where: { entity_sourceId: { entity, sourceId } },
  });
  return row?.targetId ?? null;
}

export async function logError(
  prisma: PrismaClient,
  entity: string,
  sourceId: string | null,
  message: string,
  payload?: unknown,
) {
  await prisma.migrationError.create({
    data: {
      entity,
      sourceId: sourceId ?? undefined,
      message: message.slice(0, 2000),
      payload: payload as object | undefined,
    },
  });
}
