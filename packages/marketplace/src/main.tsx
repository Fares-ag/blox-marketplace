import { mountPortalApp, i18n } from '@drivemarket/shared';
import '@drivemarket/shared/styles/global.scss';
import './styles/blox-marketplace.scss';
import { AppRoutes } from './AppRoutes';

void i18n;

mountPortalApp({
  sentryApp: 'marketplace',
  authBootstrap: true,
  root: <AppRoutes />,
});
