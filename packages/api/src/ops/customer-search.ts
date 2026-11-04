import { UserRole } from '@prisma/client';
import { readCustomerSnapshot } from '../applications/customer-snapshot';
import { splitDisplayName } from '../customers/customer-profile';
import type { PrismaService } from '../prisma/prisma.service';

export type CustomerSearchItem = {
  id: string;
  email: string;
  name: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  qid: string | null;
  gender: string | null;
  date_of_birth: string | null;
  nationality: string | null;
  address: unknown;
  latest_snapshot: unknown;
};

type RegisteredCustomer = {
  id: string;
  email: string;
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  qid: string | null;
  gender: string | null;
  dateOfBirth: Date | null;
  nationality: string | null;
  address: unknown;
};

type WalkInApplication = {
  id: string;
  customerEmail: string;
  customerSnapshot: unknown;
};


function asText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function snapshotBlob(snapshot: ReturnType<typeof readCustomerSnapshot>, email: string): string {
  const corp = snapshot.corporate as { legalName?: string; authorizedSignatory?: { firstName?: string; lastName?: string } } | undefined;
  const signatory = corp?.authorizedSignatory;
  return [
    email,
    snapshot.full_name,
    snapshot.phone,
    snapshot.qid,
    asText(snapshot.firstName),
    asText(snapshot.lastName),
    corp?.legalName,
    signatory?.firstName,
    signatory?.lastName,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

export function snapshotMatchesTerm(email: string, snapshotRaw: unknown, term: string | undefined): boolean {
  const needle = term?.trim().toLowerCase();
  if (!needle) return true;
  const snapshot = readCustomerSnapshot(snapshotRaw);
  return snapshotBlob(snapshot, email).includes(needle);
}

export function walkInSearchItem(app: WalkInApplication): CustomerSearchItem {
  const snapshot = readCustomerSnapshot(app.customerSnapshot);
  const derived = splitDisplayName(snapshot.full_name);
  const first = asText(snapshot.firstName) || derived.firstName;
  const last = asText(snapshot.lastName) || derived.lastName;
  const name = snapshot.full_name.trim() || [first, last].filter(Boolean).join(' ') || null;
  const dob = asText(snapshot.dateOfBirth);
  return {
    id: `app:${app.id}`,
    email: app.customerEmail,
    name,
    first_name: first || null,
    last_name: last || null,
    phone: snapshot.phone.trim() || null,
    qid: snapshot.qid.trim() || null,
    gender: asText(snapshot.gender) || null,
    date_of_birth: dob || null,
    nationality: asText(snapshot.nationality) || null,
    address: snapshot.address ?? null,
    latest_snapshot: app.customerSnapshot ?? null,
  };
}

/**
 * Registered customers who already have an application in scope, plus walk-in
 * applicants stored only on the application (no marketplace account yet).
 */
export async function searchScopedCustomers(
  prisma: PrismaService,
  input: { companyIds: string[] | null; term?: string; limit: number },
): Promise<CustomerSearchItem[]> {
  const { companyIds, limit } = input;
  const term = input.term?.trim();
  const users = (await prisma.user.findMany({
    where: {
      role: UserRole.customer,
      ...(companyIds ? { applications: { some: { companyId: { in: companyIds } } } } : {}),
      ...(term
        ? {
            OR: [
              { email: { contains: term, mode: 'insensitive' } },
              { name: { contains: term, mode: 'insensitive' } },
              { phone: { contains: term, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      email: true,
      name: true,
      firstName: true,
      lastName: true,
      phone: true,
      qid: true,
      gender: true,
      dateOfBirth: true,
      nationality: true,
      address: true,
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })) as RegisteredCustomer[];

  const registered = await Promise.all(
    users.map(async (user) => {
      const latest = await prisma.application.findFirst({
        where: {
          ...(companyIds ? { companyId: { in: companyIds } } : {}),
          OR: [{ customerUserId: user.id }, { customerEmail: { equals: user.email, mode: 'insensitive' } }],
        },
        orderBy: { updatedAt: 'desc' },
        select: { customerSnapshot: true },
      });
      const derived = splitDisplayName(user.name);
      return {
        id: user.id,
        email: user.email,
        name: user.name,
        first_name: user.firstName ?? (derived.firstName || null),
        last_name: user.lastName ?? (derived.lastName || null),
        phone: user.phone,
        qid: user.qid,
        gender: user.gender,
        date_of_birth: user.dateOfBirth ? user.dateOfBirth.toISOString().slice(0, 10) : null,
        nationality: user.nationality,
        address: user.address,
        latest_snapshot: latest?.customerSnapshot ?? null,
      } satisfies CustomerSearchItem;
    }),
  );

  const seen = new Set(registered.map((row) => row.email.trim().toLowerCase()));
  const walkIns = (await prisma.application.findMany({
    where: {
      customerUserId: null,
      ...(companyIds ? { companyId: { in: companyIds } } : {}),
    },
    orderBy: { updatedAt: 'desc' },
    take: Math.max(limit * 8, 80),
    select: { id: true, customerEmail: true, customerSnapshot: true },
  })) as WalkInApplication[];

  const extras: CustomerSearchItem[] = [];
  for (const app of walkIns) {
    const emailKey = app.customerEmail.trim().toLowerCase();
    if (!emailKey || seen.has(emailKey)) continue;
    if (!snapshotMatchesTerm(app.customerEmail, app.customerSnapshot, term)) continue;
    seen.add(emailKey);
    extras.push(walkInSearchItem(app));
    if (registered.length + extras.length >= limit) break;
  }

  return [...registered, ...extras].slice(0, limit);
}
