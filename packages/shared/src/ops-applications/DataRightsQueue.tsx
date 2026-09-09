import { useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { apiFetch } from '../lib/api';
import { useOpsLabels } from '../i18n/use-ops-labels';
import { usePortalBasePath, withPortalBase } from '../ops-ui-v2/PortalBasePath';
import { ConfirmDialog, OpsDetailGrid, OpsListPage, OpsTab, OpsTabs, OpsTextarea, OpsToolbar, Table, type Column } from '../ops-ui-v2';
import { OpsDangerButton, OpsPrimaryButton, OpsSecondaryButton, OpsStatusPill } from '../components/ops-ui';
import type { DataRightsRequestDto, DataRightsRequestStatusDto } from '../types/customer-platform';
import {
  DATA_RIGHTS_KIND_VARIANT,
  DATA_RIGHTS_STATUS_VARIANT,
  dataRightsMetrics,
  dataRightsTransitions,
  dueState,
  normalizeDataRightsList,
  sortDataRights,
} from './data-rights';
import type { DataRightsListResponse } from './types';

const TABS = ['open', 'in_progress', 'completed', 'rejected', 'all'] as const;
type Tab = (typeof TABS)[number];

export const DATA_RIGHTS_KEY = ['ops-data-rights'];

function dataRightsListPath(tab: Tab): string {
  return tab === 'all' ? '/api/ops/data-rights' : `/api/ops/data-rights?status=${tab}`;
}

function DueBadge({ dueAt, done }: { dueAt: string | null; done: boolean }) {
  const { t } = useOpsLabels();
  const due = dueState(dueAt);
  if (done) return <span className="blox-muted">{dueAt ? new Date(dueAt).toLocaleDateString() : '—'}</span>;
  const label =
    due.kind === 'overdue'
      ? t('adminOps.dataRights.due.overdue', { days: due.days })
      : due.kind === 'today'
        ? t('adminOps.dataRights.due.today')
        : due.kind === 'soon'
          ? t('adminOps.dataRights.due.soon', { days: due.days })
          : due.kind === 'later'
            ? t('adminOps.dataRights.due.later', { date: dueAt ? new Date(dueAt).toLocaleDateString() : '' })
            : t('adminOps.dataRights.due.none');
  return <OpsStatusPill label={label} variant={due.tone} />;
}

function customerLabel(row: DataRightsRequestDto, fallback: string): string {
  return row.customer?.name || row.customer?.email || fallback;
}

/**
 * Data-rights queue (admin / super-admin): access, correction, deletion and
 * consent-withdrawal requests with the 30-day due badge, a detail card for the
 * selected request and the transition actions (`POST /api/ops/data-rights/:id/transition`).
 * The selected request is the `:id` route segment (`/data-rights/<id>`, the link the
 * privacy team receives in notifications); `?id=` is accepted too.
 */
export function DataRightsQueuePage() {
  const { t } = useOpsLabels();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { id: routeId } = useParams();
  const base = usePortalBasePath();
  const dataRightsRoute = withPortalBase('/data-rights', base);
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('status');
  const tab: Tab = (TABS as readonly string[]).includes(tabParam ?? '') ? (tabParam as Tab) : 'open';
  const selectedId = routeId ?? searchParams.get('id');
  const [dialog, setDialog] = useState<{ status: 'completed' | 'rejected' } | null>(null);
  const [note, setNote] = useState('');

  const list = useQuery({
    queryKey: [...DATA_RIGHTS_KEY, tab],
    queryFn: () => apiFetch<DataRightsListResponse>(dataRightsListPath(tab)),
    retry: false,
  });
  // Metrics span every status, so they come from the unfiltered list (shared with the "All" tab).
  const all = useQuery({
    queryKey: [...DATA_RIGHTS_KEY, 'all'],
    queryFn: () => apiFetch<DataRightsListResponse>(dataRightsListPath('all')),
    retry: false,
  });

  const rows = useMemo(() => sortDataRights(normalizeDataRightsList(list.data)), [list.data]);
  const allRows = useMemo(() => normalizeDataRightsList(all.data), [all.data]);
  const metrics = useMemo(() => dataRightsMetrics(allRows), [allRows]);
  const selected = rows.find((r) => r.id === selectedId) ?? allRows.find((r) => r.id === selectedId) ?? null;

  function setParam(key: string, value: string | null) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value) next.set(key, value);
      else next.delete(key);
      return next;
    });
  }
  function selectRow(id: string) {
    const params = new URLSearchParams(searchParams);
    params.delete('id');
    const search = params.toString();
    navigate(`${dataRightsRoute}/${id}${search ? `?${search}` : ''}`);
  }

  const transition = useMutation({
    mutationFn: (payload: { id: string; status: DataRightsRequestStatusDto; resolution_note?: string }) =>
      apiFetch(`/api/ops/data-rights/${payload.id}/transition`, {
        method: 'POST',
        body: JSON.stringify({
          status: payload.status,
          ...(payload.resolution_note ? { resolution_note: payload.resolution_note } : {}),
        }),
      }),
    onSuccess: () => {
      toast.success(t('adminOps.dataRights.updated'));
      setDialog(null);
      setNote('');
      void qc.invalidateQueries({ queryKey: DATA_RIGHTS_KEY });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const columns: Column<DataRightsRequestDto>[] = useMemo(
    () => [
      {
        id: 'customer',
        cardTitle: true,
        label: t('adminOps.dataRights.colCustomer'),
        format: (_, r) => (
          <span className="blox-cell-stack">
            <button type="button" className="blox-link-reset" onClick={() => selectRow(r.id)}>
              {customerLabel(r, t('adminOps.dataRights.customerUnknown'))}
            </button>
            {r.customer?.email && r.customer?.name && <small className="blox-table__id">{r.customer.email}</small>}
          </span>
        ),
      },
      {
        id: 'kind',
        label: t('adminOps.dataRights.colKind'),
        format: (_, r) => (
          <span className="blox-cell-row blox-cell-row--wrap">
            <OpsStatusPill label={t(`adminOps.dataRights.kind.${r.kind}`, { defaultValue: r.kind })} variant={DATA_RIGHTS_KIND_VARIANT[r.kind] ?? 'neutral'} />
            {r.consent_code && <small className="blox-table__id">{r.consent_code.replace(/_/g, ' ')}</small>}
          </span>
        ),
      },
      {
        id: 'status',
        cardStatus: true,
        label: t('adminOps.dataRights.colStatus'),
        format: (_, r) => (
          <OpsStatusPill label={t(`adminOps.dataRights.status.${r.status}`, { defaultValue: r.status })} variant={DATA_RIGHTS_STATUS_VARIANT[r.status] ?? 'neutral'} />
        ),
      },
      {
        id: 'created_at',
        sortable: true,
        label: t('adminOps.dataRights.colCreated'),
        format: (_, r) => new Date(r.created_at).toLocaleDateString(),
      },
      {
        id: 'due_at',
        sortable: true,
        label: t('adminOps.dataRights.colDue'),
        sortValue: (r) => r.due_at ?? '',
        format: (_, r) => <DueBadge dueAt={r.due_at} done={r.status === 'completed' || r.status === 'rejected'} />,
      },
      {
        id: 'handled_by',
        hideOnCard: true,
        label: t('adminOps.dataRights.colHandledBy'),
        format: (_, r) => r.handled_by_name ?? '—',
      },
    ],
    [t, dataRightsRoute, searchParams],
  );

  const detailTitle = selected
    ? `${t(`adminOps.dataRights.kind.${selected.kind}`, { defaultValue: selected.kind })} · ${customerLabel(selected, t('adminOps.dataRights.customerUnknown'))}`
    : t('adminOps.dataRights.detailTitle');
  const next = selected ? dataRightsTransitions(selected.status) : [];
  const dialogBody =
    dialog?.status === 'rejected'
      ? t('adminOps.dataRights.rejectBody')
      : selected?.kind === 'deletion'
        ? t('adminOps.dataRights.completeDeletionBody')
        : selected?.kind === 'consent_withdrawal'
          ? t('adminOps.dataRights.completeWithdrawalBody')
          : t('adminOps.dataRights.completeBody');

  return (
    <OpsListPage
      title={t('adminOps.dataRights.title')}
      subtitle={t('adminOps.dataRights.subtitle')}
      metrics={[
        { label: t('adminOps.dataRights.metrics.open'), value: String(metrics.open) },
        { label: t('adminOps.dataRights.metrics.overdue'), value: String(metrics.overdue) },
        { label: t('adminOps.dataRights.metrics.dueSoon'), value: String(metrics.dueSoon) },
      ]}
      error={list.error ? (list.error as Error).message : undefined}
      toolbar={
        <OpsToolbar
          tabs={
            <OpsTabs value={tab} onChange={(_, value) => setParam('status', value === 'open' ? null : String(value))} variant="scrollable">
              {TABS.map((value) => (
                <OpsTab key={value} value={value} label={t(`adminOps.dataRights.tabs.${value}`)} />
              ))}
            </OpsTabs>
          }
        />
      }
    >
      <OpsDetailGrid
        main={
          <Table
            columns={columns}
            rows={rows}
            loading={list.isLoading}
            rowKey={(r) => r.id}
            onRowClick={(r) => selectRow(r.id)}
            emptyMessage={t('adminOps.dataRights.empty')}
            caption={t('adminOps.dataRights.slaNote')}
          />
        }
        aside={
          <section className="blox-detail-section">
            <h2 className="blox-panel__title">
              {detailTitle}
              {selected && (
                <span className="blox-panel__title-aside">
                  <OpsStatusPill
                    label={t(`adminOps.dataRights.status.${selected.status}`, { defaultValue: selected.status })}
                    variant={DATA_RIGHTS_STATUS_VARIANT[selected.status] ?? 'neutral'}
                  />
                </span>
              )}
            </h2>
            {!selected ? (
              <p className="blox-muted">{t('adminOps.dataRights.selectRow')}</p>
            ) : (
              <>
                <dl className="blox-kv">
                  <dt>{t('adminOps.dataRights.colCustomer')}</dt>
                  <dd>
                    {customerLabel(selected, t('adminOps.dataRights.customerUnknown'))}
                    {selected.customer?.email && selected.customer?.name ? (
                      <>
                        <br />
                        <small className="blox-muted">{selected.customer.email}</small>
                      </>
                    ) : null}
                  </dd>
                  {selected.consent_code && (
                    <>
                      <dt>{t('adminOps.dataRights.consentCode')}</dt>
                      <dd>{selected.consent_code.replace(/_/g, ' ')}</dd>
                    </>
                  )}
                  <dt>{t('adminOps.dataRights.colDue')}</dt>
                  <dd>
                    <DueBadge dueAt={selected.due_at} done={selected.status === 'completed' || selected.status === 'rejected'} />
                  </dd>
                </dl>
                <h3 className="blox-panel__subtitle">{t('adminOps.dataRights.details')}</h3>
                <p className="blox-break" style={{ whiteSpace: 'pre-wrap' }}>
                  {selected.details?.trim() ? selected.details : <span className="blox-muted">{t('adminOps.dataRights.noDetails')}</span>}
                </p>
                <h3 className="blox-panel__subtitle">{t('adminOps.dataRights.timeline')}</h3>
                <ol className="blox-tl">
                  <li>
                    <span className="blox-tl__what">{t('adminOps.dataRights.received', { date: new Date(selected.created_at).toLocaleString() })}</span>
                  </li>
                  {selected.due_at && (
                    <li>
                      <span className="blox-tl__what">{t('adminOps.dataRights.dueAt', { date: new Date(selected.due_at).toLocaleDateString() })}</span>
                    </li>
                  )}
                  {selected.handled_at && (
                    <li>
                      <span className="blox-tl__what">
                        {t('adminOps.dataRights.handled', { date: new Date(selected.handled_at).toLocaleString() })}
                        {selected.handled_by_name ? ` ${t('adminOps.dataRights.handledBy', { name: selected.handled_by_name })}` : ''}
                      </span>
                    </li>
                  )}
                </ol>
                {selected.resolution_note && (
                  <>
                    <h3 className="blox-panel__subtitle">{t('adminOps.dataRights.resolutionNote')}</h3>
                    <p className="blox-break" style={{ whiteSpace: 'pre-wrap' }}>
                      {selected.resolution_note}
                    </p>
                  </>
                )}
                {next.length > 0 && (
                  <div className="blox-inline-actions blox-inline-actions--wrap">
                    {next.includes('in_progress') && (
                      <OpsSecondaryButton
                        type="button"
                        size="sm"
                        disabled={transition.isPending}
                        onClick={() => transition.mutate({ id: selected.id, status: 'in_progress' })}
                      >
                        {t('adminOps.dataRights.start')}
                      </OpsSecondaryButton>
                    )}
                    {next.includes('completed') && (
                      <OpsPrimaryButton type="button" size="sm" disabled={transition.isPending} onClick={() => setDialog({ status: 'completed' })}>
                        {t('adminOps.dataRights.complete')}
                      </OpsPrimaryButton>
                    )}
                    {next.includes('rejected') && (
                      <OpsDangerButton type="button" size="sm" disabled={transition.isPending} onClick={() => setDialog({ status: 'rejected' })}>
                        {t('adminOps.dataRights.reject')}
                      </OpsDangerButton>
                    )}
                  </div>
                )}
              </>
            )}
          </section>
        }
      />
      <ConfirmDialog
        open={!!dialog && !!selected}
        title={dialog?.status === 'rejected' ? t('adminOps.dataRights.rejectTitle') : t('adminOps.dataRights.completeTitle')}
        message={dialogBody}
        variant={dialog?.status === 'rejected' || selected?.kind === 'deletion' ? 'danger' : 'info'}
        confirmText={dialog?.status === 'rejected' ? t('adminOps.dataRights.reject') : t('adminOps.dataRights.complete')}
        cancelText={t('adminOps.common.cancel')}
        busy={transition.isPending}
        confirmDisabled={dialog?.status === 'rejected' && !note.trim()}
        onCancel={() => {
          setDialog(null);
          setNote('');
        }}
        onConfirm={() => {
          if (!dialog || !selected) return;
          transition.mutate({ id: selected.id, status: dialog.status, resolution_note: note.trim() || undefined });
        }}
      >
        <OpsTextarea
          label={t('adminOps.dataRights.resolutionNote')}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          required={dialog?.status === 'rejected'}
          optionalLabel={dialog?.status === 'rejected' ? undefined : t('adminOps.common.optional')}
          fullWidth
        />
        <p className="blox-field__hint">
          {dialog?.status === 'rejected' ? t('adminOps.dataRights.noteRequired') : t('adminOps.dataRights.resolutionNoteHint')}
        </p>
      </ConfirmDialog>
    </OpsListPage>
  );
}
