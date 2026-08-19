import { MarketplaceTopNav } from '@drivemarket/shared';
import { useCompareStore } from '../lib/compare-store';

export function MarketplaceNav({ variant = 'overlay' }: { variant?: 'overlay' | 'solid' }) {
  const { count } = useCompareStore();
  return <MarketplaceTopNav compareCount={count} variant={variant} />;
}
