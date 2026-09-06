import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch, buildPaginationQuery, paginationWindow, OpsDataTable, OpsEmptyState, ExportButton, OpsListPage, OpsGhostButton, OpsToolbar, FilterPanel, type FilterConfig } from '@drivemarket/shared';

type ActivityLogRow = {
  id: string;
  actor_email: string | null;
  entity_type: string;
  entity_id: string;
  action: string;
  from_value: string | null;
  to_value: string | null;
  created_at: string;
  metadata?: unknown;
};

export function ActivityLogsPage() {
  const [page, setPage] = useState(0);
  const [entityType, setEntityType] = useState('');
  const [actorEmail, setActorEmail] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const qs = [
    buildPaginationQuery(page),
    entityType ? `entityType=${encodeURIComponent(entityType)}` : '',
    actorEmail ? `actorEmail=${encodeURIComponent(actorEmail)}` : '',
    fromDate ? `from=${encodeURIComponent(fromDate)}` : '',
    toDate ? `to=${encodeURIComponent(toDate)}` : '',
  ].filter(Boolean).join('&');
  const { data, error } = useQuery({
    queryKey: ['sa-logs', page, entityType, actorEmail, fromDate, toDate],
    queryFn: () =>
      apiFetch<{
        total: number;
        items: Array<{
          id: string;
          actor_email: string | null;
          entity_type: string;
          entity_id: string;
          action: string;
          from_value: string | null;
          to_value: string | null;
          created_at: string;
          metadata?: unknown;
        }>;
      }>(`/api/ops/activity-logs?${qs}`),
  });
  const [selected, setSelected] = useState<ActivityLogRow | null>(null);
  const { from, to, total } = paginationWindow(data?.total ?? 0, page);
  const filterConfigs: FilterConfig[] = [
    { id: 'actorEmail', label: 'Actor email', type: 'text' },
    { id: 'entityType', label: 'Entity type', type: 'text' },
    { id: 'fromDate', label: 'From (YYYY-MM-DD)', type: 'text' },
    { id: 'toDate', label: 'To (YYYY-MM-DD)', type: 'text' },
  ];
  const filterValues = { actorEmail, entityType, fromDate, toDate };

  return (
    <OpsListPage
      title="Activity logs"
      subtitle="Audit trail across ops actions"
      headerActions={<ExportButton data={(data?.items ?? []) as Record<string, unknown>[]} filename="activity-logs" />}
      error={error ? (error as Error).message : undefined}
      toolbar={
        <OpsToolbar
          filters={
            <FilterPanel
              filters={filterConfigs}
              values={filterValues}
              onChange={(next) => {
                setActorEmail(String(next.actorEmail ?? ''));
                setEntityType(String(next.entityType ?? ''));
                setFromDate(String(next.fromDate ?? ''));
                setToDate(String(next.toDate ?? ''));
                setPage(0);
              }}
              onClear={() => {
                setActorEmail('');
                setEntityType('');
                setFromDate('');
                setToDate('');
                setPage(0);
              }}
            />
          }
        />
      }
    >
      <OpsDataTable
        columns={['When', 'Actor', 'Action', 'Entity', 'Change']}
        pagination={{
          from,
          to,
          total,
          onPrev: () => setPage((p) => Math.max(0, p - 1)),
          onNext: () => setPage((p) => p + 1),
        }}
        empty={<OpsEmptyState title="No activity yet" body="Actions across the platform appear here." />}
        rows={(data?.items ?? []).map((l) => [
          <OpsGhostButton key="w" type="button" onClick={() => setSelected(l)}>
            {new Date(l.created_at).toLocaleString()}
          </OpsGhostButton>,
          l.actor_email ?? 'system',
          l.action,
          `${l.entity_type}:${l.entity_id.slice(0, 8)}`,
          l.from_value || l.to_value ? `${l.from_value ?? ''} → ${l.to_value ?? ''}` : '—',
        ])}
      />
      {selected && (
        <div
          className="blox-dialog-scrim"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setSelected(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setSelected(null);
          }}
        >
          <div className="blox-dialog blox-dialog--wide" role="dialog" aria-modal="true" aria-labelledby="sa-log-detail-title">
            <h3 id="sa-log-detail-title" className="blox-dialog__title">
              Log detail
            </h3>
            <p className="blox-dialog__message">
              {selected.action} · {selected.actor_email ?? 'system'} · {new Date(selected.created_at).toLocaleString()}
            </p>
            <div className="blox-dialog__body">
              <pre className="blox-pre">{JSON.stringify(selected.metadata ?? selected, null, 2)}</pre>
            </div>
            <div className="blox-dialog__actions">
              <OpsGhostButton type="button" autoFocus onClick={() => setSelected(null)}>
                Close
              </OpsGhostButton>
            </div>
          </div>
        </div>
      )}
    </OpsListPage>
  );
}
