import { PrismaClient, UserRole } from '@prisma/client';
import { hashPassword } from 'better-auth/crypto';

const prisma = new PrismaClient();
const PASSWORD = 'Password123!';

async function upsertUser(opts: {
  email: string;
  name: string;
  role: UserRole;
  companyId?: string;
  creditScope?: 'all' | 'assigned';
  financeScope?: 'all' | 'assigned';
}) {
  const password = await hashPassword(PASSWORD);
  const existing = await prisma.user.findUnique({ where: { email: opts.email } });
  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        role: opts.role,
        companyId: opts.companyId ?? null,
        creditScope: opts.creditScope ?? 'assigned',
        financeScope: opts.financeScope ?? 'assigned',
        emailVerified: true,
        name: opts.name,
      },
    });
    await prisma.account.deleteMany({ where: { userId: existing.id, providerId: 'credential' } });
    await prisma.account.create({
      data: {
        userId: existing.id,
        accountId: existing.id,
        providerId: 'credential',
        password,
      },
    });
    return existing.id;
  }

  const user = await prisma.user.create({
    data: {
      email: opts.email,
      name: opts.name,
      emailVerified: true,
      role: opts.role,
      companyId: opts.companyId,
      creditScope: opts.creditScope ?? 'assigned',
      financeScope: opts.financeScope ?? 'assigned',
    },
  });
  await prisma.account.create({
    data: {
      userId: user.id,
      accountId: user.id,
      providerId: 'credential',
      password,
    },
  });
  return user.id;
}

