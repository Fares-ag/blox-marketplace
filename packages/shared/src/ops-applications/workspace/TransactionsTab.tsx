import { useOpsLabels } from '../../i18n/use-ops-labels';
import { apiFileUrl } from '../../lib/api';
import { Table, type Column } from '../../ops-core';
import { OpsStatusPill } from '../../components/ops-ui';
import { transactionOpsPillVariant } from '../../config/status-styles';
import type { WorkspacePanelProps } from './types';

type Txn = NonNullable<WorkspacePanelProps['data']['payment_transactions']>[number];

export function TransactionsTab({ data }: Pick<WorkspacePanelProps, 'data'>) {
  const { t } = useOpsLabels();
  const rows = data.payment_transactions ?? [];
  const columns: Column<Txn>[] = [
    { id: 'created_at', label: t('ops.workspace.col.dueDate'), mono: true, format: (v) => new Date(String(v)).toLocaleString() },
    { id: 'gateway', label: t('ops.finance.method'), cardTitle: true },
    { id: 'amount', label: t('ops.workspace.col.amount'), numeric: true, format: (v) => `QAR ${Number(v).toLocaleString()}` },
    {
      id: 'status',
      label: t('ops.col.status'),
      cardStatus: true,
      format: (v) => <OpsStatusPill label={String(v).replace(/_/g, ' ')} variant={transactionOpsPillVariant(String(v))} />,
    },
    {
      id: 'receipt_url',
      label: '',
      actions: true,
      format: (v) =>
        v ? (
          <a className="blox-btn blox-btn--ghost blox-btn--sm" href={String(v).startsWith('http') ? String(v) : apiFileUrl(String(v))} target="_blank" rel="noreferrer">
            {t('ops.workspace.receipt')}
          </a>
        ) : null,
    },
  ];
  return (
    <section className="blox-detail-section">
      <h2 className="blox-panel__title">{t('ops.workspace.tab.transactions')}</h2>
      <Table<Txn> columns={columns} rows={rows} density="compact" emptyMessage={t('ops.common.noResults')} />
    </section>
  );
}
