import {
  DataTable,
  PageHeader,
  PrimaryButton,
  SecondaryButton,
  StatusPill,
} from '../components/ui';

const ledgerRows = [
  { ref: 'TXN-88201', type: 'Installment', party: 'Ahmed Al-Kuwari', amount: 'QAR 3,590', status: 'paid' as const, date: '2026-08-01' },
  { ref: 'TXN-88200', type: 'Funding release', party: 'Gulf Motors Demo', amount: 'QAR 119,500', status: 'paid' as const, date: '2026-07-31' },
  { ref: 'TXN-88199', type: 'Insurance premium', party: 'Qatar Insurance Co.', amount: 'QAR 4,200', status: 'pending' as const, date: '2026-07-30' },
  { ref: 'TXN-88198', type: 'Platform fee', party: 'Blox', amount: 'QAR 1,840', status: 'paid' as const, date: '2026-07-29' },
  { ref: 'TXN-88197', type: 'Refund', party: 'Omar Hassan', amount: 'QAR 2,100', status: 'rejected' as const, date: '2026-07-28' },
];

const statusVariant = {
  paid: 'paid' as const,
  pending: 'pending' as const,
  rejected: 'rejected' as const,
};

export function LedgersPage() {
  return (
    <div className="blox-page">
      <PageHeader
        title="Ledgers"
        subtitle="Financial transactions and platform ledger entries"
        actions={
          <>
            <SecondaryButton>Filter</SecondaryButton>
            <PrimaryButton>Export CSV</PrimaryButton>
          </>
        }
      />

      <div className="blox-filter-bar">
        <input type="date" defaultValue="2026-07-01" aria-label="From date" />
        <input type="date" defaultValue="2026-08-05" aria-label="To date" />
        <select defaultValue="">
          <option value="">All types</option>
          <option value="installment">Installment</option>
          <option value="funding">Funding release</option>
          <option value="fee">Platform fee</option>
        </select>
        <select defaultValue="">
          <option value="">All statuses</option>
          <option value="paid">Paid</option>
          <option value="pending">Pending</option>
        </select>
      </div>

      <DataTable
        columns={['Reference', 'Type', 'Party', 'Amount', 'Status', 'Date']}
        rows={ledgerRows.map((r) => [
          r.ref,
          r.type,
          r.party,
          <span key={`${r.ref}-amt`} className="blox-money">{r.amount}</span>,
          <StatusPill key={`${r.ref}-st`} label={r.status} variant={statusVariant[r.status]} />,
          r.date,
        ])}
        pagination={{ from: 1, to: 5, total: 342 }}
      />
    </div>
  );
}
