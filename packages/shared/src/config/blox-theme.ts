import { createTheme } from '@mui/material/styles';
import { bloxTokens } from './blox-tokens';

export const bloxTheme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: bloxTokens.emerald,
      contrastText: bloxTokens.deepGreen,
    },
    secondary: {
      main: bloxTokens.deepGreen,
      contrastText: '#FFFFFF',
    },
    error: {
      main: bloxTokens.danger,
    },
    warning: {
      main: bloxTokens.warning,
    },
    success: {
      main: bloxTokens.emerald,
    },
    background: {
      default: bloxTokens.canvas,
      paper: bloxTokens.surface,
    },
    text: {
      primary: bloxTokens.ink,
      secondary: bloxTokens.slate,
    },
    divider: bloxTokens.border,
  },
  typography: {
    fontFamily: '"IBM Plex Sans", "Segoe UI", sans-serif',
    h1: {
      fontFamily: '"IBM Plex Sans", "Segoe UI", sans-serif',
      fontWeight: 600,
      fontSize: '2rem',
      lineHeight: 1.25,
    },
    h2: {
      fontFamily: '"IBM Plex Sans", "Segoe UI", sans-serif',
      fontWeight: 600,
      fontSize: '1.5rem',
      lineHeight: 1.3,
    },
    h3: {
      fontFamily: '"IBM Plex Sans", "Segoe UI", sans-serif',
      fontWeight: 600,
      fontSize: '1rem',
    },
    body1: { fontSize: '1rem' },
    body2: { fontSize: '0.875rem' },
    caption: { fontSize: '0.75rem' },
    button: {
      textTransform: 'none',
      fontWeight: 600,
      fontSize: '0.875rem',
    },
  },
  shape: { borderRadius: 10 },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: bloxTokens.canvas,
          color: bloxTokens.ink,
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          minHeight: 40,
        },
      },
    },
  },
});

declare module '@mui/material/styles' {
  interface Theme {
    blox: {
      cta: string;
      ctaText: string;
      deepGreen: string;
    };
  }
  interface ThemeOptions {
    blox?: {
      cta?: string;
      ctaText?: string;
      deepGreen?: string;
    };
  }
}

export const bloxThemeWithBrand = createTheme(bloxTheme, {
  blox: {
    cta: bloxTokens.lime,
    ctaText: bloxTokens.deepGreen,
    deepGreen: bloxTokens.deepGreen,
  },
});