async function main() {
  const company = await prisma.company.upsert({
    where: { code: 'GULF' },
    update: {
      name: 'Gulf Motors Demo',
      status: 'active',
      contactPhone: '+974 4444 1000',
    },
    create: {
      name: 'Gulf Motors Demo',
      code: 'GULF',
      status: 'active',
      contactEmail: 'dealer@drivemarket.local',
      contactPhone: '+974 4444 1000',
      canPay: false,
    },
  });

  await prisma.offer.upsert({
    where: { id: 'seed-default-offer' },
    update: {},
    create: {
      id: 'seed-default-offer',
      name: 'Standard DriveMarket Finance',
      annualRentRate: 12.5,
      tenureOptions: [12, 24, 36, 48, 60],
      isDefault: true,
      status: 'active',
      minDownPaymentPct: 10,
    },
  });

  await upsertUser({
    email: 'customer@drivemarket.local',
    name: 'Demo Customer',
    role: UserRole.customer,
  });
  await upsertUser({
    email: 'dealer@drivemarket.local',
    name: 'Demo Dealer',
    role: UserRole.dealer_agent,
    companyId: company.id,
  });
  await upsertUser({
    email: 'credit@drivemarket.local',
    name: 'Demo Credit',
    role: UserRole.credit_officer,
    creditScope: 'all',
  });
  await upsertUser({
    email: 'finance@drivemarket.local',
    name: 'Demo Finance',
    role: UserRole.finance_officer,
    financeScope: 'all',
  });
  await upsertUser({
    email: 'admin@drivemarket.local',
    name: 'Demo Admin',
    role: UserRole.admin,
    creditScope: 'all',
    financeScope: 'all',
  });
  await upsertUser({
    email: 'super@drivemarket.local',
    name: 'Demo Super',
    role: UserRole.super_admin,
    creditScope: 'all',
    financeScope: 'all',
  });

  const vehicles = [
    {
      slug: 'toyota-land-cruiser-vx-2024-pearl-white-automatic-suv-seed0001',
      make: 'Toyota',
      model: 'Land Cruiser',
      trim: 'VX',
      modelYear: 2024,
      condition: 'new' as const,
      engine: '3.5L Twin-Turbo V6',
      transmission: 'automatic' as const,
      cylinders: 6,
      drivetrain: 'four_wd' as const,
      bodyType: 'suv' as const,
      color: 'Pearl White',
      mileage: 1200,
      warrantyMonths: 36,
      warrantyNotes: 'Gulf Motors warranty',
      description: 'Flagship Toyota SUV with full Gulf Motors warranty.',
      price: 385000,
    },
    {
      slug: 'nissan-patrol-platinum-2023-black-automatic-suv-seed0002',
      make: 'Nissan',
      model: 'Patrol',
      trim: 'Platinum',
      modelYear: 2023,
      condition: 'used' as const,
      engine: '5.6L V8',
      transmission: 'automatic' as const,
      cylinders: 8,
      drivetrain: 'four_wd' as const,
      bodyType: 'suv' as const,
      color: 'Black',
      mileage: 18500,
      warrantyMonths: 12,
      warrantyNotes: 'Dealer warranty',
      description: 'Low-mileage Patrol, dealer-serviced, finance-ready.',
      price: 295000,
    },
    {
      slug: 'lexus-es-350-f-sport-2022-sonic-titanium-automatic-sedan-seed0003',
      make: 'Lexus',
      model: 'ES 350',
      trim: 'F Sport',
      modelYear: 2022,
      condition: 'used' as const,
      engine: '3.5L V6',
      transmission: 'automatic' as const,
      cylinders: 6,
      drivetrain: 'fwd' as const,
      bodyType: 'sedan' as const,
      color: 'Sonic Titanium',
      mileage: 32000,
      warrantyMonths: null,
      warrantyNotes: null,
      description: 'Executive sedan with premium interior package.',
      price: 168000,
    },
    {
      slug: 'hyundai-tucson-limited-2024-amazon-grey-automatic-suv-seed0004',
      make: 'Hyundai',
      model: 'Tucson',
      trim: 'Limited',
      modelYear: 2024,
      condition: 'new' as const,
      engine: '1.6L Turbo',
      transmission: 'automatic' as const,
      cylinders: 4,
      drivetrain: 'awd' as const,
      bodyType: 'suv' as const,
      color: 'Amazon Grey',
      mileage: 450,
      warrantyMonths: 60,
      warrantyNotes: 'Manufacturer warranty',
      description: 'Compact crossover, ideal entry finance listing.',
      price: 119500,
    },
  ];

  const demoImageSets: string[][] = [
    [
      'https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?auto=format&fit=crop&w=1600&q=70',
      'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=1600&q=70',
      'https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?auto=format&fit=crop&w=1600&q=70',
      'https://images.unsplash.com/photo-1494976388531-d1058494cdd8?auto=format&fit=crop&w=1600&q=70',
    ],
    [
      'https://images.unsplash.com/photo-1605559424843-9e4c228bf1c2?auto=format&fit=crop&w=1600&q=70',
      'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?auto=format&fit=crop&w=1600&q=70',
      'https://images.unsplash.com/photo-1553440569-bcc63803a379?auto=format&fit=crop&w=1600&q=70',
      'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1600&q=70',
    ],
    [
      'https://images.unsplash.com/photo-1617814076367-b759c7d7e738?auto=format&fit=crop&w=1600&q=70',
      'https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?auto=format&fit=crop&w=1600&q=70',
      'https://images.unsplash.com/photo-1606016159991-dfe4f2746ad5?auto=format&fit=crop&w=1600&q=70',
      'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=1600&q=70',
    ],
    [
      'https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?auto=format&fit=crop&w=1600&q=70',
      'https://images.unsplash.com/photo-1542362567-b07e54358753?auto=format&fit=crop&w=1600&q=70',
      'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=1600&q=70',
      'https://images.unsplash.com/photo-1583121274602-3e2820c69888?auto=format&fit=crop&w=1600&q=70',
    ],
  ];

  let vehicleIndex = 0;
  for (const v of vehicles) {
    const product = await prisma.product.upsert({
      where: { slug: v.slug },
      update: {
        listingStatus: 'published',
        publishedAt: new Date(),
        defaultOfferId: 'seed-default-offer',
        financeEligible: true,
        price: v.price,
        description: v.description,
        transmission: v.transmission,
        cylinders: v.cylinders,
        drivetrain: v.drivetrain,
        bodyType: v.bodyType,
        warrantyMonths: v.warrantyMonths,
        warrantyNotes: v.warrantyNotes,
      },
      create: {
        companyId: company.id,
        slug: v.slug,
        make: v.make,
        model: v.model,
        trim: v.trim,
        modelYear: v.modelYear,
        condition: v.condition,
        engine: v.engine,
        transmission: v.transmission,
        cylinders: v.cylinders,
        drivetrain: v.drivetrain,
        bodyType: v.bodyType,
        color: v.color,
        mileage: v.mileage,
        warrantyMonths: v.warrantyMonths,
        warrantyNotes: v.warrantyNotes,
        description: v.description,
        price: v.price,
        financeEligible: true,
        defaultOfferId: 'seed-default-offer',
        listingStatus: 'published',
        publishedAt: new Date(),
      },
    });

    const urls = demoImageSets[vehicleIndex % demoImageSets.length];
    await prisma.productImage.deleteMany({ where: { productId: product.id } });
    await prisma.productImage.createMany({
      data: urls.map((storagePath, sortOrder) => ({
        productId: product.id,
        storagePath,
        sortOrder,
        altText: `${v.make} ${v.model} photo ${sortOrder + 1}`,
      })),
    });
    vehicleIndex += 1;
  }

  // eslint-disable-next-line no-console
  console.log('Seed complete. Password for all users:', PASSWORD);
  // eslint-disable-next-line no-console
  console.log(`Published demo vehicles: ${vehicles.length}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
