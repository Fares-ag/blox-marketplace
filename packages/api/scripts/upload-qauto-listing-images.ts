import { PrismaClient } from '@prisma/client';
import { uploadQautoListingImages } from '../prisma/upload-qauto-listing-images';

const prisma = new PrismaClient();

async function main() {
  const result = await uploadQautoListingImages(prisma);
  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
