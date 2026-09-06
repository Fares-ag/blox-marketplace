import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import {
  apiFetch,
  ConfirmDialog,
  OpsCoreTable,
  OpsListPage,
  OpsSecondaryButton,
  OpsToolbar,
  SearchBar,
  useOpsLabels,
  type OpsTableColumn,
} from '@drivemarket/shared';

export type CreditRow = {
  user_id: string;
  email: string;
  name: string | null;
  balance: number;
  updated_at: string;
};

type Action = 'add' | 'subtract' | 'set';
const PAGE = 50;

/** blox-vercel `/finance/credits` — adjust `user_credits` balances. */
export function FinanceCreditsPage() {
  const { t } = useOpsLabels();
  const qc = useQueryClient();
  const [page, setPage] = useState(0);
  const [q, setQ] = useState('');
  const [target, setTarget] = useState<CreditRow | null>(null);
  const [action, setAction] = useState<Action>('add');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');

  const { data, error, isLoading } = useQuery({
    queryKey: ['finance-credits', page, q],
    queryFn: () =>
      apiFetch<{ total: number; items: CreditRow[] }>(
        `/api/ops/credits?limit=${PAGE}&offset=${page * PAGE}${q ? `&q=${encodeURIComponent(q)}` : ''}`,
      ),
  });

  const adjust = useMutation({
    mutationFn: (p: { userId: string; action: Action; amount: number; description?: string }) =>
      apiFetch(`/api/ops/users/${p.userId}/credits`, {
        method: 'POST',
        body: JSON.stringify({ action: p.action, amount: p.amount, description: p.description || undefined }),
      }),
    onSuccess: () => {
      toast.success(t('ops.finance.creditsUpdated'));
      setTarget(null);
      void qc.invalidateQueries({ queryKey: ['finance-credits'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const columns: OpsTableColumn<CreditRow>[] = useMemo(
    () => [
      {
        id: 'email',
        label: t('ops.col.customer'),
        format: (_, r) => (
          <>
            {r.name ?? r.email}
            <br />
            <small>{r.email}</small>
          </>
        ),
      },
      { id: 'balance', label: t('ops.finance.balance'), format: (_, r) => r.balance.toLocaleString() },
      { id: 'updated_at', label: t('ops.col.created'), format: (_, r) => r.updated_at.slice(0, 10) },
      {
        id: 'actions',
        label: '',
        format: (_, r) => (
          <OpsSecondaryButton
            type="button"
            onClick={() => {
              setTarget(r);
              setAction('add');
              setAmount('');
              setDescription('');
            }}
          >
            {t('ops.finance.adjust')}
          </OpsSecondaryButton>
        ),
      },
    ],
    [t],
  );

  return (
    <OpsListPage
      title={t('ops.finance.creditsTitle')}
      subtitle={t('ops.finance.creditsSubtitle')}
      error={error ? (error as Error).message : undefined}
      toolbar={
        <OpsToolbar
          search={
            <SearchBar
              value={q}
              onChange={(value) => {
                setQ(value);
                setPage(0);
              }}
              placeholder={t('ops.common.search')}
            />
          }
        />
      }
    >
      <OpsCoreTable
        columns={columns}
        rows={data?.items ?? []}
        loading={isLoading}
        page={page}
        rowsPerPage={PAGE}
        totalRows={data?.total ?? 0}
        onPageChange={setPage}
        emptyMessage={t('ops.finance.creditsEmpty')}
      />
      <ConfirmDialog
        open={!!target}
        title={target ? t('ops.finance.adjustCredits', { email: target.email }) : ''}
        message={target ? `${t('ops.finance.balance')}: ${target.balance.toLocaleString()}` : ''}
        onCancel={() => setTarget(null)}
        onConfirm={() => {
          const value = Number(amount);
          if (!target || !Number.isFinite(value) || value <= 0) {
            toast.error(t('ops.finance.creditsAmount'));
            return;
          }
          adjust.mutate({ userId: target.user_id, action, amount: value, description });
        }}
      >
        <div className="blox-form-grid">
          <label className="blox-field">
            <span>{t('ops.finance.adjust')}</span>
            <select value={action} onChange={(e) => setAction(e.target.value as Action)}>
              <option value="add">{t('ops.finance.addCredits')}</option>
              <option value="subtract">{t('ops.finance.subtractCredits')}</option>
              <option value="set">{t('ops.finance.setCredits')}</option>
            </select>
          </label>
          <label className="blox-field">
            <span>{t('ops.finance.creditsAmount')}</span>
            <input type="number" min={0} step="1" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </label>
          <label className="blox-field">
            <span>{t('ops.finance.creditsDescription')}</span>
            <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} />
          </label>
        </div>
      </ConfirmDialog>
    </OpsListPage>
  );
}
