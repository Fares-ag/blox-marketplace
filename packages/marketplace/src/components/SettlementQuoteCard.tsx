import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { MoneyText, formatQar, getAppLocale, type SettlementQuoteDto } from '@drivemarket/shared';
import { Modal } from './Modal';
import { outstandingQuoteRows, requestSettlement } from '../lib/settlement-quote';
import { formatDate } from '../lib/dates';

/**
 * Early-settlement quote: what the customer pays to buy Blox's remaining share
 * today (principal outstanding + rent to date), what is forgiven, and the
 * saving against simply finishing the schedule. The settle action confirms
 * the quoted figure before it posts the settlement request.
 *
 * `variant="hero"` sits on the dark dashboard hero; `variant="detail"` is the
 * light card on the application page.
 */
export function SettlementQuoteCard({
  applicationId,
  quote,
  loading,
  error,
  variant,
  canSettle,
  compact = false,
}: {
  applicationId: string;
  quote: SettlementQuoteDto | undefined;
  loading: boolean;
  error: boolean;
  variant: 'hero' | 'detail';
  /** False once the financing is no longer active (finished, or a request is pending). */
  canSettle: boolean;
  /** Hero mode: headline numbers + CTA, breakdown behind a toggle. */
  compact?: boolean;
}) {
  const { t } = useTranslation();
  const locale = getAppLocale();
  const qc = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [showRows, setShowRows] = useState(!compact);
  const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  const settle = useMutation({
    mutationFn: () => requestSettlement(applicationId),
    onSuccess: () => {
      setConfirmOpen(false);
      setNotice({ tone: 'ok', text: t('ownershipHero.settlement.requested') });
      void qc.invalidateQueries({ queryKey: ['app', applicationId] });
    },
    onError: () => {
      setConfirmOpen(false);
      setNotice({ tone: 'error', text: t('ownershipHero.settlement.requestFailed') });
    },
  });

  const money = (value: number, exact = false) => <MoneyText>{formatQar(value, exact, locale)}</MoneyText>;
  const rows = quote ? outstandingQuoteRows(quote) : [];
  const idBase = `dm-settle-${variant}-${applicationId.slice(0, 8)}`;

  return (
    <section className={`dm-settle dm-settle--${variant}`} aria-labelledby={`${idBase}-title`}>
      <div className="dm-settle__head">
        <div>
          <p className="dm-settle__eyebrow">{t('ownershipHero.settlement.eyebrow')}</p>
          <h3 id={`${idBase}-title`} className="dm-settle__title">
            {t('ownershipHero.settlement.title')}
          </h3>
        </div>
        {quote && quote.savings > 0 ? (
          <span className="dm-settle__chip">{t('ownershipHero.settlement.savingsChip', { amount: formatQar(quote.savings, false, locale) })}</span>
        ) : null}
      </div>
      {!compact ? <p className="dm-settle__intro">{t('ownershipHero.settlement.intro')}</p> : null}

      {loading ? (
        <p className="dm-settle__muted" role="status">
          {t('ownershipHero.settlement.quoteLoading')}
        </p>
      ) : null}
      {error && !loading ? <p className="dm-settle__muted">{t('ownershipHero.settlement.quoteError')}</p> : null}

      {quote ? (
        <>
          <div className="dm-settle__hero">
            <span className="dm-settle__hero-label">{t('ownershipHero.settlement.settleAmount')}</span>
            <MoneyText className="dm-settle__hero-value">{formatQar(quote.settlement_amount, true, locale)}</MoneyText>
            <span className="dm-settle__asof">{t('ownershipHero.settlement.asOf', { date: formatDate(quote.as_of, locale) })}</span>
          </div>

          <dl className="dm-settle__rows">
            <div>
              <dt>{t('ownershipHero.settlement.principal')}</dt>
              <dd>{money(quote.principal_outstanding, true)}</dd>
            </div>
            <div>
              <dt>{t('ownershipHero.settlement.accruedRent')}</dt>
              <dd>{money(quote.accrued_profit, true)}</dd>
            </div>
            {quote.overdue_amount > 0 ? (
              <div className="is-warn">
                <dt>{t('ownershipHero.settlement.overdue')}</dt>
                <dd>{money(quote.overdue_amount, true)}</dd>
              </div>
            ) : null}
            <div className="is-good">
              <dt>{t('ownershipHero.settlement.forgivenRent')}</dt>
              <dd>{money(quote.forgiven_rent, true)}</dd>
            </div>
            <div>
              <dt>{t('ownershipHero.settlement.remainingScheduled')}</dt>
              <dd>{money(quote.remaining_scheduled, true)}</dd>
            </div>
            <div className="is-good">
              <dt>{t('ownershipHero.settlement.savings')}</dt>
              <dd>{money(quote.savings, true)}</dd>
            </div>
          </dl>
          {quote.overdue_amount > 0 ? <p className="dm-settle__muted">{t('ownershipHero.settlement.overdueNote')}</p> : null}

          {rows.length > 0 ? (
            <div className="dm-settle__breakdown">
              <button
                type="button"
                className="dm-settle__toggle"
                aria-expanded={showRows}
                aria-controls={`${idBase}-rows`}
                onClick={() => setShowRows((v) => !v)}
              >
                {showRows ? t('ownershipHero.settlement.hideBreakdown') : t('ownershipHero.settlement.breakdown')}
              </button>
              <div id={`${idBase}-rows`} className="dm-settle__table-wrap" hidden={!showRows}>
                <table className="dm-settle__table">
                  <thead>
                    <tr>
                      <th scope="col">{t('ownershipHero.settlement.colInstallment')}</th>
                      <th scope="col">{t('ownershipHero.settlement.colDue')}</th>
                      <th scope="col">{t('ownershipHero.settlement.colKind')}</th>
                      <th scope="col">{t('ownershipHero.settlement.colPrincipal')}</th>
                      <th scope="col">{t('ownershipHero.settlement.colRent')}</th>
                      <th scope="col">{t('ownershipHero.settlement.colAccrued')}</th>
                      <th scope="col">{t('ownershipHero.settlement.colForgiven')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.sequence} className={`is-${row.kind}`}>
                        <td className="dm-numeric">#{row.sequence}</td>
                        <td className="dm-numeric">{formatDate(row.due_date, locale)}</td>
                        <td>{t(`ownershipHero.settlement.kind.${row.kind}`)}</td>
                        <td className="dm-numeric">{formatQar(row.principal_outstanding, true, locale)}</td>
                        <td className="dm-numeric">{formatQar(row.rent_outstanding, true, locale)}</td>
                        <td className="dm-numeric">{formatQar(row.accrued_rent, true, locale)}</td>
                        <td className="dm-numeric">{formatQar(row.forgiven_rent, true, locale)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </>
      ) : null}

      {notice ? (
        <p className={`dm-settle__notice dm-settle__notice--${notice.tone}`} role="status">
          {notice.text}
        </p>
      ) : null}

      {canSettle && quote ? (
        <div className="dm-settle__actions">
          <button
            type="button"
            className={variant === 'hero' ? 'dm-btn-cta dm-settle__cta' : 'dm-btn-cta dm-settle__cta'}
            disabled={settle.isPending}
            onClick={() => {
              setNotice(null);
              setConfirmOpen(true);
            }}
          >
            {t('ownershipHero.settlement.cta')}
          </button>
          <span className="dm-settle__hint">{t('ownershipHero.settlement.ctaHint')}</span>
        </div>
      ) : null}

      <Modal
        open={confirmOpen}
        title={t('ownershipHero.settlement.confirmTitle')}
        description={
          quote
            ? t('ownershipHero.settlement.confirmBody', {
                amount: formatQar(quote.settlement_amount, true, locale),
                date: formatDate(quote.as_of, locale),
              })
            : undefined
        }
        onClose={() => setConfirmOpen(false)}
        closeLabel={t('ownershipHero.settlement.cancel')}
        footer={
          <>
            <button type="button" className="dm-btn-ghost dm-btn-ghost--on-light" disabled={settle.isPending} onClick={() => setConfirmOpen(false)}>
              {t('ownershipHero.settlement.cancel')}
            </button>
            <button type="button" className="dm-btn-cta" disabled={settle.isPending} onClick={() => settle.mutate()} data-autofocus>
              {t('ownershipHero.settlement.confirm')}
            </button>
          </>
        }
      />
      <style>{SETTLE_CSS}</style>
    </section>
  );
}

const SETTLE_CSS = `
  .dm-settle {
    display: grid;
    gap: 12px;
    padding: 18px 20px;
    border-radius: 16px;
    border: 1px solid var(--dm-slate-200);
    background: var(--dm-surface);
    color: var(--dm-ink);
    --settle-muted: var(--dm-slate-600);
    --settle-line: var(--dm-slate-200);
    --settle-good: var(--dm-success);
    --settle-warn: var(--dm-warning, #c47a00);
    --settle-soft: var(--dm-canvas);
  }
  .dm-settle--hero {
    background: rgba(255,255,255,0.08);
    border-color: rgba(255,255,255,0.18);
    color: #fff;
    --settle-muted: rgba(255,255,255,0.72);
    --settle-line: rgba(255,255,255,0.16);
    --settle-good: #7ff0d0;
    --settle-warn: #ffe27a;
    --settle-soft: rgba(255,255,255,0.06);
  }
  .dm-settle__head { display: flex; flex-wrap: wrap; align-items: flex-start; justify-content: space-between; gap: 8px 16px; }
  .dm-settle__eyebrow { margin: 0 0 2px; font-size: 0.7rem; font-weight: 650; letter-spacing: 0.1em; text-transform: uppercase; color: var(--settle-muted); }
  .dm-settle__title { margin: 0 !important; font-family: var(--dm-font-display); font-size: 1.1rem !important; }
  .dm-settle__chip {
    padding: 5px 11px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 700;
    background: var(--dm-success-soft);
    color: var(--dm-success);
    white-space: nowrap;
  }
  .dm-settle--hero .dm-settle__chip { background: rgba(0, 207, 162, 0.25); color: #fff; }
  .dm-settle__intro { margin: 0; font-size: 14px; line-height: 1.5; color: var(--settle-muted); max-width: 60ch; }
  .dm-settle__muted { margin: 0; font-size: 13px; color: var(--settle-muted); line-height: 1.45; }
  .dm-settle__hero { display: grid; gap: 2px; padding: 12px 14px; border-radius: 12px; background: var(--settle-soft); }
  .dm-settle__hero-label { font-size: 12px; font-weight: 650; color: var(--settle-muted); }
  .dm-settle__hero-value { font-family: var(--dm-font-display); font-size: clamp(1.5rem, 3vw, 2rem); font-weight: 700; line-height: 1.15; }
  .dm-settle__asof { font-size: 12px; color: var(--settle-muted); }
  .dm-settle__rows {
    margin: 0;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 10px 16px;
  }
  .dm-settle__rows div { display: grid; gap: 2px; min-width: 0; padding: 8px 10px; border-radius: 10px; border: 1px solid var(--settle-line); }
  .dm-settle__rows dt { font-size: 12px; color: var(--settle-muted); }
  .dm-settle__rows dd { margin: 0; font-weight: 650; font-size: 14px; overflow-wrap: anywhere; }
  .dm-settle__rows .is-good dd { color: var(--settle-good); }
  .dm-settle__rows .is-warn dd { color: var(--settle-warn); }
  .dm-settle__breakdown { display: grid; gap: 8px; }
  .dm-settle__toggle {
    justify-self: start;
    background: none;
    border: none;
    padding: 0;
    font: inherit;
    font-size: 13px;
    font-weight: 650;
    color: inherit;
    text-decoration: underline;
    cursor: pointer;
  }
  .dm-settle__table-wrap { overflow-x: auto; border: 1px solid var(--settle-line); border-radius: 10px; }
  .dm-settle__table { width: 100%; border-collapse: collapse; font-size: 12.5px; min-width: 560px; }
  .dm-settle__table th, .dm-settle__table td { padding: 8px 10px; text-align: start; border-bottom: 1px solid var(--settle-line); white-space: nowrap; }
  .dm-settle__table th { font-weight: 650; color: var(--settle-muted); font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; }
  .dm-settle__table tbody tr:last-child td { border-bottom: none; }
  .dm-settle__table tr.is-overdue td { color: var(--settle-warn); }
  .dm-settle__table tr.is-current td { font-weight: 650; }
  .dm-settle__notice { margin: 0; padding: 10px 14px; border-radius: 10px; font-size: 13px; font-weight: 600; line-height: 1.4; }
  .dm-settle__notice--ok { background: var(--dm-success-soft); color: var(--dm-ink); }
  .dm-settle__notice--error { background: var(--dm-danger-soft, #fcebea); color: var(--dm-danger, #b42318); }
  .dm-settle--hero .dm-settle__notice--ok { background: rgba(0, 207, 162, 0.2); color: #fff; }
  .dm-settle--hero .dm-settle__notice--error { background: rgba(255, 99, 71, 0.22); color: #fff; }
  .dm-settle__actions { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 16px; }
  .dm-settle__cta { min-height: 44px !important; padding: 0 20px !important; font-size: 0.95rem !important; }
  .dm-settle__hint { font-size: 12px; color: var(--settle-muted); flex: 1 1 240px; line-height: 1.4; }
  @media (max-width: 640px) {
    .dm-settle { padding: 16px; }
    .dm-settle__rows { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .dm-settle__cta { width: 100%; }
  }
`;
