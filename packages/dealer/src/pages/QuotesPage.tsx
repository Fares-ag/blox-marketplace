import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import {
  OpsDataTable,
  OpsEmptyState,
  OpsField,
  OpsFormSection,
  OpsGhostButton,
  OpsListPage,
  OpsPrimaryButton,
  OpsSelect,
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
  const [negotiatedPrice, setNegotiatedPrice] = useState<number | ''>('');
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

  const published = useMemo(
    () => (inventory.data?.items ?? []).filter((p) => p.listing_status === 'published'),
    [inventory.data?.items],
  );

  const selectedListing = useMemo(
    () => published.find((p) => p.id === productId),
    [published, productId],
  );

  const listPrice = selectedListing ? Number(selectedListing.price) : null;

  useEffect(() => {
    if (!selectedListing) return;
    const price = Number(selectedListing.price);
    setNegotiatedPrice((current) => {
      if (current === '' || (typeof current === 'number' && current > price)) {
        return price;
      }
      return current;
    });
  }, [selectedListing]);

  const quotes = useQuery({
    queryKey: ['dealer-quotes', page],
    queryFn: () =>
      apiFetch<{ total: number; items: DealerQuoteItem[] }>(`/api/dealer/quotes?${buildPaginationQuery(page)}`),
  });
  const quoteItems = quotes.data?.items ?? [];
  const { from, to, total } = paginationWindow(quotes.data?.total ?? 0, page);

  const createQuote = useMutation({
    mutationFn: () => {
      const priceValue = typeof negotiatedPrice === 'number' ? negotiatedPrice : Number(negotiatedPrice);
      if (!productId) throw new Error('Select a published listing.');
      if (!customerEmail.trim()) throw new Error('Enter the customer email.');
      if (!Number.isFinite(priceValue) || priceValue < 1) {
        throw new Error('Enter a negotiated price of at least QAR 1.');
      }
      if (listPrice != null && priceValue > listPrice) {
        throw new Error(`Negotiated price cannot exceed the list price (${formatQar(listPrice)}).`);
      }
      const expiry = new Date(expiresAt);
      if (Number.isNaN(expiry.getTime()) || expiry.getTime() <= Date.now()) {
        throw new Error('Expiry must be in the future.');
      }
      return apiFetch<{ url: string }>('/api/dealer/quotes', {
        method: 'POST',
        body: JSON.stringify({
          productId,
          customerEmail: customerEmail.trim(),
          negotiatedPrice: priceValue,
          expiresAt: expiry.toISOString(),
        }),
      });
    },
    onSuccess: (row) => {
      setError(null);
      setCreatedUrl(row.url);
      toast.success('Quote link created and emailed to the customer');
      void qc.invalidateQueries({ queryKey: ['dealer-quotes'] });
    },
    onError: (e: Error) => {
      setError(e.message);
      toast.error(e.message);
    },
  });

  const revoke = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/dealer/quotes/${id}/revoke`, { method: 'POST' }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['dealer-quotes'] }),
    onError: (e: Error) => {
      setError(e.message);
      toast.error(e.message);
    },
  });

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
          {error && (
            <p className="blox-form-error blox-form-grid__full" role="alert">
              {error}
            </p>
          )}
          <OpsSelect
            label="Published listing"
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            required
            fullWidth
          >
            <option value="">Select vehicle</option>
            {published.map((p) => (
              <option key={p.id} value={p.id}>
                {p.make} {p.model} {p.model_year} — {Number(p.price).toLocaleString()} QAR
              </option>
            ))}
          </OpsSelect>
          {listPrice != null && (
            <p className="blox-form-grid__full blox-muted">
              List price: {formatQar(listPrice)} — negotiated price must be at or below this amount.
            </p>
          )}
          <OpsField
            label="Customer email"
            type="email"
            required
            value={customerEmail}
            onChange={(e) => setCustomerEmail(e.target.value)}
            fullWidth
          />
          <OpsField
            label="Negotiated price (QAR)"
            type="number"
            required
            min={1}
            max={listPrice ?? undefined}
            value={negotiatedPrice}
            onChange={(e) => setNegotiatedPrice(e.target.value === '' ? '' : Number(e.target.value))}
            hint={listPrice != null ? `Maximum ${formatQar(listPrice)}` : undefined}
            fullWidth
          />
          <OpsField
            label="Expires"
            type="datetime-local"
            required
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
            fullWidth
          />
          {createdUrl && (
            <p className="blox-form-grid__full blox-break">
              Quote link:{' '}
              <a href={createdUrl} target="_blank" rel="noreferrer">
                {createdUrl}
              </a>
            </p>
          )}
          <OpsPrimaryButton
            type="submit"
            className="blox-form-grid__full blox-form-actions__primary"
            disabled={createQuote.isPending || !productId}
          >
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
              <span key="p" className="blox-money">
                <MoneyText>{formatQar(q.negotiated_price ?? 0)}</MoneyText>
              </span>,
              <StatusBadge key="s" status={q.status} type="listing" label={q.status} />,
              <a key="l" href={q.url} target="_blank" rel="noreferrer">
                Open
              </a>,
              q.status === 'active' ? (
                <OpsGhostButton key="r" type="button" disabled={revoke.isPending} onClick={() => revoke.mutate(q.id)}>
                  {revoke.isPending ? t('ops.common.saving') : 'Revoke'}
                </OpsGhostButton>
              ) : (
                '—'
              ),
            ])}
          />
        </>
      )}
    </OpsListPage>
  );
}
