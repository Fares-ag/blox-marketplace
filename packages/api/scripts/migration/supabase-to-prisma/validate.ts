import type { MigrateCtx } from './migrate.js';

export async function validateMigration(ctx: MigrateCtx) {
  const { prisma } = ctx;
  const mappedUsers = await prisma.migrationIdMap.count({ where: { entity: 'user' } });
  const mappedApps = await prisma.migrationIdMap.count({ where: { entity: 'application' } });
  const errors = await prisma.migrationError.count();
  const users = await prisma.user.count();
  const apps = await prisma.application.count();
  const report = { mappedUsers, mappedApps, users, apps, errors };
  console.log(JSON.stringify(report, null, 2));
  if (errors > 0) {
    console.warn(`Migration completed with ${errors} logged errors — inspect migration_errors`);
  }
}
