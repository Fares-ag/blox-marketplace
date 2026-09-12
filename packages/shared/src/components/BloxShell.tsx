import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Avatar, Badge, Box, Divider, Drawer, IconButton, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Menu, MenuItem, Typography, useMediaQuery } from '@mui/material';
import {
  BadgePercent,
  Bell,
  BookOpen,
  Building2,
  Car,
  ChevronLeft,
  ChevronRight,
  FileText,
  Landmark,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Menu as MenuIcon,
  Package,
  Receipt,
  ScrollText,
  Search,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Tag,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useAuthStore } from '../auth/auth-store';
import { getAppLocale, setAppLocale } from '../i18n';
import { apiFetch } from '../lib/api';
import type { NotificationItem, PaginatedResponse } from '../types/domain';
import { theme } from '../config/theme';
import { bloxTokens } from '../config/blox-tokens';
import { BloxLogo } from './BloxLogo';
import { usePortalBasePath, withPortalBase } from '../ops-ui-v2/PortalBasePath';
import '../styles/blox-ops.scss';

/**
 * BloxShell — Phase 1 §10. Sidebar is navigation only (groups, counts, active rail);
 * identity, notifications, search and language live in a 56px top bar so every page
 * shares the same top edge. MUI is used here for chrome only (drawers, menu, badge);
 * icons are lucide (consistent 1.75px stroke set).
 */
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
  /** Optional group label; consecutive items with the same group render under one heading. */
  group?: string;
  /** Optional count capsule (queue size, pending transfers). */
  count?: number;
}

interface BloxShellProps {
  title: string;
  nav: BloxNavItem[];
  children: ReactNode;
  homePaths?: string[];
  /** Replaces the default breadcrumb (active nav label). */
  breadcrumb?: ReactNode;
  /** When set, the top bar shows a search box that navigates to `${searchPath}?q=…`. */
  searchPath?: string;
}

const EXPANDED = 280;
const COLLAPSED = 72;
const TYPING_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

const NAV_ICONS: Record<NonNullable<BloxNavItem['icon']>, LucideIcon> = {
  home: LayoutDashboard,
  inventory: Car,
  products: Car,
  apps: FileText,
  queue: ListChecks,
  company: Building2,
  quotes: Receipt,
  offers: Tag,
  users: Users,
  logs: ScrollText,
  system: Settings2,
  finance: Landmark,
  ledgers: BookOpen,
  promotions: BadgePercent,
  insurance: ShieldCheck,
  packages: Package,
  settings: SlidersHorizontal,
};

function NavIcon({ kind }: { kind?: BloxNavItem['icon'] }) {
  const Icon = (kind && NAV_ICONS[kind]) || FileText;
  return <Icon size={18} strokeWidth={1.75} aria-hidden />;
}

function groupNav(nav: BloxNavItem[]): Array<{ label?: string; items: BloxNavItem[] }> {
  const groups: Array<{ label?: string; items: BloxNavItem[] }> = [];
  for (const item of nav) {
    const last = groups[groups.length - 1];
    if (last && last.label === item.group) last.items.push(item);
    else groups.push({ label: item.group, items: [item] });
  }
  return groups;
}

