import { MarketplaceTopNav } from '@drivemarket/shared';
import { useCompareStore } from '../lib/compare-store';

export function MarketplaceNav() {
  const { count } = useCompareStore();
  return <MarketplaceTopNav compareCount={count} />;
}
