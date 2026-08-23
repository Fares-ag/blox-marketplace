import slugify from 'slugify';
import { ListingStatus, VehicleCondition } from '@prisma/client';
import { logError, lookupId, mapId } from './id-map.js';
import { newId } from './01-users.js';
import type { MigrateCtx } from './migrate.js';

export async function migrateProducts(ctx: MigrateCtx) {
  const { prisma, defaultCompanyId } = ctx;
  const companyId =
    defaultCompanyId ||
    (await prisma.company.findFirst({ where: { status: 'active' } }))?.id;
  if (!companyId) throw new Error('MIGRATION_DEFAULT_COMPANY_ID or an active company is required');

  const defaultOffer = await prisma.offer.findFirst({ where: { status: 'active' } });
  if (!defaultOffer) throw new Error('An active offer is required before migrating products');

  const products = await ctx.fetchTable('products');
  for (const p of products) {
    const sourceId = `${p.id}`;
    try {
      if (await lookupId(prisma, 'product', sourceId)) continue;
      const id = newId();
      const make = `${p.make ?? 'Unknown'}`;
      const model = `${p.model ?? 'Model'}`;
      const year = Number(p.model_year ?? p.year ?? new Date().getFullYear());
      const slug = slugify(`${make}-${model}-${year}-${sourceId.slice(0, 8)}`, { lower: true, strict: true });
      const condition = `${p.condition}` === 'new' ? VehicleCondition.new : VehicleCondition.used;
      const listingStatus =
        `${p.status}` === 'inactive' ? ListingStatus.archived : ListingStatus.published;

      await prisma.product.create({
        data: {
          id,
          companyId,
          slug,
          make,
          model,
          trim: p.trim ? `${p.trim}` : null,
          modelYear: year,
          condition,
          engine: p.engine ? `${p.engine}` : null,
          color: p.color ? `${p.color}` : null,
          mileage: p.mileage != null ? Number(p.mileage) : null,
          chassisNumber: p.chassis_number ? `${p.chassis_number}` : null,
          description: p.description ? `${p.description}` : null,
          price: Number(p.price ?? 0),
          financeEligible: true,
          defaultOfferId: defaultOffer.id,
          listingStatus,
          publishedAt: listingStatus === ListingStatus.published ? new Date() : null,
        },
      });
      await mapId(prisma, 'product', sourceId, id);
    } catch (err) {
      await logError(prisma, 'product', sourceId, String(err), p);
    }
  }
}
