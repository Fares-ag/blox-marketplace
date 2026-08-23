import { PrismaClient } from '@prisma/client';
import { bootstrapQauto } from '../prisma/bootstrap-qauto';

const prisma = new PrismaClient();

async function main() {
  const result = await bootstrapQauto(prisma);
  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
