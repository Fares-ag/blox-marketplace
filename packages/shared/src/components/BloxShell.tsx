import { useEffect, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Avatar,
  Badge,
  Box,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Popover,
  Typography,
  useMediaQuery,
} from '@mui/material';
import {
  AccountBalance,
  Assessment,
  Business,
  ChevronLeft,
  ChevronRight,
  Dashboard,
  DirectionsCar,
  Inventory2,
  ListAlt,
  LocalOffer,
  Logout,
  Menu as MenuIcon,
  Notifications as NotificationsIcon,
  People,
  ReceiptLong,
  RequestQuote,
  Settings,
  Shield,
} from '@mui/icons-material';
import { useAuthStore } from '../auth/auth-store';
import { getAppLocale, setAppLocale, type AppLocale } from '../i18n';
import { apiFetch } from '../lib/api';
import type { NotificationItem, PaginatedResponse } from '../types/domain';
import { theme } from '../config/theme';
import { bloxTokens } from '../config/blox-tokens';
import { BloxLogo } from './BloxLogo';
import { OpsSegmentedControl } from '../ops-ui-v2/OpsSegmentedControl';
import { usePortalBasePath, withPortalBase } from '../ops-ui-v2/PortalBasePath';
import '../styles/blox-ops.scss';

export interface BloxNavItem {
  to: string;
  label: string;
  icon?:
    | 'home'
    | 'inventory'
    | 'apps'
    | 'company'
    | 'quotes'
    | 'queue'
    | 'users'
    | 'logs'
    | 'system'
    | 'finance'
    | 'offers'
    | 'products'
    | 'ledgers'
    | 'promotions'
    | 'insurance'
    | 'packages'
    | 'settings';
}

interface BloxShellProps {
  title: string;
  nav: BloxNavItem[];
  children: ReactNode;
  homePaths?: string[];
}

function navIcon(kind?: BloxNavItem['icon']) {
  switch (kind) {
    case 'home':
      return <Dashboard fontSize="small" />;
    case 'inventory':
    case 'products':
      return <DirectionsCar fontSize="small" />;
    case 'apps':
    case 'queue':
      return <ListAlt fontSize="small" />;
    case 'company':
      return <Business fontSize="small" />;
    case 'quotes':
    case 'offers':
      return <RequestQuote fontSize="small" />;
    case 'users':
      return <People fontSize="small" />;
    case 'logs':
      return <ReceiptLong fontSize="small" />;
    case 'system':
      return <Settings fontSize="small" />;
    case 'finance':
    case 'ledgers':
      return <AccountBalance fontSize="small" />;
    case 'promotions':
      return <LocalOffer fontSize="small" />;
    case 'insurance':
      return <Shield fontSize="small" />;
    case 'packages':
      return <Inventory2 fontSize="small" />;
    case 'settings':
      return <Assessment fontSize="small" />;
    default:
      return <ListAlt fontSize="small" />;
  }
}

/**
 * Staff inbox for the `notifications` rows the API writes on submissions,
 * decisions and settlements. Polls the unread count; the list loads on open.
 * Links are portal-relative (`/applications/:id`) and get the portal base path.
 */
