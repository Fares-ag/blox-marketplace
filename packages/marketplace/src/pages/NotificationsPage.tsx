import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { apiFetch, type NotificationItem, type PaginatedResponse } from '@drivemarket/shared';
import { CustomerPortalLayout } from '../components/CustomerPortalLayout';

type NotificationRow = NotificationItem;

export function NotificationsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => apiFetch<PaginatedResponse<NotificationRow>>('/api/notifications'),
  });
  const items = data?.items ?? [];

  const markRead = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/notifications/${id}/read`, { method: 'PATCH' }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  return (
    <CustomerPortalLayout
      metaTitle={t('notifications.title', { defaultValue: 'Notifications' })}
      eyebrow={t('nav.account')}
      title={t('notifications.title', { defaultValue: 'Notifications' })}
      lead={t('notifications.subtitle', { defaultValue: 'Updates on your financing applications' })}
      contentMax="narrow"
    >
      {isLoading && <p>{t('vehicles.loading')}</p>}
      {error && <p style={{ color: 'var(--dm-danger)' }}>{(error as Error).message}</p>}

      {!isLoading && !items.length && (
        <p style={{ color: 'var(--dm-slate-600)' }}>
          {t('notifications.empty', { defaultValue: 'No notifications yet.' })}
        </p>
      )}

      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 12 }}>
        {items.map((n) => (
          <li
            key={n.id}
            style={{
              padding: 16,
              borderRadius: 12,
              border: '1px solid var(--dm-slate-200)',
              background: n.read_at ? 'var(--dm-surface)' : 'var(--dm-steel-soft)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <strong>{n.title}</strong>
              <span style={{ fontSize: 13, color: 'var(--dm-slate-600)' }}>
                {new Date(n.created_at).toLocaleString()}
              </span>
            </div>
            <p style={{ margin: '8px 0 0', fontSize: 14, lineHeight: 1.5 }}>{n.body}</p>
            <div style={{ display: 'flex', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
              {n.link_path && (
                <Link
                  to={n.link_path}
                  onClick={() => {
                    if (!n.read_at) markRead.mutate(n.id);
                  }}
                >
                  {t('notifications.view', { defaultValue: 'View' })}
                </Link>
              )}
              {!n.read_at && (
                <button
                  type="button"
                  className="dm-linkbtn"
                  disabled={markRead.isPending}
                  onClick={() => markRead.mutate(n.id)}
                >
                  {t('notifications.markRead', { defaultValue: 'Mark read' })}
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </CustomerPortalLayout>
  );
}
