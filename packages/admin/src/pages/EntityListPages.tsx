import {
  DataTable,
  PageHeader,
  PrimaryButton,
  SecondaryButton,
  StatusPill,
} from '../components/ui';

interface EntityListPageProps {
  title: string;
  subtitle: string;
  entityLabel: string;
  rows: { name: string; code: string; rate: string; status: 'active' | 'draft' | 'expired'; updated: string }[];
}

export function EntityListPage({ title, subtitle, entityLabel, rows }: EntityListPageProps) {
  return (
    <div className="blox-page">
      <PageHeader
        title={title}
        subtitle={subtitle}
        actions={
          <>
            <SecondaryButton>Archive</SecondaryButton>
            <PrimaryButton>Create {entityLabel.toLowerCase()}</PrimaryButton>
          </>
        }
      />

      <div className="blox-filter-bar">
        <input type="search" placeholder={`Search ${entityLabel.toLowerCase()}s…`} />
        <select defaultValue="">
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="draft">Draft</option>
          <option value="expired">Expired</option>
        </select>
      </div>

      <DataTable
        columns={['Name', 'Code', 'Rate / terms', 'Status', 'Updated']}
        rows={rows.map((r) => [
          r.name,
          r.code,
          <span key={`${r.code}-rate`} className="blox-money">{r.rate}</span>,
          <StatusPill key={`${r.code}-st`} label={r.status} variant={r.status} />,
          r.updated,
        ])}
        pagination={{ from: 1, to: rows.length, total: rows.length + 12 }}
      />
    </div>
  );
}

export function OffersPage() {
  return (
    <EntityListPage
      title="Offers"
      subtitle="Financing offer templates and default rates"
      entityLabel="Offer"
      rows={[
        { name: 'Standard 36-month', code: 'OFF-STD-36', rate: '4.9% APR', status: 'active', updated: '2026-07-15' },
        { name: 'Premium 48-month', code: 'OFF-PRM-48', rate: '5.4% APR', status: 'active', updated: '2026-07-10' },
        { name: 'Zero down promo', code: 'OFF-ZD-24', rate: '6.1% APR', status: 'draft', updated: '2026-06-28' },
        { name: 'Legacy 60-month', code: 'OFF-LEG-60', rate: '5.8% APR', status: 'expired', updated: '2026-05-01' },
      ]}
    />
  );
}

export function PromotionsPage() {
  return (
    <EntityListPage
      title="Promotions"
      subtitle="Campaigns and limited-time financing incentives"
      entityLabel="Promotion"
      rows={[
        { name: 'Summer drive 2026', code: 'PROM-SUM26', rate: '0% down · 36 mo', status: 'active', updated: '2026-07-01' },
        { name: 'Ramadan special', code: 'PROM-RAM26', rate: '1.9% flat', status: 'expired', updated: '2026-04-15' },
        { name: 'New model launch', code: 'PROM-NML26', rate: 'Extended tenure', status: 'draft', updated: '2026-08-02' },
      ]}
    />
  );
}

export function PackagesPage() {
  return (
    <EntityListPage
      title="Packages"
      subtitle="Bundled insurance and service packages"
      entityLabel="Package"
      rows={[
        { name: 'Essential cover', code: 'PKG-ESS', rate: 'QAR 1,200/yr', status: 'active', updated: '2026-06-20' },
        { name: 'Premium cover + service', code: 'PKG-PRM', rate: 'QAR 2,400/yr', status: 'active', updated: '2026-06-20' },
        { name: 'Fleet bundle', code: 'PKG-FLT', rate: 'Custom', status: 'draft', updated: '2026-07-18' },
      ]}
    />
  );
}
