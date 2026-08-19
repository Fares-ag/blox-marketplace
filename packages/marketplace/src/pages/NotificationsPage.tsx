import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '@drivemarket/shared';
import { MarketplaceNav } from '../components/MarketplaceNav';

type NotificationRow = {
  id: string;
  title: string;
  body: string;
  linkPath: string | null;
  readAt: string | null;
  createdAt: string;
};

export function NotificationsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => apiFetch<NotificationRow[]>('/api/notifications'),
  });

  const markRead = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/notifications/${id}/read`, { method: 'PATCH' }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  return (
    <div style={{ background: 'var(--dm-canvas)', minHeight: '100vh' }}>
      <div style={{ background: 'var(--dm-graphite-900)', height: 72 }}>
        <MarketplaceNav variant="solid" />
      </div>
      <div style={{ padding: 32, maxWidth: 720, margin: '0 auto' }}>
        <p style={{ margin: '0 0 16px' }}>
          <Link to="/app/dashboard">← {t('nav.account')}</Link>
        </p>
        <h1 style={{ margin: '0 0 8px', fontFamily: 'var(--dm-font-display)' }}>
          {t('notifications.title', { defaultValue: 'Notifications' })}
        </h1>
        <p style={{ margin: '0 0 24px', color: 'var(--dm-slate-600)' }}>
          {t('notifications.subtitle', { defaultValue: 'Updates on your financing applications' })}
        </p>

        {isLoading && <p>{t('vehicles.loading')}</p>}
        {error && <p style={{ color: 'var(--dm-danger)' }}>{(error as Error).message}</p>}

        {!isLoading && !data?.length && (
          <p style={{ color: 'var(--dm-slate-600)' }}>
            {t('notifications.empty', { defaultValue: 'No notifications yet.' })}
          </p>
        )}

        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 12 }}>
          {(data ?? []).map((n) => (
            <li
              key={n.id}
              style={{
                padding: 16,
                borderRadius: 12,
                border: '1px solid var(--dm-slate-200)',
                background: n.readAt ? 'var(--dm-surface)' : 'var(--dm-steel-soft)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <strong>{n.title}</strong>
                <span style={{ fontSize: 13, color: 'var(--dm-slate-600)' }}>
                  {new Date(n.createdAt).toLocaleString()}
                </span>
              </div>
              <p style={{ margin: '8px 0 0', fontSize: 14, lineHeight: 1.5 }}>{n.body}</p>
              <div style={{ display: 'flex', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
                {n.linkPath && (
                  <Link
                    to={n.linkPath}
                    onClick={() => {
                      if (!n.readAt) markRead.mutate(n.id);
                    }}
                  >
                    {t('notifications.view', { defaultValue: 'View' })}
                  </Link>
                )}
                {!n.readAt && (
                  <button
                    type="button"
                    className="dm-btn-ghost"
                    style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0, font: 'inherit' }}
                    onClick={() => markRead.mutate(n.id)}
                  >
                    {t('notifications.markRead', { defaultValue: 'Mark read' })}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
