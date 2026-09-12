import type { VehicleCategory } from '@drivemarket/shared';

export type ListingEligibilityInput = {
  slug: string;
  price: number;
  condition: string;
  model_year: number;
  category?: VehicleCategory;
  title?: string;
  tenure?: number;
  downPct?: number;
  rate?: number;
};

/** Build `/eligibility` with listing context so vehicle fields are prefilled and locked. */
export function buildListingEligibilityHref(input: ListingEligibilityInput): string {
  const params = new URLSearchParams();
  params.set('product', input.slug);
  params.set('price', String(input.price));
  params.set('condition', input.condition === 'used' ? 'used' : 'new');
  params.set('year', String(input.model_year));
  if (input.category) params.set('category', input.category);
  if (input.title) params.set('title', input.title);
  if (input.tenure != null && input.tenure > 0) params.set('tenure', String(input.tenure));
  if (input.downPct != null && input.downPct >= 0) params.set('downPct', String(input.downPct));
  if (input.rate != null && input.rate > 0) params.set('rate', String(input.rate));
  return `/eligibility?${params.toString()}`;
}
