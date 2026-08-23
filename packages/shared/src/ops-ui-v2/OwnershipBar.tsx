import { bloxTokens } from '../config/blox-tokens';

export function OwnershipBar({
  customerPct,
  bloxPct,
  height = 8,
}: {
  customerPct: number;
  bloxPct: number;
  height?: number;
}) {
  const total = customerPct + bloxPct;
  const customerWidth = total > 0 ? (customerPct / total) * 100 : 50;
  const bloxWidth = total > 0 ? (bloxPct / total) * 100 : 50;

  return (
    <div
      className="blox-ownership-bar"
      role="img"
      aria-label={`Customer ${customerPct}%, Blox ${bloxPct}%`}
      style={{ height, borderRadius: height / 2 }}
    >
      <span style={{ width: `${customerWidth}%`, background: bloxTokens.emerald }} />
      <span style={{ width: `${bloxWidth}%`, background: bloxTokens.deepGreen }} />
    </div>
  );
}
