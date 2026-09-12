import { Prisma } from '@prisma/client';

export function isUniqueConstraintError(err: unknown): boolean {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002'
  );
}

export function isForeignKeyConstraintError(err: unknown): boolean {
  let current: unknown = err;
  for (let i = 0; i < 5 && current; i += 1) {
    if (
      current instanceof Prisma.PrismaClientKnownRequestError &&
      (current.code === 'P2003' || current.code === 'P2014')
    ) {
      return true;
    }
    current = typeof current === 'object' && current && 'cause' in current
      ? (current as { cause?: unknown }).cause
      : undefined;
  }
  return false;
}
