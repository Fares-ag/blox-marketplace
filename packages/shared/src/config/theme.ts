import { createTheme } from '@mui/material/styles';
import { brandTokens } from './brand-tokens';

/** MUI primary = steel (everyday). Amber is custom brand.cta — never MUI default purple. */
export const dmTheme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: brandTokens.steel,
      contrastText: '#FFFFFF',
    },
    secondary: {
      main: brandTokens.graphite900,
      contrastText: '#FFFFFF',
    },
    error: {
      main: brandTokens.danger,
    },
    warning: {
      main: brandTokens.warning,
    },
    success: {
      main: brandTokens.success,
    },
    background: {
      default: brandTokens.canvas,
      paper: brandTokens.surface,
    },
    text: {
      primary: brandTokens.ink,
      secondary: brandTokens.slate600,
    },
  },
  typography: {
    fontFamily: '"Manrope", "Segoe UI", sans-serif',
    h1: {
      fontFamily: '"Fraunces", "Times New Roman", serif',
      fontWeight: 600,
    },
    h2: {
      fontFamily: '"Fraunces", "Times New Roman", serif',
      fontWeight: 600,
    },
    h3: {
      fontFamily: '"Manrope", "Segoe UI", sans-serif',
      fontWeight: 650,
    },
    button: {
      textTransform: 'none',
      fontWeight: 650,
    },
  },
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          minHeight: 40,
        },
        containedPrimary: {
          // Everyday primary uses steel via palette.primary
        },
      },
    },
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: brandTokens.canvas,
          color: brandTokens.ink,
        },
      },
    },
  },
});

declare module '@mui/material/styles' {
  interface Theme {
    brand: {
      cta: string;
      ctaText: string;
      graphite900: string;
    };
  }
  interface ThemeOptions {
    brand?: {
      cta?: string;
      ctaText?: string;
      graphite900?: string;
    };
  }
}

export const dmThemeWithBrand = createTheme(dmTheme, {
  brand: {
    cta: brandTokens.amber,
    ctaText: brandTokens.ink,
    graphite900: brandTokens.graphite900,
  },
});
