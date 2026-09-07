import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ApiError, apiFetch, apiFileUrl, DEFAULT_PAGE_SIZE } from '../lib/api';
import { formatQar } from '../lib/format';
import { applicationOpsPillVariant } from '../config/status-styles';
import { useOpsLabels } from '../i18n/use-ops-labels';
import { OpsDetailGrid, OpsDetailPage, OpsListPage, OpsTab, OpsTabs, OpsToolbar, PageSkeleton, Table, type Column } from '../ops-ui-v2';
import { OpsStatusPill } from '../components/ops-ui';
import { Alert } from '../ops-ui-v2';
import type { PartnerApplicationDto } from '../types/customer-platform';
import { InfoItem } from './CustomerInfoOverview';
import { creditPathVariant } from './credit-decision';
import {
  PARTNER_STATUS_TABS,
  filterPartnerApplications,
  normalizePartnerList,
  normalizePartnerSummary,
  partnerListPath,
  partnerStatusesFor,
  partnerSummaryCount,
  type PartnerStatusTabId,
} from './partner-view';
import { CreditAssessmentPanel } from './workspace/CreditAssessmentPanel';
import type { PartnerApplicationListResponse } from './types';

export const PARTNER_APPLICATIONS_KEY = ['partner-applications'];
export const PARTNER_SUMMARY_KEY = ['partner-summary'];

/** `GET /api/partner/summary` — counts by status for the partner viewer's institution. */
export function usePartnerSummary(enabled = true) {
  return useQuery({
    queryKey: PARTNER_SUMMARY_KEY,
    queryFn: () => apiFetch<unknown>('/api/partner/summary'),
    select: normalizePartnerSummary,
    enabled,
    retry: false,
  });
}

function vehicleLabel(app: PartnerApplicationDto): string {
  return [app.vehicle?.make, app.vehicle?.model, app.vehicle?.model_year].filter(Boolean).join(' ') || app.id.slice(0, 8);
}

function residencyPill(residency: 'qatari' | 'expat' | null, t: (key: string) => string) {
  if (!residency) return '—';
  return (
    <OpsStatusPill
      label={residency === 'qatari' ? t('dealerOps.intake.residencyQatari') : t('dealerOps.intake.residencyExpat')}
      variant={residency === 'qatari' ? 'success' : 'info'}
    />
  );
}

/**
 * Finance-partner list (`partner_viewer`): applications tagged to the viewer's
 * institution from submission onwards, read-only. Identity fields arrive masked
 * from the API; the shell search filters the loaded page client-side.
 */
