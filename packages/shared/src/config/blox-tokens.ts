/** Blox brand tokens for ops portals (admin, dealer, credit, finance, super-admin) */
export const bloxTokens = {
  deepGreen: '#16535B',
  emerald: '#00CFA2',
  /** Aliased to emerald in ops UI — marketplace uses distinct lime elsewhere */
  lime: '#00CFA2',
  slate: '#708090',
  canvas: '#F4F7F7',
  surface: '#FFFFFF',
  ink: '#12383D',
  border: '#D5E0E0',
  deepGreenDark: '#0F3F45',
  emeraldSoft: '#E6FBF5',
  danger: '#B42318',
  warning: '#C47A00',
  success: '#00CFA2',
} as const;

export const bloxSpacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const bloxRadius = {
  sm: 8,
  md: 16,   // card radius
  lg: 20,   // surface/hero radius
} as const;

export const bloxElevation = {
  rest: '0 1px 4px rgba(15, 63, 69, 0.06), 0 1px 2px rgba(15, 63, 69, 0.04)',
  hover: '0 6px 20px rgba(15, 63, 69, 0.10), 0 2px 8px rgba(15, 63, 69, 0.06)',
  modal: '0 24px 48px rgba(15, 63, 69, 0.22), 0 8px 16px rgba(15, 63, 69, 0.1)',
} as const;

export const bloxMotion = {
  fast: '150ms',
  normal: '200ms',
  slow: '300ms',
  ease: 'cubic-bezier(0.4, 0, 0.2, 1)',
} as const;

export const bloxMeta = {
  name: 'Blox',
  tagline: "Own it, don't owe it.",
  logo: {
    nav: '/brand/blox-logo-nav.png',
    light: '/brand/blox-logo.png',
  },
} as const;
