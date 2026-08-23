import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  OpsDataTable,
  OpsEmptyState,
  OpsFormSection,
  OpsGhostButton,
  OpsListPage,
  OpsPrimaryButton,
  MoneyText,
  StatusBadge,
  apiFetch,
  buildPaginationQuery,
  formatQar,
  paginationWindow,
  useOpsLabels,
  type DealerInventoryItem,
  type DealerQuoteItem,
} from '@drivemarket/shared';

export function QuotesPage() {
  const { t } = useOpsLabels();
  const qc = useQueryClient();
  const [productId, setProductId] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [negotiatedPrice, setNegotiatedPrice] = useState(90000);
  const [page, setPage] = useState(0);
  const [expiresAt, setExpiresAt] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 16);
  });
  const [error, setError] = useState<string | null>(null);
  const [createdUrl, setCreatedUrl] = useState<string | null>(null);

  const inventory = useQuery({
    queryKey: ['dealer-inventory', 'quotes'],
    queryFn: () =>
      apiFetch<{
        total: number;
        items: Array<Pick<DealerInventoryItem, 'id' | 'make' | 'model' | 'model_year' | 'price' | 'listing_status'>>;
      }>('/api/dealer/inventory?limit=100&offset=0'),
  });

  const quotes = useQuery({
    queryKey: ['dealer-quotes', page],
    queryFn: () =>
      apiFetch<{ total: number; items: DealerQuoteItem[] }>(`/api/dealer/quotes?${buildPaginationQuery(page)}`),
  });
  const quoteItems = quotes.data?.items ?? [];
  const { from, to, total } = paginationWindow(quotes.data?.total ?? 0, page);

  const createQuote = useMutation({
    mutationFn: () =>
      apiFetch<{ url: string }>('/api/dealer/quotes', {
        method: 'POST',
        body: JSON.stringify({
          productId,
          customerEmail,
          negotiatedPrice,
          expiresAt: new Date(expiresAt).toISOString(),
        }),
      }),
    onSuccess: (row) => {
      setError(null);
      setCreatedUrl(row.url);
      void qc.invalidateQueries({ queryKey: ['dealer-quotes'] });
    },
    onError: (e: Error) => setError(e.message),
  });

  const revoke = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/dealer/quotes/${id}/revoke`, { method: 'POST' }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['dealer-quotes'] }),
    onError: (e: Error) => setError(e.message),
  });

  const published = (inventory.data?.items ?? []).filter((p) => p.listing_status === 'published');

  function onCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setCreatedUrl(null);
    createQuote.mutate();
  }

  return (
    <OpsListPage title={t('ops.dealer.quotesTitle')} subtitle={t('ops.dealer.quotesSubtitle')}>
      <OpsFormSection title={t('ops.dealer.createQuote')}>
        <form onSubmit={onCreate} className="blox-form">
          <label>
            Published listing
            <select required value={productId} onChange={(e) => setProductId(e.target.value)}>
              <option value="">Select vehicle</option>
              {published.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.make} {p.model} {p.model_year} — {Number(p.price).toLocaleString()} QAR
                </option>
              ))}
            </select>
          </label>
          <label>
            Customer email
            <input
              type="email"
              required
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
            />
          </label>
          <label>
            Negotiated price (QAR)
            <input
              type="number"
              required
              min={1}
              value={negotiatedPrice}
              onChange={(e) => setNegotiatedPrice(Number(e.target.value))}
            />
          </label>
          <label>
            Expires
            <input
              type="datetime-local"
              required
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
            />
          </label>
          {error && <p style={{ color: '#b42318', margin: 0 }}>{error}</p>}
          {createdUrl && (
            <p style={{ margin: 0, wordBreak: 'break-all' }}>
              Quote link:{' '}
              <a href={createdUrl} target="_blank" rel="noreferrer">
                {createdUrl}
              </a>
            </p>
          )}
          <OpsPrimaryButton type="submit" disabled={createQuote.isPending}>
            Create quote link
          </OpsPrimaryButton>
        </form>
      </OpsFormSection>

      {!quoteItems.length ? (
        <OpsEmptyState title={t('ops.dealer.noQuotes')} body="" />
      ) : (
        <>
          <OpsDataTable
            columns={[t('ops.col.vehicle'), t('ops.col.customer'), t('ops.col.price'), t('ops.col.status'), 'Link', '']}
            pagination={{
              from,
              to,
              total,
              onPrev: () => setPage((p) => Math.max(0, p - 1)),
              onNext: () => setPage((p) => p + 1),
            }}
            rows={quoteItems.map((q) => [
              `${q.product.make} ${q.product.model} ${q.product.model_year}`,
              q.customer_email,
              <span key="p" className="blox-money"><MoneyText>{formatQar(q.negotiated_price ?? 0)}</MoneyText></span>,
              <StatusBadge key="s" status={q.status} type="listing" label={q.status} />,
              <a key="l" href={q.url} target="_blank" rel="noreferrer">Open</a>,
              q.status === 'active' ? (
                <OpsGhostButton key="r" type="button" disabled={revoke.isPending} onClick={() => revoke.mutate(q.id)}>
                  {revoke.isPending ? t('ops.common.saving') : 'Revoke'}
                </OpsGhostButton>
              ) : '—',
            ])}
          />
        </>
      )}
    </OpsListPage>
  );
}