export function PartnerApplicationsList({ basePath = '/partner' }: { basePath?: string }) {
  const { t, applicationStatus } = useOpsLabels();
  const [searchParams] = useSearchParams();
  const q = searchParams.get('q') ?? '';
  const [tab, setTab] = useState<PartnerStatusTabId>('all');
  const [page, setPage] = useState(0);

  const list = useQuery({
    queryKey: [...PARTNER_APPLICATIONS_KEY, tab, page],
    queryFn: () => apiFetch<PartnerApplicationListResponse>(partnerListPath({ tab, page, pageSize: DEFAULT_PAGE_SIZE })),
  });
  const summary = usePartnerSummary();
  const { items, total } = useMemo(() => normalizePartnerList(list.data), [list.data]);
  const visible = useMemo(() => filterPartnerApplications(items, q), [items, q]);
  const counts = summary.data ?? { by_status: {}, total: 0 };
  // 403 `partner_not_assigned`: the viewer account has no finance provider yet.
  const listError = list.error
    ? list.error instanceof ApiError && list.error.code === 'partner_not_assigned'
      ? t('dealerOps.partnerView.notAssigned')
      : (list.error as Error).message
    : undefined;

  const columns: Column<PartnerApplicationDto>[] = useMemo(
    () => [
      {
        id: 'vehicle',
        cardTitle: true,
        label: t('dealerOps.partnerView.vehicle'),
        format: (_, a) => (
          <span className="blox-cell-stack">
            <Link to={`${basePath}/${a.id}`}>{vehicleLabel(a)}</Link>
            <small className="blox-table__id">{a.id.slice(0, 10)}…</small>
          </span>
        ),
      },
      {
        id: 'customer',
        label: t('dealerOps.partnerView.customer'),
        format: (_, a) => (
          <span className="blox-cell-stack">
            <span>{a.customer?.name ?? '—'}</span>
            <small className="blox-table__mono">{a.customer?.qid_masked ?? '—'}</small>
          </span>
        ),
      },
      {
        id: 'residency',
        hideOnCard: true,
        label: t('dealerOps.partnerView.residency'),
        format: (_, a) => residencyPill(a.customer?.residency ?? null, t),
      },
      {
        id: 'financing',
        numeric: true,
        label: t('dealerOps.partnerView.financing'),
        format: (_, a) =>
          a.financing?.financed_amount != null
            ? `${formatQar(a.financing.financed_amount)} · ${a.financing.tenure_months ?? '—'} × ${a.financing.monthly != null ? formatQar(a.financing.monthly) : '—'}`
            : '—',
      },
      {
        id: 'status',
        cardStatus: true,
        sortable: true,
        label: t('ops.col.status'),
        format: (_, a) => <OpsStatusPill label={applicationStatus(a.status)} variant={applicationOpsPillVariant(a.status)} />,
      },
      {
        id: 'credit',
        label: t('dealerOps.partnerView.creditPath'),
        format: (_, a) =>
          a.credit_assessment ? (
            <OpsStatusPill
              label={t(`dealerOps.creditAssessment.path.${a.credit_assessment.path}`, { defaultValue: a.credit_assessment.path })}
              variant={creditPathVariant(a.credit_assessment.path)}
            />
          ) : (
            '—'
          ),
      },
      {
        id: 'dealer',
        hideOnCard: true,
        label: t('dealerOps.partnerView.dealer'),
        format: (_, a) => [a.company_name, a.branch_name].filter(Boolean).join(' · ') || '—',
      },
      {
        id: 'submitted_at',
        sortable: true,
        label: t('dealerOps.partnerView.submitted'),
        format: (_, a) => (a.submitted_at ? new Date(a.submitted_at).toLocaleDateString() : '—'),
      },
    ],
    [t, basePath, applicationStatus],
  );

  return (
    <OpsListPage
      title={t('dealerOps.partnerView.title')}
      subtitle={t('dealerOps.partnerView.subtitle')}
      metrics={[
        { label: t('dealerOps.partnerView.summary.total'), value: String(counts.total) },
        { label: t('dealerOps.partnerView.summary.review'), value: String(partnerSummaryCount(counts, partnerStatusesFor('review'))) },
        { label: t('dealerOps.partnerView.summary.active'), value: String(partnerSummaryCount(counts, partnerStatusesFor('active'))) },
        { label: t('dealerOps.partnerView.summary.completed'), value: String(partnerSummaryCount(counts, partnerStatusesFor('completed'))) },
      ]}
      error={listError}
      toolbar={
        <OpsToolbar
          tabs={
            <OpsTabs
              value={tab}
              onChange={(_, next) => {
                setTab(next as PartnerStatusTabId);
                setPage(0);
              }}
              variant="scrollable"
            >
              {PARTNER_STATUS_TABS.map((entry) => (
                <OpsTab key={entry.id} value={entry.id} label={t(`dealerOps.partnerView.tabs.${entry.id}`)} />
              ))}
            </OpsTabs>
          }
        />
      }
    >
      <Table
        columns={columns}
        rows={visible}
        loading={list.isLoading}
        rowKey={(a) => a.id}
        page={page}
        rowsPerPage={DEFAULT_PAGE_SIZE}
        totalRows={q ? visible.length : total}
        onPageChange={setPage}
        emptyMessage={t('dealerOps.partnerView.empty')}
      />
    </OpsListPage>
  );
}

