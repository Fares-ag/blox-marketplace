import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { bloxThemeWithBrand, useAuthStore, i18n } from '@drivemarket/shared';
import '@drivemarket/shared/styles/global.scss';
import './styles/blox-marketplace.scss';
import { AppRoutes } from './AppRoutes';

void i18n;

const queryClient = new QueryClient();

function Bootstrap() {
  const init = useAuthStore((s) => s.init);
  useEffect(() => {
    void init();
  }, [init]);
  return <AppRoutes />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={bloxThemeWithBrand}>
        <CssBaseline />
        <BrowserRouter>
          <Bootstrap />
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>,
);
