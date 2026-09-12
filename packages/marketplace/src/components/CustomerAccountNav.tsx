import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const ACCOUNT_LINKS = [
  { to: '/app/dashboard', end: true, labelKey: 'nav.account' },
  { to: '/app/applications', end: false, labelKey: 'application.title' },
  { to: '/app/calendar', end: true, labelKey: 'calendar.shortcut' },
  { to: '/app/profile', end: true, labelKey: 'customerProfile.title' },
  { to: '/app/consents', end: true, labelKey: 'consentCentre.pageTitle' },
  {
    to: '/app/notifications',
    end: true,
    labelKey: 'notifications.title',
    defaultValue: 'Notifications',
  },
] as const;

export function CustomerAccountNav() {
  const { t } = useTranslation();

  return (
    <nav className="dm-account-nav" aria-label={t('nav.account')}>
      {ACCOUNT_LINKS.map((link) => (
        <NavLink
          key={link.to}
          to={link.to}
          end={link.end}
          className={({ isActive }) => (isActive ? 'is-active' : undefined)}
        >
          {'defaultValue' in link
            ? t(link.labelKey, { defaultValue: link.defaultValue })
            : t(link.labelKey)}
        </NavLink>
      ))}
    </nav>
  );
}
