import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ListingStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { seedFinancePartners } from '../../prisma/seed-finance-partners';
import { seedCheryInventory } from '../../prisma/seed-chery';

/**
 * After deploy, re-seed published inventory when the catalog is empty.
 * Idempotent — no-op when published products already exist.
 */
@Injectable()
export class InventoryBootstrapService implements OnModuleInit {
  private readonly logger = new Logger(InventoryBootstrapService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    const raw = this.config.get<string>('SEED_INVENTORY_ON_STARTUP')?.trim().toLowerCase();
    if (raw === 'false' || raw === '0') return;

    const published = await this.prisma.product.count({
      where: { listingStatus: ListingStatus.published },
    });
    if (published > 0) return;

    this.logger.warn('No published inventory found — running Chery seed');
    await seedFinancePartners(this.prisma);
    const result = await seedCheryInventory(this.prisma);
    this.logger.log(
      `Inventory bootstrap complete: ${result.listingsPublished} listings for ${result.companyName}`,
    );
  }
}
