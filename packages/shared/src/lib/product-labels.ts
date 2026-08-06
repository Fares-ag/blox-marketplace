import type { BodyType, Drivetrain, Transmission, VehicleCondition } from '../types/domain';

export function labelTransmission(value: Transmission | null | undefined, t: (k: string) => string): string {
  if (!value) return '';
  return value === 'automatic' ? t('facets.automatic') : t('facets.manual');
}

export function labelDrivetrain(value: Drivetrain | null | undefined, t: (k: string) => string): string {
  if (!value) return '';
  const map: Record<Drivetrain, string> = {
    fwd: t('facets.fwd'),
    rwd: t('facets.rwd'),
    awd: t('facets.awd'),
    four_wd: t('facets.fourWd'),
  };
  return map[value];
}

export function labelBodyType(value: BodyType | null | undefined, t: (k: string) => string): string {
  if (!value) return '';
  const map: Record<BodyType, string> = {
    sedan: t('facets.sedan'),
    suv: t('facets.suv'),
    coupe: t('facets.coupe'),
    hatchback: t('facets.hatchback'),
    pickup: t('facets.pickup'),
    van: t('facets.van'),
    other: t('facets.other'),
  };
  return map[value];
}

export function labelCondition(value: VehicleCondition, t: (k: string) => string): string {
  return value === 'new' ? t('facets.new') : t('facets.used');
}

export function formatCardFacets(
  p: {
    model_year: number;
    transmission?: Transmission | null;
    cylinders?: number | null;
    mileage?: number | null;
  },
  t: (k: string, opts?: Record<string, unknown>) => string,
): string {
  const parts: string[] = [String(p.model_year)];
  const gear = labelTransmission(p.transmission, t);
  if (gear) parts.push(gear);
  if (p.cylinders) parts.push(`${p.cylinders} cyl`);
  if (p.mileage != null) parts.push(`${p.mileage.toLocaleString()} ${t('facets.km')}`);
  return parts.join(' · ');
}

export function hasWarranty(warrantyMonths: number | null | undefined): boolean {
  return (warrantyMonths ?? 0) > 0;
}
