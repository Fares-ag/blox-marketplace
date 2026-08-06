import {
  DataTable,
  PageHeader,
  PrimaryButton,
  SecondaryButton,
  StatusPill,
} from '../components/ui';

const applications = [
  { id: 'APP-2401', customer: 'Ahmed Al-Kuwari', vehicle: 'Hyundai Tucson Limited', amount: 'QAR 119,500', status: 'pending' as const, date: '2026-08-01' },
  { id: 'APP-2400', customer: 'Sara Al-Mannai', vehicle: 'Toyota Camry SE', amount: 'QAR 98,200', status: 'approved' as const, date: '2026-07-30' },
  { id: 'APP-2399', customer: 'Omar Hassan', vehicle: 'Nissan Patrol SE', amount: 'QAR 245,000', status: 'rejected' as const, date: '2026-07-28' },
  { id: 'APP-2398', customer: 'Fatima Al-Thani', vehicle: 'Kia Sportage GT', amount: 'QAR 87,400', status: 'pending' as const, date: '2026-07-27' },
  { id: 'APP-2397', customer: 'Khalid Al-Emadi', vehicle: 'BMW 320i M Sport', amount: 'QAR 178,900', status: 'approved' as const, date: '2026-07-25' },
];

const statusVariant = {
  pending: 'pending' as const,
  approved: 'approved' as const,
  rejected: 'rejected' as const,
};

export function ApplicationsPage() {
  return (
    <div className="blox-page">
      <PageHeader
        title="Applications"
        subtitle="Vehicle financing applications across all dealers"
        actions={
          <>
            <SecondaryButton>Filters</SecondaryButton>
            <PrimaryButton>New application</PrimaryButton>
          </>
        }
      />

      <div className="blox-filter-bar">
        <input type="search" placeholder="Search customer or ID…" />
        <select defaultValue="">
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
        <select defaultValue="">
          <option value="">All dealers</option>
          <option value="gulf">Gulf Motors Demo</option>
        </select>
      </div>

      <DataTable
        columns={['ID', 'Customer', 'Vehicle', 'Amount', 'Status', 'Submitted']}
        rows={applications.map((a) => [
          a.id,
          a.customer,
          a.vehicle,
          <span key={`${a.id}-amt`} className="blox-money">{a.amount}</span>,
          <StatusPill key={`${a.id}-st`} label={a.status} variant={statusVariant[a.status]} />,
          a.date,
        ])}
        pagination={{ from: 1, to: 5, total: 128 }}
      />
    </div>
  );
}
