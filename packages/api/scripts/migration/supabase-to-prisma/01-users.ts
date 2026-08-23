import { randomBytes } from 'node:crypto';
import { UserRole } from '@prisma/client';
import { logError, lookupId, mapId } from './id-map.js';
import type { MigrateCtx } from './migrate.js';

export function newId(): string {
  return `c${randomBytes(12).toString('hex')}`;
}

function splitName(name: string): string {
  return name.trim() || 'Customer';
}

export async function migrateUsers(ctx: MigrateCtx, supabaseUrl: string, serviceKey: string) {
  const { prisma } = ctx;
  const res = await fetch(`${supabaseUrl}/auth/v1/admin/users?per_page=1000`, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
  });
  if (!res.ok) throw new Error(`auth.users HTTP ${res.status}`);
  const body = (await res.json()) as { users?: Array<Record<string, unknown>> };
  const authUsers = body.users ?? [];
  const publicUsers = await ctx.fetchTable('users');
  const roleByEmail = new Map(
    publicUsers.map((u) => [`${u.email ?? ''}`.toLowerCase(), `${u.role ?? 'customer'}`]),
  );

  for (const u of authUsers) {
    const email = `${u.email ?? ''}`.trim().toLowerCase();
    if (!email) continue;
    try {
      const existingMap = await lookupId(prisma, 'user', `${u.id}`);
      if (existingMap) continue;
      const meta = (u.user_metadata ?? u.raw_user_meta_data ?? {}) as Record<string, unknown>;
      const name = splitName(
        `${meta.first_name ?? meta.firstName ?? ''} ${meta.last_name ?? meta.lastName ?? ''}`.trim() ||
          `${meta.full_name ?? email}`,
      );
      const roleRaw = roleByEmail.get(email) ?? 'customer';
      const role = (Object.values(UserRole) as string[]).includes(roleRaw)
        ? (roleRaw as UserRole)
        : UserRole.customer;

      const created = await prisma.user.upsert({
        where: { email },
        update: {
          name,
          phone: `${meta.phone ?? ''}` || undefined,
          qid: `${meta.qid ?? meta.nationalId ?? ''}` || undefined,
          emailVerified: Boolean(u.email_confirmed_at),
        },
        create: {
          id: newId(),
          email,
          name,
          emailVerified: Boolean(u.email_confirmed_at),
          role,
          phone: `${meta.phone ?? ''}` || null,
          qid: `${meta.qid ?? meta.nationalId ?? ''}` || null,
        },
      });
      await mapId(prisma, 'user', `${u.id}`, created.id);
    } catch (err) {
      await logError(prisma, 'user', `${u.id}`, String(err), { email });
    }
  }
}
