import { StrictMode, useEffect, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { CssBaseline, ThemeProvider } from '@mui/material';
import { ToastContainer } from 'react-toastify';
import * as Sentry from '@sentry/react';
import { ScrollToTop } from '../components/ScrollToTop';
import { PortalErrorFallback } from '../components/PortalErrorFallback';
import { useAuthStore } from '../auth/auth-store';
import { theme } from '../config/theme';
import { initAppSentry } from './sentry';
import { createQueryClient } from './query-client';
import { assertApiBaseConfigured } from './api';
import '../i18n';
import 'react-toastify/dist/ReactToastify.css';

export function AuthBootstrap({ children }: { children: ReactNode }) {
  const init = useAuthStore((s) => s.init);
  useEffect(() => {
    void init();
  }, [init]);
  return <>{children}</>;
}

export type MountPortalAppOptions = {
  /** Sentry app tag (e.g. admin, dealer, marketplace). */
  sentryApp: string;
  root: ReactNode;
  /** Mount ScrollToTop inside the router (default true). */
  scrollTop?: boolean;
  /** Run auth store init before rendering children (default false). */
  authBootstrap?: boolean;
};

/** Shared React bootstrap for Blox portal SPAs. Import SCSS in main.tsx before calling. */
export function mountPortalApp({
  sentryApp,
  root,
  scrollTop = true,
  authBootstrap = false,
}: MountPortalAppOptions) {
  assertApiBaseConfigured();
  initAppSentry(sentryApp);
  const queryClient = createQueryClient();
  const app = authBootstrap ? <AuthBootstrap>{root}</AuthBootstrap> : root;

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <Sentry.ErrorBoundary
        fallback={({ error, resetError }) => (
          <PortalErrorFallback error={error} onReset={resetError} />
        )}
      >
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <QueryClientProvider client={queryClient}>
            <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
              {scrollTop && <ScrollToTop />}
              {app}
            </BrowserRouter>
            <ToastContainer position="bottom-center" autoClose={4000} hideProgressBar={false} newestOnTop />
          </QueryClientProvider>
        </ThemeProvider>
      </Sentry.ErrorBoundary>
    </StrictMode>,
  );
}
