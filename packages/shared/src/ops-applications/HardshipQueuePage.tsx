import { CreditQueue } from './CreditQueue';

/** Credit hardship / repossession / total-loss queue. */
export function HardshipQueuePage({ detailBase }: { detailBase?: string }) {
  return <CreditQueue detailBase={detailBase} initialTab="hardship" />;
}
