import { useQuery } from '@tanstack/react-query';
import { ApiError, apiFetch } from '../../lib/api';
import { useOpsLabels } from '../../i18n/use-ops-labels';
import { formatQar } from '../../lib/format';

type RegisterPayload = {
  register: {
    application_id: string;
    total_units: number;
    customer_units: number;
    blox_units: number;
    vehicle_price: number;
    unit_nominal_value: number;
    matured: boolean;
    matured_at: string | null;
  } | null;
  entries: Array<{
    id: string;
    event_type: string;
    units_delta: number;
    customer_units_after: number;
    blox_units_after: number;
    created_at: string;
  }>;
};

export function RegisterTab({ applicationId }: { applicationId: string }) {
  const { t } = useOpsLabels();
  const { data, isLoading, error } = useQuery({
    queryKey: ['ops-app-register', applicationId],
    queryFn: () => apiFetch<RegisterPayload>(`/api/applications/${applicationId}/ownership-register`),
  });
  const register = data?.register;

  if (isLoading) {
    return <p>{t('ops.common.loading', { defaultValue: 'Loading…' })}</p>;
  }
  if (error) {
    const apiErr = error instanceof ApiError ? error : null;
    const notFound = apiErr?.status === 404;
    return (
      <p className="blox-text-muted">
        {notFound
          ? t('ops.workspace.registerUnavailable', {
              defaultValue:
                'Ownership register is not available on this environment yet. The API needs to be updated to the latest release.',
            })
          : ((error as Error).message || t('ops.common.error', { defaultValue: 'Something went wrong.' }))}
      </p>
    );
  }
  if (!register) {
    return (
      <p>
        {t('ops.workspace.registerEmpty', {
          defaultValue: 'No ownership register yet. Dual-write starts when the flag is on.',
        })}
      </p>
    );
  }

  return (
    <div className="blox-stack">
      <dl className="blox-facts">
        <div>
          <dt>{t('ops.workspace.col.customerShare')}</dt>
          <dd>
            {register.customer_units} / {register.total_units}
          </dd>
        </div>
        <div>
          <dt>{t('ops.workspace.col.bloxShare')}</dt>
          <dd>{register.blox_units}</dd>
        </div>
        <div>
          <dt>{t('ops.col.vehicle')}</dt>
          <dd>{formatQar(register.vehicle_price)}</dd>
        </div>
        <div>
          <dt>{t('ops.workspace.unitValue', { defaultValue: 'Unit value' })}</dt>
          <dd>{formatQar(register.unit_nominal_value)}</dd>
        </div>
      </dl>
      <table className="blox-table">
        <thead>
          <tr>
            <th>{t('ops.col.date', { defaultValue: 'Date' })}</th>
            <th>{t('ops.col.event', { defaultValue: 'Event' })}</th>
            <th>{t('ops.workspace.unitsDelta', { defaultValue: 'Units' })}</th>
            <th>{t('ops.workspace.col.customerShare')}</th>
            <th>{t('ops.workspace.col.bloxShare')}</th>
          </tr>
        </thead>
        <tbody>
          {(data?.entries ?? []).map((row) => (
            <tr key={row.id}>
              <td>{new Date(row.created_at).toLocaleString()}</td>
              <td>{row.event_type}</td>
              <td>{row.units_delta}</td>
              <td>{row.customer_units_after}</td>
              <td>{row.blox_units_after}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
