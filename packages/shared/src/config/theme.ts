import { createTheme } from '@mui/material/styles';
import { bloxElevation, bloxTokens } from './blox-tokens';

const shadowScale = [
  'none',
  '0 1px 2px 0 rgba(22, 83, 91, 0.05)',
  '0 1px 3px 0 rgba(22, 83, 91, 0.08), 0 1px 2px -1px rgba(22, 83, 91, 0.04)',
  '0 4px 6px -1px rgba(22, 83, 91, 0.08), 0 2px 4px -2px rgba(22, 83, 91, 0.04)',
  '0 10px 15px -3px rgba(22, 83, 91, 0.1), 0 4px 6px -4px rgba(22, 83, 91, 0.05)',
  '0 20px 25px -5px rgba(22, 83, 91, 0.1), 0 8px 10px -6px rgba(22, 83, 91, 0.05)',
  ...Array(19).fill('0 20px 25px -5px rgba(22, 83, 91, 0.1), 0 8px 10px -6px rgba(22, 83, 91, 0.05)'),
] as unknown as typeof createTheme extends (...args: infer A) => infer R ? R extends { shadows: infer S } ? S : never : never;

export const theme = createTheme({
  palette: {
    primary: {
      main: bloxTokens.emerald,
      dark: bloxTokens.deepGreenDark,
      light: bloxTokens.emeraldSoft,
      contrastText: bloxTokens.deepGreen,
    },
    secondary: {
      main: bloxTokens.deepGreen,
      dark: bloxTokens.deepGreenDark,
      light: bloxTokens.slate,
      contrastText: bloxTokens.canvas,
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
    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    h1: { fontSize: '32px', fontWeight: 700, lineHeight: '40px', letterSpacing: '-0.02em' },
    h2: { fontSize: '28px', fontWeight: 700, lineHeight: '36px', letterSpacing: '-0.02em' },
    h3: { fontSize: '20px', fontWeight: 600, lineHeight: '28px', letterSpacing: '-0.01em' },
    h4: { fontSize: '16px', fontWeight: 600, lineHeight: '24px', letterSpacing: '-0.01em' },
    h5: { fontSize: '14px', fontWeight: 500, lineHeight: '20px' },
    body1: { fontSize: '14px', fontWeight: 400, lineHeight: '22px' },
    body2: { fontSize: '12px', fontWeight: 400, lineHeight: '18px' },
    caption: { fontSize: '11px', fontWeight: 400, lineHeight: '16px' },
  },
  shape: { borderRadius: 12 },
  shadows: shadowScale as never,
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontFamily: '"Inter", sans-serif',
          fontSize: '15px',
          fontWeight: 500,
          letterSpacing: '-0.01em',
          borderRadius: '10px',
          padding: '10px 20px',
          minHeight: '44px',
          boxShadow: 'none',
          transition: 'all 200ms cubic-bezier(0.4, 0, 0.2, 1)',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: '16px',
          boxShadow: bloxElevation.rest,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: '16px',
          boxShadow: bloxElevation.rest,
          transition: 'all 200ms cubic-bezier(0.4, 0, 0.2, 1)',
          '&:hover': { boxShadow: bloxElevation.hover },
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: '8px',
            minHeight: '48px',
            '& .MuiOutlinedInput-notchedOutline': { borderColor: bloxTokens.border },
            '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: bloxTokens.slate },
            '&.Mui-focused': {
              boxShadow: `0 0 0 2px ${bloxTokens.emerald}`,
              '& .MuiOutlinedInput-notchedOutline': {
                borderColor: bloxTokens.deepGreen,
                borderWidth: '2px',
              },
            },
          },
        },
      },
    },
    MuiCheckbox: {
      styleOverrides: {
        root: {
          color: bloxTokens.slate,
          '&.Mui-checked': { color: bloxTokens.deepGreen },
        },
      },
    },
    MuiRadio: {
      styleOverrides: {
        root: {
          color: bloxTokens.slate,
          '&.Mui-checked': { color: bloxTokens.deepGreen },
        },
      },
    },
    MuiDivider: {
      styleOverrides: {
        root: { borderColor: bloxTokens.border },
      },
    },
    MuiSelect: {
      styleOverrides: {
        root: { minHeight: '48px', borderRadius: '8px' },
      },
    },
  },
});

export const brandColors = {
  primary: bloxTokens.emerald,
  primaryDark: bloxTokens.deepGreenDark,
  bloxBlack: bloxTokens.deepGreen,
  darkGrey: bloxTokens.slate,
  midGrey: bloxTokens.border,
  lightGrey: bloxTokens.canvas,
  background: bloxTokens.canvas,
  cardBackground: bloxTokens.surface,
};