function useNotifications(enabled: boolean, open: boolean) {
  const qc = useQueryClient();
  const unread = useQuery({
    queryKey: ['shell-notifications-unread'],
    queryFn: () => apiFetch<{ count: number }>('/api/notifications/unread-count'),
    enabled,
    staleTime: 60_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: false,
  });
  const list = useQuery({
    queryKey: ['shell-notifications'],
    queryFn: () => apiFetch<PaginatedResponse<NotificationItem>>('/api/notifications?limit=20'),
    enabled: enabled && open,
  });
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['shell-notifications'] });
    void qc.invalidateQueries({ queryKey: ['shell-notifications-unread'] });
  };
  const markRead = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/notifications/${id}/read`, { method: 'PATCH' }),
    onSuccess: invalidate,
  });
  const markAllRead = useMutation({
    mutationFn: async (ids: string[]) => {
      await Promise.all(ids.map((id) => apiFetch(`/api/notifications/${id}/read`, { method: 'PATCH' })));
    },
    onSuccess: invalidate,
  });
  return { count: unread.data?.count ?? 0, items: list.data?.items ?? [], loading: list.isLoading, markRead, markAllRead };
}

export function BloxShell({ title, nav, children, homePaths = ['/'], breadcrumb, searchPath }: BloxShellProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);
  const { t } = useTranslation();
  const locale = getAppLocale();
  const rtl = locale === 'ar';
  const portalBase = usePortalBasePath();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isNarrowDesktop = useMediaQuery('(max-width: 1200px)');
  const [collapsed, setCollapsed] = useState(isNarrowDesktop);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifFilter, setNotifFilter] = useState<'all' | 'unread'>('all');
  const [accountEl, setAccountEl] = useState<HTMLElement | null>(null);
  const [globalQuery, setGlobalQuery] = useState('');

  useEffect(() => {
    setCollapsed(isNarrowDesktop);
  }, [isNarrowDesktop]);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const notifications = useNotifications(!!user, notifOpen);

  /** Longest matching nav path wins — avoids /applications and /applications/new both active. */
  const activeNavPath = useMemo(() => {
    function matches(pathname: string, navPath: string): boolean {
      if (homePaths.includes(navPath)) {
        return pathname === navPath || (navPath !== '/' && pathname.startsWith(`${navPath}/`));
      }
      if (navPath === '/') return pathname === '/';
      return pathname === navPath || pathname.startsWith(`${navPath}/`);
    }
    const hits = nav.filter((item) => matches(location.pathname, item.to));
    if (hits.length === 0) return null;
    return hits.reduce((best, item) => (item.to.length > best.to.length ? item : best)).to;
  }, [nav, location.pathname, homePaths]);

  function isActive(path: string) {
    return path === activeNavPath;
  }

  const activeItem = useMemo(() => nav.find((item) => item.to === activeNavPath), [nav, activeNavPath]);
  const groups = useMemo(() => groupNav(nav), [nav]);

  // Keyboard: "[" toggles the sidebar, "n" opens notifications, "/" focuses global search, Esc closes drawers.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (TYPING_TAGS.has(target?.tagName ?? '') || target?.isContentEditable) return;
      if (e.key === '[' && !isMobile) setCollapsed((v) => !v);
      if (e.key === 'n' && !e.metaKey && !e.ctrlKey) setNotifOpen(true);
      if (e.key === '/' && searchPath && !document.querySelector('.blox-search__input')) {
        e.preventDefault();
        document.querySelector<HTMLInputElement>('.blox-topbar__search input')?.focus();
      }
      if (e.key === 'Escape') {
        setNotifOpen(false);
        setMobileOpen(false);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isMobile, searchPath]);

  const drawerWidth = collapsed ? COLLAPSED : EXPANDED;
  const sideCollapsed = collapsed && !isMobile;
  const visibleItems = notifFilter === 'unread' ? notifications.items.filter((n) => !n.read_at) : notifications.items;
  const unreadIds = notifications.items.filter((n) => !n.read_at).map((n) => n.id);

  function openNotification(item: NotificationItem) {
    if (!item.read_at) notifications.markRead.mutate(item.id);
    setNotifOpen(false);
    if (item.link_path) navigate(withPortalBase(item.link_path, portalBase));
  }

  function submitSearch(e: FormEvent) {
    e.preventDefault();
    if (!searchPath) return;
    const q = globalQuery.trim();
    navigate(`${withPortalBase(searchPath, portalBase)}${q ? `?q=${encodeURIComponent(q)}` : ''}`);
  }

  const sidebar = (
    <Box className="blox-side" sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <Box className={`blox-side__head${sideCollapsed ? ' is-collapsed' : ''}`}>
        <Box
          className="blox-side__brand"
          onClick={() => navigate(nav[0]?.to ?? '/')}
          role="link"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter') navigate(nav[0]?.to ?? '/');
          }}
        >
          <BloxLogo height={sideCollapsed ? 22 : 26} tone="onDark" />
          {!sideCollapsed && <span className="blox-side__portal">{title}</span>}
        </Box>
        {isMobile ? (
          <IconButton onClick={() => setMobileOpen(false)} aria-label={t('ops.shell.closeMenu')} className="blox-side__toggle">
            <X size={16} />
          </IconButton>
        ) : (
          <IconButton
            onClick={() => setCollapsed((v) => !v)}
            aria-label={collapsed ? t('ops.shell.expand') : t('ops.shell.collapse')}
            title={`${collapsed ? t('ops.shell.expand') : t('ops.shell.collapse')} ( [ )`}
            className="blox-side__toggle"
          >
            {collapsed !== rtl ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </IconButton>
        )}
      </Box>
      <List sx={{ flex: 1, py: 1, overflowY: 'auto', overflowX: 'hidden' }}>
        {groups.map((group, gi) => (
          <li key={`${group.label ?? 'ungrouped'}-${gi}`} className="blox-side__group">
            {group.label && !sideCollapsed && <span className="blox-side__group-label">{group.label}</span>}
            {group.label && sideCollapsed && gi > 0 && <Divider className="blox-side__group-rule" />}
            <ul className="blox-side__list">
              {group.items.map((item) => {
                const active = isActive(item.to);
                return (
                  <ListItem key={item.to} disablePadding>
                    <ListItemButton
                      disableRipple
                      className={`menu-item blox-side__item${active ? ' active' : ''}${sideCollapsed ? ' is-collapsed' : ''}`}
                      onClick={() => {
                        navigate(item.to);
                        if (isMobile) setMobileOpen(false);
                      }}
                      aria-current={active ? 'page' : undefined}
                      title={sideCollapsed ? item.label : undefined}
                    >
                      <ListItemIcon className="blox-side__icon">
                        <NavIcon kind={item.icon} />
                      </ListItemIcon>
                      {!sideCollapsed && <ListItemText primary={item.label} className="blox-side__label" />}
                      {item.count !== undefined && item.count > 0 && (
                        <span className={`blox-side__count${sideCollapsed ? ' is-collapsed' : ''}`}>
                          {item.count > 99 ? '99+' : item.count}
                        </span>
                      )}
                    </ListItemButton>
                  </ListItem>
                );
              })}
            </ul>
          </li>
        ))}
      </List>
    </Box>
  );

  const drawerPaperSx = {
    width: isMobile ? EXPANDED : drawerWidth,
    boxSizing: 'border-box' as const,
    background: bloxTokens.deepGreenDark,
    color: '#fff',
    overflow: 'hidden',
    transition: 'width 0.2s ease',
    border: 'none',
    boxShadow: 'none',
  };

  return (
    <Box className="blox-ops side-panel blox-shell" sx={{ display: 'flex', minHeight: '100vh', background: 'transparent' }}>
      {isMobile ? (
        <Drawer
          variant="temporary"
          anchor={rtl ? 'right' : 'left'}
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{ '& .MuiDrawer-paper': drawerPaperSx }}
        >
          {sidebar}
        </Drawer>
      ) : (
        <Drawer
          variant="permanent"
          anchor={rtl ? 'right' : 'left'}
          open
          sx={{ width: drawerWidth, flexShrink: 0, '& .MuiDrawer-paper': drawerPaperSx }}
        >
          {sidebar}
        </Drawer>
      )}

      <Box component="div" className="blox-shell__column" sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <header className="blox-topbar">
          {isMobile && (
            <IconButton onClick={() => setMobileOpen(true)} aria-label={t('ops.shell.menu')} className="blox-topbar__ibtn">
              <MenuIcon size={18} />
            </IconButton>
          )}
          <nav className="blox-topbar__crumb" aria-label="Breadcrumb">
            {breadcrumb ?? (
              <>
                <span className="blox-topbar__crumb-portal">{title}</span>
                {activeItem && (
                  <>
                    <span className="blox-topbar__crumb-sep" aria-hidden>
                      ›
                    </span>
                    <b>{activeItem.label}</b>
                  </>
                )}
              </>
            )}
          </nav>
          <div className="blox-topbar__right">
            {searchPath && !isMobile && (
              <form className="blox-topbar__search" role="search" onSubmit={submitSearch}>
                <Search size={15} strokeWidth={1.75} aria-hidden />
                <input
                  type="search"
                  value={globalQuery}
                  onChange={(e) => setGlobalQuery(e.target.value)}
                  placeholder={t('ops.shell.searchPlaceholder')}
                  aria-label={t('ops.shell.search')}
                />
                <kbd aria-hidden>/</kbd>
              </form>
            )}
            {searchPath && isMobile && (
              <IconButton
                onClick={() => navigate(withPortalBase(searchPath, portalBase))}
                aria-label={t('ops.shell.search')}
                className="blox-topbar__ibtn"
              >
                <Search size={18} strokeWidth={1.75} />
              </IconButton>
            )}
            <IconButton
              onClick={() => setNotifOpen(true)}
              aria-label={t('ops.shell.notifications')}
              title={`${t('ops.shell.notifications')} ( n )`}
              className="blox-topbar__ibtn"
            >
              <Badge badgeContent={notifications.count} color="error" max={99} overlap="circular">
                <Bell size={18} strokeWidth={1.75} />
              </Badge>
            </IconButton>
            {!isMobile && (
              <span className="blox-segmented blox-segmented--light blox-topbar__locale" role="group" aria-label={t('ops.shell.locale')}>
                <button type="button" className={locale === 'en' ? 'is-active' : undefined} onClick={() => setAppLocale('en')}>
                  {t('nav.localeEn')}
                </button>
                <button type="button" className={locale === 'ar' ? 'is-active' : undefined} onClick={() => setAppLocale('ar')}>
                  {t('nav.localeAr')}
                </button>
              </span>
            )}
            <button
              type="button"
              className="blox-identity"
              onClick={(e) => setAccountEl(e.currentTarget)}
              aria-label={t('ops.shell.account')}
              aria-haspopup="menu"
              aria-expanded={Boolean(accountEl)}
            >
              <Avatar className="blox-avatar">{(user?.full_name || user?.email || 'U').charAt(0).toUpperCase()}</Avatar>
              {!isMobile && (
                <span className="blox-identity__copy">
                  <b>{user?.full_name || user?.email || 'User'}</b>
                  {user?.role && <small>{user.role.replace(/_/g, ' ')}</small>}
                </span>
              )}
            </button>
            <Menu
              anchorEl={accountEl}
              open={Boolean(accountEl)}
              onClose={() => setAccountEl(null)}
              anchorOrigin={{ vertical: 'bottom', horizontal: rtl ? 'left' : 'right' }}
              transformOrigin={{ vertical: 'top', horizontal: rtl ? 'left' : 'right' }}
              slotProps={{ paper: { className: 'blox-account-menu' } }}
            >
              <li className="blox-account-menu__head">
                <Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>
                  {user?.full_name || 'User'}
                </Typography>
                <Typography variant="caption" noWrap sx={{ display: 'block', color: 'var(--blox-slate)' }}>
                  {user?.email}
                </Typography>
                {user?.role && <span className="blox-account-menu__role">{user.role.replace(/_/g, ' ')}</span>}
              </li>
              {isMobile && (
                <li className="blox-account-menu__locale">
                  <span className="blox-segmented blox-segmented--light" role="group" aria-label={t('ops.shell.locale')}>
                    <button type="button" className={locale === 'en' ? 'is-active' : undefined} onClick={() => setAppLocale('en')}>
                      {t('nav.localeEn')}
                    </button>
                    <button type="button" className={locale === 'ar' ? 'is-active' : undefined} onClick={() => setAppLocale('ar')}>
                      {t('nav.localeAr')}
                    </button>
                  </span>
                </li>
              )}
              <Divider />
              <MenuItem
                onClick={() => {
                  setAccountEl(null);
                  void signOut();
                }}
              >
                <ListItemIcon>
                  <LogOut size={16} strokeWidth={1.75} />
                </ListItemIcon>
                {t('ops.shell.signOut')}
              </MenuItem>
            </Menu>
          </div>
        </header>

        <Box component="main" className="blox-shell-main" sx={{ flex: 1, minWidth: 0, background: 'transparent' }}>
          <Box sx={{ maxWidth: 'var(--bp-content-max, 1600px)', mx: 'auto' }}>{children}</Box>
        </Box>
      </Box>

      <Drawer
        anchor={rtl ? 'left' : 'right'}
        open={notifOpen}
        onClose={() => setNotifOpen(false)}
        sx={{ '& .MuiDrawer-paper': { width: 380, maxWidth: '100vw', boxSizing: 'border-box' } }}
      >
        <div className="blox-ndrawer">
          <div className="blox-ndrawer__head">
            <b>{t('ops.shell.notifications')}</b>
            {notifications.count > 0 && (
              <span className="blox-ndrawer__unread">{t('ops.shell.notificationsUnread', { count: notifications.count })}</span>
            )}
            <div className="blox-ndrawer__head-actions">
              {unreadIds.length > 0 && (
                <button
                  type="button"
                  className="blox-btn blox-btn--ghost blox-btn--sm"
                  disabled={notifications.markAllRead.isPending}
                  onClick={() => notifications.markAllRead.mutate(unreadIds)}
                >
                  {t('ops.shell.markAllRead')}
                </button>
              )}
              <IconButton size="small" onClick={() => setNotifOpen(false)} aria-label={t('ops.shell.closeMenu')}>
                <X size={16} />
              </IconButton>
            </div>
          </div>
          <div className="blox-ndrawer__filters">
            <span className="blox-segmented blox-segmented--light" role="group">
              <button type="button" className={notifFilter === 'all' ? 'is-active' : undefined} onClick={() => setNotifFilter('all')}>
                {t('ops.shell.all')}
              </button>
              <button type="button" className={notifFilter === 'unread' ? 'is-active' : undefined} onClick={() => setNotifFilter('unread')}>
                {t('ops.shell.unread')}
              </button>
            </span>
          </div>
          <div className="blox-ndrawer__list">
            {notifications.loading ? (
              <p className="blox-ndrawer__empty">{t('ops.shell.notificationsLoading')}</p>
            ) : visibleItems.length === 0 ? (
              <p className="blox-ndrawer__empty">{t('ops.shell.notificationsEmpty')}</p>
            ) : (
              visibleItems.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  className={`blox-ndrawer__item${item.read_at ? ' is-read' : ''}`}
                  onClick={() => openNotification(item)}
                >
                  <span className="blox-ndrawer__dot" aria-hidden />
                  <span className="blox-ndrawer__text">
                    <b>{item.title}</b>
                    {item.body && <span className="blox-ndrawer__body">{item.body}</span>}
                  </span>
                  <span className="blox-ndrawer__when">
                    {new Date(item.created_at).toLocaleString(rtl ? 'ar-QA' : 'en-QA', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      </Drawer>
    </Box>
  );
}

export { BloxShell as OpsShell };

/** Wraps an entire ops portal (including auth) so teal tokens apply outside BloxShell. */
export function OpsAppFrame({ children }: { children: ReactNode }) {
  return <div className="blox-ops blox-ops-app-wrapper">{children}</div>;
}