function ShellNotifications({ collapsed, onNavigated }: { collapsed: boolean; onNavigated?: () => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const portalBase = usePortalBasePath();
  const locale = getAppLocale();
  const user = useAuthStore((s) => s.user);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const open = Boolean(anchor);

  const unread = useQuery({
    queryKey: ['shell-notifications-unread'],
    queryFn: () => apiFetch<{ count: number }>('/api/notifications/unread-count'),
    enabled: !!user,
    refetchInterval: 60_000,
  });
  const list = useQuery({
    queryKey: ['shell-notifications'],
    queryFn: () => apiFetch<PaginatedResponse<NotificationItem>>('/api/notifications?limit=20'),
    enabled: !!user && open,
  });
  const markRead = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/notifications/${id}/read`, { method: 'PATCH' }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['shell-notifications'] });
      void qc.invalidateQueries({ queryKey: ['shell-notifications-unread'] });
    },
  });

  const count = unread.data?.count ?? 0;
  const items = list.data?.items ?? [];

  function openItem(item: NotificationItem) {
    if (!item.read_at) markRead.mutate(item.id);
    setAnchor(null);
    if (item.link_path) {
      navigate(withPortalBase(item.link_path, portalBase));
      onNavigated?.();
    }
  }

  return (
    <>
      <ListItemButton
        onClick={(e) => setAnchor(e.currentTarget)}
        aria-label={t('ops.shell.notifications')}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="blox-shell-notifications"
        sx={{
          borderRadius: 1,
          justifyContent: collapsed ? 'center' : 'flex-start',
          '&:hover': { bgcolor: 'rgba(255,255,255,0.08)' },
        }}
      >
        <ListItemIcon sx={{ color: 'rgba(255,255,255,0.8)', minWidth: collapsed ? 0 : 40 }}>
          <Badge badgeContent={count} color="error" max={99} overlap="circular">
            <NotificationsIcon fontSize="small" />
          </Badge>
        </ListItemIcon>
        {!collapsed && (
          <ListItemText
            primary={t('ops.shell.notifications')}
            secondary={count > 0 ? t('ops.shell.notificationsUnread', { count }) : undefined}
            slotProps={{ secondary: { sx: { color: 'rgba(255,255,255,0.65)' } } }}
          />
        )}
      </ListItemButton>
      <Popover
        open={open}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        slotProps={{ paper: { sx: { width: 380, maxWidth: '92vw', maxHeight: 520 } } }}
      >
        <Box
          sx={{
            px: 2,
            py: 1.5,
            borderBottom: '1px solid rgba(0,0,0,0.08)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 1,
          }}
        >
          <Typography variant="subtitle2">{t('ops.shell.notifications')}</Typography>
          {count > 0 && (
            <Typography variant="caption" color="text.secondary">
              {t('ops.shell.notificationsUnread', { count })}
            </Typography>
          )}
        </Box>
        {list.isLoading ? (
          <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
            {t('ops.shell.notificationsLoading')}
          </Typography>
        ) : items.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
            {t('ops.shell.notificationsEmpty')}
          </Typography>
        ) : (
          <List dense disablePadding>
            {items.map((item) => (
              <ListItem key={item.id} disablePadding divider>
                <ListItemButton
                  onClick={() => openItem(item)}
                  sx={{ alignItems: 'flex-start', bgcolor: item.read_at ? 'transparent' : 'rgba(0,207,162,0.08)' }}
                >
                  <ListItemText
                    primary={item.title}
                    secondary={[
                      item.body,
                      new Date(item.created_at).toLocaleString(locale === 'ar' ? 'ar-QA' : 'en-QA'),
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                    slotProps={{
                      primary: { sx: { fontWeight: item.read_at ? 400 : 600, fontSize: '0.875rem' } },
                      secondary: { sx: { fontSize: '0.75rem' } },
                    }}
                  />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        )}
      </Popover>
    </>
  );
}

export function BloxShell({ title, nav, children, homePaths = ['/'] }: BloxShellProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);
  const { t } = useTranslation();
  const locale = getAppLocale();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [collapsed, setCollapsed] = useState(isMobile);

  useEffect(() => {
    setCollapsed(isMobile);
  }, [isMobile]);

  function isActive(path: string) {
    if (homePaths.includes(path)) {
      return location.pathname === path || (path !== '/' && location.pathname.startsWith(`${path}/`));
    }
    if (path === '/') return location.pathname === '/';
    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  }

  const drawerWidth = collapsed ? (isMobile ? 0 : 80) : 280;

  return (
    <Box className="blox-ops side-panel" sx={{ display: 'flex', minHeight: '100vh', background: 'transparent' }}>
      {collapsed && (
        <IconButton
          onClick={() => setCollapsed(false)}
          aria-label={t('ops.shell.menu')}
          sx={{
            position: 'fixed',
            left: 8,
            top: 16,
            zIndex: 1200,
            backgroundColor: bloxTokens.deepGreen,
            color: bloxTokens.emerald,
            '&:hover': { backgroundColor: bloxTokens.deepGreenDark },
          }}
        >
          <MenuIcon />
        </IconButton>
      )}
      <Drawer
        variant="permanent"
        open={!collapsed}
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            boxSizing: 'border-box',
            background: `linear-gradient(180deg, ${bloxTokens.deepGreenDark} 0%, ${bloxTokens.deepGreen} 100%)`,
            color: '#fff',
            overflow: 'hidden',
            transition: 'width 0.3s ease',
            display: { xs: collapsed ? 'none' : 'flex' },
            border: 'none',
          },
        }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
          <Box
            sx={{
              px: 2,
              py: 1.75,
              borderBottom: '1px solid rgba(255,255,255,0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 1,
              minHeight: 72,
            }}
          >
            <Box
              onClick={() => navigate(nav[0]?.to ?? '/')}
              sx={{
                cursor: 'pointer',
                flex: 1,
                minWidth: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: collapsed ? 'center' : 'flex-start',
                justifyContent: 'center',
              }}
            >
              <BloxLogo height={collapsed ? 22 : 28} tone="onDark" />
              {!collapsed && (
                <Typography
                  variant="caption"
                  component="span"
                  className="blox-shell-portal-badge"
                  sx={{
                    display: 'block',
                    mt: 0.5,
                    color: bloxTokens.emerald,
                    letterSpacing: 1,
                    textTransform: 'uppercase',
                    fontWeight: 600,
                    fontSize: '0.6875rem',
                  }}
                >
                  {title}
                </Typography>
              )}
            </Box>
            <IconButton
              onClick={() => setCollapsed((v) => !v)}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              sx={{
                flexShrink: 0,
                color: '#fff',
                backgroundColor: 'rgba(255,255,255,0.1)',
                width: 32,
                height: 32,
                ...(collapsed && { mx: 'auto' }),
              }}
            >
              {collapsed ? <ChevronRight fontSize="small" /> : <ChevronLeft fontSize="small" />}
            </IconButton>
          </Box>
          <List sx={{ flex: 1, py: 1 }}>
            {nav.map((item) => {
              const active = isActive(item.to);
              return (
                <ListItem key={item.to} disablePadding>
                  <ListItemButton
                    className={`menu-item${active ? ' active' : ''}`}
                    onClick={() => {
                      navigate(item.to);
                      if (isMobile) setCollapsed(true);
                    }}
                    sx={{
                      mx: 1,
                      my: 0.25,
                      borderRadius: 1,
                      color: active ? bloxTokens.emerald : 'rgba(255,255,255,0.9)',
                      backgroundColor: active ? 'rgba(0,207,162,0.18)' : 'transparent',
                      boxShadow: active ? `inset 3px 0 0 ${bloxTokens.emerald}` : 'none',
                      justifyContent: collapsed ? 'center' : 'flex-start',
                      transition: `background var(--blox-motion-fast) var(--blox-ease-standard), transform var(--blox-motion-fast) var(--blox-ease-standard)`,
                      '&:hover': {
                        backgroundColor: active ? 'rgba(0,207,162,0.22)' : 'rgba(255,255,255,0.08)',
                        transform: collapsed ? 'none' : 'translateX(4px)',
                      },
                    }}
                  >
                    <ListItemIcon sx={{ color: 'inherit', minWidth: collapsed ? 0 : 40 }}>
                      {navIcon(item.icon)}
                    </ListItemIcon>
                    {!collapsed && <ListItemText primary={item.label} />}
                  </ListItemButton>
                </ListItem>
              );
            })}
          </List>
          <Box sx={{ p: 1.5, borderTop: '1px solid rgba(255,255,255,0.2)' }}>
            <ShellNotifications
              collapsed={collapsed}
              onNavigated={() => {
                if (isMobile) setCollapsed(true);
              }}
            />
            {!collapsed && (
              <Box sx={{ display: 'flex', justifyContent: 'center', mb: 1, mt: 1 }}>
                <OpsSegmentedControl
                  value={locale}
                  options={[
                    { value: 'en' as AppLocale, label: t('nav.localeEn') },
                    { value: 'ar' as AppLocale, label: t('nav.localeAr') },
                  ]}
                  onChange={setAppLocale}
                  aria-label={t('ops.shell.locale')}
                />
              </Box>
            )}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1, py: 1 }}>
              <Avatar
                sx={{
                  bgcolor: bloxTokens.emerald,
                  color: bloxTokens.deepGreen,
                  width: 36,
                  height: 36,
                  boxShadow: `0 0 0 2px rgba(255,255,255,0.25), 0 0 0 3px ${bloxTokens.emerald}`,
                }}
              >
                {(user?.full_name || user?.email || 'U').charAt(0).toUpperCase()}
              </Avatar>
              {!collapsed && (
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>
                    {user?.full_name || 'User'}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.75)', display: 'block' }} noWrap>
                    {user?.email}
                  </Typography>
                  {user?.role && (
                    <Typography
                      variant="caption"
                      component="span"
                      sx={{
                        display: 'inline-block',
                        mt: 0.5,
                        px: 1,
                        py: 0.25,
                        borderRadius: 999,
                        bgcolor: 'rgba(0,207,162,0.16)',
                        color: bloxTokens.emerald,
                        fontSize: '0.625rem',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                      }}
                    >
                      {user.role.replace(/_/g, ' ')}
                    </Typography>
                  )}
                </Box>
              )}
            </Box>
            <Divider sx={{ borderColor: 'rgba(255,255,255,0.2)', my: 0.5 }} />
            <ListItemButton onClick={() => void signOut()} sx={{ borderRadius: 1, '&:hover': { bgcolor: 'rgba(255,255,255,0.08)' } }}>
              <ListItemIcon sx={{ color: 'rgba(255,255,255,0.8)', minWidth: collapsed ? 0 : 40 }}>
                <Logout fontSize="small" />
              </ListItemIcon>
              {!collapsed && <ListItemText primary={t('ops.shell.signOut')} />}
            </ListItemButton>
          </Box>
        </Box>
      </Drawer>
      <Box
        component="main"
        className="blox-shell-main"
        sx={{
          flex: 1,
          minWidth: 0,
          background: 'transparent',
        }}
      >
        <Box sx={{ maxWidth: 'var(--bp-content-max, 1600px)', mx: 'auto' }}>{children}</Box>
      </Box>
    </Box>
  );
}

export { BloxShell as OpsShell };

/** Wraps an entire ops portal (including auth) so teal tokens apply outside BloxShell. */
export function OpsAppFrame({ children }: { children: ReactNode }) {
  return (
    <div className="blox-ops blox-ops-app-wrapper">
      {children}
    </div>
  );
}
