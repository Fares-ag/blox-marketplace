import { useState } from 'react';
import { toast } from 'react-toastify';
import { apiFetch, exportToCSV, OpsContentCard, OpsListPage, OpsPrimaryButton, useOpsLabels } from '@drivemarket/shared';

const MAX_ROWS = 5000;
const PAGE = 200;

/** Page through a paginated ops endpoint up to MAX_ROWS. */
async function fetchAll<T>(path: string): Promise<T[]> {
  const out: T[] = [];
  for (let offset = 0; offset < MAX_ROWS; offset += PAGE) {
    const res = await apiFetch<{ total: number; items: T[] }>(
      `${path}${path.includes('?') ? '&' : '?'}limit=${PAGE}&offset=${offset}`,
    );
    out.push(...res.items);
    if (out.length >= res.total || res.items.length < PAGE) break;
  }
  return out.slice(0, MAX_ROWS);
}

/** blox-vercel `/finance/exports` — operational CSVs (not a general ledger). */
export function FinanceExportsPage() {
  const { t } = useOpsLabels();
  const [busy, setBusy] = useState<string | null>(null);

  async function run(key: string, path: string, filename: string) {
    setBusy(key);
    try {
      const rows = await fetchAll<Record<string, unknown>>(path);
      if (!rows.length) {
        toast.info(t('ops.common.noResults'));
        return;
      }
      exportToCSV(rows, `${filename}-${new Date().toISOString().slice(0, 10)}`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const items: Array<{ key: string; label: string; path: string; filename: string }> = [
    { key: 'schedules', label: t('ops.finance.exportSchedules'), path: '/api/ops/payment-schedules', filename: 'schedules' },
    { key: 'book', label: t('ops.finance.exportBook'), path: '/api/ops/finance/book', filename: 'active-book' },
    { key: 'transactions', label: t('ops.finance.exportTransactions'), path: '/api/ops/payment-transactions', filename: 'transactions' },
    { key: 'settlements', label: t('ops.finance.exportSettlements'), path: '/api/ops/settlements', filename: 'settlements' },
  ];

  return (
    <OpsListPage title={t('ops.finance.exportsTitle')} subtitle={t('ops.finance.exportsSubtitle')}>
      <OpsContentCard>
        <p>{t('ops.finance.exportNote', { max: MAX_ROWS.toLocaleString() })}</p>
        <div className="blox-inline-actions blox-inline-actions--wrap">
          {items.map((item) => (
            <OpsPrimaryButton
              key={item.key}
              type="button"
              disabled={busy !== null}
              onClick={() => void run(item.key, item.path, item.filename)}
            >
              {busy === item.key ? t('ops.finance.exporting') : item.label}
            </OpsPrimaryButton>
          ))}
        </div>
      </OpsContentCard>
    </OpsListPage>
  );
}
