import { useQuery } from '@tanstack/react-query';
import { apiFetch, type SettlementQuoteDto } from '@drivemarket/shared';

/**
 * Early-settlement quote (`GET /api/applications/:id/settlement-quote`): the
 * principal still outstanding plus rent accrued to today, with future rent
 * forgiven. The customer's "settle early" action always goes through this
 * quote — the API refuses a bare "pay everything" without one
 * (`settlement_quote_required`).
 */

export const SETTLEMENT_ERROR_CODES = {
  quoteRequired: 'settlement_quote_required',
  overdueNotDeferrable: 'schedule_overdue_not_deferrable',
} as const;

export function settlementQuoteQueryKey(applicationId: string | null | undefined) {
  return ['app', applicationId ?? '', 'settlement-quote'] as const;
}

export function fetchSettlementQuote(applicationId: string): Promise<SettlementQuoteDto> {
  return apiFetch<SettlementQuoteDto>(`/api/applications/${encodeURIComponent(applicationId)}/settlement-quote`);
}

export function useSettlementQuote(applicationId: string | null | undefined, enabled = true) {
  return useQuery({
    queryKey: settlementQuoteQueryKey(applicationId),
    queryFn: () => fetchSettlementQuote(applicationId!),
    enabled: !!applicationId && enabled,
    retry: false,
    staleTime: 60_000,
  });
}

export function requestSettlement(applicationId: string): Promise<unknown> {
  return apiFetch(`/api/applications/${encodeURIComponent(applicationId)}/settlement-request`, { method: 'POST' });
}

/** Rows worth showing in the breakdown: everything not already paid off. */
export function outstandingQuoteRows(quote: SettlementQuoteDto): SettlementQuoteDto['rows'] {
  return quote.rows.filter((row) => row.kind !== 'settled');
}
