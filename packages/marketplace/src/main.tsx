import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { dmThemeWithBrand, useAuthStore } from '@drivemarket/shared';
import '@drivemarket/shared/styles/global.scss';
import { AppRoutes } from './AppRoutes';

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
      <ThemeProvider theme={dmThemeWithBrand}>
        <CssBaseline />
        <BrowserRouter>
          <Bootstrap />
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>,
);