/** Read-only detail for one tagged application — masked applicant, financing, stored credit assessment, documents. */
export function PartnerApplicationDetail({ id, backTo = '/partner' }: { id: string; backTo?: string }) {
  const { t, applicationStatus } = useOpsLabels();
  const { data, error, isLoading } = useQuery({
    queryKey: ['partner-application', id],
    queryFn: () => apiFetch<PartnerApplicationDto>(`/api/partner/applications/${id}`),
    enabled: !!id,
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="blox-page">
        <PageSkeleton variant="detail" />
      </div>
    );
  }
  if (!data) {
    const notFound = error instanceof ApiError && (error.status === 404 || error.status === 403);
    return (
      <OpsDetailPage backTo={backTo} backLabel={t('dealerOps.partnerView.detailBack')} title={t('dealerOps.partnerView.title')}>
        <Alert variant="error">{notFound ? t('dealerOps.partnerView.notFound') : ((error as Error | null)?.message ?? t('dealerOps.partnerView.notFound'))}</Alert>
      </OpsDetailPage>
    );
  }

  const financing = data.financing ?? { financed_amount: null, tenure_months: null, monthly: null, down_payment_pct: null };
  const idLine = [data.id, data.company_name, data.branch_name].filter(Boolean).join(' · ');

  return (
    <OpsDetailPage
      backTo={backTo}
      backLabel={t('dealerOps.partnerView.detailBack')}
      title={`${vehicleLabel(data)} · ${data.customer?.name ?? '—'}`}
      idLabel={idLine}
      status={{ label: applicationStatus(data.status), variant: applicationOpsPillVariant(data.status) }}
    >
      <OpsDetailGrid
        main={
          <>
            <section className="blox-detail-section">
              <h2 className="blox-panel__title">{t('dealerOps.partnerView.customer')}</h2>
              <InfoItem label={t('ops.col.name')} value={data.customer?.name} />
              <InfoItem
                label={t('dealerOps.partnerView.qid')}
                value={
                  <span className="blox-cell-row">
                    <span className="blox-table__mono">{data.customer?.qid_masked ?? '—'}</span>
                    <OpsStatusPill label={t('privacy.masked')} variant="neutral" />
                  </span>
                }
              />
              <InfoItem label={t('dealerOps.partnerView.nationality')} value={data.customer?.nationality} />
              <InfoItem label={t('dealerOps.partnerView.residency')} value={residencyPill(data.customer?.residency ?? null, t)} />
              <p className="blox-field__hint">{t('dealerOps.partnerView.maskedNote')}</p>
            </section>

            <section className="blox-detail-section">
              <h2 className="blox-panel__title">{t('dealerOps.partnerView.financing')}</h2>
              <dl className="blox-kv blox-kv--two">
                <dt>{t('ops.credit.vehiclePrice')}</dt>
                <dd className="blox-kv__num">{data.vehicle?.price != null ? formatQar(data.vehicle.price) : '—'}</dd>
                <dt>{t('dealerOps.partnerView.financedAmount')}</dt>
                <dd className="blox-kv__num">{financing.financed_amount != null ? formatQar(financing.financed_amount) : '—'}</dd>
                <dt>{t('dealerOps.partnerView.tenure')}</dt>
                <dd>
                  {financing.tenure_months
                    ? t('ops.common.months', { count: financing.tenure_months, defaultValue: `${financing.tenure_months} months` })
                    : '—'}
                </dd>
                <dt>{t('dealerOps.partnerView.monthly')}</dt>
                <dd className="blox-kv__num">{financing.monthly != null ? formatQar(financing.monthly) : '—'}</dd>
                <dt>{t('dealerOps.partnerView.downPayment')}</dt>
                <dd className="blox-kv__num">{financing.down_payment_pct != null ? `${financing.down_payment_pct} %` : '—'}</dd>
              </dl>
            </section>

            {data.credit_assessment ? (
              <CreditAssessmentPanel assessment={data.credit_assessment} showApprover={false} />
            ) : (
              <section className="blox-detail-section">
                <h2 className="blox-panel__title">{t('dealerOps.creditAssessment.title')}</h2>
                <p className="blox-muted">{t('dealerOps.partnerView.noAssessment')}</p>
              </section>
            )}

            <section className="blox-detail-section">
              <h2 className="blox-panel__title">{t('dealerOps.partnerView.documents')}</h2>
              {data.documents.length === 0 ? (
                <p className="blox-muted">{t('dealerOps.partnerView.documentsEmpty')}</p>
              ) : (
                <ul className="blox-doc-rows">
                  {data.documents.map((doc) => (
                    <li key={doc.id} className="blox-doc-row">
                      <span className="blox-doc-row__ic" aria-hidden>
                        {doc.original_name?.toLowerCase().endsWith('.pdf') ? 'PDF' : 'DOC'}
                      </span>
                      <span className="blox-doc-row__name">
                        <strong>
                          {t(`application.docCategory.${doc.category}`, {
                            defaultValue: t(`ops.wizard.doc.${doc.category}`, { defaultValue: doc.category.replace(/_/g, ' ') }),
                          })}
                        </strong>
                        <br />
                        <small className="blox-muted">
                          {doc.original_name ?? ''}
                          {doc.created_at ? ` · ${t('dealerOps.docs.uploadedOn', { date: new Date(doc.created_at).toLocaleDateString() })}` : ''}
                        </small>
                      </span>
                      <a
                        className="blox-btn blox-btn--ghost blox-btn--sm"
                        href={apiFileUrl(`/partner/applications/${data.id}/documents/${doc.id}/file`)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {t('dealerOps.partnerView.view')}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        }
        aside={
          <section className="blox-detail-section">
            <h2 className="blox-panel__title">{t('dealerOps.partnerView.detailTitle', { defaultValue: t('ops.credit.summary') })}</h2>
            <dl className="blox-kv">
              <dt>{t('dealerOps.partnerView.dealer')}</dt>
              <dd>{data.company_name || '—'}</dd>
              <dt>{t('dealerOps.partnerView.branch')}</dt>
              <dd>{data.branch_name ?? '—'}</dd>
              <dt>{t('dealerOps.partnerView.submitted')}</dt>
              <dd>{data.submitted_at ? new Date(data.submitted_at).toLocaleString() : '—'}</dd>
              <dt>{t('dealerOps.partnerView.updated')}</dt>
              <dd>{data.updated_at ? new Date(data.updated_at).toLocaleString() : '—'}</dd>
              <dt>{t('dealerOps.partnerView.consents')}</dt>
              <dd>
                {data.consents_completed_at ? (
                  <OpsStatusPill
                    label={t('dealerOps.partnerView.consentsComplete', { date: new Date(data.consents_completed_at).toLocaleDateString() })}
                    variant="success"
                  />
                ) : (
                  <OpsStatusPill label={t('dealerOps.partnerView.consentsPending')} variant="warning" />
                )}
              </dd>
              <dt>{t('dealerOps.partnerView.creditPath')}</dt>
              <dd>
                {data.credit_assessment ? (
                  <OpsStatusPill
                    label={t(`dealerOps.creditAssessment.path.${data.credit_assessment.path}`, { defaultValue: data.credit_assessment.path })}
                    variant={creditPathVariant(data.credit_assessment.path)}
                  />
                ) : (
                  '—'
                )}
              </dd>
            </dl>
          </section>
        }
      />
    </OpsDetailPage>
  );
}
