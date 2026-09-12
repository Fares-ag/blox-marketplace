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
  OpsSecondaryButton,
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

function formatExpiry(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export function QuotesPage() {
  const { t, quoteStatus } = useOpsLabels();
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
  const vehicleLabel = selectedListing
    ? `${selectedListing.make} ${selectedListing.model} ${selectedListing.model_year}`
    : null;

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
      if (!productId) throw new Error(t('ops.dealer.quoteSelectVehicle'));
      if (!customerEmail.trim()) throw new Error(t('ops.dealer.quoteCustomerEmail'));
      if (!Number.isFinite(priceValue) || priceValue < 1) {
        throw new Error(t('ops.dealer.quoteNegotiatedPrice'));
      }
      if (listPrice != null && priceValue > listPrice) {
        throw new Error(t('ops.dealer.quoteMaxPrice', { price: formatQar(listPrice) }));
      }
      const expiry = new Date(expiresAt);
      if (Number.isNaN(expiry.getTime()) || expiry.getTime() <= Date.now()) {
        throw new Error(t('ops.dealer.quoteExpires'));
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
      toast.success(t('ops.dealer.quoteLinkReady'));
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
      <div className="blox-quotes-layout">
        <OpsFormSection title={t('ops.dealer.createQuote')} description={t('ops.dealer.createQuoteHint')}>
          <form onSubmit={onCreate} className="blox-quotes-form">
            {error && (
              <p className="blox-form-error blox-form-grid__full" role="alert">
                {error}
              </p>
            )}
            <OpsSelect
              label={t('ops.dealer.quoteListing')}
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              required
              fullWidth
            >
              <option value="">{t('ops.dealer.quoteSelectVehicle')}</option>
              {published.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.make} {p.model} {p.model_year} — {Number(p.price).toLocaleString()} QAR
                </option>
              ))}
            </OpsSelect>
            <OpsField
              label={t('ops.dealer.quoteCustomerEmail')}
              type="email"
              required
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
            />
            <OpsField
              label={t('ops.dealer.quoteNegotiatedPrice')}
              type="number"
              required
              min={1}
              max={listPrice ?? undefined}
              value={negotiatedPrice}
              onChange={(e) => setNegotiatedPrice(e.target.value === '' ? '' : Number(e.target.value))}
              hint={listPrice != null ? t('ops.dealer.quoteMaxPrice', { price: formatQar(listPrice) }) : undefined}
              mono
            />
            <OpsField
              label={t('ops.dealer.quoteExpires')}
              type="datetime-local"
              required
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
            />
            <div className="blox-quotes-form__actions blox-form-grid__full">
              <OpsPrimaryButton type="submit" disabled={createQuote.isPending || !productId}>
                {createQuote.isPending ? t('ops.common.saving') : t('ops.dealer.quoteCreateLink')}
              </OpsPrimaryButton>
            </div>
            {createdUrl && (
              <div className="blox-quotes-form__success blox-form-grid__full">
                <p className="blox-quotes-form__success-label">{t('ops.dealer.quoteLinkReady')}</p>
                <div className="blox-inline-actions">
                  <OpsSecondaryButton type="button" onClick={() => window.open(createdUrl, '_blank', 'noopener,noreferrer')}>
                    {t('ops.dealer.quoteOpenLink')}
                  </OpsSecondaryButton>
                </div>
              </div>
            )}
          </form>
        </OpsFormSection>

        <aside className="blox-quotes-summary" aria-label={t('ops.dealer.quoteSummaryTitle')}>
          <h3 className="blox-quotes-summary__title">{t('ops.dealer.quoteSummaryTitle')}</h3>
          {!selectedListing ? (
            <p className="blox-quotes-summary__empty">{t('ops.dealer.quoteSummaryEmpty')}</p>
          ) : (
            <dl className="blox-quotes-summary__list">
              <div>
                <dt>{t('ops.col.vehicle')}</dt>
                <dd>{vehicleLabel}</dd>
              </div>
              <div>
                <dt>{t('ops.dealer.quoteSummaryList')}</dt>
                <dd className="blox-money">{formatQar(listPrice ?? 0)}</dd>
              </div>
              <div>
                <dt>{t('ops.dealer.quoteSummaryNegotiated')}</dt>
                <dd className="blox-money">
                  {typeof negotiatedPrice === 'number' ? formatQar(negotiatedPrice) : '—'}
                </dd>
              </div>
              <div>
                <dt>{t('ops.dealer.quoteSummaryCustomer')}</dt>
                <dd>{customerEmail.trim() || '—'}</dd>
              </div>
              <div>
                <dt>{t('ops.dealer.quoteSummaryExpires')}</dt>
                <dd>{formatExpiry(expiresAt)}</dd>
              </div>
            </dl>
          )}
        </aside>
      </div>

      {!quoteItems.length ? (
        <OpsEmptyState title={t('ops.dealer.noQuotes')} body="" />
      ) : (
        <OpsDataTable
          columns={[
            t('ops.col.vehicle'),
            t('ops.col.customer'),
            t('ops.col.price'),
            t('ops.col.status'),
            t('ops.dealer.quoteExpires'),
            t('ops.dealer.quoteOpenLink'),
            '',
          ]}
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
            <StatusBadge key="s" status={q.status} type="quote" label={quoteStatus(q.status)} />,
            formatExpiry(q.expires_at),
            <OpsSecondaryButton
              key="l"
              type="button"
              onClick={() => window.open(q.url, '_blank', 'noopener,noreferrer')}
            >
              {t('ops.dealer.quoteOpenLink')}
            </OpsSecondaryButton>,
            q.status === 'active' ? (
              <OpsGhostButton key="r" type="button" disabled={revoke.isPending} onClick={() => revoke.mutate(q.id)}>
                {revoke.isPending ? t('ops.common.saving') : t('ops.dealer.quoteRevoke')}
              </OpsGhostButton>
            ) : (
              '—'
            ),
          ])}
        />
      )}
    </OpsListPage>
  );
}
