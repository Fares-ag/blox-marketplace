import { useOpsLabels } from '../../i18n/use-ops-labels';
import type { WorkspacePanelProps } from './types';

export function LogsTab({ data }: Pick<WorkspacePanelProps, 'data'>) {
  const { t } = useOpsLabels();
  const logs = data.activity_logs ?? [];
  return (
    <section className="blox-detail-section">
      <h2 className="blox-panel__title">{t('ops.workspace.tab.logs')}</h2>
      {logs.length === 0 ? (
        <p className="blox-decision__none">{t('ops.common.noResults')}</p>
      ) : (
        <ol className="blox-tl">
          {logs.map((log) => (
            <li key={log.id}>
              <span className="blox-tl__what">
                {log.action.replace(/_/g, ' ')}
                {log.from_value || log.to_value ? ` · ${log.from_value ?? ''} → ${log.to_value ?? ''}` : ''}
              </span>
              <span className="blox-tl__when">
                {new Date(log.created_at).toLocaleString()} · {log.actor_email ?? 'system'}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
