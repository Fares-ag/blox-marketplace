import { useEffect, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Avatar,
  Box,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
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
  People,
  ReceiptLong,
  RequestQuote,
  Settings,
  Shield,
} from '@mui/icons-material';
import { useAuthStore } from '../auth/auth-store';
import { getAppLocale, setAppLocale, type AppLocale } from '../i18n';
import { theme } from '../config/theme';
import { bloxTokens } from '../config/blox-tokens';
import { BloxLogo } from './BloxLogo';
import { OpsSegmentedControl } from '../ops-ui-v2/OpsSegmentedControl';
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
            overflowX: 'hidden',
            transition: 'width 0.3s ease',
            display: { xs: collapsed ? 'none' : 'flex' },
          },
        }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <Box sx={{ p: 2, position: 'relative', borderBottom: '1px solid rgba(255,255,255,0.2)' }}>
            <Box
              onClick={() => navigate(nav[0]?.to ?? '/')}
              sx={{ cursor: 'pointer', display: 'flex', justifyContent: 'center' }}
            >
              <BloxLogo height={collapsed ? 22 : 28} tone="onDark" />
            </Box>
            {!collapsed && (
              <Typography
                variant="caption"
                component="span"
                className="blox-shell-portal-badge"
                sx={{
                  display: 'block',
                  textAlign: 'center',
                  mt: 0.5,
                  color: bloxTokens.emerald,
                  letterSpacing: 1,
                  textTransform: 'uppercase',
                  fontWeight: 600,
                }}
              >
                {title}
              </Typography>
            )}
            <IconButton
              onClick={() => setCollapsed((v) => !v)}
              sx={{
                position: 'absolute',
                top: 8,
                right: collapsed ? '50%' : 8,
                transform: collapsed ? 'translateX(50%)' : 'none',
                color: '#fff',
                backgroundColor: 'rgba(255,255,255,0.1)',
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
            {!collapsed && (
              <Box sx={{ display: 'flex', justifyContent: 'center', mb: 1 }}>
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
